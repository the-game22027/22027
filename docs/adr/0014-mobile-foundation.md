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
Filled in by the M0 PR (2026-11-10).

- **Flutter 3.38.5** (Dart 3.10.4), pinned in `apps/mobile/.fvmrc`. **Deviation:** the latest stable at scaffold time was 3.47.9, but downloading it on the owner's connection would have taken hours (about 150 KB/s for 1.6 GB). The owner chose to start on the 3.38.5 SDK already installed. Upgrading to the latest stable is a separate PR, as this ADR already requires for every upgrade.
- **Packages:** flutter_riverpod 3.3.2, go_router 17.5.0, dio 5.11.1, flutter_secure_storage 11.2.0, shared_preferences 2.5.5, uuid 4.6.0. Riverpod is used without code generation.
- **Client generator:** openapi-generator **v7.27.0** (Docker image `openapitools/openapi-generator-cli:v7.27.0`), generator `dart-dio`, `serializationLibrary=json_serializable`, `enumUnknownDefaultCase=true` (unknown enum values parse to `unknownDefaultOpenApi` instead of failing). Output in `apps/mobile/packages/api_client`, committed. A one-file template override (`tool/openapi-templates/pubspec.mustache`) raises the package SDK floor to 3.8, because current json_serializable emits Dart 3.8 syntax.
- **Lints:** `flutter_lints` plus Dart strict modes and a few extra rules; not `very_good_analysis`, which requires doc comments on every public member.
- **iOS:** no separate schemes (not verifiable on Linux); iOS reads the same `--dart-define-from-file` config. `NSAllowsLocalNetworking` lets any iOS build reach `http://localhost`; public hosts still require HTTPS.
