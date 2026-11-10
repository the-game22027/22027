# apps/mobile

Flutter app for the football prediction & trivia game (A-09; ADR-0011, ADR-0014).

**Not scaffolded yet: M0 does it** (`docs/prompts/mobile-m0-foundation.md`). Decided in ADR-0014:
- Flutter latest stable, pinned with `fvm` (committed `.fvmrc`);
- Riverpod for state, go_router for navigation;
- application id deferred (DEC-52): placeholder `com.example.thegame`, `.dev` suffix for the dev flavor.

## How it talks to the backend

| Channel | Source of truth | In the app |
|---|---|---|
| REST | `docs/api/API.md` → backend OpenAPI (`/docs-json`), snapshotted in `apps/mobile/openapi/openapi.json` | Generated Dart client; regenerate on contract change, never edit by hand |
| WebSocket (`/battles`) | `docs/api/WEBSOCKET.md` | Hand-written Dart message types + `socket_io_client` (M3) |

Rules that matter for the client: the server is authoritative for every timer and score. Use `serverTime` for countdowns, never decide correctness or lock state locally, and show bots as bots (DEC-40).
