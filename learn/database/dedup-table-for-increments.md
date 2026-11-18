# A dedup table makes increments safe
> Record "this event was applied" in the same transaction as the `+=`; a redelivered event finds the record and adds nothing.

**Problem:** `times_served = times_served + 1` on every `BattleCompleted` counts a battle twice when the queue redelivers the event. Unlike a leaderboard total, a question's counters cannot be recomputed cheaply: the source rows (`battle_round_actions`) are deleted after 12 months.

**How:**
- `INSERT INTO question_stats_applied (battle_id) … ON CONFLICT DO NOTHING`. One row inserted: first delivery, go on. Zero rows: already applied, stop.
- The increments run in the same transaction. If they fail, the dedup row rolls back too, so the retry is not wrongly skipped.
- The dedup table only needs to live as long as redeliveries can happen (30 days, `02` §6), not forever.

**In our code:** `RecordQuestionStats` in [record-question-stats.ts](../../apps/backend/src/modules/question-bank/application/record-question-stats.ts); [prisma-question-stats.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-stats.repository.ts).

**Watch out:** the dedup row and the change must be in one transaction. Inserting the dedup row first and committing it separately loses the stats when the second step fails.

**Check yourself:** leaderboards recompute, question stats use a dedup table. Why not the same pattern for both?
<details><summary>Answer</summary>Recompute needs the source rows to stay; the ledger keeps its rows forever, so it works there. Round actions are deleted after a year, so stats must be counted once, as they happen.</details>
