# One timer per phase
> A game with several timed phases keeps a single deadline timer and replaces it on every phase change, so a stale timer can never fire into the wrong phase.

**Problem:** an Auction round has four timed phases: pick (10 s), each bid turn (8 s), the proof (45 s), the steal (10 s). With one timer per phase, a forgotten cancel means the old "pick" timer fires during the proof and auto-picks a list mid-proof.

**How:**
- The rules use one timer key, `phase`. Every move to a new phase emits `CANCEL phase` and then `SCHEDULE phase` at the new deadline plus the latency grace.
- When it fires, `handleTimer` switches on the **current** phase: picking → random pick, bidding → minimum opening bid or a call, proving → bust, stealing → no winner.
- Because the handler reads the phase at firing time, even a timer that slipped through acts on the phase the round is really in.

**In our code:** `PHASE_TIMER`, `scheduleDeadline` and `handleTimer` in [auction-rules.ts](../../apps/backend/src/modules/battles/domain/games/auction-rules.ts); the round runner scopes the key per round (`rules:phase`) in [auction-round-runner.ts](../../apps/backend/src/modules/battles/application/rounds/auction-round-runner.ts).

**Watch out:** the deadline sent to players (`turnDeadlineAt`) is the real one; the timer fires `latencyGraceMs` later, so a command sent just before the deadline still counts.

**Check yourself:** why switch on the phase inside `handleTimer` instead of having a separate timer key per phase?
<details><summary>Answer</summary>One key means at most one pending timer per round, and the phase check means a timer can only do what fits the moment it fires. Separate keys need every transition to remember to cancel every other key.</details>
