# Persistence: RDB snapshots and the AOF log
> Redis keeps data in RAM; to survive a restart it can save snapshots (RDB), log every write (AOF), or both.

**Problem:** Redis restarts (deploy, crash, laptop reboot). Without persistence, every queued job and ticket is gone.

**How:**
- **RDB:** a point-in-time file every N seconds/changes. Compact, fast restart; loses writes since the last snapshot.
- **AOF** (`appendonly yes`): appends each write; replayed at start. With `appendfsync everysec` (default) you lose at most about a second.
- Both can be on. AOF is rewritten in the background so it does not grow forever.

**In our code:** [docker-compose.yml](../../docker-compose.yml) runs `redis-server --appendonly yes` with a volume, so BullMQ jobs survive a restart. Tests use a throwaway Redis without persistence ([global-setup.ts](../../apps/backend/test/support/global-setup.ts)).

**Watch out:** persistence is not a backup. A bad command (`FLUSHALL`) is persisted too. Anything that must never be lost belongs in Postgres; that is why events start in the outbox table, not in Redis.

**Check yourself:** our outbox writes events to Postgres first and only then to BullMQ. What does that buy if Redis loses its data?
<details><summary>Answer</summary>Unpublished rows stay in `outbox_events`, so the publisher sends them again. Jobs that were in Redis but not yet processed are the risk; handlers are idempotent, so republishing is safe.</details>
