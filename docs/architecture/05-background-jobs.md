# 05 — Background Jobs

## 1. Principles

1. **Synchronous by default.** A user action whose result the user waits for runs in the request transaction: submit prediction, cast vote, friend request, create/join league, create/join/start a battle room.
2. **Async only when** the work is triggered by time (closing a window), fans out (scoring thousands of predictions), is derived (ledger → leaderboards), is slow or external (provider sync, imports), or must survive a crash (anything triggered by a domain event).
3. **Every job is idempotent.** BullMQ is at-least-once; the outbox publisher can publish twice; workers can crash after committing. Idempotency comes from natural unique keys and conditional updates, not from hoping a job runs once.
4. **Jobs carry IDs, not state.** A handler reloads current state, so a stale payload cannot overwrite newer data.
5. **Real-time battle timers are not BullMQ jobs.** Round deadlines, ready deadlines, reconnect grace and bot answer delays need millisecond precision and live in the battle engine (in-memory timers in the API process), persisted to Postgres at each transition. The matchmaking matcher loop (including bot fallback) and room idle timers also run in the API process, because they must push WebSocket events (`03-workflows.md` §3).

## 2. Workload inventory

| Workload | Trigger | Mechanism | Queue | Idempotency | Notes |
|---|---|---|---|---|---|
| Outbox publishing | New `outbox_events` rows | Polling loop in the worker (~1s) | → subscriber queues | `jobId = <eventId>__<subscriber>` | `FOR UPDATE SKIP LOCKED` so several workers can run |
| Football sync (mock now) | Schedule | BullMQ job scheduler | `football-sync` | Provider `version`/`provider_updated_at` checks | Mock provider reads seed files; the simulator CLI drives live states |
| Score match predictions | `MatchFinished`, `MatchResultCorrected`, `ScoringRuleSetActivated` | Event handler | `predictions` | PK `(prediction_id, rule_set_id, match_result_version)` | Pages of 1,000; resumable |
| Void predictions | `MatchCancelled`, postponement policy | Event handler | `predictions` | Conditional update `status <> 'VOID'` | |
| Open MOTM poll | `MatchFinished` | Event handler | `motm` | UQ `motm_polls.match_id` | Schedules the close job |
| Close + aggregate MOTM | `closes_at` | BullMQ **delayed job** + sweeper (every minute) | `motm` | `UPDATE ... WHERE status='OPEN' AND closes_at <= now()` | Sweeper covers lost delayed jobs |
| Record points | Game completion events | Event handler | `points` | UQ `(source_type, source_id, rule_set_id, source_revision)` | Supersedes older revisions |
| Update leaderboards | `PointsRecorded`, `PointsSuperseded` | Event handler | `leaderboards` | Recompute absolute value per (period, user) under an advisory lock | Never `+=` without a guard |
| Period lifecycle | Schedule (hourly) | BullMQ job scheduler | `leaderboards` | Upsert periods by UQ; conditional status changes | Creates upcoming periods, closes ended ones, finalizes after grace (DEC-28) |
| Stale battle sweeper | Schedule (1 min) | BullMQ job scheduler | `battles` | Conditional status update | Marks battles without an owner heartbeat `ABANDONED`; returns their rooms to `LOBBY` |
| Idle room sweeper (backstop) | Schedule (1 min) | BullMQ job scheduler | `battles` | `UPDATE battle_rooms SET status='CLOSED' WHERE status='LOBBY' AND expires_at <= now()` | The API's in-memory room timer is primary and notifies clients; this only fixes the DB if a timer was lost |
| Question import | CLI command | Runs the use case directly (no queue) | — | `external_key` + `content_hash` | A long CLI run is simpler than a job for a manual action |
| Question stats | `BattleCompleted` | Event handler | `question-bank` | Insert into `question_stats_applied(battle_id)` in the same transaction; skip if present | Folds the event's `questionResults` into `question_stats` |
| Account deletion fan-out | `UserDeleted` | Event handlers in each module | per module | Deletes/anonymizes are idempotent | |
| Maintenance | Schedule (daily) | BullMQ job scheduler | `maintenance` | Deletes by age | Sessions, outbox, idempotency keys, old battle answers, closed rooms, `question_stats_applied` (retention table in `02-database.md` §6) |
| Notifications | Events | Future | `notifications` | — | Not MVP |

## 3. Topology

- **Process:** `main.worker.ts` boots the same Nest modules with processors and schedulers enabled, without the HTTP server or WS gateway. Start with **one worker process**; scale by running more (BullMQ distributes jobs; the outbox publisher uses `SKIP LOCKED`).
- **Queues:** one per owning module (listed above). A queue name never encodes the producer, only the consumer module, so ownership stays clear.
- **Concurrency (initial):** `predictions` 2, `points` 4, `leaderboards` 4, `motm` 4, others 1. Tune with metrics.

## 4. Retry, failure, dead letters

| Setting | Default (Recommended) |
|---|---|
| Attempts | 5 (provider sync 10) |
| Backoff | Exponential, base 2s, with jitter |
| Completed jobs | Removed after 24h (keep last 1,000) |
| Failed jobs | Kept 14 days in BullMQ's failed set = **dead-letter store** |
| Non-retryable errors | Domain errors that will never succeed (e.g., entity deleted) throw `UnrecoverableError` → straight to failed |
| On final failure | Structured error log with `jobId`, queue, event id; metric `jobs_failed_total{queue}`; visible in Bull Board |
| Replay | Bull Board "retry", or a CLI `jobs:retry <queue> <jobId>`; safe because handlers are idempotent |

Outbox rows that cannot be published (Redis down) stay unpublished and are retried by the loop; `attempts`/`last_error` columns make stuck events visible.

## 5. Scheduling details

- Use BullMQ **Job Schedulers** (repeatable jobs) registered on worker boot with fixed scheduler ids, so restarts do not create duplicates.
- Time-anchored work (MOTM close) uses **delayed jobs plus a sweeper**: delayed jobs give precision, the sweeper guarantees completion even if a delayed job is lost or the worker was down.
- Cron expressions use the platform timezone where business periods matter (period lifecycle) and UTC otherwise.

## 6. Redis requirements

- `maxmemory-policy noeviction` (BullMQ requirement: evicted keys corrupt queues).
- AOF persistence enabled outside local dev.
- One logical Redis is enough; separate key prefixes: `bull:*`, `mm:*` (matchmaking), `act:*` (one activity per user), `rl:*` (rate limits), `cache:*`.

## 7. Observability

- **Bull Board** (open source) mounted in the API at `/admin/queues`: dev only for now, behind admin auth later.
- Metrics (prom-client): `jobs_processed_total{queue,status}`, `job_duration_seconds{queue}`, `queue_waiting{queue}`, `outbox_unpublished_events`, `outbox_oldest_unpublished_age_seconds`.
- Every job log line carries `jobId`, `queue`, `eventId`, `correlationId` (copied from the originating request into the outbox payload metadata).

## 8. What we deliberately do not do

- No Kafka, no separate event bus: outbox + BullMQ covers at-least-once delivery at this scale.
- No sagas framework: flows are short, and compensations are explicit use cases (void, supersede).
- No jobs for user-facing writes "to be fast": they would make errors invisible to the user and add eventual consistency where none is needed.
