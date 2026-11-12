# Tools like Redis, and when to pick them
> Redis is one of several in-memory or messaging tools; knowing the neighbours tells you why each choice was made.

**Problem:** "use Kafka", "use Memcached", "use RabbitMQ" sound like upgrades but solve different problems with different costs.

**How:**
| Tool | What it is | Pick it when | Here |
|---|---|---|---|
| Redis / Valkey | In-memory data structures | Shared state, queues, counters, small caches | ✅ used |
| Dragonfly, KeyDB | Redis-compatible, multi-threaded | One huge node is the bottleneck | Not needed |
| Memcached | Plain key → bytes cache | Pure cache only, no types or persistence | No: we need structures |
| BullMQ | Job queue library on Redis | Background jobs with retries in Node | ✅ used |
| RabbitMQ | Message broker (AMQP) | Routing between many services and languages | No: one monolith |
| Kafka | Durable replicated log | Very high event volume, replay, stream processing | No: ADR-0001 (no Kafka until measured) |
| Postgres `LISTEN/NOTIFY`, `SKIP LOCKED` | Queues inside the database | Small workloads, one dependency fewer | Partly: the outbox claims rows with `SKIP LOCKED` |

**In our code:** the choice is in [ADR-0001](../../docs/adr/0001-modular-monolith.md) and `05-background-jobs.md`: Redis + BullMQ only where justified, Postgres for truth.

**Watch out:** each new system adds operations (backups, monitoring, upgrades, failure modes). Add one only for a measured need.

**Check yourself:** our outbox already uses `SKIP LOCKED` in Postgres. Why not run all jobs that way and drop Redis?
<details><summary>Answer</summary>Possible for jobs, but we would rebuild retries, backoff, scheduling and a dashboard that BullMQ gives us, and we still need Redis for matchmaking, the activity guard and shared rate limits.</details>
