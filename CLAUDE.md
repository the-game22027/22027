# CLAUDE.md — Football Social Prediction & Trivia Game

This file is the always-loaded project memory for Claude Code and any coding agent.
Read it fully before proposing designs, writing code, or writing prompts for other agents.
Deeper references live in `docs/` (index: `docs/README.md`).

---

## 1. What we are building

A football-focused **social gaming platform** (not a CRUD app, not a simple quiz app). This is a **monorepo** holding the backend, the mobile app, the data pipeline and the docs (ADR-0011):

- Match predictions (top-5 European leagues + national teams), private by default, editable until kickoff.
- Man of the Match (MOTM) community voting, open for 1 hour after the authoritative match end.
- **Core:** football trivia **battles** against other players, any time, **real-time only** over WebSockets: random 1v1 matchmaking with a bot fallback, and multiplayer private rooms (2 or more players) joined with a code. No Daily Quiz, no solo mode, no async play (ADR-0010). A battle plays one of several **game types** on one shared engine (Buzzer, Career, Who is the player?, Tiki Taka Toe; Imposter in rooms). Answers are **typed text, judged on the server against the round's accepted answers with typo tolerance**; never multiple choice, no suggestions (ADR-0015, ADR-0021). No monetization at launch (ADR-0016).
- Private leagues (prediction and battle competitions).
- Leaderboards: weekly, monthly, seasonal, all-time. Monthly leader gets a prize.
- Friends (mutual), privacy-aware prediction visibility.
- A fact-first football knowledge database that feeds an offline question generator.

Current phase: **Phases 0-2, P3.1 (prediction submit), P5, D.1-D.2, D.3a-d (match data, goals, lineups), P6.1-P6.6, P7, and track N implemented except N6 (parked) (N0 rock-paper-scissors first mover, N1 `MINES`, N2 `AUCTION`, N3 `VAULT`, N4 `HEX`, N5 `LINEUP`, N7 `THREAD`, N8 `ONE_TWO` on a link graph, N9 `BRIDGE` on the same graph); mobile M0-M1.5 done (data and application layers only, no new UI); DEC-44 done (a player never gets a seen question while unseen ones remain); next: P8 private rooms in three PRs: P8a rooms, P8b `IMPOSTER` (08 §18, DEC-58 chosen), P8c topic filters (N6 `TIME_MACHINE` parked) (prediction scoring P3.2+ postponed, see `docs/ROADMAP.md`)**. See `docs/ROADMAP.md`.

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
├── .claude/skills/           # project skills: new-module, adr, agent-prompt
├── .claude/agents/           # subagents for the orchestrator (§7.2)
└── scripts/ask-external.sh   # send a task to a non-Claude model through the Cursor CLI (§7.2)
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

Mobile (from `apps/mobile`; Flutter version pinned in `.fvmrc`, details in `apps/mobile/README.md`):

```bash
# one-time
dart pub global activate fvm && fvm install  # installs the pinned Flutter
fvm flutter pub get                          # also generates lib/l10n/generated

# run (backend running on :3000; Android: forward the port first)
adb reverse tcp:3000 tcp:3000
fvm flutter run --flavor dev --dart-define-from-file=config/dev.json

# quality
dart format lib test                         # generated code excluded
fvm flutter analyze
fvm flutter test
fvm flutter test test_live                    # live check, backend on :3000; never in CI (test_live/README.md)

# REST contract
tool/update_openapi.sh                       # backend running: snapshot /docs-json into openapi/openapi.json
tool/generate_api_client.sh                  # Docker: regenerate packages/api_client from the snapshot
```

Football simulator, development only (from `apps/backend`; `npm run cli -- --help` lists every command):

```bash
npm run cli -- mock:run-day --speed 60x      # play the next matchday in accelerated time
npm run cli -- mock:scenario postponed       # kickoff-change | postponed | result-corrected | abandoned
npm run cli -- mock:kickoff <matchId>        # also mock:score, finish, postpone, reschedule, cancel, abandon, correct-result, correct-end-time
```

Question bank (from `apps/backend`; available in every environment, not only development):

```bash
npm run cli -- questions:import ../../data/bundles/dev-0001   # validate + import a bundle; re-import is a no-op
npm run cli -- questions:import ../../data/bundles/dev-0013   # generated game content + its catalog (07 §5.8), every game type, and the link graph (ONE_TWO, BRIDGE; replaces the imported graph)
npm run cli -- questions:publish dev-0013                     # APPROVED questions of that bundle → PUBLISHED (battles pick only these)
npm run cli -- questions:publish dev-0013 --include-drafts    # development: also the unreviewed rounds (refused in production)
npm run cli -- questions:disable <questionId> --reason "…"     # battles stop picking it at once
npm run cli -- questions:reports [--limit 20]                  # most reported questions with their latest reasons (08 §5.7)
python3 -I ../../data/generate/dev_bundle.py                  # rebuild the hand-written dev bundle (bump its version first)
```

Scoring rule sets (from `apps/backend`; a battle keeps the rule set active when it was created, `08` §6.1):

```bash
npm run cli -- battles:activate-rule-set config/scoring/battle.dev.json   # BATTLE leaderboard points; same config again = no-op; devOnly refused in production
```

Knowledge base pipeline (from `data/`; Python 3.12+, writes to the `football_kb` database, `FOOTBALL_KB_URL` overrides the default local URL):

```bash
python3 -m venv .venv && .venv/bin/pip install 'psycopg[binary]>=3.2' pytest ruff   # once
.venv/bin/python -m kb migrate                                     # apply kb_migrations/*.sql
.venv/bin/python -m kb ingest --scope config/scope.dev.toml       # 4 clubs, ~6 min first time; cached afterwards
.venv/bin/python -m kb ingest --scope config/scope.toml           # 9 leagues; --refresh refetches from Wikidata
.venv/bin/python -m kb sources:fetch                             # D.3a: download config/sources.toml files into raw_downloads/ and load raw.*; --source <id>, --refresh
.venv/bin/python -m kb link                                      # D.3b: source ids → Wikidata entities (core.entity_xref); --source transfermarkt|fjelstul; run again after every ingest; unlinked ids → .out/link-review-<source>.csv
.venv/bin/python -m kb ingest:matches                            # D.3c/d: claims → core.match (resolved results), core.goal and core.lineup_slot (Transfermarkt, then Fjelstul World Cup lineups), offline; rerun after ingest or link
.venv/bin/python -m kb names:missing --locale ar                  # entities without an Arabic name → .out/names-missing-ar.csv
.venv/bin/python -m kb catalog --out .out/catalog                 # write catalog.jsonl
.venv/bin/python -m kb bundle --version dev-0014 --out bundles/dev-0014 --careers 60 --buzzers 60 --who 60 --grids 30 --mines 40 --auctions 60 --vaults 60 --hexes 30 --lineups 60 --one-twos 60 --bridges 40 --threads 100 --links-min-player-sitelinks 60 --catalog-min-player-sitelinks 40   # generated bundle (07 §5.8); --one-twos and --bridges write the link graph too (--bridge-size, --bridge-clubs, --bridge-min-answers); --threads (--thread-min-player-sitelinks, --threads-per-final)
FOOTBALL_KB_TEST_URL=postgresql://game:game@localhost:5440/football_kb_test .venv/bin/python -m pytest   # needs CREATE DATABASE football_kb_test once
.venv/bin/ruff check . && .venv/bin/ruff format --check .
```
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

**Retired on 2026-11-18 (product owner):** the orchestrator (§7.2) now owns mobile work through the `mobile` agent, and the separate mobile session is no longer used. The rules below stay for the case the user runs two sessions again.

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

### 7.2 Orchestrator and subagents

The main session is the **orchestrator**. It knows this codebase, keeps the conversation with the user, and delegates to the subagents in `.claude/agents/`. Subagents cannot start other subagents: the hierarchy is one level deep.

| Agent | Model | Owns | Use for |
|---|---|---|---|
| `backend` | sonnet | `apps/backend/`, `docs/api/` (contract changes in the brief), a learn card where the brief says | normal backend tasks |
| `backend-heavy` | opus | same | architecture, concurrency, engine and protocol changes, cross-module refactors |
| `data` | sonnet | `data/`, a learn card where the brief says | normal pipeline tasks |
| `data-heavy` | opus | same | linking, conflict resolution, generator uniqueness, data-quality investigations |
| `mobile` | sonnet | `apps/mobile/`, `learn/mobile/` | Flutter tasks; while no new UI is wanted, only data and application code |
| `quick` | haiku | the files the brief names | search, formatting, routine test runs, tiny exact edits |
| `reviewer` | opus | nothing (read-only) | review every implementation diff and every external-model output |
| `external-worker` | haiku | nothing | wraps `scripts/ask-external.sh` (Cursor CLI, read-only); only when the user routes a task there |

**When to delegate:**
- Delegate work that is independent and substantial: the backend and mobile halves of a feature, a data step, a review. Do small or tightly coupled edits yourself.
- Docs owned by the orchestrator: `docs/architecture/`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, ADRs, `CLAUDE.md`, `.claude/`. Agents report needed doc changes under "Needs from others".
- Pick the agent by difficulty: opus variants for hard tasks, sonnet for normal implementation, `quick` (haiku) for small ones.

**Contract first:**
- The shared contracts already exist: `docs/api/API.md` and `docs/api/WEBSOCKET.md`, the OpenAPI snapshot `apps/mobile/openapi/openapi.json` with its generated client, and the bundle format in `07` §5.4.
- When a feature spans backend and mobile, settle the contract change in those files first, then brief both agents against it. No new contract files.

**Briefs and parallel launch:**
- Launch independent agents **in parallel, in one message**.
- Each brief is self-contained, because agents cannot see this conversation: the goal, the design sections to read, the exact files or folders allowed, the acceptance criteria, the checks to run, and the non-goals. The `agent-prompt` skill gives the shape.

**Isolation:**
- Parallel agents get disjoint folders, so no two agents edit the same file. `learn/` cards go in the folder the brief names; `learn/README.md` is the orchestrator's (agents send the index line under "Needs from others").
- If two tasks must touch the same files, run them one after the other, or start one with `isolation: "worktree"` (its own git worktree, merged back by the orchestrator).
- Subagents never commit, push, merge or switch branches. The orchestrator commits each finished step (Conventional Commits, one logical step per commit).

**Review loop:**
1. When the implementation agents finish, run `reviewer` on the diff (for example `git diff main...HEAD`, or the listed files) with the brief's acceptance criteria.
2. For each finding: fix it yourself if it is small, re-delegate if it is not, and say so when it is not worth fixing.
3. Re-run the checks. Report to the user only what passed, with exit codes.

**External models:**
- Only for tasks the user explicitly routes there.
- `external-worker` returns the raw answer. `reviewer` checks it before anything is applied, and the orchestrator applies it.
- Cursor must be logged in (`cursor-agent login`); `scripts/ask-external.sh --list-models` lists the models.

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
| Battle game types, shared engine, game rules, answer catalog | `docs/architecture/08-battle-games.md` |
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
