# ADR-0019: Mobile data layer before screens

- **Status:** Accepted
- **Date:** 2026-11-12
- **Related:** ADR-0014, ADR-0015, ADR-0017, ADR-0021, `docs/api/API.md` §5-6, `docs/api/WEBSOCKET.md`, `docs/architecture/08-battle-games.md` §5.3, ROADMAP M2, M3

## Context
The backend has finished football reads (P2), prediction submit (P3.1) and the first battle slice over WebSocket (P6.1: matchmaking with a bot, `BUZZER` rounds). The app uses only auth and `GET/PATCH /v1/me`. The screens for M2 and M3 are not designed yet, and the owner wants no new UI until they are.

The part every future screen needs is the same whatever the screens look like: calling the API, mapping its DTOs to app models, caching, the battle protocol, and the rules a screen must not re-implement (server clock offset, `seq` gaps). Building it now, with tests, lets each later screen be a thin layer over it.

## Decision
1. **Data and application layers only.** New features get `data/` and `application/`, no `presentation/`. Features import only `core/`, as before.
2. **App models, not generated DTOs, cross the data boundary.** Repositories return small immutable Dart classes. Screens never import `package:api_client`, so a regenerated client or a contract change touches one mapping, not every widget. Enums get an `unknown` value: the API tells clients to tolerate new values.
3. **No pass-through data sources.** The generated API classes already are the remote data source for REST. A repository wraps them, maps DTOs and turns failures into `AppError`. A separate data source class exists only when there is a real second source or a non-REST transport: the battle socket (Socket.IO).
4. **Use cases are application classes with clear names.** Each one does one job a screen will call (`submitPrediction`, `answerWithText`, `joinMatchmaking`). Read-only lists are exposed as Riverpod providers.
5. **Profile completed:** `avatarUrl`, `favouriteTeamId` (set and clear), `identities` and `privacy` (read only: `PATCH /v1/me/privacy` is future) are added to the account profile.
6. **Football and predictions:** competitions, matches by date range, competition and status with cursor paging, match detail with `serverTime`, squads; own prediction (`404` = none) and submit (`PUT`, `EXACT_SCORE` picks). Lock state comes from the server only (`predictable`, `locked`, `409 PREDICTION_LOCKED`).
7. **Answers are typed text, judged on the server (ADR-0021).** The app sends what the player typed as `{ text }` (`{ number }` for a number round) and shows the verdict event. No catalog download, no normalizing and no suggestions on the device. The round's `answerKind` only picks the hint and the keyboard. *(Changed on 2026-11-12: the first version of this point kept the answer catalog on the device with local search; ADR-0021 removed it before it shipped.)*
8. **Battles over Socket.IO with `socket_io_client`.** A socket data source connects to `/battles` with the access token in the handshake `auth`, sends commands with a `clientMsgId` and an acknowledgement, and exposes server events as a stream. On top of it:
   - a **server clock**: `time:sync` 5 times, keep the lowest round trip, `offset = serverTime − (t0 + rtt/2)`;
   - a **pure battle state reducer** that applies each event in `seq` order and reports a gap. `battle:resync` arrives with P6.3; until then a gap is recorded and the state keeps the last good events;
   - **commands** for matchmaking, ready, buzz, answer and grid claim, returning the ack (`accepted` or a `code`);
   - `auth:expiring` triggers a token refresh and `auth:refresh`; `auth:revoked` ends the socket.
9. **Only what the backend serves or has specified.** MOTM, history, friends, leaderboards, leagues and rooms wait for their backend phases. `GRID` events and `GET /v1/me/play-state` are parsed from the contract.

## Consequences
- M2 and M3 screens read providers and call use cases; the protocol and the clock live in tested Dart code, not in widgets.
- The battle reducer must follow `WEBSOCKET.md` changes from P6.2-P6.4; unknown events and game types are ignored, not fatal.
- One new package: `socket_io_client` (pure Dart).
- Without screens, the new code is checked by unit tests and by a run against the local backend, not by the emulator.
