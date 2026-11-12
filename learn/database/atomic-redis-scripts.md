# Atomic Redis scripts
> Run "read, decide, change" as one Lua script inside Redis, so nobody else can act between the read and the change.

**Problem:** the matcher takes the two oldest tickets while one of those players presses "leave". Done as separate commands (`ZRANGE`, then `ZREM`), both can see the ticket: the player is matched *and* told they left, or matched twice by two ticks.

**How:**
- Redis runs one script at a time, so a script is atomic: no other command runs in the middle.
- `takeOldestPair`: read the two oldest ids, remove them, read and delete their ticket keys, return them. All or nothing.
- `removeTicket` (leave): remove only if still in the queue, and say whether it did. If the matcher won, leave does nothing and the player gets `battle:found`.
- The activity guard does the same: "replace only if the current value is still X".

**In our code:** [redis-matchmaking-queue.ts](../../apps/backend/src/modules/battles/infrastructure/redis-matchmaking-queue.ts), [redis-activity-guard.ts](../../apps/backend/src/modules/battles/infrastructure/redis-activity-guard.ts).

**Watch out:**
- Keep scripts short: while one runs, Redis serves nobody else.
- A script only touches keys passed in `KEYS` (or built from a prefix argument, as here, which is fine on one Redis but not on a Redis Cluster).

**Check yourself:** why is `MULTI ... EXEC` (a transaction) not enough for `takeOldestPair`?
<details><summary>Answer</summary>`MULTI` queues commands without seeing their results, so it cannot decide "remove these two ids" from what `ZRANGE` returned inside the same block. A script can read and decide.</details>
