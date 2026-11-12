# Server clock offset for countdowns
> Never trust the phone's clock in a timed game: estimate how far it is from the server's clock and show every deadline in server time.

**Problem:** the server sends deadlines as timestamps (`answerDeadlineAt`). A phone whose clock is 3 s fast would show 3 s less to answer; a player could even change the clock to get more time on screen (the server still decides, but the screen would lie).

**How:**
- Send `time:sync {t0}` a few times; the server answers with its time. Keep the sample with the **shortest round trip** (`rtt`): the least room for the network to delay one direction more than the other.
- `offset = serverTime − (t0 + rtt/2)`: assume the server read its clock halfway through the trip.
- Countdown = `deadline − (deviceNow + offset)`, never below zero.

**In our code:** [server_clock.dart](../../apps/mobile/lib/features/battles/application/server_clock.dart), `synchronizeServerClock` in [battle_session_controller.dart](../../apps/mobile/lib/features/battles/application/battle_session_controller.dart), `WEBSOCKET.md` §5.

**Watch out:**
- The countdown is only a display. Whether an answer was in time is decided by the server on arrival (`ANSWER_WINDOW_CLOSED`).
- Show a clue when its event arrives, not on a local timer: `nextClueAt` is for animations only.

**Check yourself:** why not average all the samples?
<details><summary>Answer</summary>A slow sample is usually slow in one direction only, so its midpoint is wrong. Averaging mixes that error in; the fastest sample has the smallest possible error (at most half its round trip).</details>
