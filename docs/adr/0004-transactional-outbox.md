# ADR-0004: Transactional outbox + BullMQ for cross-module asynchronous reactions

- **Status:** Proposed
- **Date:** 2026-11-07
- **Related:** 01-modules.md §6, 05-background-jobs.md

## Context
A finished match must reliably trigger scoring and MOTM voting; a completed battle must reliably reach the ledger. Writing to the DB and enqueueing to Redis separately can lose events (crash between the two) or emit events for rolled-back changes.

## Decision
Use cases insert `outbox_events` in the same DB transaction as the state change. A worker loop publishes them to BullMQ queues (`FOR UPDATE SKIP LOCKED`, `jobId = <eventId>__<subscriber>`; BullMQ rejects `:` in custom ids). Delivery is at-least-once; handlers are idempotent via natural unique keys.

## Alternatives considered
| Option | Why not |
|---|---|
| In-process `EventEmitter` | Lost on crash; runs inside the request; no retries |
| Enqueue to BullMQ directly after commit | Crash window loses events |
| Kafka / RabbitMQ | Extra infrastructure without a scale requirement |
| Postgres LISTEN/NOTIFY only | Not durable by itself; still needs a table |

## Consequences
+ No lost or phantom events; retries and dead letters via BullMQ.
− Small publish latency (~1s); outbox table maintenance.
