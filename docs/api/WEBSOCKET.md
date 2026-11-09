# WebSocket Contract — Real-Time Quiz Battles (v1)

Transport: **Socket.IO** (via `@nestjs/websockets` + `@nestjs/platform-socket.io`), namespace **`/battles`**.

Design rules:
- The server is authoritative. WebSocket delivery is treated as **unordered, at-least-once, lossy**; durability lives in PostgreSQL.
- Battles have **2..N participants**. A participant is a `HUMAN` or a `BOT` (ADR-0010). Random matchmaking is always 1v1; private rooms can be larger (DEC-38).
- Rule values (round count, timers, scoring, room size, bot wait) come from config and stay TBD (DEC-31..33, 38..44).
- **Room lifecycle commands are REST** (`API.md` §6.7: create, join by code, leave, remove, start, close). This namespace **pushes** lobby changes and carries all battle traffic.

## 1. Connection

```js
io("wss://<host>/battles", { auth: { token: "<accessToken>" }, transports: ["websocket"] })
```

- The token goes in the handshake `auth`, never in the query string. Outside production, namespace `/_dev/socket` (`whoami`) exercises this check until `/battles` exists.
- Invalid/expired token → connection refused with `connect_error` `{ code: "UNAUTHENTICATED" }`.
- On connect, the server reads the user's current activity (queue, room, battle) and joins the socket to the matching channels (`room:{roomId}`, `battle:{battleId}`). The client then sends `room:resync` / `battle:resync` to get a snapshot.
- One user may have several sockets (devices). Events go to every socket of the user, but only one socket may send answers for a battle: the first that emitted `battle:ready` (the *active socket*).
- Before the access token expires the server emits `auth:expiring`; the client sends `auth:refresh { token }` with a new access token. Revoked session → server emits `auth:revoked` and disconnects.

## 2. Envelopes

Client → server: every command carries a `clientMsgId` (UUID v4) and is sent **with a Socket.IO acknowledgement callback**.

```json
{ "clientMsgId": "6f1c...", "battleId": "0193...", "...": "command fields" }
```

Ack (always returned, also for duplicates):

```json
{ "clientMsgId": "6f1c...", "accepted": true }
{ "clientMsgId": "6f1c...", "accepted": false, "code": "ROUND_CLOSED" }
```

Server → client: every battle event carries a per-battle monotonically increasing `seq` and the server time. Room events carry a per-room `version` (the room row version) instead of `seq`.

```json
{ "battleId": "0193...", "seq": 7, "serverTime": "2026-11-07T19:00:03.120Z", "type": "round:start", "data": { } }
{ "roomId": "0193...", "version": 4, "serverTime": "2026-11-07T19:00:03.120Z", "type": "room:updated", "data": { } }
```

Clients track `lastSeq` per battle and `version` per room. A gap (`seq > lastSeq + 1`), an older room version, or a reconnect → send the matching resync command.

### Shared shapes

```ts
interface BattlePlayer {
  participantId: string;            // stable inside the battle; use it, not userId, to match events
  kind: 'HUMAN' | 'BOT';            // bots are always labeled (DEC-40)
  user?: PublicUser;                // HUMAN only
  bot?: { displayName: string; avatarUrl?: string | null };   // BOT only
  seat: number;
}
interface BattleRoomSnapshot {      // same shape as REST BattleRoom (API.md §5)
  id: string; code: string; status: 'LOBBY' | 'IN_BATTLE' | 'CLOSED';
  host: PublicUser; members: { user: PublicUser; joinedAt: string }[];
  maxPlayers: number; expiresAt: string; currentBattleId?: string | null;
}
```

## 3. Client → server commands

| Event | Payload | Rules | Ack errors |
|---|---|---|---|
| `time:sync` | `{ t0 }` (client ms) | Any time | — (ack carries `{ t0, serverTime }`) |
| `matchmaking:join` | `{ clientMsgId }` | Caller has no other activity (queue, room, battle) | `PLAYER_BUSY`, `RATE_LIMITED` |
| `matchmaking:leave` | `{ clientMsgId }` | — (no-op if not queued) | — |
| `room:resync` | `{ clientMsgId, roomId }` | Caller is a member | `ROOM_NOT_FOUND` (ack carries `BattleRoomSnapshot`) |
| `battle:ready` | `{ clientMsgId, battleId }` | Participant; battle `WAITING_READY`; sets the active socket | `NOT_PARTICIPANT`, `INVALID_STATE` |
| `round:answer` | `{ clientMsgId, battleId, roundNo, optionId }` | Active socket; battle `IN_PROGRESS`; `roundNo` = current open round; receive time ≤ `deadlineAt + latencyGrace`; first answer per participant per round wins | `ROUND_CLOSED`, `ROUND_NOT_CURRENT`, `ALREADY_ANSWERED`, `INVALID_OPTION`, `NOT_ACTIVE_SOCKET`, `PARTICIPANT_FORFEITED` |
| `battle:resync` | `{ clientMsgId, battleId, lastSeq }` | Participant | `NOT_PARTICIPANT` (ack carries the snapshot) |
| `battle:forfeit` | `{ clientMsgId, battleId }` | Participant; battle not finished | `INVALID_STATE` |
| `auth:refresh` | `{ token }` | — | `UNAUTHENTICATED` |

Duplicate `clientMsgId` for the same user + battle → the stored ack is returned again; no state change. Unknown events are ignored and counted in metrics.

## 4. Server → client events

### 4.1 Matchmaking

| Type | Data | When |
|---|---|---|
| `matchmaking:queued` | `{ ticketId, queuedAt, botFallbackAt? }` | After join. `botFallbackAt` is present when bots are enabled (DEC-39) |
| `matchmaking:timeout` | `{}` | Only when bots are disabled: queue timeout (config) |

A match (human or bot) is announced with `battle:found`.

### 4.2 Private room lobby

| Type | Data | When |
|---|---|---|
| `room:updated` | `{ room: BattleRoomSnapshot }` | Any lobby change: join, leave, removal, host transfer, back to `LOBBY` after a battle |
| `room:removed` | `{ roomId }` | Sent to the removed user only; their sockets leave the channel |
| `room:closed` | `{ roomId, reason: "HOST_CLOSED" \| "EMPTY" \| "IDLE" }` | Room closed |

When the host starts the room, members receive `battle:found` with `mode: "ROOM"`.

### 4.3 Battle

| Type | Data | When |
|---|---|---|
| `battle:found` | `{ battleId, mode: "MATCHMAKING" \| "ROOM", roomId?, players: BattlePlayer[], youParticipantId, config: { roundCount, roundMs, readyTimeoutMs }, readyDeadlineAt }` | Participants formed. The client joins the battle channel automatically |
| `battle:cancelled` | `{ reason: "READY_TIMEOUT" \| "SERVER" }` | Before start: fewer than 2 participants ready |
| `battle:started` | `{ startedAt, players: BattlePlayer[] }` | Start. `players` excludes anyone dropped for not being ready |
| `round:start` | `{ roundNo, question: { questionId, text, category, options: [{ optionId, text }] }, startedAt, deadlineAt }` | Each round. No correctness. Option order may differ per player (DEC-44) |
| `round:player-answered` | `{ roundNo, participantId }` | Another participant submitted (not what they chose) |
| `round:result` | `{ roundNo, correctOptionId, you: { optionId, correct, points, elapsedMs }, players: [{ participantId, answered, correct, points }], scores: [{ participantId, score }] }` | Round closed |
| `player:disconnected` | `{ participantId, graceUntil }` | A human's last socket dropped |
| `player:reconnected` | `{ participantId }` | |
| `player:forfeited` | `{ participantId, reason: "GRACE_EXPIRED" \| "FORFEIT" \| "NOT_READY" }` | Participant out of the battle |
| `battle:completed` | `{ endReason, you: { placement, outcome: "WIN" \| "LOSS" \| "DRAW", score }, placements: [{ participantId, placement, score }], pointsPending: boolean }` | End. Ledger points arrive asynchronously; `pointsPending` is false when this mode earns none (DEC-41) |
| `battle:snapshot` | `{ status, mode, players, currentRound?, deadlineAt?, rounds: [...my answers + results so far], scores, seq }` | Reply to resync and on reconnect |

### 4.4 Session

| Type | Data | When |
|---|---|---|
| `auth:expiring` / `auth:revoked` | `{ expiresAt }` / `{}` | Session lifecycle |
| `error` | `{ code, message }` | Protocol violations not tied to an ack |

Question text is localized per player, with the locale fixed at battle creation. All players get the same question ids in the same order.

## 5. Timing

- The server is the only clock for scoring. `startedAt` and `deadlineAt` are server timestamps.
- Clients compute `offset = serverTime − (t0 + rtt/2)` from `time:sync` (repeat 3-5 times, keep the lowest RTT) and render countdowns as `deadlineAt − (Date.now() + offset)`.
- `latencyGrace` (config, small) tolerates network delay; answers received after `deadlineAt + latencyGrace` get `ROUND_CLOSED`.
- `elapsedMs = receivedAt − startedAt` (server times) feeds any speed component of scoring (DEC-33).
- A round closes early when every active participant has answered.

## 6. Disconnects and reconnection

1. Disconnect → the server records `disconnected_at` and emits `player:disconnected { participantId, graceUntil }` to the others. The battle **continues**; missed rounds are timeouts.
2. Reconnect within grace → the client connects and emits `battle:resync { lastSeq }`. The server replies with `battle:snapshot` and resumes normal events; the others get `player:reconnected`.
3. Grace expired → that participant forfeits (`player:forfeited`). With one active participant left, the battle ends with `endReason: "FORFEIT"`. In a room battle with 3 or more players, the rest keep playing.
4. No active human left → `ABANDONED` (scoring policy for abandoned battles: DEC-33, default no points). A bot never keeps a battle alive alone.
5. Server restart (single-instance MVP) → in-progress battles become `ABANDONED`; reconnecting clients receive a snapshot with that status. Rooms survive (Postgres) and return to `LOBBY`; clients send `room:resync`.

## 7. Limits

| Limit | Value (Recommended) |
|---|---|
| Max payload | 4 KB per message |
| Message rate | 10 messages/second per socket; burst 20 |
| Activities per user | 1 (queue **or** room **or** battle) |
| Participants per battle | 2 in matchmaking; up to `room.maxPlayers` in rooms (DEC-38) |

## 8. Example: matchmaking falls back to a bot

```
C→S matchmaking:join {clientMsgId:a1}                         ack {accepted:true}
S→C matchmaking:queued {ticketId, queuedAt, botFallbackAt}
    ... no human found before botFallbackAt ...
S→C battle:found {battleId:B, mode:"MATCHMAKING", players:[{you, HUMAN}, {kind:"BOT", bot:{displayName}}], youParticipantId:P1, config, readyDeadlineAt}  seq 1
C→S battle:ready {clientMsgId:a2, battleId:B}                 ack {accepted:true}
S→C battle:started {players}                                    seq 2
S→C round:start {roundNo:1, question, deadlineAt}              seq 3
S→C round:player-answered {roundNo:1, participantId:P2}        seq 4   (the bot's scheduled answer)
C→S round:answer {clientMsgId:a3, battleId:B, roundNo:1, optionId:o2}   ack {accepted:true}
S→C round:result {roundNo:1, correctOptionId:o2, you, players, scores}  seq 5
...  (rounds per config)
S→C battle:completed {endReason:"COMPLETED", you:{placement:1, outcome:"WIN"}, placements, pointsPending:false}  seq N
```

## 9. Example: private room

```
Host  REST POST /v1/battle-rooms                    → 201 {id:R, code:"K7M2QX", ...}
Host  (socket already connected; server joins it to room:R)
Friend REST POST /v1/battle-rooms/join {code:"K7M2QX"} → 200 {id:R, ...}
S→all room:updated {room:{members:[host, friend], version:2}}
Host  REST POST /v1/battle-rooms/R/start            → 202 {battleId:B}
S→all battle:found {battleId:B, mode:"ROOM", roomId:R, players:[...], ...}   seq 1
...   (same battle flow as above)
S→all battle:completed {...}                         seq N
S→all room:updated {room:{status:"LOBBY", currentBattleId:null, version:4}}   (rematch possible, DEC-42)
```
