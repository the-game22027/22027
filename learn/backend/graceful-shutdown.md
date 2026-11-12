# Graceful shutdown: drain work before closing connections
> On shutdown, first stop taking new work, then let the work already started finish, and only then close the database.

**Problem:** a battle's ready timer fired just before the API closed. Its queued work ran after Prisma disconnected and tried to write `forfeited_at`. In production that is a half-applied battle; in tests, Jest failed the run (`require … after the Jest environment has been torn down`) even though every test had passed.

**How:**
- Nest calls `beforeApplicationShutdown` hooks before `onApplicationShutdown`; the database closes in the later one. Drain in the earlier one.
- **Refuse new work:** set a flag, empty the "live battles" maps, so late commands and dropping sockets find nothing.
- **Stop timers** and make the battle refuse to schedule new ones.
- **Wait for queued work:** await each battle's queue until it stops changing.

**In our code:** `beforeApplicationShutdown` in [battle-engine.ts](../../apps/backend/src/modules/battles/application/battle-engine.ts); `stopAndFinishQueuedWork` in [live-battle.ts](../../apps/backend/src/modules/battles/application/live-battle.ts). The outbox publisher does the same: [outbox.publisher.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.publisher.ts).

**Watch out:**
- Closing the WebSocket server disconnects sockets *during* shutdown, which can schedule new work after you stopped the timers. That is why new work must be refused, not only old timers cancelled.
- A green test count is not a green run: check the command's exit code.

**Check yourself:** why is stopping all timers not enough?
<details><summary>Answer</summary>A timer that already fired has queued its work, and sockets closing during shutdown can create new timers. You must also refuse new work and wait for what is queued.</details>
