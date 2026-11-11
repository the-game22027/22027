# One at a time per game (serialized processing)
> Handle every command and timer for one game strictly one after another, so "who was first" is never ambiguous.

**Problem:** two players buzz within the same millisecond. If both handlers run side by side, both read "nobody holds the buzz", both win, and the round has two answerers.

**How:**
- Each live battle has one queue of inputs: player commands and timer firings, in arrival order.
- The engine takes the next input only after the previous one is fully handled (state updated, effects queued).
- The second buzz then sees the first one's result and gets `BUZZ_TAKEN`. No lock, no database race.
- Different battles still run in parallel: the queue is per battle, not global.

**In our code:** `runInQueue` in [live-battle.ts](../../apps/backend/src/modules/battles/application/live-battle.ts): each task is chained on the previous one's promise (`queue.then(task)`), commands and timers alike. `battle_round_actions.action_no` records the order the engine decided.

**Watch out:**
- Everything awaited inside the queue delays the next input. P6.1 saves each action inside it (a few ms, and the history is always in order); a slow database would show up as slow buzz acks, so watch `battle_buzz_latency_ms` before moving writes out.
- With several API servers, a battle must still live on exactly one of them (ownership lock), or there are two queues again.

**Check yourself:** why not use a database unique constraint to pick the first buzz?
<details><summary>Answer</summary>The buzz needs an answer in milliseconds and also has to pause the reveal timer. Doing it in the in-memory queue is exact and instant; the database only records what the engine already decided.</details>
