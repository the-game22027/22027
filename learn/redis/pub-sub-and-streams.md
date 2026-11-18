# Pub/Sub and Streams
> Pub/Sub broadcasts a message to whoever listens right now; a Stream is a stored log that consumers read and acknowledge.

**Problem:** with two API instances, a player's socket is on instance A and the battle runs on B. B's `round:clue` must reach A's socket.

**How:**
- **Pub/Sub:** `PUBLISH channel msg`; subscribers get it if connected. Nothing is stored: a disconnected subscriber misses it. Fast, fire-and-forget.
- **Streams:** `XADD` appends; consumer groups (`XREADGROUP`, `XACK`) give each message to one consumer and remember what was acknowledged. Durable, replayable.
- The Socket.IO Redis adapter uses Pub/Sub so `io.to(room).emit()` reaches sockets on every instance.

**In our code:** not used yet. One API instance runs every battle (`03` §4.4). Multi-instance needs the Socket.IO Redis adapter, sticky sessions and a battle owner lock. BullMQ uses a stream internally for its own job events.

**Watch out:** do not use Pub/Sub for work that must happen (points, stats). A missed message is gone; that work goes through the outbox and BullMQ.

**Check yourself:** why is Pub/Sub fine for socket fan-out but not for recording points?
<details><summary>Answer</summary>A lost live event is repaired by `battle:resync`, since the snapshot is the truth. A lost "record points" is lost forever. Live updates can be best effort; money-like data cannot.</details>
