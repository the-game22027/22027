# CLAUDE.md — Football Social Prediction & Trivia Game

This file is the always-loaded project memory for Claude Code and any coding agent.
Read it fully before proposing designs, writing code, or writing prompts for other agents.
Deeper references live in `docs/` (index: `docs/README.md`).

---

## 1. What we are building

A football-focused **social gaming platform** (not a CRUD app, not a simple quiz app). This is a **monorepo** holding the backend, the mobile app, the data pipeline and the docs (ADR-0011):

- Match predictions (top-5 European leagues + national teams), private by default, editable until kickoff.
- Man of the Match (MOTM) community voting, open for 1 hour after the authoritative match end.
- **Core:** football trivia **battles** against other players, any time, **real-time only** over WebSockets: random 1v1 matchmaking with a bot fallback, and multiplayer private rooms (2 or more players) joined with a code. No Daily Quiz, no solo mode, no async play (ADR-0010).
- Private leagues (prediction and battle competitions).
- Leaderboards: weekly, monthly, seasonal, all-time. Monthly leader gets a prize.
- Friends (mutual), privacy-aware prediction visibility.
- A fact-first football knowledge database that feeds an offline question generator.

Current phase: **Phases 0-2 implemented (foundation, auth + users, football mock data); next: P3 predictions + points ledger**. See `docs/ROADMAP.md`.

## 2. Hard constraints (do not violate)

1. **Stack is fixed:** Node.js + TypeScript + NestJS, PostgreSQL + Prisma, Redis + BullMQ (only where justified), WebSockets (Socket.IO via `@nestjs/websockets`), Python for football data ingestion, Ollama for local AI, Docker Compose, OpenAPI/Swagger, Jest. Do **not** switch language, ORM, or framework. Mobile app: **Flutter** in `apps/mobile` with **Riverpod** (state) and **go_router** (navigation), Flutter latest stable pinned with **fvm** (ADR-0014). Do not switch the mobile framework, state library or router.
2. **Modular monolith.** No microservices, no Kafka, no event sourcing, no distributed real-time cluster until a measured bottleneck justifies it (`docs/adr/0001-modular-monolith.md`).
3. **Zero budget.** No paid service may be *required* for development: no paid LLM APIs, paid football APIs, paid SMS, paid hosting, paid monitoring. Paid things are allowed only as optional production adapters behind a port, clearly labeled.
4. **Mock football data first.** Real data replaces mocks later through the `FootballDataProvider` port.
5. **The LLM is never on the gameplay request path.** Question generation is offline. The API must work with Ollama switched off.
6. **The backend is authoritative** for: prediction lock (kickoff), MOTM voting window, battle state/timing/scoring (including bots), room membership, scores, leaderboards. Never trust client clocks or client-computed results.
7. **Never invent open business rules.** Anything listed in `docs/DECISIONS.md` as TBD stays TBD: make it configuration (`scoring_rule_sets`, battle/room/matchmaking/bot config JSON) or an explicit `// TODO(DEC-xx)` — never a hard-coded constant or a DB constraint.

## 3. Architecture rules

- Layering inside every module: `presentation → application → domain`; `infrastructure` implements ports defined in `application`/`domain`.
- **Domain layer imports nothing from** NestJS, Prisma, Redis, BullMQ, Socket.IO, Ollama, or `process.env`. Plain TypeScript only. Time comes from an injected `Clock`.
- Modules talk to each other only through the target module's public entry (`src/modules/<name>/index.ts`): application facades, query services, DTO types, event types. Never import another module's `domain/`, `infrastructure/`, or Prisma models directly.
- Each table has exactly **one owning module**. Other modules never write to it; they read through the owner's query interface. FKs across modules are allowed (single database).
- Cross-module async reactions use the **transactional outbox** (`outbox_events`) → BullMQ dispatch. Handlers must be idempotent. Same-request needs use direct facade calls.
- Scores from every game mode go into the append-only **points ledger** (`point_entries`). Leaderboards are projections of the ledger, rebuildable at any time.
- Avoid speculative abstractions. A port/interface must solve a real problem (testing time, swapping mock→real provider, single→multi instance). No generic `BaseRepository<T>`.
- Full rules: `docs/architecture/01-modules.md`.

## 4. Repository layout (target, monorepo — ADR-0011)

```
the-game/
├── CLAUDE.md                 # this file
├── docs/                     # architecture, API contract, decisions, ADRs, roadmap
├── apps/mobile/              # Flutter app (ADR-0014); README.md explains how it talks to the backend
│   ├── openapi/openapi.json  # snapshot of the backend contract; the REST client is generated from it
│   └── lib/                  # app code, one folder per feature (structure set by M0)
├── apps/backend/             # NestJS modular monolith (api + worker entrypoints)
│   ├── src/main.api.ts       # HTTP + WebSocket process
│   ├── src/main.worker.ts    # BullMQ processors + schedulers
│   ├── src/main.cli.ts       # nest-commander: developer commands (mock:*)
│   ├── src/modules/<module>/{domain,application,infrastructure,presentation}/
│   ├── src/shared/           # kernel (Clock, ids, errors) + infra (prisma, redis, logger, outbox)
│   ├── prisma/               # schema (one file per module), migrations, seed
│   └── test/                 # e2e + integration (Testcontainers)
├── data/                     # Python: football knowledge DB ingestion + question generation
│   ├── ingest/  generate/  kb_migrations/  bundles/
├── docker-compose.yml        # postgres, redis, (optional) ollama, prometheus, grafana
└── .claude/skills/           # project skills: new-module, adr, agent-prompt
```

## 5. Coding conventions

- TypeScript `strict: true`. No `any` in domain/application code.
- File names `kebab-case.ts`; classes `PascalCase`; DB tables/columns `snake_case` (Prisma `@@map`/`@map`); API JSON `camelCase`.
- **Function names must be clear to someone new to backend** (the user's rule). Read alone, the name says what the function does and what it returns: a verb plus its object (`findActiveSessionsForUser`, `lockMatchIfPredictable`), and booleans state the full condition (`isSupportedLocale`, not `isLocale`; `hasRecentSignIn`, not `recent`). Prefer a longer plain name over a short or clever one; no abbreviations. Rename unclear names when you touch their file.
- IDs: UUID v7 generated in the application (`shared/kernel/id.ts`), stored as `uuid`.
- All timestamps `timestamptz`, UTC in storage and API (ISO-8601 with `Z`). Period/timezone logic only in the leaderboard period calculator.
- Validation: `class-validator` DTOs at the edge; invariants enforced again in domain.
- Errors: domain errors extend `DomainError` (`@shared/kernel`) with a stable `code` and a `kind` (`CONFLICT`, `NOT_FOUND`, …), never an HTTP status; one global filter maps `kind` to HTTP and renders RFC 9457 problem+json (`docs/api/API.md` §4).
- Transactions: `@nestjs-cls/transactional` with the Prisma adapter. Outbox rows are written in the same transaction as the state change.
- Time-critical checks (kickoff lock, voting window) use the **database clock** (`now()`) inside the write statement, not `Date.now()` in Node.
- Logging: `nestjs-pino`, structured JSON, `requestId` propagated, never log tokens, auth codes or personal data in full.
- Tests: domain rules → unit tests (no Nest, no DB). Repositories/transactions/concurrency → integration tests against real Postgres/Redis via Testcontainers. Flows → e2e with Supertest and `socket.io-client`.
- Mobile (Dart): file names `snake_case.dart`, `flutter analyze` clean with the committed lint rules, the same clear-function-name rule as above. Generated code (REST client, l10n) is never edited by hand. The app never decides lock state, correctness or timers itself; it shows what the server says (`serverTime`, problem+json `code`). User-facing text lives in Arabic + English ARB files, and layouts must work right-to-left.
- Git: never commit to `main` directly. Branch `feat/<phase>-<topic>`, `fix/…`, `docs/…`, `chore/…`; Conventional Commits (`feat(predictions): …`); one PR per coherent change using `.github/pull_request_template.md`. **Merge with a merge commit, never squash or rebase** (`git merge --no-ff`, or `gh pr merge --merge`), so every individual commit stays visible in `main`'s history under its merge commit. Because each commit is kept, every commit must be meaningful: one logical step, a Conventional Commit message, building and passing tests on its own where practical; clean up WIP commits before opening the PR. Roadmap phases are GitHub milestones (`P0 …`), issues use `type:*` and `area:<module>` labels. Commit scopes name the area: `feat(backend/predictions): …`, `feat(mobile): …`, `docs(api): …`. Each app keeps its own toolchain (no root build orchestrator); CI jobs are path-filtered per app. A contract change updates `docs/api/`, the backend and the regenerated mobile client in the same PR when possible. Remote: `github.com/the-game22027/the-game`.

## 6. Commands

Requires **Node 24 LTS** (`.node-version`; `fnm use` / `nvm use`) and Docker. NestJS 12 is ESM-only and Jest needs Node 24.9+ to load it.

```bash
# one-time
docker compose up -d postgres redis          # Postgres on localhost:5440, Redis on localhost:6379
cd apps/backend && cp .env.example .env && npm install   # postinstall runs prisma generate
npm run keys:generate                        # writes a local ES256 JWT signing key into .env
npm run prisma:deploy                        # apply migrations

# run (from apps/backend)
npm run start:api:dev        # API + WS on :3000  → /health/ready, /docs, /admin/queues, /metrics
npm run start:worker:dev     # worker on :3100    → outbox publisher, /health/ready, /metrics

# quality (from apps/backend)
npm run lint | format | format:check | typecheck
npm run depcheck:boundaries  # module boundary rules (dependency-cruiser)
npm test                     # unit
npm run test:integration     # Testcontainers: real Postgres + Redis (Docker required)
npm run test:e2e             # full HTTP flows, Testcontainers

# database (from apps/backend)
npm run prisma:migrate -- --name <change>    # create + apply a migration in dev
npm run prisma:generate

# optional infrastructure (repo root)
docker compose --profile observability up -d # Prometheus :9090, Grafana :3001
docker compose --profile ai up -d ollama     # local LLM for the offline question pipeline
```

Mobile (from `apps/mobile`): not scaffolded yet. The M0 PR adds its commands here (run, test, analyze, regenerate the REST client).

Football simulator, development only (from `apps/backend`; `npm run cli -- --help` lists every command):

```bash
npm run cli -- mock:run-day --speed 60x      # play the next matchday in accelerated time
npm run cli -- mock:scenario postponed       # kickoff-change | postponed | result-corrected | abandoned
npm run cli -- mock:kickoff <matchId>        # also mock:score, finish, postpone, reschedule, cancel, abandon, correct-result, correct-end-time
```

Planned, not implemented yet: `npm run cli -- questions:import <bundle>` (P5).
Update this section when commands change. Do not document commands that do not exist yet as if they work.

## 7. Working agreement with the user (mentorship mode)

- The user is a backend + mobile developer using this project as a serious learning journey.
- **Teach while building.** The user is learning backend, DevOps and software engineering (already a mobile developer). For every feature or bug fix, name the concepts involved and add or update a card in the matching track folder of `learn/` (`backend/`, `database/`, `devops/`, `mobile/`, …; format and index in `learn/README.md`): one concept per file, to the point, max ~30 lines, linked to our real code. No long explanations of easy things.
- **Talk to the user in English.** Be direct and precise, explain WHY and the trade-offs.
- **Do not blindly agree.** If a request is a bad idea, say so, explain why, propose a better option.
- Prompts written for coding agents: **professional English**, self-contained (the agent has not seen this conversation), with context, scope, constraints, expected behavior, acceptance criteria, tests, and explicit non-goals. Use the `agent-prompt` skill.
- Do not start implementation code for a phase before its design section exists in `docs/`.
- When an open decision blocks work: list options + trade-offs + a recommended default, keep it **Pending** in `docs/DECISIONS.md`, and continue with the default behind configuration.

### 7.1 Parallel sessions (backend + mobile at the same time)

The user may run two Claude Code sessions at once, each in its own **git worktree** of this one repository (same history, same remote, different folder and branch):

| Folder | Session | Owns |
|---|---|---|
| `the-game/` | backend | `apps/backend/`, `data/`, `docs/api/`, `docs/architecture/` |
| `the-game-mobile/` | mobile | `apps/mobile/`, `learn/mobile/`, mobile ADRs, `.github/workflows/mobile-ci.yml` |

- Stay inside the folders your session owns. If you need a backend or contract change, stop and write down what is needed (endpoint, field, error code) in your PR description for the user to take to the backend session. Never edit the other side's files.
- Shared files (`CLAUDE.md`, `docs/ROADMAP.md`, `docs/DECISIONS.md`, `learn/README.md`): keep edits small and in your own lines or rows, so the two PRs merge without conflicts.
- One backend process serves both: the API runs from the backend folder (`npm run start:api:dev`, port 3000). The mobile session reads the contract from `http://localhost:3000/docs-json` and does not start its own backend.
- Docker services (Postgres, Redis) are shared. Never reset or drop the dev database from the mobile session.
- Each session commits and pushes only its own branch, and merges only after the user says "merge".

## 8. Where things are documented

| Topic | File |
|---|---|
| Docs index | `docs/README.md` |
| Product requirements (v1.0 scope, stories, decided rules) | `docs/PRD.md` |
| Vision, scope, assumptions, risks, system diagrams | `docs/architecture/00-overview.md` |
| Modules, boundaries, dependency rules, events | `docs/architecture/01-modules.md` |
| Database design + ERD | `docs/architecture/02-database.md` |
| Prediction / MOTM / quiz battle (matchmaking, rooms, bots, engine) / Leaderboard / League workflows | `docs/architecture/03-workflows.md` |
| Authentication and sessions | `docs/architecture/04-auth.md` |
| Background jobs | `docs/architecture/05-background-jobs.md` |
| Security, scalability, observability, testing | `docs/architecture/06-cross-cutting.md` |
| Football data, knowledge DB, question generation | `docs/architecture/07-football-data-and-questions.md` |
| REST contract | `docs/api/API.md` |
| WebSocket (quiz battles + room lobby) contract | `docs/api/WEBSOCKET.md` |
| Mobile app: stack decisions, how it talks to the backend | `docs/adr/0014-mobile-foundation.md`, `apps/mobile/README.md` |
| Open decisions register | `docs/DECISIONS.md` |
| Architecture Decision Records | `docs/adr/` |
| Roadmap and phase exit criteria | `docs/ROADMAP.md` |
| Domain vocabulary | `docs/GLOSSARY.md` |
| Ready-to-use agent prompts | `docs/prompts/` |
| Learning cards (concepts behind what we build) | `learn/` |

When a design changes, update the relevant doc **and** add/supersede an ADR in the same change.
