# Functional core, imperative shell
> Decide in pure functions; do the I/O in one thin outer layer that carries out the decisions.

**Problem:** game logic mixed with timers, sockets and database calls can only be tested by running all of them. Testing "a wrong answer locks the player out and the reveal resumes" would need a real socket and real waiting.

**How:**
- The **core** takes the current state plus one input (a command, a timer firing, the time) and returns the new state plus a list of **effects**: "emit this event", "schedule this timer", "save this action", "end the round".
- The core never sends, waits or saves anything itself. Same input, same output.
- The **shell** (the engine) feeds inputs in, then carries out the effects: sockets, timers, database.
- Tests call the core directly with a fake time and assert on the returned effects. No waiting, no network.

**In our code:** `GameRules.handleCommand / handleTimer` return `{ state, effects }`, and the battle engine executes them (`docs/architecture/08-battle-games.md` §2.2).

**Watch out:**
- If the core starts needing "just one quick database read", pass that data in as input instead.
- Effects are data. Keep them few and simple (emit, schedule, cancel, record, end), or the shell becomes a second brain.

**Check yourself:** why does `handleTimer` take `now` as a parameter instead of calling `new Date()`?
<details><summary>Answer</summary>So the function stays pure: a test can pass any time it wants, and the same inputs always give the same effects. Reading the clock inside would make results depend on when the test runs.</details>
