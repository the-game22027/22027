# Redis data types
> Each key holds one type, and each type has its own commands; pick the type by the question you need answered fast.

**Problem:** storing everything as JSON strings forces read-modify-write in the app (slow, racy). The right type lets Redis answer in one command.

**How:**
| Type | Like | Typical use | Example commands |
|---|---|---|---|
| String | a variable | flags, counters, JSON blobs | `SET`, `GET`, `INCR`, `SET NX EX` |
| Hash | a small object | fields of one record | `HSET`, `HGET`, `HINCRBY` |
| List | a queue/stack | FIFO work queue | `LPUSH`, `RPOP`, `BLMOVE` |
| Set | unique members | "who is online" | `SADD`, `SISMEMBER` |
| Sorted set | members with a score, kept in order | queues by time, rankings | `ZADD`, `ZRANGE`, `ZRANGEBYSCORE`, `ZREVRANK` |
| Stream | an append-only log | events with consumer groups | `XADD`, `XREADGROUP` |

**In our code:** strings for the activity guard and rate limit counters; a sorted set per game type for the matchmaking queue, plus one string per ticket ([redis-matchmaking-queue.ts](../../apps/backend/src/modules/battles/infrastructure/redis-matchmaking-queue.ts)). BullMQ uses lists, sorted sets, hashes and a stream inside `bull:<queue>:*`.

**Watch out:** a key has one type. `GET` on a sorted set fails with `WRONGTYPE`. Name keys so their type is obvious.

**Check yourself:** why is the matchmaking queue a sorted set and not a list?
<details><summary>Answer</summary>We need "oldest first" and also "remove this ticket" (a player leaves) and "everyone queued before T" (bot fallback). A sorted set scored by queue time does all three in one command each; a list makes removal by id slow.</details>
