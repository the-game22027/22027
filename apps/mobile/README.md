# apps/mobile

Flutter app for the football prediction & trivia game (assumption A-09; ADR-0011).

**Not scaffolded yet.** Before running `flutter create`, decide:
- the Flutter version (pin it with `fvm`, committed `.fvmrc`);
- the application id / bundle id (e.g. `com.<org>.<app>`): it is hard to change after store publication;
- the organization name passed to `flutter create --org`.

Suggested scaffold once decided:

```bash
cd apps/mobile
fvm use <version>
fvm flutter create --org com.example --project-name the_game --platforms android,ios .
```

## How it talks to the backend

| Channel | Source of truth | In the app |
|---|---|---|
| REST | `docs/api/API.md` → backend-generated `openapi.json` | Generated Dart client (e.g. `openapi-generator` `dart-dio`); regenerate on contract change |
| WebSocket (`/battles`) | `docs/api/WEBSOCKET.md` | Hand-written Dart message types + `socket_io_client` |

Rules that matter for the client: the server is authoritative for every timer and score. Use `serverTime` for countdowns, never decide correctness or lock state locally, and show bots as bots (DEC-40).
