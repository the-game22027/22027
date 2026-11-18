# Memory limits and eviction
> When Redis reaches `maxmemory`, the eviction policy decides: refuse new writes, or delete keys to make room.

**Problem:** RAM runs out. A cache can drop old entries; a job queue that silently drops keys loses work with no error.

**How:**
- `noeviction`: writes fail with an error when full. Right for queues and state.
- `allkeys-lru` / `allkeys-lfu`: delete the least recently / least frequently used key. Right for a pure cache.
- `volatile-*`: evict only keys with a TTL.
- Watch it: `INFO memory` (`used_memory_human`, `maxmemory`), and `MEMORY USAGE <key>`.

**In our code:** `--maxmemory-policy noeviction` in [docker-compose.yml](../../docker-compose.yml) and in the test container, because BullMQ requires it (`05` §6).

**Watch out:** one Redis cannot be both a queue (noeviction) and a large cache (LRU). When a cache arrives, give it its own instance or database with its own policy.

**Check yourself:** what does the API do if Redis refuses a write because it is full?
<details><summary>Answer</summary>The command fails like any Redis error: the rate limiter fails open (allows), a matchmaking call throws so the join fails instead of half-joining, the outbox publisher retries later. Nothing is silently lost, which is the point of `noeviction`.</details>
