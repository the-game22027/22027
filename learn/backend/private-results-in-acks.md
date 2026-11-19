# Private results travel in acks, not in their own events
> When only one player may see a result, put it in the reply to their command (or in their copy of a shared event), never in an event sent to them alone.

**Problem:** every battle event carries a `seq` that goes up by one, and a client that sees a gap (`seq > lastSeq + 1`) resyncs. In لغم, "your mine was buried" is private. Sending `mines:buried` only to the burier would still use a `seq` number, so the opponent sees 7 → 9, resyncs for nothing, and learns by the timing that you just buried a mine.

**How:**
- The command's ack carries the private part: `mines:bury` answers `{ accepted: true, data: { mines, wrongTriesLeft } }`. Acks have no `seq`.
- Private data inside a shared moment goes in that viewer's copy: everyone gets the first `mines:turn` with the same `seq`, and each copy holds only that viewer's own `yourMines`. `mines:scanned` does the same with the detector result.
- The engine supports this by letting a runner return `RoundCommandOutcome = string | null | { accepted: true; data }`.

**In our code:** `RoundCommandOutcome` in [round-runner.ts](../../apps/backend/src/modules/battles/application/rounds/round-runner.ts); `buryAckDataFor` and the `TURN` and `SCANNED` cases in [mines-round-runner.ts](../../apps/backend/src/modules/battles/application/rounds/mines-round-runner.ts); design in `docs/architecture/08-battle-games.md` §10.2.

**Watch out:** an ack is replayed for a repeated `clientMsgId`, so its data must describe the result of that one command, not live state that changes later.

**Check yourself:** why not send every player a `mines:buried` event and just leave the mine names out of the opponent's copy?
<details><summary>Answer</summary>The event itself would leak: the opponent would see how many mines you buried and when. Nothing about the burying phase may reach them until it ends.</details>
