# Leases
> Claim work for a limited time instead of locking it while you do it.

**Problem:** holding a database lock during a network call ties up a connection for as long as the other side is slow. Without any lock, two workers do the same job, and a crashed worker's job is stuck forever.

**How:**
- One short statement claims the rows: `available_at = now() + lease`, plus an owner id. It commits at once.
- Do the slow work with no transaction open.
- Crash? Nothing to clean up. When the lease ends, the rows are claimable again.
- Every later write checks the owner id (a **fencing** check), so a worker that ran past its lease changes nothing.

**In our code:** `claim`, `markPublished` and `countLostLeases` in [outbox.publisher.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.publisher.ts). Tests: `claiming` in [outbox.int-spec.ts](../../apps/backend/test/integration/outbox.int-spec.ts).

**Watch out:** the work must finish inside the lease. We stop starting new rows halfway through it, and config refuses a lease shorter than twice the publish timeout.

**Check yourself:** a worker pauses past its lease, then adds the job to Redis anyway. What stops a duplicate?
<details><summary>Answer</summary>The owner check stops it from marking the row. The fixed `jobId` makes the second add a no-op in BullMQ, and idempotent handlers cover anything left.</details>
