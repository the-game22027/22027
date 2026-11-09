# 04 — Authentication, Identity, Sessions, Authorization

## 1. Authentication vs authorization

- **Authentication (`auth` module):** proves *who* the caller is. Output: an `AuthContext {userId, sessionId}` attached to the request or socket.
- **Authorization (each owning module):** decides *what* that user may do with a specific resource: ownership (my prediction), relationship (friend's prediction after lock), role (league owner), platform role (admin, future). Rules live in domain policies (`PredictionVisibilityPolicy`, `LeaguePolicy`), never in the `auth` module and never only in the client.

## 2. Identity model

```
users (1) ──< auth_identities (provider, provider_subject)   UQ(provider, provider_subject)
users (1) ──< sessions (rotating refresh tokens, one per device sign-in)
```

- One internal `users.id` is the identity used everywhere. Provider identities are **credentials pointing at a user**, never user records themselves.
- `provider_subject` is the provider's stable user id (Google `sub`, Facebook user id, X user id). Never use email as the key: it can change and is not always provided (X, Facebook).

## 3. Provider flows (A-01: native mobile clients)

All flows end in the same use case: `SignInWithVerifiedIdentity(provider, subject, profileHints)` → find identity → (create user if new) → create session → return tokens.

### 3.1 Google

1. App uses the native Google Sign-In SDK and receives an **ID token** (JWT).
2. `POST /v1/auth/google {idToken}`.
3. Backend verifies with Google's public keys (`google-auth-library` `verifyIdToken`): signature, `iss`, `exp`, and `aud` ∈ our configured client IDs (iOS, Android, web).
4. Subject = `sub`; hints = `email` + `email_verified`, `name`, `picture`.

### 3.2 Facebook

1. App uses the Facebook SDK. Classic login returns a user **access token**. iOS Limited Login returns an **OIDC authentication token** (JWT) instead.
2. `POST /v1/auth/facebook {accessToken | authenticationToken, nonce?}`.
3. Backend verification:
   - access token → Graph API `debug_token` with the app token (check `app_id` = ours, `is_valid`, `user_id`), then `/me?fields=id,name,email`;
   - Limited Login token → verify the JWT against Facebook's published JWKS, check `aud` = our app id and the `nonce` the app generated.
4. Subject = Facebook user id. Email may be missing.

### 3.3 X (Twitter)

1. App runs **OAuth 2.0 Authorization Code with PKCE** in the system browser (`ASWebAuthenticationSession` / Custom Tabs), with `state` and `code_challenge`, redirecting to an app deep link.
2. `POST /v1/auth/x {code, codeVerifier, redirectUri}`.
3. Backend exchanges the code at X's token endpoint (client secret stays server-side), calls the "me" endpoint for the user id/username, then **discards the X access token** (we only need identity).
4. Subject = X user id. Do not rely on email from X.
5. Risk: X developer API access tiers and rate limits change frequently; verify the current free-tier allowance for user lookups before relying on X sign-in at scale (DEC-26).

### 3.4 No phone number sign-in; Sign in with Apple pending (DEC-48)

- **Phone number + SMS code sign-in was removed (ADR-0012):** every SMS costs money, and it adds OTP brute-force and SMS pumping risks. There is no `PHONE` provider, no OTP and no `SmsSender` port.
- **Sign in with Apple (pending, DEC-48):** App Store guideline 4.8 requires it (or an equivalent privacy-focused option) for an iOS app that offers Google, Facebook or X. If accepted, it follows the Google pattern: the native SDK returns an identity token (JWT); `POST /v1/auth/apple {identityToken, nonce}`; the backend verifies it against Apple's JWKS (`iss` = `https://appleid.apple.com`, `aud` = our bundle id, `nonce`). Subject = `sub`. Email can be a private relay address and is sent only on the first sign-in.

### 3.5 Identity broker option (DEC-25)

| Option | Pros | Cons |
|---|---|---|
| **A. In-house verification (Recommended)** | No vendor dependency, free, full control, fits the stack | We own security-sensitive code for three providers (four with Apple, DEC-48) |
| B. Firebase Authentication as broker; backend verifies Firebase ID tokens | Social logins handled for us; mature mobile SDKs | Vendor lock-in; user records in two places |
| C. Self-hosted broker (Keycloak, Supabase Auth/GoTrue, Ory Kratos) | Free, open source | Another service to run and secure, often heavier than the problem |

Recommendation: **A**, phased (Google → Facebook → X). The `SignInWithVerifiedIdentity` boundary means switching to B later only replaces the verification adapters.

## 4. Account linking and duplicates

Rules (Recommended, they protect against account takeover):

1. **No automatic merging by email.** A sign-in with an unknown `(provider, subject)` creates a new user, unless rule 2 applies.
2. **Verified-email hint:** if the provider asserts a *verified* email that matches the verified email of an existing account, respond `409 ACCOUNT_EXISTS_FOR_EMAIL {linkWith: ["GOOGLE"]}` instead of creating a duplicate. This is not user enumeration: the caller has just proven they own that email.
3. **Linking requires two proofs:** an authenticated session (proof of the existing account) plus a fresh credential for the new provider: `POST /v1/me/identities/{provider}`. If that identity already belongs to another user → `409 IDENTITY_ALREADY_LINKED`.
4. **Unlinking** is allowed only if at least one identity remains: `DELETE /v1/me/identities/{identityId}`.
5. **Merging two existing accounts** (both with data) is out of MVP scope: support-assisted, future.

## 5. Sessions and tokens

| Token | Format | Lifetime (Recommended) | Storage |
|---|---|---|---|
| Access token | JWT signed with an asymmetric key (`jose`, ES256 or EdDSA, `kid` header for rotation). Claims: `sub` (userId), `sid` (sessionId), `iat`, `exp`, `iss`, `aud` | 15 minutes | Client memory; sent as `Authorization: Bearer` |
| Refresh token | Opaque 256-bit random string; server stores only its SHA-256 hash in `sessions` | 60 days sliding, 180 days absolute | iOS Keychain / Android Keystore (web: httpOnly Secure SameSite cookie, future) |

- **Rotation with reuse detection:** every `POST /v1/auth/refresh` revokes the presented token and issues a new one in the same `family_id`. Presenting an already-rotated token means theft → revoke the whole family and force sign-in.
- **Logout:** revoke the current session. **Logout everywhere:** revoke all sessions for the user.
- **Revocation latency:** access tokens are short-lived. Sensitive operations (identity linking, account deletion) re-check `sessions.revoked_at`. WebSocket connections validate the token on connect, are told to re-authenticate before `exp`, and are force-disconnected when their session is revoked (in-process signal now; Redis pub/sub when multi-instance).
- **Session list:** `GET /v1/auth/sessions` shows device, platform, last used; users can revoke any.

## 6. WebSocket authentication

- Socket.IO handshake `auth: {token}` (not query string: query strings end up in logs).
- `WsAuthGuard` verifies the JWT at connection; the socket stores `{userId, sessionId}`; expired tokens get `auth:expired` and the client sends `auth:refresh {token}` with a new access token without reconnecting.
- Every inbound message is validated (schema + participant check) regardless of a valid connection.

## 7. Authorization model

- **Global guard:** `JwtAuthGuard` on everything; `@Public()` opt-out for auth endpoints and health checks.
- **Resource policies** in the application layer, by module: ownership checks (sessions, predictions), `PredictionVisibilityPolicy`, `LeaguePolicy` (role-based), battle participant checks, room membership and host checks.
- **Platform roles (future):** `user_roles(user_id, role)` with `ADMIN`, `MODERATOR` for the admin dashboard; checked by a `RolesGuard`. Not needed in MVP.
- **User status:** `SUSPENDED`/`PENDING_DELETION` users cannot obtain new tokens; existing sessions are revoked on status change.

## 8. Account recovery and deletion

- **Recovery:** social providers own their recovery. Encourage linking a second identity in the profile UI.
- **Deletion (required by both app stores):** `DELETE /v1/me` (requires a recent sign-in, e.g. token issued in the last 10 minutes, or a re-verification) → `users.status = PENDING_DELETION`, publish `UserDeleted`. Handlers revoke sessions, delete identities, remove friendships, requests and blocks, leave leagues (ownership transfer or archive per DEC-22), and anonymize the profile. Ledger entries, votes and snapshots keep the same `user_id` but show "Deleted user", which keeps leaderboards and prize history consistent. After a grace period (Recommended 30 days, cancellable by signing in), status becomes `DELETED`.

## 9. Account takeover threat checklist (MVP)

| Threat | Control |
|---|---|
| Forged provider token | Verify signature, `aud`, `iss`, `exp`; Facebook `app_id`; X code exchange server-side with PKCE |
| Account hijack through email-based auto-linking | Never auto-link (§4) |
| Stolen refresh token | Rotation + reuse detection + session revocation |
| Token leakage in logs | Redaction rules in pino; no tokens in URLs |
| Session fixation via WebSocket | Token in handshake auth only; re-validation on refresh |
| Credential stuffing, code brute force | Not applicable (no passwords, no one-time codes), which is a deliberate benefit of this provider set |

## 10. Secrets

- Development: `.env` (git-ignored) with provider client IDs/secrets for test apps, JWT signing keys generated locally (`npm run keys:generate`, planned). `.env.example` documents every variable with fake values.
- Configuration is validated at boot (schema); the app refuses to start with missing secrets in production.
- Production (later): the host's secret store or an encrypted env file; key rotation through `kid`.

## 11. P1 implementation notes

- **Signing keys:** ES256. `JWT_PRIVATE_KEY` (PEM, current key) and `JWT_KEY_ID`; verification also accepts `JWT_PREVIOUS_PUBLIC_KEY` during a rotation. `npm run keys:generate` writes a fresh pair into the local `.env`. Tests generate keys at runtime. `JWT_ISSUER`, `JWT_AUDIENCE` and token lifetimes are config.
- **Google config:** `GOOGLE_CLIENT_IDS` (comma-separated: Android, iOS, web). The verifier takes its JWKS source and issuer from config, so tests sign Google-shaped ID tokens with a local key and exercise the real verification code.
- **Fake sign-in (dev and test only):** `POST /v1/_dev/auth/sign-in {subject, displayName?}` → `SignInWithVerifiedIdentity(GOOGLE, "dev:" + subject)`. Lives in the dev module, so it is absent in production (same switch as `/v1/_dev/*`). Lets the mobile app sign in before Google OAuth clients exist.
- **New user = one transaction:** `users` + `user_profiles` + `user_privacy_settings` + `auth_identities` + first `sessions` row. Display name from the provider hint, else a generated `Player-xxxx`.
- **Refresh:** lock the presented session row (`SELECT … FOR UPDATE`) so two parallel refreshes with the same token cannot both succeed; the loser sees a rotated token and the family is revoked.
- **Deletion in P1:** `DELETE /v1/me` sets `PENDING_DELETION`, revokes all sessions and writes a `UserDeletionRequested` outbox event. Signing in during the grace period cancels it (status back to `ACTIVE`). Anonymization and finalization arrive with the modules that own the data (P12 end-to-end).
