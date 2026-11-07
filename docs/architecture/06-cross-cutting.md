# 06 — Cross-Cutting: Security, Scalability, Observability, Testing

## 1. Security

### 1.1 MVP (required before any public user)

| Area | Control |
|---|---|
| Authentication | Provider token verification, short-lived JWT, rotating refresh tokens with reuse detection (`04-auth.md`) |
| Authorization | Global auth guard; resource policies per module; deny by default; IDs in URLs never imply access |
| Private predictions | One `PredictionVisibilityPolicy`; integration test per read path; responses for other users never include picks unless the policy allows |
| Answer secrecy | Battle payloads never include correctness before the round closes; question DTOs built by a dedicated mapper that has no access to correctness |
| Input validation | Global `ValidationPipe({whitelist: true, forbidNonWhitelisted: true, transform: true})`; domain re-validates invariants; size limits on bodies (e.g., 100 KB) |
| WebSocket validation | Every message validated against a DTO; unknown events ignored and counted; per-socket message rate limit; payload size limit |
| Replays and duplicates | Natural idempotency (PUT semantics, unique keys), `Idempotency-Key` for non-idempotent POSTs, `clientMsgId` for socket answers |
| Rate limiting | `@nestjs/throttler` with Redis storage: global per-IP baseline, strict limits on `/auth/phone/otp`, `/auth/*`, user search, friend requests, league joins, room joins (code guessing) |
| SQL injection | Prisma parameterization; `$queryRaw` with tagged templates only (never `$queryRawUnsafe` with user input) |
| Secrets | Not in git; validated at boot; dev-only adapters refuse to run in production |
| Transport | HTTPS only in deployed environments; HSTS; WSS for sockets |
| Headers / CORS | `helmet`; CORS allow-list (mobile apps do not need CORS; the future web app does) |
| Logging hygiene | pino redaction for `authorization`, tokens, OTPs, phone numbers (mask all but the last 2 digits), emails |
| Abuse | User blocks; report-question endpoint (feeds question disable); friend request rate limits |
| Account takeover | See `04-auth.md` §9 |
| Dependencies | `npm audit` / Dependabot in CI (free) |

### 1.2 Future enhancements

App attestation (Play Integrity / App Attest) for OTP and battles; anomaly detection for battle cheating (answer-time distributions, answers faster than reading time, pairs of accounts that meet unusually often in rooms or matchmaking); device fingerprint limits per account for prize eligibility; admin audit log; WAF/CDN in front of the API; regular key rotation.

### 1.3 Fair-play notes for trivia (product + tech)

Battles are real-time with short round deadlines, which already limits searching for answers. The remaining risks and mitigations:

| Risk | Mitigation |
|---|---|
| Searching answers during a round | Short round timers (DEC-32); server-measured answer times; flag statistically impossible speeds |
| Sharing answers in a private room (players sitting together) | Option order shuffled per player (DEC-44); room battles earn no leaderboard points (Decided, DEC-41) |
| Collusion: a friend throws the game, or one person plays their own second account | Room battles earn no leaderboard points (Decided, DEC-41); matchmaking pairs random people; detect account pairs that meet unusually often |
| Farming easy bot wins | Bot battles earn no leaderboard points; bots always labeled (Decided, DEC-41/40) |
| Memorizing a small bank | Per-player exposure exclusion (DEC-44); large bank (risk K-09) |

Do not promise "cheat-proof"; design so cheating is unrewarding for prizes (prize eligibility checks before awarding).

## 2. Scalability

### 2.1 Starting point (A-07 scale)

One API process (HTTP + WS), one worker process, one Postgres, one Redis, on one machine. This comfortably serves the assumed launch scale if queries are indexed and transactions are short.

### 2.2 Evolution path (do each step only when a metric demands it)

| Step | Trigger metric | Change |
|---|---|---|
| 1 | p95 latency or CPU on the API | Run 2+ API instances behind a load balancer. The API is stateless for REST (JWT, no server sessions) |
| 2 | WebSocket battles across instances | Sticky sessions at the load balancer + `@socket.io/redis-adapter` + Redis battle ownership lock (`battle:owner:{id}`, TTL heartbeat). Matchmaking queue is already in Redis |
| 3 | Job backlog (`queue_waiting`) | More worker processes; split hot queues into dedicated workers |
| 4 | DB connections | PgBouncer (transaction pooling); a Prisma connection limit per process |
| 5 | Read load on leaderboards | Cache top pages in Redis ZSET or plain key cache with short TTL; read replica for leaderboard and history reads |
| 6 | Table size (`point_entries`, `battle_answers`) | Native monthly partitioning (indexes already compatible) |
| 7 | One module dominates resources or needs independent deploys | Extract that module (likely `battles`) using its existing public interface + events |

### 2.3 Database performance rules

- Every list endpoint uses keyset pagination over an index; no `OFFSET` beyond small pages.
- Every query on a hot path has an index in `02-database.md`; new queries add their index in the same migration.
- Transactions are short; no network calls (providers, SMS) inside a transaction.
- Use `EXPLAIN ANALYZE` in integration tests for the 5 hottest queries (leaderboard page, my rank, friends' predictions for a match, matches by date, battle question selection with recent-exposure exclusion).

### 2.4 Caching strategy

| Data | Cache? | How |
|---|---|---|
| Match lists by date/competition | Yes, short TTL (30-60s) | In-memory LRU per instance, or Redis when multi-instance |
| Leaderboard first pages | When measured | Redis key per (period, category, page 1), TTL 30s, invalidated on rebuild |
| User public profiles | Optional | In-memory LRU (60s) |
| Predictions, votes, rooms, battles | **No** | Correctness first; always read the DB (live battle state is in the engine's memory anyway) |
| Playable question payloads by (question id, locale) | Yes | Published question content is immutable per version: in-memory LRU of the localized payload (without correctness), invalidated on disable |
| Recent question exposures per user | When measured | Redis list per user, refreshed on battle completion, if the exposure query (DEC-44) gets hot |

### 2.5 Real-time state ownership

Each battle has exactly one owner engine (the instance that created it). Messages for that battle must reach the owner: on a single instance this is trivial; multi-instance uses sticky sessions + the Redis adapter, and the owner lock prevents two engines from running the same battle.

## 3. Observability (free, self-hosted)

| Concern | Tooling |
|---|---|
| Structured logging | `nestjs-pino` JSON logs; fields: `time`, `level`, `msg`, `requestId`, `userId` (when authenticated), `module`, `route`, `durationMs`, `jobId`, `battleId` |
| Correlation IDs | Accept `X-Request-Id` or generate one; propagate via `nestjs-cls` into logs, outbox metadata and jobs; return it in responses and in problem+json `traceId` |
| Error handling | One global exception filter → problem+json; domain errors → 4xx with stable `code`; unexpected → 500 with `traceId`, full error logged |
| Metrics | `prom-client` at `/metrics` (internal only): HTTP RED metrics, DB pool, job metrics (`05-background-jobs.md` §7), WS metrics (below) |
| Dashboards | Optional Prometheus + Grafana in Docker Compose (free) |
| Health checks | `@nestjs/terminus`: `/health/live` (process up), `/health/ready` (DB + Redis reachable, migrations applied); worker exposes the same on a separate port |
| Job monitoring | Bull Board (dev), job metrics, outbox lag metric |
| WebSocket diagnostics | `ws_connections{namespace}`, `ws_messages_total{event,result}`, `ws_rejected_messages_total{reason}`, `battles_active{mode}`, `battle_round_latency_ms` (deadline vs answer receive), `matchmaking_wait_seconds`, `matchmaking_bot_fallback_total`, `rooms_active`, `room_join_failures_total{code}`, `question_selection_relaxed_total` (bank too small for the exposure window); log connect/disconnect with reason |
| Tracing | Future: OpenTelemetry → Jaeger/Tempo (free) when there is more than one service |

## 4. Testing strategy

### 4.1 Pyramid and focus

Business rules and workflows are where bugs cost the most (wrong points, leaked predictions, votes after the window). Tests concentrate there.

| Level | Scope | Tools | Examples |
|---|---|---|---|
| Unit (most) | Domain models, policies, calculators, period math; no Nest, no DB | Jest, `FixedClock` | `PredictionScorer` against rule-set fixtures; `LockPolicy`; `PredictionVisibilityPolicy` matrix; period key around DST/new year; MOTM aggregation strategies; battle state machine transitions; `BattleScorer` and `PlacementCalculator` (ties, N players); `BotPlayer` with a seeded `RandomSource`; room lobby rules (host transfer, capacity) |
| Module/application | Use cases with in-memory or test-double ports | Jest | `SubmitPrediction` returns `PREDICTION_LOCKED` when the reader says locked; `CastVote` maps 0-row results to the right error |
| Integration | Repositories, raw SQL, transactions, outbox, BullMQ handlers against **real** Postgres/Redis | Jest + Testcontainers (free, Docker) | Conditional prediction upsert at the kickoff boundary; outbox written atomically; handler idempotency (run twice → same state); leaderboard rebuild equals incremental result |
| Concurrency | Races that matter | Integration tests firing parallel requests | 50 parallel edits around kickoff → none accepted after `kickoff_at`; duplicate votes → one row; two battle answers same round → first wins; two joins for the last room seat → one `ROOM_FULL`; double start → one battle; parallel friend requests A→B and B→A → one pending/friendship |
| E2E (HTTP) | Full flows through the API | Supertest against a booted app + Testcontainers | Sign in (fake provider adapter) → predict → simulate match → scoring job → leaderboard shows points |
| WebSocket | Battle and lobby protocol | `socket.io-client` in tests, fake clock for round and bot timers | Pairing, bot fallback after the wait, room lobby pushes, 3-player room battle, ready timeout with partial readiness, answer ack, duplicate `clientMsgId`, late answer, disconnect → reconnect → resync snapshot, forfeit after grace |
| Auth | Verification adapters and session logic | Unit with signed test JWTs (local JWKS), integration for refresh rotation | Wrong `aud` rejected; refresh reuse revokes family; OTP attempts lockout |
| Contract | OpenAPI document stays in sync | Generate the spec in CI and diff it; fail on breaking changes without a version bump | |

### 4.2 Rules

- Domain unit tests never hit the DB or the clock; inject `FixedClock`.
- Each open decision (DEC-xx) that is configurable gets tests for **at least two config values**, proving the system is not secretly hard-coded.
- Scoring tests are table-driven fixtures (input picks + result + rule set → expected points/breakdown), so new rules add rows, not code.
- Integration tests run each test in a transaction or truncate between tests; migrations run once per container.
- CI (free GitHub Actions minutes for public repos, or local `act`): lint → typecheck → unit → integration → e2e → dependency-cruiser boundaries → OpenAPI diff.

### 4.3 Test data

- `prisma/seed.ts` + mock football seed JSON: 5 leagues + national teams, one season, realistic fixtures, squads.
- Simulator CLI scenarios (`mock:scenario kickoff-change`, `postponed`, `result-corrected`, `abandoned`) reproduce every edge case in `03-workflows.md` for manual and automated testing.
