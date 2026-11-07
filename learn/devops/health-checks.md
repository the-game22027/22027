# Health checks: liveness vs readiness
> Live: the process isn't stuck. Ready: it can serve traffic right now (DB and Redis reachable).

**Problem:** with one "health" endpoint, a DB outage makes the orchestrator restart every app instance in a loop, which fixes nothing because the DB is still down.

**How:**
- `/health/live` checks nothing external. If it fails, restart the process.
- `/health/ready` pings Postgres and Redis with timeouts. If it fails, stop sending traffic but don't restart.
- Ready returns `503` with the per-dependency result, so you see *which* dependency is down.

**In our code:** [health.controller.ts](../../apps/backend/src/shared/infrastructure/health/health.controller.ts), [redis.health.ts](../../apps/backend/src/shared/infrastructure/health/redis.health.ts), [health.int-spec.ts](../../apps/backend/test/integration/health.int-spec.ts).

**Watch out:** every check needs a timeout. A hanging ping makes the health endpoint hang too.

**Check yourself:** Redis is down. What should `/health/live` return?
<details><summary>Answer</summary>200. The process itself is fine; restarting it won't bring Redis back. Only readiness fails.</details>
