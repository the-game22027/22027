# One at a time per game (serialized processing)
> Handle every command and timer for one game strictly one after another, so "who was first" is never ambiguous.

**Problem:** two players buzz within the same millisecond. If both handlers run side by side, both read "nobody holds the buzz", both win, and the round has two answerers.

**How:**
- Each live battle has one queue of inputs: player commands and timer firings, in arrival order.
- The engine takes the next input only after the previous one is fully handled (state updated, effects queued).
- The second buzz then sees the first one's result and gets `BUZZ_TAKEN`. No lock, no database race.
- Different battles still run in parallel: the queue is per battle, not global.

**In our code:** the battle engine (`docs/architecture/08-battle-games.md` §2.1, `03-workflows.md` §4.3 step 4). `battle_round_actions.action_no` records the order the engine decided.

**Watch out:**
- Never `await` slow I/O in the middle of deciding. Decide first, then save, or one slow write stalls the whole battle.
- With several API servers, a battle must still live on exactly one of them (ownership lock), or there are two queues again.

**Check yourself:** why not use a database unique constraint to pick the first buzz?
<details><summary>Answer</summary>The buzz needs an answer in milliseconds and also has to pause the reveal timer. Doing it in the in-memory queue is exact and instant; the database only records what the engine already decided.</details>
