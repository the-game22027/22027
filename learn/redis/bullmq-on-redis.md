# BullMQ: job queues on Redis
> BullMQ stores jobs in Redis; producers add them, workers take them, and Redis keeps the state (waiting, active, delayed, completed, failed).

**Problem:** work that must run outside the request (record points after a battle, sync football data every minute) needs to survive restarts, retry on failure and run on any worker.

**How:**
- **Queue** (`points`, `leaderboards`, `question-bank`, `football-sync`): a set of keys `bull:<name>:*`.
- **Job:** name + data + options. Our outbox events become jobs with `jobId = <eventId>__<subscriber>`, so adding the same job twice is a no-op while it is kept.
- **Worker** (`@Processor(queue, { concurrency })`): takes a job, runs `process()`, marks it completed or failed.
- **Retries:** `attempts: 5` with exponential backoff; failed jobs are kept 14 days as the dead-letter store.
- **Schedulers:** `upsertJobScheduler` adds a job every N ms (football sync).
- **Bull Board** at `/admin/queues` shows every queue and job.

**In our code:** [queue-provider.ts](../../apps/backend/src/shared/infrastructure/queue/queue-provider.ts), [job-defaults.ts](../../apps/backend/src/shared/infrastructure/queue/job-defaults.ts), [outbox.publisher.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.publisher.ts), processors such as [points-events.processor.ts](../../apps/backend/src/modules/points/presentation/points-events.processor.ts). Related: [transactional-outbox](../backend/transactional-outbox.md), [retries-and-dead-letters](../backend/retries-and-dead-letters.md), [scheduled-jobs](../backend/scheduled-jobs.md).

**Watch out:** delivery is at-least-once: a worker can crash after doing the work but before marking the job done. Every handler must be idempotent.

**Check yourself:** why not let the API add BullMQ jobs directly, without the outbox table?
<details><summary>Answer</summary>The database commit and the Redis write are two systems. A crash between them loses the job (or sends a job for a change that rolled back). Writing the event in the same Postgres transaction makes it all-or-nothing.</details>
