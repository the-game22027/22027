# Never block the boot on a dependency
> A process must start even when the database or Redis is down; it reports "not ready" and recovers, instead of crashing or hanging.

**Problem:** the battle engine cleans up after a restart (unfinished battles become `ABANDONED`, stale queue tickets are freed). The first version did this inside `onApplicationBootstrap` and awaited it. With Redis down the boot waited forever; with Postgres down it crashed. The health test caught it: an API that cannot start cannot even answer `/health/ready` with 503.

**How:**
- Start the cleanup in the background (`void work().catch(log)`); the boot returns at once.
- Wait for the connection inside that background work (`redis.once('ready')`), not in the boot.
- On shutdown, release what you can and ignore a dependency that is already gone; leftovers expire (TTL) or the next boot clears them.
- Readiness checks (`/health/ready`) tell the load balancer when the process can serve.

**In our code:** `onApplicationBootstrap` in [battle-engine.ts](../../apps/backend/src/modules/battles/application/battle-engine.ts) and [matchmaking.service.ts](../../apps/backend/src/modules/battles/application/matchmaking.service.ts); the test that caught it: [health.int-spec.ts](../../apps/backend/test/integration/health.int-spec.ts).

**Watch out:**
- Background work can still be running when the first requests arrive. Here that is harmless: a player who joins early just finds their old ticket already freed.
- Log failures of background work, or they disappear silently.

**Check yourself:** why is crashing at boot fine for a bad config file, but not for Redis being down?
<details><summary>Answer</summary>A bad config never fixes itself, so failing fast is the honest answer. Redis being down is temporary; the process should wait it out and report not ready.</details>
