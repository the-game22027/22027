# Agent Prompt — M0: Mobile foundation (Flutter)

> Self-contained prompt for a coding agent. It assumes no access to prior conversations. Copy everything below the line.

---

## Context

You are building the foundation of the mobile app for a **football social gaming platform**. Players predict match results, vote for the Man of the Match, and play real-time football trivia battles against other players (1v1 matchmaking with a bot fallback, and private rooms). The backend is a NestJS modular monolith in the same monorepo (`apps/backend`). Auth, users and football mock data are already implemented, and the REST contract is written. **This phase (M0 in `docs/ROADMAP.md`) builds only the app skeleton and the plumbing every later screen uses.** It does not build the visual design or the product screens.

You work in a **git worktree** of the monorepo at `the-game-mobile/`, on branch `feat/m0-mobile-foundation`. A second Claude session works on the backend in another worktree at the same time. Read `CLAUDE.md` §7.1 for the ownership rules.

Read these before writing code:
- `CLAUDE.md`, especially §2 (stack), §5 (the mobile and function-name conventions) and §7.1 (parallel sessions).
- `docs/adr/0014-mobile-foundation.md` (decided stack) and `docs/adr/0011-monorepo-backend-mobile.md`.
- `apps/mobile/README.md`.
- `docs/api/API.md` §1 (conventions), §4 (problem+json and the error code catalog), §5 (`AuthTokens`, `Me`), §6.1, §6.2 and §6.11.
- `docs/architecture/04-auth.md`: token lifetimes, refresh rotation (context for M1), and §11 (the dev-only fake sign-in).

## Constraints

- **Stack (ADR-0014, do not change):**
  - Flutter latest **stable**, pinned with **fvm** in a committed `.fvmrc`. Check the real latest stable with `fvm releases`; do not guess a version number.
  - **Riverpod** (`flutter_riverpod`) for state and dependency injection.
  - **go_router** for navigation.
  - Platforms: Android and iOS.
- **Application id is not decided (DEC-52).**
  - Use the placeholder `com.example.thegame`, with `applicationIdSuffix ".dev"` for the dev flavor.
  - On iOS, set the same bundle id.
  - Do not invent a real id or organization name.
- **Zero budget:**
  - Only free, open-source packages and tools.
  - No Firebase, no paid services, no accounts or credentials of any kind.
  - No secrets in the repo. Config files hold only URLs and flags.
- **The server is authoritative.** The app never decides lock state, correctness, timers or scores. In M0 this only means: show what the server returns, and map errors by their `code`.
- **Ownership:**
  - Change only `apps/mobile/**`, `learn/mobile/**`, `.github/workflows/mobile-ci.yml`, and the `pub` entry in `.github/dependabot.yml`.
  - You may make small, own-line edits to `CLAUDE.md` §6, `learn/README.md` and the *Implementation notes* section of ADR-0014.
  - **Never edit `apps/backend/`, `docs/api/` or `docs/architecture/`.** If the contract or the backend needs a change (for example, an endpoint missing from the OpenAPI document, or an untyped response), list it under "Backend requests" in the PR description.
- **Backend:** do not start or stop the backend. The user runs it from the other worktree on `http://localhost:3000`, so ask the user to start it if it is not reachable. Never reset or drop the shared Postgres database.
- **Clear function names (CLAUDE.md §5):** a verb plus its object, and booleans state the full condition (`isSignedIn`, `hasValidAccessToken`).
- **Comments:** only where the reason is not obvious.

## Scope

1. **Scaffold**
   - Run `fvm use <latest stable>`, then `fvm flutter create --org com.example --project-name the_game --platforms android,ios .` inside `apps/mobile`.
   - Keep the existing `README.md` and extend it.
   - Set the Android `applicationId` and the iOS bundle id to `com.example.thegame` explicitly.
   - Use strict analysis options: `flutter_lints` or `very_good_analysis`, your choice, justified in the PR.
2. **Flavors and config**
   - Android `productFlavors` `dev` (`.dev` suffix, app label "The Game (dev)") and `prod`.
   - Runtime config through `--dart-define-from-file=config/<flavor>.json`:
     - `config/dev.json` with `apiBaseUrl: "http://localhost:3000"`, used with `adb reverse tcp:3000 tcp:3000` (document it, plus the `10.0.2.2` alternative).
     - `config/prod.json` with the placeholder `https://api.example.invalid`.
   - A typed `AppConfig` provider reads the values and fails fast when one is missing.
   - iOS: the dev and prod values work through the same dart-define files. Separate iOS schemes are optional, because they cannot be verified without macOS. Say what you did.
3. **App structure**
   - Feature-first layout: `lib/app/` (router, theme, root widget), `lib/core/` (config, network, storage, errors, l10n), `lib/features/<feature>/{data,application,presentation}/`.
   - Document the layout and its rule in `apps/mobile/README.md`: features depend on `core`, never on each other's internals.
   - Use a plain Material 3 theme. No custom visual design.
4. **Contract and generated REST client**
   - `tool/update_openapi.sh` downloads `http://localhost:3000/docs-json` into `openapi/openapi.json`, pretty-printed and stable, so diffs stay readable. Commit the snapshot.
   - Generate a Dart client from the snapshot. Recommended: `openapi-generator` `dart-dio`, run through its official Docker image pinned to an exact existing tag, into a local path package `packages/api_client/`. Alternative: a pure-Dart generator.
   - Record the choice and the version in ADR-0014 *Implementation notes*.
   - Commit the generated code, so CI and fresh clones need no Docker or Java. Exclude it from lints.
   - `tool/generate_api_client.sh` regenerates the client.
   - Only feature `data/` layers use the generated client.
5. **HTTP plumbing (Dio)**
   - The base URL comes from `AppConfig`.
   - Every request sends `Accept-Language` with the current app language (`ar` or `en`) and an `X-Request-Id` (a new UUID per request).
   - Authenticated requests send `Authorization: Bearer <accessToken>`.
   - Use sensible timeouts.
   - Log requests only in the dev flavor, and never log the `authorization` header, tokens or request bodies of `/auth` routes.
6. **Error mapping**
   - Parse `application/problem+json` into an `ApiProblem` (`status`, `code`, `detail`, `traceId`, field `errors`).
   - Turn network failures and timeouts into their own typed errors, not exceptions leaking from Dio.
   - A function such as `describeErrorForUser(error, l10n)` returns a localized message by `code`. Cover at least `VALIDATION_FAILED`, `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `RATE_LIMITED`, `NOT_FOUND`, `ACCOUNT_DISABLED` and `INTERNAL`. Unknown codes fall back to a generic message chosen by HTTP status.
   - Unknown enum values and unknown fields must never crash parsing (API §8).
7. **Session and secure token storage**
   - Store `accessToken`, `accessTokenExpiresAt` and `refreshToken` with `flutter_secure_storage`.
   - A Riverpod session controller exposes signed-in or signed-out state and survives an app restart.
   - On a `401` from an authenticated call: clear the session and go to sign-in. Refresh rotation is M1; leave a clearly named seam for it.
8. **Dev sign-in (dev flavor only)**
   - A screen with `subject` and optional `displayName` fields calls `POST /v1/_dev/auth/sign-in`, stores the returned `AuthTokens`, and lands on a home screen that shows `GET /v1/me` (`displayName`, `locale`).
   - Add a sign-out button that clears local tokens and calls `POST /v1/auth/logout`.
   - The prod flavor must not contain this screen or route.
9. **Navigation (go_router)**
   - Routes: splash/loading, sign-in, home, server status, settings.
   - A redirect guard sends signed-out users to sign-in and signed-in users away from it.
10. **Server status screen:** calls `GET /health/ready` (not versioned, not problem+json on failure) and shows whether the backend is up. This is the M0 exit check.
11. **Arabic and English with RTL**
    - `flutter_localizations` plus `gen-l10n` with `lib/l10n/app_en.arb` and `app_ar.arb`. Every user-facing string lives there.
    - A language switch on the settings screen, persisted locally (`shared_preferences` is fine for this non-secret value), applies immediately and changes `Accept-Language`.
    - Layouts use directional padding and alignment (`EdgeInsetsDirectional`, `AlignmentDirectional`).
12. **CI:** `.github/workflows/mobile-ci.yml`
    - Runs on PRs and pushes that touch `apps/mobile/**`, on `ubuntu-latest`.
    - Installs the Flutter version from `.fvmrc`.
    - Runs `pub get`, `dart format --set-exit-if-changed` (excluding generated code), `flutter analyze`, `flutter test`, and `flutter build apk --flavor dev --debug` with the dev config.
    - Add a weekly `pub` entry for `/apps/mobile` to `.github/dependabot.yml`.
13. **Learning cards** (`learn/mobile/`, format in `learn/README.md`, about 30 lines each, linked to the real code)
    - Write one card each for:
      - a REST client generated from OpenAPI
      - secure token storage
      - Riverpod providers as dependency injection, with overrides in tests
      - the go_router redirect guard
      - RTL and localization
    - Add them to the `learn/README.md` index (phase `M0`) and replace the placeholder text in `learn/mobile/README.md`.
14. **Docs**
    - Add the real mobile commands to `CLAUDE.md` §6, replacing the "not scaffolded yet" line: setup, run dev, test, analyze, update the OpenAPI snapshot, regenerate the client.
    - Expand `apps/mobile/README.md` with how to run against the local backend.

## Expected behavior

- With the backend running, `fvm flutter run --flavor dev --dart-define-from-file=config/dev.json` on an Android emulator shows the splash screen, then sign-in.
- The server status screen shows "up". After the backend is stopped, it shows "down" without crashing.
- Dev sign-in with `subject: "alice"` lands on home and shows the display name from `/v1/me`. Killing and reopening the app keeps the user signed in.
- Switching to Arabic flips the layout to right-to-left and changes every visible string. The next request carries `Accept-Language: ar`.
- A request that returns problem+json shows the localized message for its `code`. A timeout shows a "cannot reach the server" message.
- An expired or revoked access token (`401`) signs the user out and returns to sign-in.
- The prod flavor builds without the dev sign-in route.

## Acceptance criteria

- [ ] `.fvmrc` pins an existing stable Flutter version; `fvm flutter --version` matches it.
- [ ] `flutter analyze` is clean and `flutter test` passes, locally and in `mobile-ci.yml`.
- [ ] `openapi/openapi.json` is committed, the client is generated from it, and running `tool/generate_api_client.sh` again produces no diff.
- [ ] No hand-written HTTP calls for endpoints the generated client covers, except `/health/ready` if it is not in the document (say so).
- [ ] Every user-facing string is in both ARB files, with no hard-coded UI text.
- [ ] The app id is `com.example.thegame` (`.dev` for dev); there are no real ids, credentials, Firebase files or secrets.
- [ ] The dev sign-in route is absent from the prod build (shown by a test or by build configuration).
- [ ] Nothing outside the allowed paths changed (`git diff --stat main` shows it).
- [ ] ADR-0014 *Implementation notes*, `CLAUDE.md` §6, `apps/mobile/README.md` and the learning cards are updated.

## Testing requirements

- **Unit:**
  - problem+json parsing, including a missing `errors`, an unknown `code` and a non-JSON body
  - `describeErrorForUser` for the listed codes plus an unknown code
  - `AppConfig` failing on missing values
  - the session controller restoring from storage, with fake storage via a provider override
- **Interceptor:** using a fake Dio adapter, the `Authorization`, `Accept-Language` and `X-Request-Id` headers are attached; a `401` clears the session; tokens never appear in logs.
- **Router:** signed-out → sign-in redirect; signed-in → home; the dev route is missing when the flavor is prod.
- **Widget:** the Arabic locale renders right-to-left (check `Directionality.of(context)`); the server status screen shows up and down states with a fake health client.
- **Manual (in the PR description):** each Expected behavior item, checked on an Android emulator against the local backend. iOS cannot be run on this Linux machine. State that, and do not claim it.

## Non-goals (do not do these)

- No visual design, custom theme, animations, icons or splash artwork beyond the defaults.
- No Google, Facebook or X sign-in, and no refresh-token rotation (M1). No profile editing or sessions list (M1).
- No matches, predictions, leaderboards, battles, WebSocket client or rooms (M2 and later).
- No Firebase, crash reporting, analytics or push notifications.
- No choosing the real application id or app name (DEC-52).
- No backend, contract or architecture-doc changes. Request them in the PR description instead.
- No root-level build orchestrator (Melos, Nx) and no root `package.json` changes (ADR-0011).

## Deliverable

A pull request from `feat/m0-mobile-foundation` into `main` of `github.com/the-game22027/the-game`:
- Use Conventional Commits with scope `mobile` (`feat(mobile): …`, `ci(mobile): …`, `docs(learn): …`), one logical step per commit, each building on its own.
- Fill in the PR template.
- Add no attribution lines.

The PR description lists:
- the exact Flutter, Riverpod, go_router and generator versions;
- the choices you made within the allowed freedom (lint package, generator, iOS flavor handling);
- how to run the app against the local backend;
- the manual check results;
- **Backend requests**, if any;
- any deviation from this prompt, with the reason.

The PR is merged only after the user explicitly says "merge" (`gh pr merge <n> --merge`, never squash or rebase).
