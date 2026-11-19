# Keeping a list's order in SQL: `unnest ... WITH ORDINALITY`
> Turn an array parameter into rows numbered 1, 2, 3..., join them, and `ORDER BY` that number.

**Problem:** a player has seen every question, so the battle repeats the ones they saw longest ago (DEC-44). Node knows that order; Postgres must still drop the ones that are now unpublished, expired or the wrong difficulty. `WHERE id = ANY($ids)` filters, but the rows come back in any order.

**How:**
- `unnest($ids::uuid[]) WITH ORDINALITY AS c(id, position)` makes one row per id, plus its place in the array.
- `JOIN questions q ON q.id = c.id`, then the same `WHERE` as the random pick (one shared SQL fragment).
- `ORDER BY c.position LIMIT $count`: the first n that still pass, in the order Node asked for.
- The order itself comes from a `GROUP BY question_id ORDER BY max(started_at) DESC`: the last time any of the players saw it.

**In our code:** `pickMatchingContentIdsInGivenOrder` in [prisma-question-read.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-read.repository.ts); `findSeenQuestionIdsMostRecentFirst` in [prisma-battle.repository.ts](../../apps/backend/src/modules/battles/infrastructure/prisma-battle.repository.ts); the pick-then-refill steps in [pick-content-skipping-seen.ts](../../apps/backend/src/modules/battles/application/pick-content-skipping-seen.ts).

**Watch out:**
- "Seen" means the round started (`started_at IS NOT NULL`). A round reserved at battle creation but never played is not seen.
- The seen list grows with every battle. A few thousand ids as one array parameter is fine; if it gets slow, cache it per user in Redis (06 §3).

**Check yourself:** why not fetch the matching ids with `= ANY` and sort them in Node?
<details><summary>Answer</summary>You could, but you would load every match to keep n of them. With `LIMIT` after `ORDER BY position`, Postgres returns only the n rows the battle needs.</details>
