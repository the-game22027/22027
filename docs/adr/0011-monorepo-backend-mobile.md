# ADR-0011: One monorepo for backend, mobile app, data pipeline and docs

- **Status:** Accepted (product owner, 2026-11-07)
- **Date:** 2026-11-07
- **Related:** A-01, A-09; CLAUDE.md §4; api/API.md; api/WEBSOCKET.md

## Context
The project started with two GitHub repos (`game-backend`, `game-mobile`). The owner wants the backend and the mobile app in **one repository and one folder** on the development machine. The developer is a single person working across both sides. The API contract (`docs/api/`) changes together with both client and server.

## Decision
- One repository, `the-game22027/the-game`, checked out at `the-game/`:
  - `apps/backend/`: NestJS modular monolith (unchanged stack).
  - `apps/mobile/`: the mobile app (Flutter, assumption A-09).
  - `data/`: Python knowledge-base pipeline.
  - `docs/`: architecture and contracts for all of them.
- **No cross-language build orchestrator** (no Nx, Turborepo, Melos at the root). Each app keeps its own toolchain (`npm` in `apps/backend`, `flutter`/`fvm` in `apps/mobile`, Python in `data/`). Add a tool only when a measured pain appears.
- **Contract sharing without shared code:** the backend generates `openapi.json` from `@nestjs/swagger`. The mobile app generates its REST client from that file with a free generator (e.g. `openapi-generator` `dart-dio`). WebSocket message types are hand-written in Dart from `docs/api/WEBSOCKET.md`. A contract change, the backend change and the client regeneration can land in the same PR.
- **CI uses path filters:** backend jobs run on `apps/backend/**` changes, mobile jobs on `apps/mobile/**`, and pipeline jobs on `data/**`. Docs-only PRs run no build.
- Commits and PRs use Conventional Commit scopes per area, e.g. `feat(backend/predictions): …`, `feat(mobile): …`, `docs(api): …`.

## Alternatives considered
| Option | Why not |
|---|---|
| Two repos (backend, mobile) | Contract changes need two coordinated PRs; the docs would live in only one of them; more overhead for a solo developer. Rejected by the owner |
| Monorepo with Nx/Turborepo/Melos at the root | These tools mainly orchestrate one ecosystem; with TypeScript + Dart + Python they add configuration without much benefit at this size |
| Git submodules | Combine the downsides of both: two histories plus pointer bumps |

## Consequences
+ One clone, one history, one place for the API contract; atomic "contract + server + client" PRs.
+ The AI agent sees both sides, so it can keep the mobile client consistent with the contract.
− Larger clone; CI must filter by path to stay within free Actions minutes.
− Access control is all-or-nothing per repo (fine for a solo developer; revisit if outside contributors join only one side).
