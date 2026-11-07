# Idempotency
> Running an operation twice has the same effect as running it once.

**Problem:** networks retry, queues redeliver, users double-tap. Without idempotency, a retried "award 10 points" awards 20.

**How:**
- Give each operation a natural unique key and let the database reject the duplicate: `UNIQUE(source_type, source_id, rule_set_id)` on points.
- Dedupe queue jobs by id: our outbox job id is `<eventId>__<subscriber>`, so BullMQ ignores a second add.
- Write conditional updates: `UPDATE … WHERE status <> 'VOID'`.

**In our code:** `outboxJobId` in [outbox-event.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox-event.ts); the "publish twice" test in [outbox.int-spec.ts](../../apps/backend/test/integration/outbox.int-spec.ts).

**Watch out:** "check if it exists, then insert" is not idempotent under concurrency (two requests both see "not exists"). Use a unique constraint.

**Check yourself:** what's the difference between at-least-once and exactly-once delivery?
<details><summary>Answer</summary>At-least-once may deliver duplicates; exactly-once is nearly impossible across systems. In practice: at-least-once delivery + idempotent handlers = exactly-once *effect*.</details>
