# Simulating time
> Test things that take hours in seconds, without changing the code under test.

**Problem:** a matchday lasts about 10 hours. You can't wait that long to see whether a kickoff, a final whistle or a voting window works.

**How:**
- Separate **what happens** from **when it runs**. A pure function builds a timeline of steps with offsets; a small loop plays it.
- `--speed 60x` only divides the waits: one simulated minute takes one real second.
- Derive randomness from a stable input (the match id), so a run can be reproduced.
- Business code gets time from an injected `Clock`, so unit tests can fix "now".

**In our code:** [matchday-timeline.ts](../../apps/backend/src/modules/football/domain/matchday-timeline.ts) (the plan), [matchday-runner.ts](../../apps/backend/src/modules/football/application/matchday-runner.ts) (the loop), [match-simulator.ts](../../apps/backend/src/modules/football/application/match-simulator.ts).

**Watch out:** two steps can land in the same millisecond, and "not newer" counts as stale. `newerThanStored` always moves the timestamp forward by at least 1 ms.

**Check yourself:** why does the simulator stamp `ended_at` with the real time instead of the simulated one?
<details><summary>Answer</summary>The MOTM window is checked against the database clock. A simulated end time would be hours away from real `now()`, so the window would look closed or not yet open.</details>
