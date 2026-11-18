# Peek, decide, then take atomically
> When the decision needs data Redis does not have, read without removing, decide in the app, then remove only if nothing changed, in one script.

**Problem:** the matcher must not pair two players who blocked each other, and blocks live in Postgres. A Lua script cannot ask Postgres. Taking tickets out first and putting the unpaired ones back opens a gap: a player who taps "leave" while their ticket is out finds nothing to remove, and the matcher then puts them back in the queue.

**How:**
1. **Peek:** `ZRANGE` the oldest tickets; nothing is removed.
2. **Decide:** ask Postgres for blocked pairs, pair the tickets in plain code.
3. **Take:** for each chosen pair, one script checks both are still queued (`ZSCORE`) and removes both, or removes nothing.
- A ticket that left in between makes step 3 return nothing; that pair is skipped and the next tick tries again.
- Unpaired tickets never leave the queue, so leave and the bot fallback always see them.

**In our code:** `TAKE_PAIR_IF_BOTH_QUEUED`, `peekOldestTickets` and `takeTicketPair` in [redis-matchmaking-queue.ts](../../apps/backend/src/modules/battles/infrastructure/redis-matchmaking-queue.ts); the loop in `runMatcherOnce` in [matchmaking.service.ts](../../apps/backend/src/modules/battles/application/matchmaking.service.ts); the pairing rule in [ticket-pairing.ts](../../apps/backend/src/modules/battles/domain/ticket-pairing.ts).

**Watch out:** the decision can be stale by the time you act. That is fine only because step 3 re-checks the one thing that matters (both still queued) atomically; never act on a peek without that re-check.

**Check yourself:** why not remove all 50 tickets, pair them, and `ZADD` the rest back?
<details><summary>Answer</summary>While they are out, the players are in no queue: a leave is silently ignored and the matcher re-adds them, so a player who left stays queued. Peek-then-take never removes a ticket it will not use.</details>
