# ADR-0014: Mobile foundation (Flutter, Riverpod, go_router, fvm)

- **Status:** Accepted
- **Date:** 2026-11-10
- **Related:** A-09, ADR-0011, DEC-52, ROADMAP M0, `apps/mobile/README.md`

## Context
M0 needs a few choices that are expensive to change once screens exist: the framework version policy, state management, navigation, and the application id. The owner is a Flutter developer. Budget is zero, so every tool must be free and run locally. The owner develops on Linux, so iOS builds cannot be checked locally.

## Decision
- **Flutter (Dart)** in `apps/mobile` (confirms A-09). The exact version is the **latest stable** release at scaffold time, pinned with **fvm** in a committed `.fvmrc`. Upgrades are deliberate, in their own PR.
- **State management: Riverpod** (`flutter_riverpod`, latest stable).
- **Navigation: go_router** (latest stable).
- **REST client generated** from the backend OpenAPI document, which is snapshotted at `apps/mobile/openapi/openapi.json`. The generated code is never edited by hand. The M0 PR records the generator it picked in this ADR's *Implementation notes* section.
- **WebSocket** messages (`docs/api/WEBSOCKET.md`) are hand-written Dart types over `socket_io_client` (M3).
- **Application id deferred (DEC-52).** Until it is decided, the app uses the placeholder `com.example.thegame`, with suffix `.dev` for the dev flavor. Google Play refuses `com.example.*`, so the placeholder cannot reach a store by accident.
- **Two flavors, `dev` and `prod`.** The API base URL comes from `--dart-define-from-file`, never from code.

## Alternatives considered
| Option | Why not |
|---|---|
| Bloc / Cubit | Fine choice; the owner prefers Riverpod. Riverpod's providers also give us dependency injection and easy overrides in tests without a second library |
| Navigator 2.0 by hand / auto_route | go_router is maintained by the Flutter team and covers deep links and redirects (signed-in guard) with less code |
| Hand-written REST client | Drifts from the backend; the OpenAPI document already exists |
| Choosing the application id now | The product name is not final; changing an id after store publication is impossible, but before it is free |
| Unpinned Flutter | Builds differ between machines and CI |

## Consequences
- \+ Same toolchain on every machine and in CI (`fvm`), contract-driven client, testable providers.
- \+ No store-visible identity is fixed before the product name is.
- − Renaming the application id later touches Android `applicationId`, iOS bundle id, Firebase/Google sign-in client ids (M1) and flavor config. That is cheap before R2 and impossible after it, so DEC-52 must be decided before the first store upload.
- − iOS is only build-checked when a macOS machine or a macOS CI runner is available.
- Revisit if Riverpod or go_router stop being maintained, or if the generated client blocks a contract feature we need.

## Implementation notes
Filled in by the M0 PR: the exact Flutter version, the client generator and its version, and the reason for any deviation.
