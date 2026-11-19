# Secret simultaneous moves
> Both players choose before either sees the other's choice; the server holds the picks and reveals them together.

**Problem:** in online rock-paper-scissors, if the server broadcast "A picked ROCK" (or even "A has picked"), B could wait, read it, and always win. The same trap hides in any game with hidden choices (buried mines, sealed bids).

**How:**
- The server is the only place that knows the picks. Clients get one event per attempt: `battle:rps-start`, then `battle:rps-result` with both picks at once.
- No "opponent has picked" event, and the resync snapshot says only `youPicked`, never the other side.
- A deadline closes the attempt; whoever did not pick gets a random pick marked `auto`, so stalling cannot block the game.
- Bots pick through the same path, from the battle's seeded random source, so a battle replays the same way.

**In our code:** pure rules in [rock-paper-scissors-duel.ts](../../apps/backend/src/modules/battles/domain/first-mover/rock-paper-scissors-duel.ts); the `PICKING_FIRST` phase in [live-battle.ts](../../apps/backend/src/modules/battles/application/live-battle.ts) (`takeRockPaperScissorsPick`, `closeDuelAttempt`); design in `docs/architecture/08-battle-games.md` §9.1.

**Watch out:**
- Accept picks until `deadline + latencyGrace`, then refuse with `PICK_WINDOW_CLOSED`: the grace absorbs network delay without letting anyone pick after the reveal.
- Timing leaks too: the bot's pick delay is not in the public config, or a client could tell when the bot is about to move.

**Check yourself:** why does the attempt close the moment both picks are in, instead of waiting for the deadline?
<details><summary>Answer</summary>Nothing is left to hide once both picks are in, and waiting would only add dead time. The deadline exists only for a player who never picks.</details>
