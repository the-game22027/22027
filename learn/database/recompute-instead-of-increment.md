# Recompute instead of increment
> Update a derived total by recomputing it from its source rows and writing the absolute value, not by adding a delta.

**Problem:** `points = points + 30` on every `PointsRecorded` event double counts when the queue redelivers the event, and drifts forever once one update is lost or applied twice. There is no way to tell from the total.

**How:**
- On each event, read `SUM(points)` of the user in the period from the ledger, then upsert that value. Running it twice writes the same number.
- Two handlers for the same player could interleave (read, read, write, write) and leave the older sum. Take an advisory lock per (board, player) first; the second handler waits, then reads everything committed.
- Lock several players in a fixed order (sorted ids) so two handlers never wait for each other in a circle (deadlock).
- A sum of 0 deletes the row, so a corrected (superseded) entry disappears from the board.

**In our code:** `UpdateLeaderboards` in [update-leaderboards.ts](../../apps/backend/src/modules/leaderboards/application/update-leaderboards.ts); `waitForOtherUpdatesOfPlayers` and `replacePlayerTotals` in [prisma-leaderboard.repository.ts](../../apps/backend/src/modules/leaderboards/infrastructure/prisma-leaderboard.repository.ts).

**Watch out:** recomputing reads more than incrementing. It is cheap here because the read uses the `(user_id, category, occurred_at)` index and touches one player's rows.

**Check yourself:** why is the lock needed when each handler writes a correct sum?
<details><summary>Answer</summary>"Correct" means correct for what that handler saw. If handler A read before B's entry committed and writes after B, A overwrites B's newer total. The lock makes the later handler read after the earlier one has finished.</details>
