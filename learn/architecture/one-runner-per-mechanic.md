# One runner per mechanic (strategy, chosen in one place)
> The engine handles what every game shares; a small object per mechanic handles one round of that mechanic. Exactly one place picks the object.

**Problem:** Buzzer reveals and buzzes; Grid takes turns on a board. Putting both into the engine means `if (gameType === 'GRID')` in every method: commands, events, bots, snapshots. Each new game touches all of them, and a mistake in one game breaks another.

**How:**
- `LiveBattle` keeps the shared part: participants, readiness, the command queue, timers, `seq`, scores, forfeits, completion.
- A `RoundRunner` owns a round: `start`, `handleCommand`, `participantLeft`, `snapshotFor`. `RevealRoundRunner` serves three games, `GridRoundRunner` one.
- Runners talk back through a narrow `RoundHost`: emit, schedule, record an action, end the round.
- `startNextRound` is the only `if` on the game type (the registry). Adding a game = a new runner, not new branches.

**In our code:** [round-runner.ts](../../apps/backend/src/modules/battles/application/rounds/round-runner.ts), [reveal-round-runner.ts](../../apps/backend/src/modules/battles/application/rounds/reveal-round-runner.ts), [grid-round-runner.ts](../../apps/backend/src/modules/battles/application/rounds/grid-round-runner.ts), `startNextRound` in [live-battle.ts](../../apps/backend/src/modules/battles/application/live-battle.ts).

**Watch out:**
- Refactor with the tests green before and after: the 11 existing battle tests passed unchanged, which is what proves the move changed no behavior.
- Keep the host narrow. A runner that reaches into the battle's internals brings the branches back.

**Check yourself:** where would `IMPOSTER` (chat and vote) go?
<details><summary>Answer</summary>A new `ImposterRoundRunner` with its own pure rules, plus one more case in `startNextRound`. The queue, timers, forfeits and completion are reused as they are.</details>
