# ADR-0017: Mobile session refresh and Google sign-in

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** ADR-0014, ADR-0012, `docs/architecture/04-auth.md` §3.1, §5, §8, DEC-25, DEC-50, DEC-52, DEC-63, ROADMAP M1

## Context
M0 left a seam for refresh-token rotation (`AccessTokenRefresher`) and signs the player out on every `401`. M1 adds real sign-in. The backend side exists since P1: `POST /v1/auth/google`, `POST /v1/auth/refresh` (rotation with reuse detection), `GET/DELETE /v1/auth/sessions`, `PATCH /v1/me`, `DELETE /v1/me` with a recent-sign-in check.

Rotation makes the client part delicate. Each refresh token works **once**: presenting it a second time is treated as theft and revokes the whole session family (`REFRESH_TOKEN_REUSED`). A client that refreshes twice in parallel, or retries a refresh with the old token, signs its own player out.

## Decision
1. **Refresh reactively, once, for everyone.** The app refreshes only when a request to a secured route gets a `401`, never on a timer: the server decides expiry, not the device clock. One refresh runs at a time (the auth interceptor is a `QueuedInterceptor`). A request that failed with an access token that is **no longer the current one** is retried with the current token **without** refreshing again: another request already rotated it.
2. **Only a rejected refresh signs out.** `400`, `401` or `403` from `/v1/auth/refresh` ends the session: `REFRESH_TOKEN_INVALID`, `REFRESH_TOKEN_REUSED`, or `ACCOUNT_DISABLED` for a suspended account or one pending deletion. A network failure, a timeout, `429 RATE_LIMITED` or a `5xx` keeps the session and surfaces the error: losing signal in a tunnel must not sign anyone out.
3. **The refresh call skips the auth interceptor.** It goes through a separate Dio instance with the same base URL, headers interceptor and logging, but without the bearer/401 logic, so a failing refresh cannot recurse.
4. **New tokens are saved before they are used.** The rotated pair is written to secure storage, then the original request is retried. If the app dies between the server's rotation and the write, the next refresh presents the old token and the player has to sign in again. That is rare and safe (fails closed).
5. **Google sign-in uses `google_sign_in` 7.x**, the Flutter team's plugin (Credential Manager on Android), not Firebase Authentication (DEC-25: in-house verification). The plugin is initialized with `serverClientId` = our **web** OAuth client id, so the ID token's `aud` is a client id the backend lists in `GOOGLE_CLIENT_IDS`. Client ids are public identifiers, not secrets: they live in `config/<flavor>.json` (`googleServerClientId`). No `google-services.json`.
6. **Sensitive actions re-authenticate with the provider.** When `DELETE /v1/me` answers `403 RECENT_SIGN_IN_REQUIRED`, the app runs the provider sign-in again (Google; the dev sign-in in the dev flavor), stores the new session, and retries once (`04-auth.md` §8, DEC-50).
7. **Dev sign-in stays in the dev flavor** next to Google, so development works before the Google OAuth clients exist.

## Alternatives considered
| Option | Why not |
|---|---|
| Proactive refresh on a timer before `accessTokenExpiresAt` | Depends on the device clock; adds timers to manage across app pause/resume; the reactive path is needed anyway |
| Refresh on every `401` without the "token already changed" check | Two parallel `401`s rotate twice; the second presents a used token and revokes the family: random sign-outs |
| Sign out on any refresh failure | A timeout in a tunnel would sign the player out |
| Firebase Authentication | Vendor lock-in, user records in two places (DEC-25) |
| `google_sign_in` 6.x API | Deprecated sign-in flow on Android; 7.x is the maintained API |

## Consequences
- \+ No random sign-outs from parallel requests; offline does not mean signed out.
- \+ Google sign-in without Firebase or paid services.
- − The owner must create Google OAuth clients (free): one web client, one Android client per flavor (package name + signing SHA-1), an iOS client later. If Google Cloud refuses the `com.example.*` placeholder package name, DEC-52 has to be decided before Google sign-in can be tested.
- − Re-authentication for deletion needs a provider UI round trip; acceptable for a rare, destructive action.
- Revisit if the backend adds sliding access tokens or server-side session checks on every request.

## Implementation notes
Filled in by the M1 PR (2026-11-11).

- **Packages:** `google_sign_in` 7.2.0. No other new dependency.
- **Retries go through the Dio without the auth interceptor**, not only the refresh call. A retry sent through the same `QueuedInterceptor` would wait, on a second `401`, behind the error handler that is waiting for it: a deadlock that the M0 retry code also had.
- **One `account` feature** holds sign-in, sign-out, sessions, profile and deletion, instead of an `auth` feature plus an `account` feature. Deletion re-authentication and sign-out need the Google gateway and the sign-in repository, and features must not import each other.
- **No locale field on the profile screen.** With the DEC-63 default, the app language in Settings is the profile `locale`, so the profile form does not offer it a second time.
- **A new account does not dictate the language.** The backend gives every new account `locale: "ar"`, so adopting it would switch a first-time English player to Arabic (seen on the emulator). When `isNewUser` is true the app keeps its language and sends it with `PATCH /v1/me {locale}`; only an existing account's `locale` is adopted.
- **Removing a username:** the generated `UpdateMeDto` drops null fields, so a small subclass overrides `toJson()` to send `"username": null`. The generator's `useOptional` / `patchOnly` options (meant for this) produce code that does not compile in v7.27.0 (an invalid `unknownEnumValue` and converters on non-`Optional` fields), so they are not used.
- **Side effect the app cannot prevent:** re-authenticating with an unknown Google account creates a new account on the server (sign-in is also sign-up). The app revokes that session and deletes nothing. A dedicated re-authentication endpoint would avoid it (backend request in the M1 PR).
