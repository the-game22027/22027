# Agent Prompt — Phase 0: Foundation

> Self-contained prompt for a coding agent. It assumes no access to prior conversations. Copy everything below the line.

---

## Context

You are implementing the foundation of a **Football Social Prediction & Trivia Game** backend: a NestJS **modular monolith** (TypeScript) with PostgreSQL (Prisma), Redis, and BullMQ. Future modules include auth, users, football (matches), predictions, MOTM voting, question bank, real-time quiz battles (Socket.IO; random matchmaking, private rooms, bot opponents; the only quiz mode), points ledger, leaderboards, leagues, and social. **This phase builds only the skeleton and cross-cutting infrastructure that every module will use.** The repository already contains `CLAUDE.md` and `docs/` with the architecture. Read `CLAUDE.md`, `docs/architecture/01-modules.md`, `docs/architecture/05-background-jobs.md` and `docs/architecture/06-cross-cutting.md` before writing code, and follow them.

Constraints that are not negotiable:
- Stack: Node.js 24 LTS, TypeScript (`strict`), NestJS (latest stable), Prisma (latest stable), PostgreSQL 16+, Redis 7+, BullMQ, Jest. Do not introduce another ORM, framework, or language.
- Zero budget: only free/open-source dependencies and local Docker services.
- No business features in this phase (no users, matches, predictions...).
- Domain layer code must never import NestJS, Prisma, Redis, BullMQ, or read `process.env`.

## Scope

1. **Repository layout**
   - `apps/backend/` NestJS project with two entrypoints: `src/main.api.ts` (HTTP server; WebSocket support enabled but no gateways yet) and `src/main.worker.ts` (no HTTP server; boots BullMQ processors and the outbox publisher).
   - `src/modules/` (empty, with a `README.md` explaining the module template from `docs/architecture/01-modules.md` §5), `src/shared/kernel/`, `src/shared/infrastructure/`.
   - Path aliases: `@shared/*`, `@modules/*` (the latter must resolve to each module's `index.ts`).
2. **Docker Compose** at the repo root: `postgres` (16+, init script creating databases `app` and `football_kb`), `redis` (7+, `maxmemory-policy noeviction`, AOF on), optional profiles `observability` (prometheus + grafana) and `ai` (ollama). Named volumes. `.env.example` documenting every variable with fake values; `.env` git-ignored.
3. **Configuration:** a typed config module validated at boot (zod or class-validator; your choice, justify it in the PR description). The app must refuse to start on invalid config.
4. **Shared kernel:** `Clock` interface + `SystemClock` + `FixedClock` (tests); `IdGenerator` producing UUID v7; `DomainError` base class with a stable `code`; cursor pagination types.
5. **HTTP cross-cutting:**
   - URI versioning (`/v1`), global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, `helmet`, body size limit.
   - Global exception filter producing RFC 9457 `application/problem+json` exactly as specified in `docs/api/API.md` §4 (`type`, `title`, `status`, `code`, `detail`, `instance`, `traceId`, optional `errors[]`). `DomainError` subclasses map to their declared HTTP status; unknown errors → 500 `INTERNAL` without leaking stack traces.
   - Request id: accept `X-Request-Id` or generate one; store in `nestjs-cls`; return it in the response header and as `traceId` in errors.
   - `nestjs-pino` structured logging with redaction of `authorization`, `cookie`, `*.token`, `*.refreshToken`, `*.code`, `*.phone`.
   - Swagger at `/docs` (disabled when `NODE_ENV=production`).
   - Health: `@nestjs/terminus` `/health/live` and `/health/ready` (DB + Redis). The worker exposes the same on its own port.
   - `prom-client` metrics at `/metrics` with default Node metrics + HTTP request duration histogram.
6. **Persistence:** Prisma configured for the `app` database with a multi-file schema folder if supported by the installed Prisma version (otherwise one file with module sections); `PrismaService` with graceful shutdown; `@nestjs-cls/transactional` with the Prisma adapter so repositories share a transaction.
7. **Outbox + BullMQ:**
   - Prisma model + migration for `outbox_events` as specified in `docs/architecture/02-database.md` §4.13.
   - `OutboxWriter` (application-facing service) that inserts events inside the current transaction.
   - `OutboxPublisher` loop (worker only): claims unpublished rows with `FOR UPDATE SKIP LOCKED` in batches, adds BullMQ jobs to subscriber queues with `jobId = <eventId>__<subscriber>` (BullMQ rejects `:` in custom ids), marks rows published, records `attempts`/`last_error` on failure.
   - A simple subscription registry: handlers declare which event types they consume and which queue they run on.
   - BullMQ defaults from `docs/architecture/05-background-jobs.md` §4 (attempts, exponential backoff with jitter, retention).
   - Bull Board mounted at `/admin/queues` only when `NODE_ENV !== 'production'`.
8. **Quality gates:** ESLint + Prettier; `dependency-cruiser` rules that (a) forbid `domain/` importing `@nestjs/*`, `@prisma/*`, `bullmq`, `ioredis`, `socket.io`, and (b) forbid deep imports into another module (only `@modules/<name>` allowed); npm scripts `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `depcheck:boundaries`; a GitHub Actions workflow running them, path-filtered to `apps/backend/**` (the repository is a monorepo that also holds `apps/mobile` (Flutter) and `data/` (Python); do not touch those). Add `.github/dependabot.yml` for `npm` (`/apps/backend`) and `github-actions`, weekly. The repository already has PR/issue templates, labels and milestones; do not replace them.
9. **Testing harness:** Jest projects for unit/integration/e2e; Testcontainers helpers for Postgres and Redis (start once per test run, run migrations); Supertest bootstrap helper for e2e.
10. **Developer docs:** update the "Commands" section of `CLAUDE.md` with the real commands you created. Do not document commands that do not exist.

## Expected behavior

- `docker compose up -d postgres redis` then `npm run start:api:dev` and `npm run start:worker:dev` both start cleanly; `/health/ready` returns 200 with DB and Redis up, 503 when either is down.
- A request with an invalid body to a sample validation-only endpoint (create a temporary `/v1/_dev/echo` route available only outside production) returns a problem+json `400 VALIDATION_FAILED` with `errors[]`.
- Throwing a sample `DomainError` (`code: "SAMPLE_CONFLICT"`, status 409) returns a matching problem+json with `traceId` equal to the response `X-Request-Id`.
- Writing an outbox event inside a transaction that rolls back produces **no** job; committing produces exactly one job per subscriber even if the publisher runs twice concurrently.

## Acceptance criteria

- [ ] All scope items implemented; no business modules created.
- [ ] `npm run lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `depcheck:boundaries` pass locally and in CI.
- [ ] A deliberate boundary violation (temporary test file) makes `depcheck:boundaries` fail. Remove it afterwards.
- [ ] Config validation failure stops the process with a clear message.
- [ ] Logs are JSON and never contain the redacted fields.
- [ ] `.env.example` complete; no secrets committed.

## Testing requirements

- Unit: problem+json mapping for `DomainError`, validation errors, unknown errors; `FixedClock`; UUID v7 ordering property.
- Integration (Testcontainers): outbox atomicity (rollback → nothing published; commit → published once); two concurrent publishers do not double-publish (`SKIP LOCKED` + jobId dedup); health readiness reflects DB/Redis availability.
- E2E: request id propagation; versioned route; Swagger disabled in production mode.

## Non-goals (do not do these)

- No authentication, users, football data, predictions, or any other business module.
- No WebSocket gateways (only make sure the platform adapter is installed and configured).
- No Kafka, no microservices, no event sourcing, no paid services, no cloud deployment.
- No admin dashboard UI beyond Bull Board in development.
- Do not change the stack or rename the architecture's concepts.

## Deliverable

A pull request from branch `feat/p0-foundation` into `main` of `github.com/the-game22027/the-game` (Conventional Commits, PR template filled in, linked to the Phase 0 issue and milestone `P0 Foundation`), with a short description of decisions you made within the allowed freedom (e.g., config validation library), how to run everything, and any deviation from the docs with the reason.
