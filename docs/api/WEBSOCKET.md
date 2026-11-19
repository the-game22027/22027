# WebSocket Contract — Real-Time Quiz Battles (v1)

Transport: **Socket.IO** (via `@nestjs/websockets` + `@nestjs/platform-socket.io`), namespace **`/battles`**.

Design rules:
- The server is authoritative. WebSocket delivery is treated as **unordered, at-least-once, lossy**; durability lives in PostgreSQL.
- Battles have **2..N participants**. A participant is a `HUMAN` or a `BOT` (ADR-0010). Random matchmaking is always 1v1; private rooms can be larger (DEC-38).
- Every battle plays one **game type** (`gameType`: `BUZZER`, `CAREER`, `WHO_IS_PLAYER`, `GRID`; ADR-0015). Game mechanics: `architecture/08-battle-games.md`. Answers are **typed text**, judged on the server against the round's accepted answers with typo tolerance; no suggestions (DEC-55, ADR-0021).
- Rule values (round count, timers, scoring, room size, bot wait) come from config and stay TBD (DEC-31..33, 38..44, 54, 60, 61).
- **Room lifecycle commands are REST** (`API.md` §6.7: create, join by code, leave, remove, start, close). This namespace **pushes** lobby changes and carries all battle traffic.

## 1. Connection

```js
io("wss://<host>/battles", { auth: { token: "<accessToken>" }, transports: ["websocket"] })
```

- The token goes in the handshake `auth`, never in the query string. Outside production, namespace `/_dev/socket` (`whoami`) exercises this check until `/battles` exists.
- Invalid/expired token → connection refused with `connect_error` `{ code: "UNAUTHENTICATED" }`.
- On connect, the server reads the user's current activity (queue, room, battle) and joins the socket to the matching channels (`room:{roomId}`, `battle:{battleId}`). The client then sends `room:resync` / `battle:resync` to get a snapshot.
- One user may have several sockets (devices). Events go to every socket of the user, but only one socket may send answers for a battle: the *active socket*. It is the first that emitted `battle:ready`, and it moves to the socket that most recently sent `battle:resync` (a reconnecting device takes over).
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

Matchmaking and session events (`matchmaking:*`, `error`) belong to no battle, so they carry no `seq`:

```json
{ "type": "matchmaking:queued", "serverTime": "2026-11-07T19:00:03.120Z", "data": { } }
```

Acks for malformed payloads use `INVALID_PAYLOAD`. A command for a battle that is not running (finished, or never existed) gets `NOT_PARTICIPANT`.

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
  maxPlayers: number; gameType: GameType; expiresAt: string; currentBattleId?: string | null;
}
type GameType = 'BUZZER' | 'CAREER' | 'WHO_IS_PLAYER' | 'GRID';          // clients must tolerate unknown values
type AnswerKind = 'PLAYER' | 'CLUB' | 'NATIONAL_TEAM' | 'COUNTRY' | 'COMPETITION' | 'COACH' | 'NUMBER';
type Answer = { text: string } | { number: number };                     // text: at most answers.maxLength characters (DEC-55, ADR-0021)
interface EntityRef { entityId: string; name: string }                   // name in the viewer's locale
interface GridCriterion { kind: 'CLUB' | 'NATIONALITY' | 'COMPETITION_WON'; entity: EntityRef }
```

## 3. Client → server commands

| Event | Payload | Rules | Ack errors |
|---|---|---|---|
| `time:sync` | `{ t0 }` (client ms) | Any time | — (ack carries `{ t0, serverTime }`) |
| `matchmaking:join` | `{ clientMsgId, gameType }` | Caller has no other activity (queue, room, battle). One queue per game type (DEC-59) | `PLAYER_BUSY`, `RATE_LIMITED`, `GAME_TYPE_UNAVAILABLE` |
| `matchmaking:leave` | `{ clientMsgId }` | — (no-op if not queued) | — |
| `room:resync` | `{ clientMsgId, roomId }` | Caller is a member | `ROOM_NOT_FOUND` (ack carries `BattleRoomSnapshot`) |
| `battle:ready` | `{ clientMsgId, battleId }` | Participant; battle `WAITING_READY`; sets the active socket | `NOT_PARTICIPANT`, `INVALID_STATE` |
| `battle:rps-pick` | `{ clientMsgId, battleId, attempt, choice: "ROCK" \| "PAPER" \| "SCISSORS" }` | Game types with `firstMover: "RPS"` (08 §9.1, ADR-0023). Active socket; battle `PICKING_FIRST`; once per attempt, received ≤ `pickDeadlineAt + latencyGrace` | `ALREADY_PICKED`, `ATTEMPT_NOT_CURRENT`, `PICK_WINDOW_CLOSED`, `INVALID_STATE`, `NOT_ACTIVE_SOCKET` |
| `round:buzz` | `{ clientMsgId, battleId, roundNo }` | Reveal-and-buzz games. Active socket; round `REVEALING` or `FINAL_WINDOW`; sender not locked out; nobody holds the buzz. The first accepted buzz wins (server arrival order) | `BUZZ_TAKEN`, `LOCKED_OUT`, `ROUND_CLOSED`, `ROUND_NOT_CURRENT`, `WRONG_GAME_TYPE`, `NOT_ACTIVE_SOCKET`, `PARTICIPANT_FORFEITED` |
| `round:answer` | `{ clientMsgId, battleId, roundNo, answer: Answer }` | Reveal-and-buzz games. Only the buzz holder, once per buzz, received ≤ `answerDeadlineAt + latencyGrace`. `{ number }` when the round's `answerKind` is `NUMBER`, `{ text }` otherwise (the other one gets `INVALID_PAYLOAD`). Correctness arrives as an event, not in the ack | `NOT_BUZZ_HOLDER`, `ANSWER_WINDOW_CLOSED`, `EMPTY_ANSWER` (blank after normalizing, or too long), `ROUND_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `grid:claim` | `{ clientMsgId, battleId, roundNo, cell: { row, col }, answer: { text } }` | `GRID`. Sender's turn, received ≤ `turnDeadlineAt + latencyGrace`; cell free; the text must not name a player already used on this board | `NOT_YOUR_TURN`, `CELL_TAKEN`, `PLAYER_ALREADY_USED`, `EMPTY_ANSWER`, `TURN_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `grid:skip` | `{ clientMsgId, battleId, roundNo }` | `GRID`. Sender's turn | `NOT_YOUR_TURN`, `TURN_CLOSED` |
| `mines:bury` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `MINES` (08 §10). Round in `BURYING`, received ≤ `buryDeadlineAt + latencyGrace`; fewer than `minesPerPlayer` buried. A name outside the category uses one of `burying.maxWrongTries` | `NOT_IN_CATEGORY`, `ALREADY_BURIED`, `ALL_MINES_BURIED`, `NO_TRIES_LEFT`, `BURY_WINDOW_CLOSED`, `EMPTY_ANSWER`, `NOT_ACTIVE_SOCKET` |
| `mines:answer` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `MINES`. Sender's turn, received ≤ `turnDeadlineAt + latencyGrace`. The outcome arrives as `mines:answered`; with `ownMine: "REJECT"` naming your own live mine is refused and the turn goes on | `NOT_YOUR_TURN`, `OWN_MINE`, `EMPTY_ANSWER`, `TURN_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `mines:scan` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `MINES`. Sender's turn; detector uses left. Costs `detector.costMs` of the turn | `NOT_YOUR_TURN`, `NO_DETECTOR_LEFT`, `EMPTY_ANSWER`, `TURN_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `battle:resync` | `{ clientMsgId, battleId, lastSeq }` | Participant | `NOT_PARTICIPANT` (ack carries the snapshot) |
| `battle:forfeit` | `{ clientMsgId, battleId }` | Participant; battle not finished. The participant leaves for good: last placement (DEC-33) | `NOT_PARTICIPANT`, `INVALID_STATE` |
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
| `battle:found` | `{ battleId, gameType, mode: "MATCHMAKING" \| "ROOM", roomId?, players: BattlePlayer[], youParticipantId, config, readyDeadlineAt }` | Participants formed. `config` is the game type's public config (round count, timers, attempts) and `answerMaxLength`, the longest text an answer may have. The client joins the battle channel automatically |
| `battle:cancelled` | `{ reason: "READY_TIMEOUT" \| "PLAYER_LEFT" \| "SERVER" }` | Before start: fewer than 2 participants ready, or a player forfeited or did not come back before the start |
| `battle:started` | `{ startedAt, players: BattlePlayer[] }` | Start. `players` excludes anyone dropped for not being ready |
| `battle:rps-start` | `{ attempt, pickDeadlineAt }` | First-mover phase (08 §9.1): a new rock-paper-scissors attempt. No event ever says who has already picked |
| `battle:rps-result` | `{ attempt, picks: [{ participantId, choice, auto: boolean }], winnerId: string \| null, decidedBy: "RPS" \| "DRAW" \| null }` | Both picks revealed together. `winnerId` null means a tie and another attempt follows; after `rps.maxReplays` ties the server draws the winner (`decidedBy: "DRAW"`). `auto` marks a pick the server made for a player who did not pick in time |
| `round:start` | Reveal and buzz: `{ roundNo, gameType, answerKind, stepCount, category? }`. Grid: `{ roundNo, gameType, rows: GridCriterion[3], cols: GridCriterion[3], firstTurnParticipantId }`. Mines: `{ roundNo, gameType, criteria: MinesCriterion[2], answerCount, minesPerPlayer, hearts, buryDeadlineAt, firstTurnParticipantId }`, where `MinesCriterion` is a `GridCriterion` or `{ kind: "DECADE", fromYear }` | Each round. Never contains unrevealed steps or accepted answers |
| `round:clue` | `{ roundNo, index, clue: string, nextClueAt: string \| null }` | Reveal and buzz: step `index` (1-based) revealed, text in the viewer's locale. `nextClueAt` is null after the last step (final window) |
| `round:buzzed` | `{ roundNo, participantId, answerDeadlineAt }` | A buzz was accepted; the reveal is paused |
| `round:wrong` | `{ roundNo, participantId, answer?: EntityRef \| { number } , timedOut: boolean }` | The buzz holder answered wrong or ran out of time and is locked out. `answer` is present only when `showWrongAnswers` is on (DEC-60) |
| `round:resumed` | `{ roundNo, nextClueAt: string \| null }` | Reveal continues after a wrong answer (or the final window continues) |
| `grid:turn` | `{ roundNo, participantId, turnDeadlineAt, attemptsLeft }` | Grid: whose turn it is |
| `grid:claimed` | `{ roundNo, cell, participantId, player: EntityRef }` | Grid: a correct answer took the cell |
| `grid:missed` | `{ roundNo, cell, participantId, answer?: EntityRef, timedOut: boolean, skipped: boolean }` | Grid: a wrong answer, a timeout or a skip. `answer` only when `showWrongAnswers` is on |
| `mines:buried` | `{ roundNo, mines: [{ player: EntityRef, auto: boolean }], wrongTriesLeft }` | Mines, to the burier only: after each accepted mine, and once more when the phase closes with the `auto` ones. The opponent never gets it |
| `mines:turn` | `{ roundNo, participantId, turnNo, turnDeadlineAt }` | Mines: whose turn it is. The first one also ends `BURYING` |
| `mines:answered` | `{ roundNo, participantId, outcome: "SAFE" \| "MINE" \| "WRONG" \| "REPEATED" \| "OWN_MINE" \| "TIMEOUT", player?: EntityRef, buriedBy?: string, hearts: [{ participantId, hearts }], answersLeft, minesLeft: [{ participantId, minesLeft }] }` | Mines: a judged answer or a timeout. `player` for `SAFE`, `MINE`, `REPEATED`, and for `WRONG` only when `showWrongAnswers` is on; never for `OWN_MINE`. `buriedBy` for `MINE` |
| `mines:scanned` | `{ roundNo, participantId, turnDeadlineAt, result?: "MINE" \| "CLEAR" }` | Mines: the detector was used. `result` only in the scanner's copy |
| `round:result` | `{ roundNo, questionId, winnerParticipantIds: string[], reveal, points: [{ participantId, points }], scores: [{ participantId, score }] }` | Round closed. `questionId` is what a player sends to `POST /v1/questions/{questionId}/reports` (`08` §5.7); it is never sent before the round ends. `winnerParticipantIds` holds the round winner (the correct answerer, or the grid line owner); it is empty when nobody won or the grid was a draw. `reveal`: reveal and buzz: `{ steps: string[], answer: EntityRef \| { number }, explanation? }`; grid: `{ line?: cell[3], sampleAnswers: [{ cell, player: EntityRef }] }`; mines: `{ reason: "LAST_HEART" \| "NO_SAFE_ANSWERS" \| "MAX_TURNS" \| "FORFEIT", mines: [{ participantId, mines: [{ player: EntityRef, exploded, auto }] }], sampleAnswers: EntityRef[] }` |
| `player:disconnected` | `{ participantId, graceUntil }` | A human's last socket dropped |
| `player:reconnected` | `{ participantId }` | |
| `player:forfeited` | `{ participantId, reason: "GRACE_EXPIRED" \| "FORFEIT" \| "NOT_READY" }` | Participant out of the battle |
| `battle:completed` | `{ endReason: "COMPLETED" \| "FORFEIT" \| "ABANDONED", you?: { placement, outcome: "WIN" \| "LOSS" \| "DRAW", score, points }, placements: [{ participantId, placement, score }], pointsPending: boolean }` | End. Those who left are placed after everyone still in, as losses. `ABANDONED` (no human left) has no placements. `you.points` is what this battle adds to your `BATTLES` leaderboards (`08` §6.1); it reaches them asynchronously, so `pointsPending` is true when it is above 0 (always false vs a bot or in a room, DEC-41) |
| `battle:snapshot` | `{ status, gameType, mode, players, firstMover?, currentRound?: { roundNo, phase, revealedClues \| board, buzzHolder?, lockedOut[], deadlines }, rounds: [...results so far], scores, seq }` | Reply to resync and on reconnect. Contains only what was already revealed. `status` is `PICKING_FIRST` during rock-paper-scissors; then `firstMover` is `{ attempt, pickDeadlineAt, youPicked, attempts }` (finished attempts only, never the other player's current pick), and `{ participantId }` once decided. For `MINES`, `currentRound` holds `phase` (`BURYING` \| `TURNS`), `buryDeadlineAt`, your own mines, exploded mines, said names with outcomes, hearts, the turn, `detectorUsesLeft`, `answersLeft` and `minesLeft` (08 §10.7); never another player's live mines |

### 4.4 Session

| Type | Data | When |
|---|---|---|
| `auth:expiring` / `auth:revoked` | `{ expiresAt }` / `{}` | Session lifecycle |
| `error` | `{ code, message }` | Protocol violations not tied to an ack. `NO_CONTENT`: the bank has no published content of that game type in the player's locale, so no battle could start; `SERVER_ERROR`: the battle could not be created |

Clue text and entity names are localized per player, with the locale fixed at battle creation. All players get the same content in the same order, and in `BUZZER` every locale has the same number of reveal steps, so everyone sees the same share of the question at the same time (`08` §3.1).

## 5. Timing

- The server is the only clock. `startedAt`, `nextClueAt`, `answerDeadlineAt` and `turnDeadlineAt` are server timestamps.
- Clients compute `offset = serverTime − (t0 + rtt/2)` from `time:sync` (repeat 3-5 times, keep the lowest RTT) and render countdowns as `deadline − (Date.now() + offset)`.
- The client shows a clue when its `round:clue` arrives, not on its own timer. `nextClueAt` is for animations only.
- `latencyGrace` (config, small) tolerates network delay on answers and claims; later ones get `ANSWER_WINDOW_CLOSED` / `TURN_CLOSED`.
- **Buzz order is the order in which the server receives buzzes** (`08` §7). Clients may send their local time in metrics fields; the server never uses it to decide.

## 6. Disconnects and reconnection

1. Disconnect → the server records `disconnected_at` and emits `player:disconnected { participantId, graceUntil }` to the others. The battle **continues**: a disconnected player simply does not buzz; a held buzz runs out as a wrong answer; a grid turn runs out as a timeout.
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
C→S matchmaking:join {clientMsgId:a1, gameType:"CAREER"}      ack {accepted:true}
S→C matchmaking:queued {ticketId, queuedAt, botFallbackAt}
    ... no human found before botFallbackAt ...
S→C battle:found {battleId:B, gameType:"CAREER", mode:"MATCHMAKING", players:[{you, HUMAN}, {kind:"BOT", bot:{displayName}}], youParticipantId:P1, config, readyDeadlineAt}  seq 1
C→S battle:ready {clientMsgId:a2, battleId:B}                 ack {accepted:true}
S→C battle:started {players}                                    seq 2
S→C round:start {roundNo:1, gameType:"CAREER", answerKind:"PLAYER", stepCount:6}   seq 3
S→C round:clue {roundNo:1, index:1, clue:"سبورتنج لشبونة (2002–2003)", nextClueAt}  seq 4
S→C round:clue {roundNo:1, index:2, clue:"مانشستر يونايتد (2003–2009)", nextClueAt} seq 5
S→C round:buzzed {roundNo:1, participantId:P2, answerDeadlineAt}  seq 6   (the bot buzzes; reveal paused)
S→C round:wrong {roundNo:1, participantId:P2, answer:{entityId, name:"ناني"}, timedOut:false}  seq 7
S→C round:resumed {roundNo:1, nextClueAt}                       seq 8
S→C round:clue {roundNo:1, index:3, clue:"ريال مدريد (2009–2018)", nextClueAt}    seq 9
C→S round:buzz {clientMsgId:a3, battleId:B, roundNo:1}         ack {accepted:true}
S→C round:buzzed {roundNo:1, participantId:P1, answerDeadlineAt}  seq 10
    (the player types "رونالدوو" and sends it: one edit from the alias "رونالدو", so it is correct)
C→S round:answer {clientMsgId:a4, battleId:B, roundNo:1, answer:{text:"رونالدوو"}}  ack {accepted:true}
S→C round:result {roundNo:1, winnerParticipantIds:[P1], reveal:{steps:[…6 clubs], answer:{entityId, name:"كريستيانو رونالدو"}}, points, scores}  seq 11
...  (rounds per config)
S→C battle:completed {endReason:"COMPLETED", you:{placement:1, outcome:"WIN"}, placements, pointsPending:false}  seq N
```

## 8b. Example: grid turn

```
S→C round:start {roundNo:1, gameType:"GRID", rows:[Real Madrid, Barcelona, Juventus], cols:[Brazil, France, Argentina], firstTurnParticipantId:P1}
S→C grid:turn {roundNo:1, participantId:P1, turnDeadlineAt, attemptsLeft:1}
C→S grid:claim {clientMsgId:c1, battleId:B, roundNo:1, cell:{row:0,col:1}, answer:{text:"زيدان"}}   ack {accepted:true}
S→C grid:claimed {roundNo:1, cell:{row:0,col:1}, participantId:P1, player:{entityId, name:"Zinedine Zidane"}}
S→C grid:turn {roundNo:1, participantId:P2, turnDeadlineAt, attemptsLeft:1}
    ... until a line or a full board ...
S→C round:result {roundNo:1, winnerParticipantIds:[P1], reveal:{line:[[0,1],[1,1],[2,1]], sampleAnswers}, points, scores}
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
