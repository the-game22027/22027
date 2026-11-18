# The client side: connections, retries and outages
> How the Node client behaves when Redis is slow or down decides whether the API degrades or hangs.

**Problem:** by default ioredis queues commands while disconnected and retries forever. During an outage, requests pile up in memory and hang instead of failing fast.

**How:**
- `enableOfflineQueue: false`: a command while disconnected fails at once.
- `maxRetriesPerRequest: 1`: give up quickly on a broken connection.
- An `error` listener logs and lets ioredis reconnect in the background (without it, errors are unhandled).
- Decide per feature what "Redis down" means: rate limit **fails open** (sign-in still works), the outbox publisher **pauses** (events wait safely in Postgres), readiness reports **not ready**.
- BullMQ opens its own connections from the URL with the settings it needs (workers wait for Redis instead of failing).

**In our code:** [redis.module.ts](../../apps/backend/src/shared/infrastructure/redis/redis.module.ts); fail-open in [redis-throttler.storage.ts](../../apps/backend/src/shared/infrastructure/rate-limit/redis-throttler.storage.ts); `redisIsUp` in [outbox.publisher.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.publisher.ts); `PING` with a 1 s timeout in [redis.health.ts](../../apps/backend/src/shared/infrastructure/health/redis.health.ts). Related: [never-block-boot-on-a-dependency](../backend/never-block-boot-on-a-dependency.md).

**Watch out:** with the offline queue off, code that runs at boot must wait for `ready` first (see `releaseEveryQueueActivity`).

**Check yourself:** why fail open for rate limits but closed for the activity guard?
<details><summary>Answer</summary>Skipping a rate limit for a few minutes risks some abuse; refusing everyone locks all players out. Skipping the guard could put a player in two battles and break the game, so matchmaking errors instead.</details>
