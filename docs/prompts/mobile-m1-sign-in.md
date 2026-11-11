# Agent Prompt — M1: Mobile sign-in and profile (Flutter)

> Self-contained prompt for a coding agent. It assumes no access to prior conversations. Copy everything below the line.

---

## Context

You are working on the mobile app of a **football social gaming platform**. Players predict match results, vote for the Man of the Match, and play real-time football trivia battles. The backend is a NestJS modular monolith in the same monorepo (`apps/backend`); the Flutter app is in `apps/mobile`.

M0 (merged) built the app foundation:
- flavors and config;
- a REST client generated from the backend's OpenAPI document;
- Dio with request headers, a bearer token and problem+json error mapping;
- secure token storage and a Riverpod session controller;
- go_router with a session guard;
- Arabic/English with RTL;
- a **dev-only** sign-in.

**This phase (M1 in `docs/ROADMAP.md`) makes sign-in real:** refresh-token rotation, Google sign-in, the sessions list, profile editing and account deletion. All the backend endpoints already exist (backend phase P1).

You work in the **git worktree** `the-game-mobile/`, on a new branch `feat/m1-mobile-sign-in` from `main`. A second Claude session works on the backend in another worktree. Read `CLAUDE.md` §7.1 for the ownership rules.

Read these before writing code:
- `CLAUDE.md`, especially §2, §5 (mobile conventions, clear function names), §7 (teach while building) and §7.1.
- `docs/adr/0017-mobile-session-refresh-and-google-sign-in.md`: **the design for this phase**. Follow it.
- `docs/adr/0014-mobile-foundation.md` and `apps/mobile/README.md` (layout rule: features depend on `core/`, never on each other).
- `docs/architecture/04-auth.md`: §3.1 (Google), §4 (account linking, `ACCOUNT_EXISTS_FOR_EMAIL`), §5 (tokens, rotation, reuse detection), §8 (deletion, recent sign-in).
- `docs/api/API.md` §4 (error codes), §5 (`AuthTokens`, `SessionInfo`, `Me`), §6.1, §6.2.
- The M0 code you will change:
  - `lib/core/network/auth_interceptor.dart` and `lib/core/session/access_token_refresher.dart` (the M1 seam);
  - `lib/core/session/session_controller.dart`;
  - `lib/core/l10n/app_language_controller.dart`;
  - `lib/app/router.dart`;
  - `lib/features/auth/`, `lib/features/home/`.

## Constraints

- **Stack (do not change):** Flutter pinned in `apps/mobile/.fvmrc` (run everything through `fvm`), Riverpod (no code generation), go_router, Dio, the generated client in `packages/api_client`.
- **Google sign-in:**
  - use `google_sign_in` **7.x**, initialized with `serverClientId`;
  - **no Firebase**, no `google-services.json`, no other auth SDK (DEC-25: the backend verifies tokens itself).
- **Zero budget:** only free packages and services. Never commit credentials. OAuth client ids are public identifiers and may go in `config/<flavor>.json`; client **secrets** never go in the app.
- **The server is authoritative:**
  - never decide on the device clock that a token is expired: refresh only after a `401` (ADR-0017);
  - never validate username or display-name formats locally beyond "not empty": DEC-49 is pending, so show the server's error codes.
- **Open decisions stay open:**
  - **DEC-49:** username format, server-side only.
  - **DEC-50:** how recent a sign-in must be to delete an account; the server answers `RECENT_SIGN_IN_REQUIRED`.
  - **DEC-52:** application id; keep the `com.example.thegame` placeholder.
  - **DEC-62:** app language vs profile `locale`. Implement the recommended default, with `// TODO(DEC-62)` at the sync point.
  - **Grace period:** do not show a number of days for the deletion grace period; the API does not return one.
- **Ownership:**
  - change only `apps/mobile/**`, `learn/mobile/**` and `.github/workflows/mobile-ci.yml`;
  - small own-line edits are allowed in `CLAUDE.md` §6, `learn/README.md`, `docs/ROADMAP.md` (M1 entry) and ADR-0017 (*Implementation notes* only);
  - **never edit `apps/backend/`, `docs/api/` or `docs/architecture/`.** List contract or backend needs under "Backend requests" in the PR.
- **Backend:** do not start or stop it. The user runs it from the other worktree on `http://localhost:3000`. Never reset the shared database.
- **Layout rule:**
  - only feature `data/` layers call the generated client;
  - the refresh call is an `auth` feature data class that implements the core `AccessTokenRefresher` port and is wired in `main.dart` with a provider override.
- **Clear function names, comments only where the reason is not obvious, every user-facing string in both ARB files, directional layouts.**
- **Commits:** commit after each finished piece (one logical step, Conventional Commits with scope `mobile`), not one commit at the end.

## Scope

1. **Refresh-token rotation (ADR-0017 §1–4)**
   - `core/network`: a second Dio provider for unauthenticated calls (same base URL, timeouts, `RequestHeadersInterceptor` and dev logging, **no** `AuthInterceptor`).
   - `features/auth/data`: `ApiAccessTokenRefresher` implements `AccessTokenRefresher`. It calls `POST /v1/auth/refresh {refreshToken}` with the generated `AuthApi` on that Dio and maps `AuthTokens` to `StoredSession`. Change the port so the interceptor can tell the outcomes apart:
     - **refreshed**: new tokens;
     - **rejected**: `400`, `401` or `403` from the refresh endpoint (`REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_REUSED`, `ACCOUNT_DISABLED` for a suspended account or one pending deletion);
     - **could not reach**: network error, timeout, `429 RATE_LIMITED` or `5xx`, as the matching `AppError`.
   - `AuthInterceptor` on a `401` from a secured route:
     - if the request was sent with an access token that is **not** the current one, retry once with the current token and do not refresh;
     - otherwise refresh;
     - **refreshed**: save the tokens through the session controller **before** retrying the request once;
     - **rejected**: end the session;
     - **could not reach**: keep the session and fail the request with that network error.
   - Remove `NoAccessTokenRefresher` from production wiring; `main.dart` overrides `accessTokenRefresherProvider`.
2. **Google sign-in (ADR-0017 §5)**
   - Add `google_sign_in` 7.x.
   - Config: optional `googleServerClientId` in `config/dev.json` and `config/prod.json`, empty by default. `AppConfig` exposes it. When it is empty, the Google button is disabled and shows "Google sign-in is not set up for this build".
   - `features/auth/data`:
     - a `GoogleIdentityGateway` port with an implementation over `GoogleSignIn.instance` that returns the ID token, or a typed "cancelled by the player" result;
     - `AuthRepository.signInWithGoogle` calls `POST /v1/auth/google {idToken, device}`.
   - The sign-in screen (`/sign-in`, both flavors) gets a "Continue with Google" button. In the dev flavor it also links to the existing dev sign-in. The guard now sends signed-out players to `/sign-in` in **both** flavors; `/dev-sign-in` stays registered only in dev.
   - Errors: cancelling shows nothing; `PROVIDER_TOKEN_INVALID` and `ACCOUNT_DISABLED` show their localized messages.
   - Signing out also calls the Google plugin's `signOut()`, best effort, so the account picker shows next time.
3. **Account screen** (new feature `features/account/`)
   - Reachable from home (app bar button). It groups profile, sessions, delete account and sign out. Move the sign-out button from home to this screen.
4. **Profile editing**
   - Edit `displayName`, `username` (empty clears it: `null`) and `locale` with `PATCH /v1/me`. Send only the changed fields (no unknown fields: the server rejects them with `400`).
   - Show field errors from the problem's `errors[]` next to the field.
   - Map `DISPLAY_NAME_INVALID`, `USERNAME_INVALID` and `USERNAME_TAKEN` to localized messages.
5. **App language and profile locale (DEC-62, recommended default)**
   - Changing the app language while signed in also sends `PATCH /v1/me {locale}`, best effort: a failure is ignored and the local choice stays.
   - After signing in to an existing account, a device that never saved a language adopts the profile `locale`; a new account gets the app language instead (its `locale` is only the server default).
6. **Sessions list**
   - `GET /v1/auth/sessions`: device name, platform, last used (formatted in the app language and the device time zone), and a "This device" badge for `current`.
   - Revoke another session with `DELETE /v1/auth/sessions/{id}` after a confirm dialog.
   - Revoking `current` behaves like sign-out.
7. **Account deletion (ADR-0017 §6)**
   - A confirm dialog explains that every device will be signed out and that signing in again before deletion completes cancels it, **without** a number of days.
   - `DELETE /v1/me` → `202`: end the local session and show the sign-in screen with a "deletion requested" notice.
   - On `403 RECENT_SIGN_IN_REQUIRED`, ask the player to confirm who they are. Run the provider sign-in again (Google; the dev sign-in in the dev flavor), **without** starting a session yet, then compare `AuthTokens.user.id` with the current user id:
     - **same user**: start the session with the new tokens and retry `DELETE /v1/me` once;
     - **different user**: do not store the new tokens, revoke them best effort (`POST /v1/auth/logout` with that access token), keep the current session, and show "That is a different account".
8. **Documentation**
   - `apps/mobile/README.md` gets a "Google sign-in setup" section:
     - OAuth consent screen in testing mode with test users;
     - a web client id → `googleServerClientId`;
     - an Android client per flavor package (`com.example.thegame.dev`, `com.example.thegame`) with the debug SHA-1 (`keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`);
     - the backend's `GOOGLE_CLIENT_IDS` must contain the web client id (that is the user's backend `.env`, not a file you edit).
   - Fill in ADR-0017 *Implementation notes*.
   - Update the `CLAUDE.md` §6 mobile commands only if they change.
   - Learning cards in `learn/mobile/` (format in `learn/README.md`, about 30 lines, linked to real code), added to the `learn/README.md` index with phase `M1`:
     - refresh-token rotation on the client (single-flight and the "token already changed" rule);
     - Google ID-token sign-in on mobile (`serverClientId`, `aud`, why the backend verifies);
     - re-authentication before sensitive actions (and the different-account trap).

## Expected behavior

- An access token expires while the app is open: the next request refreshes once, transparently, and the player notices nothing.
- Three requests fail with `401` at the same time: exactly **one** `POST /v1/auth/refresh` is sent, and all three succeed with the new token.
- The refresh token was revoked (from another device's sessions list) or reused, or the account was suspended: the refresh is rejected (`401` or `403`) and the player lands on sign-in.
- The network drops during a refresh: the request shows "cannot reach the server" and the player stays signed in. When the network is back, the next request refreshes normally.
- The app is killed and reopened days later: still signed in. The first request refreshes.
- "Continue with Google" with a configured client id signs in and lands on home. Cancelling the account picker leaves the sign-in screen without an error. Without a configured client id, the button is disabled with an explanation.
- Profile: a taken username shows the localized `USERNAME_TAKEN` message under the username field. Saving a new display name updates home.
- Sessions: the current device is marked. Revoking another device removes it from the list. Revoking this device signs out.
- Delete account with a fresh sign-in: `202`, signed out, notice shown. With an old sign-in: re-authentication, then `202`. Re-authenticating as a different account deletes nothing and keeps the original session.
- Switching the app language while signed in updates the profile `locale` (visible on the next `GET /v1/me`).

## Acceptance criteria

- [ ] `flutter analyze` is clean, `dart format --set-exit-if-changed lib test` passes, `flutter test` passes, and `mobile-ci.yml` is green.
- [ ] No production path uses `NoAccessTokenRefresher`. The refresh request carries no `Authorization` header.
- [ ] A test proves that parallel `401`s cause exactly one refresh call.
- [ ] No hand-written HTTP calls for endpoints the generated client covers.
- [ ] Every new user-facing string is in both ARB files. New screens use directional padding and alignment.
- [ ] No Firebase files, no client secrets, no real credentials committed. `googleServerClientId` is empty in committed config files.
- [ ] The dev sign-in route is still absent from the prod flavor (router test).
- [ ] Nothing outside the allowed paths changed (`git diff --stat main...HEAD`).
- [ ] ADR-0017 *Implementation notes*, `apps/mobile/README.md` (Google setup) and the three learning cards are done.

## Testing requirements

- **Interceptor and refresher** (fake Dio adapter, real generated client):
  - one `401` → one refresh → the request is retried with the new token, and the new tokens are stored before the retry;
  - three parallel `401`s → exactly one refresh request;
  - a `401` for a request sent with an outdated token → a retry with the current token and no refresh;
  - refresh `401 REFRESH_TOKEN_REUSED` → session ended;
  - refresh `403 ACCOUNT_DISABLED` → session ended;
  - refresh connection error, `429` or `503` → session kept, a typed error surfaces;
  - the retried request still failing with `401` → session ended, no second refresh (no loop);
  - the refresh request has no `Authorization` header.
- **Google sign-in** (fake `GoogleIdentityGateway`): success, cancel (no error), `PROVIDER_TOKEN_INVALID`, `ACCOUNT_DISABLED`, and an empty client id (the button is disabled).
- **Profile:** only changed fields are sent; an empty username sends `null`; field errors land on the right field.
- **Locale sync (DEC-62):**
  - changing the language while signed in sends `PATCH /v1/me {locale}`;
  - a failed PATCH keeps the local choice;
  - no PATCH while signed out;
  - after sign-in, the profile locale is adopted only when no language was saved.
- **Sessions:** the list renders with the current badge; revoking another session sends `DELETE` and refreshes the list; revoking the current one ends the session.
- **Deletion:**
  - `202` ends the session;
  - `RECENT_SIGN_IN_REQUIRED` → re-authentication as the same user → retry → `202`;
  - re-authentication as a different user → no `DELETE` retry, the new tokens are not stored, and the original session is kept.
- **Router:** signed-out players go to `/sign-in` in both flavors; `/dev-sign-in` exists only in dev.
- **Manual (in the PR description; Android emulator against the local backend):**
  - each Expected behavior item you can reproduce, saying which you could not and why. Google sign-in needs the OAuth clients from the README section: if the user has not created them yet, say so and do not claim it;
  - the ROADMAP M1 exit: "sign in → kill the app → reopen still signed in; refresh reuse forces sign-out". Revoking the device's session from another client and waiting for the access token to expire (15 minutes) is an acceptable way to force a rejected refresh;
  - iOS cannot be run on this Linux machine. Say so.

## Non-goals (do not do these)

- No Facebook, X or Apple sign-in (the backend has no endpoints for them yet; DEC-48 is pending).
- No identity linking or unlinking screens (`/v1/me/identities` is not in the contract yet), and no `ACCOUNT_EXISTS_FOR_EMAIL` handling: the backend does not implement the verified-email check yet (`04-auth.md` §4). An unknown `409` already falls back to the generic conflict message.
- No avatar upload or avatar URL editing, no favourite team picker (no team search endpoint; M2), no privacy settings (fixed in v1.0 by DEC-21).
- No proactive or timer-based token refresh; no access-token expiry checks on the device clock.
- No Firebase, analytics, crash reporting or push notifications.
- No change to the application id (DEC-52) and no decision on DEC-49, DEC-50 or the grace period.
- No backend, contract or architecture-doc changes. Request them in the PR description.

## Deliverable

A pull request from `feat/m1-mobile-sign-in` into `main` of `github.com/the-game22027/the-game`, using `.github/pull_request_template.md`:
- Conventional Commits with scope `mobile` (`feat(mobile): …`, `test(mobile): …`, `docs(learn): …`), one logical step per commit, each building on its own;
- no attribution lines.

The PR description lists:
- the `google_sign_in` version and any other new package;
- how refresh concurrency is handled (in two or three sentences);
- the manual check results, including what could not be checked (Google OAuth clients, iOS);
- **Backend requests**, if any (for example the identity-linking endpoints, the `ACCOUNT_EXISTS_FOR_EMAIL` check, problem+json error schemas in the OpenAPI document);
- any deviation from this prompt or from ADR-0017, with the reason.

The PR is merged only after the user explicitly says "merge" (`gh pr merge <n> --merge`, never squash or rebase).
