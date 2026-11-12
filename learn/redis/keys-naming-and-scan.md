# Key names, and SCAN instead of KEYS
> Name keys `area:kind:id`; to find many keys, walk them with `SCAN` in small batches, never `KEYS *`.

**Problem:** Redis has one flat key space per database. Without a naming scheme you cannot tell who owns a key, clean up one feature, or inspect it. And `KEYS pattern` reads every key in one command: on a big instance it blocks every other client for seconds.

**How:**
- Prefix by owner and purpose: `act:<userId>`, `mm:queue:<gameType>`, `mm:ticket:<ticketId>`, `rl:auth:<ip>` (sign-in rate limit); BullMQ uses `bull:<queue>:…`.
- `SCAN 0 MATCH mm:* COUNT 500` returns a cursor and a batch; repeat until the cursor is `0`. Other clients run between the batches.
- ioredis wraps it: `redis.scanStream({ match, count })`.

**In our code:** `releaseEveryQueueActivity` in [redis-activity-guard.ts](../../apps/backend/src/modules/battles/infrastructure/redis-activity-guard.ts) and `removeEveryTicket` in [redis-matchmaking-queue.ts](../../apps/backend/src/modules/battles/infrastructure/redis-matchmaking-queue.ts) use `scanStream` at boot.

**Watch out:**
- `SCAN` may return a key twice, and keys added during the scan may be missed. Make what you do per key safe to repeat.
- `COUNT` is a hint about work per call, not a page size.

**Check yourself:** `redis-cli KEYS 'act:*'` is fine on your laptop. Why not in production?
<details><summary>Answer</summary>It is one command over the whole key space. Redis runs one command at a time, so every request waits until it finishes: the whole game pauses.</details>
