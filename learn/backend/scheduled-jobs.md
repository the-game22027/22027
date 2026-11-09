# Scheduled background jobs
> Work that runs on a timer, in a separate process from the API.

**Problem:** slow syncing inside the API steals capacity from players. A `setInterval` runs once per instance and dies with the process.

**How:**
- A BullMQ **job scheduler** with a fixed id: restarts don't create duplicates, and several workers still produce one job per tick.
- `concurrency: 1`, so two syncs never overlap on one worker.
- Failures retry with backoff. The job must be idempotent, because a retry repeats the work.
- Each run writes a `provider_sync_runs` row, so you can see what happened.

**In our code:** [football-sync.scheduler.ts](../../apps/backend/src/modules/football/presentation/football-sync.scheduler.ts), [football-sync.processor.ts](../../apps/backend/src/modules/football/presentation/football-sync.processor.ts), [football-sync.service.ts](../../apps/backend/src/modules/football/application/football-sync.service.ts).

**Watch out:** don't wrap a whole sync in one transaction. Each match gets its own, so one bad match can't undo the rest and locks stay short.

**Check yourself:** the worker crashes halfway through a sync. What happens?
<details><summary>Answer</summary>The job is retried. Matches already applied come back as `STALE`, so only the unfinished ones do real work.</details>
