# ADR-0013: Outbox publishing with leases, backoff and dead letters

- **Status:** Accepted
- **Date:** 2026-11-10
- **Related:** ADR-0004 (publishing mechanics superseded), 05-background-jobs.md §4, 02-database.md §4.13

## Context
ADR-0004 published inside a transaction: `FOR UPDATE SKIP LOCKED` held the row locks and a database connection for every Redis call in the batch. A slow Redis tied up connections, and the transaction could hit its timeout after the jobs were already added. Failed events retried on every poll with no delay and no limit. BullMQ queues commands while Redis is down, so a publish could also hang.

## Decision
- One statement claims a batch: it raises `attempts`, sets a per-batch `claimed_by`, and moves `available_at` forward by the lease. Redis is called after that statement commits.
- `available_at` is the only eligibility check. It carries both the lease and the retry backoff, so a crashed publisher needs no cleanup.
- Later writes require the matching `claimed_by`, so a publisher that lost its lease changes nothing.
- A failure waits exponentially with equal jitter. At `OUTBOX_MAX_ATTEMPTS` the row gets `dead_lettered_at` and stays in the table for an operator.
- `attempts` counts publishes started. A row released without being tried gets its attempt back.
- No events are claimed while Redis does not answer `PING`.

## Alternatives considered
| Option | Why not |
|---|---|
| Keep the transaction, add retries | Still holds locks and a connection during network calls |
| Separate `claimed_until` and `next_attempt_at` columns | Two columns and two conditions for one question: can this row be claimed now? |
| A dead-letter table | Moving rows adds a second write path; a column and the existing row are enough at this scale |
| Heartbeats to renew leases | More moving parts; instead a batch stops starting rows halfway through its lease |

## Consequences
+ Redis slowness no longer holds database locks or connections.
+ A crash delays its events by at most one lease, and a Redis outage does not dead-letter healthy events.
− A crash between adding jobs and marking rows re-adds them. `jobId` dedup covers this while BullMQ retains the job, and handlers stay idempotent for the rest.
− Events can publish out of order after a retry. Handlers already cannot rely on order, because delivery is at-least-once.
− Dead letters need a person: an alert on `outbox_dead_lettered_events` and the requeue in 05-background-jobs.md §4.

Revisit if publish volume makes polling or the single index a measured bottleneck.
