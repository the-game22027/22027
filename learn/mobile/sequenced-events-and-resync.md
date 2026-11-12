# Sequenced events and resync
> Every battle event has a `seq` (1, 2, 3…). The app applies them strictly in order; a missing number means "ask for a snapshot", never "guess".

**Problem:** WebSocket delivery is treated as lossy: a reconnect can drop events. Applying `round:resumed` without the `round:wrong` before it would show the wrong player holding the buzzer.

**How:**
- `seq <= lastSeq` → a repeat: ignore it.
- `seq == lastSeq + 1` → apply it.
- `seq > lastSeq + 1` → a gap: mark `needsResync`, ignore events, send `battle:resync`; its ack carries a snapshot (with its own `seq`) that replaces the live state. Events continue from there.
- After a reconnect, resync too: events sent while offline are gone.
- The reducer is a pure function `(state, event) → state`, so every ordering rule is a unit test.

**In our code:** [battle_state.dart](../../apps/mobile/lib/features/battles/application/battle_state.dart), [battle_session_controller.dart](../../apps/mobile/lib/features/battles/application/battle_session_controller.dart), [battle_state_test.dart](../../apps/mobile/test/features/battles/battle_state_test.dart), `WEBSOCKET.md` §2, §6.

**Watch out:**
- Commands are never queued while disconnected: a buzz delivered seconds late is worse than none.
- Each command has a `clientMsgId`, so a repeated command gets the stored ack, not a second effect.

**Check yourself:** why ignore events after a gap instead of applying them and fixing things when the snapshot arrives?
<details><summary>Answer</summary>A later event applied to a state that missed an earlier one can produce a state that never existed on the server (and the screen would show it). The snapshot is the truth; until it arrives, keeping the last correct state is safer.</details>
