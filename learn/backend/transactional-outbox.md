# Transactional outbox
> Save the event in the same DB transaction as the change. A background loop publishes it later.

**Problem:** "save the prediction, then send an event to Redis". If the app crashes between the two steps, the event is lost. If you send first and the DB write fails, you announced something that never happened.

**How:**
- The use case writes the state change **and** a row in `outbox_events` in one transaction. Both happen or neither does.
- The worker polls unpublished rows with `FOR UPDATE SKIP LOCKED` (two workers never grab the same row), adds BullMQ jobs, and marks the rows published.
- Delivery is **at-least-once**: a job can arrive twice, so handlers must be [idempotent](idempotency.md).

**In our code:** [outbox.writer.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.writer.ts) (throws outside a transaction), [outbox.publisher.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.publisher.ts), [outbox.int-spec.ts](../../apps/backend/test/integration/outbox.int-spec.ts).

**Watch out:** never call Redis or HTTP *inside* the DB transaction. It holds locks while waiting on the network.

**Check yourself:** why not just publish to BullMQ right after `COMMIT`?
<details><summary>Answer</summary>A crash between COMMIT and publish loses the event forever. With the outbox, the row survives the crash and gets published on the next poll.</details>
