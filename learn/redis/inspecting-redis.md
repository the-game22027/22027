# Inspecting Redis while developing
> Open `redis-cli` in the container and look at the real keys; most "why is the player stuck?" questions end there.

**Problem:** state in Redis is invisible from the app logs. A stuck activity flag or a ghost ticket looks like a game bug.

**How:**
```bash
docker compose exec redis redis-cli
SCAN 0 MATCH act:* COUNT 100          # activity flags (never KEYS in prod)
GET act:<userId>                      # QUEUE:<ticket> | BATTLE:<id> | ROOM:<id>
TTL act:<userId>                      # seconds left
ZRANGE mm:queue:BUZZER 0 -1 WITHSCORES   # who waits, by queued time (ms)
GET mm:ticket:<ticketId>              # the ticket JSON
GET rl:auth:<ip>                      # sign-in attempts in this minute
TYPE <key>                            # string, zset, hash, list, stream
INFO memory                           # used_memory_human, maxmemory
MONITOR                               # every command live (dev only, heavy)
```
- Jobs: Bull Board at `http://localhost:3000/admin/queues` (development), or `SCAN 0 MATCH bull:points:*`.

**In our code:** key names come from [redis-activity-guard.ts](../../apps/backend/src/modules/battles/infrastructure/redis-activity-guard.ts) and [redis-matchmaking-queue.ts](../../apps/backend/src/modules/battles/infrastructure/redis-matchmaking-queue.ts).

**Watch out:** `FLUSHALL` in the shared dev Redis wipes queued jobs and every session's state, including the mobile session's. Delete specific keys instead.

**Check yourself:** a player says "I can't join, it says I'm busy". What do you check first?
<details><summary>Answer</summary>`GET act:<userId>`. If it names a battle that no longer runs, the flag leaked; its TTL shows when it clears, and the boot cleanup or `DEL` frees it.</details>
