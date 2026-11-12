# Sorted sets for queues and rankings
> A sorted set keeps unique members ordered by a numeric score, and finds by rank or score range in O(log n).

**Problem:** "the two players who waited longest", "everyone waiting more than 10 seconds", "my rank among a million players": a plain list or SQL `COUNT(*)` gets slow or racy as it grows.

**How:**
- Queue by time: `ZADD mm:queue:BUZZER <queuedAtMs> <ticketId>`; oldest first `ZRANGE … 0 1`; waited too long `ZRANGEBYSCORE … -inf <cutoff>`; leave `ZREM`.
- Ranking: `ZINCRBY board 30 <userId>`, `ZREVRANK board <userId>` (0-based rank), `ZREVRANGE board 0 49 WITHSCORES` (top 50).
- Equal scores are ordered by member (lexicographic), the same tie-break idea as our `user_id`.

**In our code:** the matchmaking queue in [redis-matchmaking-queue.ts](../../apps/backend/src/modules/battles/infrastructure/redis-matchmaking-queue.ts). Leaderboards are **not** in Redis: `03` §5.2 option C was rejected (a second source of truth, rebuild and memory costs). We use a Postgres projection and could add a ZSET cache in front of hot boards when measured.

**Watch out:** `ZREVRANK` gives a position (0, 1, 2…, every member a different one), not a shared rank (1, 1, 3). A shared rank is 1 + `ZCOUNT` of strictly higher scores.

**Check yourself:** why did we keep leaderboards in Postgres even though ZSETs rank faster?
<details><summary>Answer</summary>The board must be rebuildable from the ledger and survive restarts exactly; it is read with keyset pages that one index already serves well. Speed is not a measured problem yet, and two copies of the truth are.</details>
