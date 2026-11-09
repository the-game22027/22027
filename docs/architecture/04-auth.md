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
- `provider_subject` is the provider's stable user id (Google `sub`, Facebook user id, X user id) or the verified E.164 number for `PHONE`. Never use email as the key: it can change and is not always provided (X, phone).

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

### 3.4 Phone number

1. `POST /v1/auth/phone/otp {phone}` → normalize to E.164 (`libphonenumber-js`), check country allow-list and rate limits (per number, per IP, per device), generate a 6-digit code with a CSPRNG, store `sha256(code + pepper)` in Redis `otp:signin:{e164}` with TTL (Recommended 5 min) and an attempt counter, and send via the `SmsSender` port.
2. `POST /v1/auth/phone/verify {phone, code}` → constant-time compare, max attempts (Recommended 5) then lock for a cooldown, delete the key on success, then `SignInWithVerifiedIdentity(PHONE, e164)`.
3. **Zero budget:** `ConsoleSmsSender` (logs the code in development only; refuses to start in production). Real SMS costs money in production: a paid provider, or an identity service's phone auth (DEC-26). Also guard against **SMS pumping fraud** (attackers trigger OTPs to premium numbers): country allow-list, per-IP/device limits, and later app attestation (Play Integrity / App Attest, both free).

### 3.5 Identity broker option (DEC-25)

| Option | Pros | Cons |
|---|---|---|
| **A. In-house verification (Recommended)** | No vendor dependency, free, full control, fits the stack | We own security-sensitive code for four providers; phone still needs an SMS vendor |
| B. Firebase Authentication as broker; backend verifies Firebase ID tokens | Social logins handled for us; mature mobile SDKs | Vendor lock-in; phone auth has usage costs beyond a free quota; user records in two places |
| C. Self-hosted broker (Keycloak, Supabase Auth/GoTrue, Ory Kratos) | Free, open source | Another service to run and secure, often heavier than the problem |

Recommendation: **A**, phased (Google → phone with console SMS → Facebook → X). The `SignInWithVerifiedIdentity` boundary means switching to B later only replaces the verification adapters.

## 4. Account linking and duplicates

Rules (Recommended, they protect against account takeover):

1. **No automatic merging by email.** A sign-in with an unknown `(provider, subject)` creates a new user, unless rule 2 applies.
2. **Verified-email hint:** if the provider asserts a *verified* email that matches the verified email of an existing account, respond `409 ACCOUNT_EXISTS_FOR_EMAIL {linkWith: ["GOOGLE"]}` instead of creating a duplicate. This is not user enumeration: the caller has just proven they own that email.
3. **Linking requires two proofs:** an authenticated session (proof of the existing account) plus a fresh credential for the new provider: `POST /v1/me/identities/{provider}`. If that identity already belongs to another user → `409 IDENTITY_ALREADY_LINKED`.
4. **Unlinking** is allowed only if at least one identity remains: `DELETE /v1/me/identities/{identityId}`.
5. **Merging two existing accounts** (both with data) is out of MVP scope: support-assisted, future.
6. **Phone number recycling:** carriers reassign numbers. If a phone identity has not been used for a long time and the account also has a social identity, require the social sign-in to re-confirm (future hardening; documented risk).

## 5. Sessions and tokens

| Token | Format | Lifetime (Recommended) | Storage |
|---|---|---|---|
| Access token | JWT signed with an asymmetric key (`jose`, ES256 or EdDSA, `kid` header for rotation). Claims: `sub` (userId), `sid` (sessionId), `iat`, `exp`, `iss`, `aud` | 15 minutes | Client memory; sent as `Authorization: Bearer` |
| Refresh token | Opaque 256-bit random string; server stores only its SHA-256 hash in `sessions` | 60 days sliding, 180 days absolute | iOS Keychain / Android Keystore (web: httpOnly Secure SameSite cookie, future) |

- **Rotation with reuse detection:** every `POST /v1/auth/refresh` revokes the presented token and issues a new one in the same `family_id`. Presenting an already-rotated token means theft → revoke the whole family and force sign-in.
- **Logout:** revoke the current session. **Logout everywhere:** revoke all sessions for the user.
- **Revoking:** logout and device sign-out revoke the whole family, because refreshing replaces the row and a token or list can hold a rotated id. Every revoke locks the rows first and then updates in a second statement, so a replacement session that a concurrent refresh is committing is revoked too.
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

- **Recovery:** social providers own their recovery. Phone users recover by re-verifying the number. Encourage linking a second identity in the profile UI.
- **Deletion (required by both app stores):** `DELETE /v1/me` (requires a recent sign-in, e.g. token issued in the last 10 minutes, or a re-verification) → `users.status = PENDING_DELETION`, publish `UserDeleted`. Handlers revoke sessions, delete identities, remove friendships, requests and blocks, leave leagues (ownership transfer or archive per DEC-22), and anonymize the profile. Ledger entries, votes and snapshots keep the same `user_id` but show "Deleted user", which keeps leaderboards and prize history consistent. After a grace period (Recommended 30 days, cancellable by signing in), status becomes `DELETED`.
- **Recent sign-in (DEC-50):** measured from the oldest session in the family, i.e. the real sign-in. Token issue time would not work: a silent refresh renews it, so anyone holding a refresh token could pass the check. The mobile app asks the user to sign in with the provider again, then retries.

## 9. Account takeover threat checklist (MVP)

| Threat | Control |
|---|---|
| Forged provider token | Verify signature, `aud`, `iss`, `exp`; Facebook `app_id`; X code exchange server-side with PKCE |
| Account hijack through email-based auto-linking | Never auto-link (§4) |
| OTP brute force | 6 digits, TTL, max attempts, cooldown, per-IP limits |
| SMS pumping | Country allow-list, rate limits, attestation later |
| Stolen refresh token | Rotation + reuse detection + session revocation |
| Token leakage in logs | Redaction rules in pino; no tokens in URLs |
| Session fixation via WebSocket | Token in handshake auth only; re-validation on refresh |
| Credential stuffing | Not applicable (no passwords), which is a deliberate benefit of this provider set |

## 10. Secrets

- Development: `.env` (git-ignored) with provider client IDs/secrets for test apps, JWT signing keys generated locally (`npm run keys:generate`, planned). `.env.example` documents every variable with fake values.
- Configuration is validated at boot (schema); the app refuses to start with missing secrets or with `ConsoleSmsSender` in production.
- Production (later): the host's secret store or an encrypted env file; key rotation through `kid`.
