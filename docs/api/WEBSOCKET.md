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
{ "clientMsgId": "6f1c...", "accepted": true, "data": { } }   // a few commands return private data (mines:bury)
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
| `mines:bury` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `MINES` (08 §10). Round in `BURYING`, received ≤ `buryDeadlineAt + latencyGrace`; fewer than `minesPerPlayer` buried. A name outside the category uses one of `burying.maxWrongTries`. The accepted ack carries `data: { mines: [{ player: EntityRef, auto }], wrongTriesLeft }`, private to the burier | `NOT_IN_CATEGORY`, `ALREADY_BURIED`, `ALL_MINES_BURIED`, `NO_TRIES_LEFT`, `BURY_WINDOW_CLOSED`, `EMPTY_ANSWER`, `NOT_ACTIVE_SOCKET` |
| `mines:answer` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `MINES`. Sender's turn, received ≤ `turnDeadlineAt + latencyGrace`. The outcome arrives as `mines:answered`; with `ownMine: "REJECT"` naming your own live mine is refused and the turn goes on | `NOT_YOUR_TURN`, `OWN_MINE`, `EMPTY_ANSWER`, `TURN_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `mines:scan` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `MINES`. Sender's turn; detector uses left. Costs `detector.costMs` of the turn | `NOT_YOUR_TURN`, `NO_DETECTOR_LEFT`, `EMPTY_ANSWER`, `TURN_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `auction:pick` | `{ clientMsgId, battleId, roundNo, list }` | `AUCTION` (08 §11). The picker, round in `PICKING`, `list` 0..2, received ≤ `pickDeadlineAt + latencyGrace` | `NOT_YOUR_PICK`, `INVALID_LIST`, `PICK_WINDOW_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `auction:bid` | `{ clientMsgId, battleId, roundNo, amount }` | `AUCTION`. Sender's bidding turn; the first bid ≥ `bidding.minOpeningBid`, later bids above the current one, never above the answer count (equal = all-in) | `NOT_YOUR_TURN`, `BID_TOO_LOW`, `BID_TOO_HIGH`, `TURN_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `auction:call` | `{ clientMsgId, battleId, roundNo }` | `AUCTION`. Sender's bidding turn, after at least one bid | `NOT_YOUR_TURN`, `NOTHING_TO_CALL`, `TURN_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `auction:answer` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `AUCTION`. The prover during `PROVING`, or the stealer during `STEALING`, before the deadline plus grace. The outcome arrives as `auction:answered` | `NOT_YOUR_TURN`, `EMPTY_ANSWER`, `ANSWER_WINDOW_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `vault:try` | `{ clientMsgId, battleId, roundNo, code }` | `VAULT` (08 §12). `code` is a string of digits, one per question; the sender is not locked out; received ≤ `roundDeadlineAt + latencyGrace`. A wrong try is acked as `{ accepted: true, data: { opened: false, lockedUntil, tries } }` to the sender only; a right one ends the round | `INVALID_CODE`, `LOCKED_OUT`, `ROUND_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `hex:pick` | `{ clientMsgId, battleId, roundNo, cell, clear? }` | `HEX` (08 §13). The player on turn, in `PICKING`, ≤ `pickDeadlineAt + latencyGrace`; an open `cell` (0-based, row by row), or with `clear: true` an opponent's cell while clears are left | `NOT_YOUR_PICK`, `INVALID_CELL`, `CELL_TAKEN`, `CELL_NOT_OPPONENTS`, `NO_CLEARS_LEFT`, `PICK_WINDOW_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `lineup:answer` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `LINEUP` (08 §14). Anyone not locked out, while the round is open. The server decides what the name is: a starter in an empty slot (placed), a shown name while the fake is not found (an accusation, one per player per round), or a wrong name (a lockout). The ack carries `data: { result: "PLACED" \| "WRONG" \| "ACCUSED_RIGHT" \| "ACCUSED_WRONG", slot?, lockedUntil }`, only to the sender | `LOCKED_OUT`, `ALREADY_TAKEN` (a placed starter, or the fake once found: no penalty), `ACCUSATION_USED`, `ALREADY_TRIED` (the same wrong name again: no new lockout), `EMPTY_ANSWER`, `ROUND_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `oneTwo:pass` | `{ clientMsgId, battleId, roundNo, passType }` | `ONE_TWO` (08 §15). The passer only, while picking: one of the pass types of the last `oneTwo:offer` (`FACED_IN_FINAL`, `FACED_IN_KNOCKOUT`, `SCORED_IN_SAME_MATCH`, `ASSIST_GIVEN`, `ASSIST_RECEIVED`, `SCORED_AGAINST`, `CONCEDED_TO`) | `NOT_YOUR_TURN`, `NOT_OFFERED`, `ALREADY_PASSED`, `PICK_WINDOW_CLOSED`, `ROUND_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `oneTwo:answer` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `ONE_TWO`. The receiver only, once per pass. The server judges the text against the ball's links of the picked pass type. The ack carries `data: { result: "RETURNED" \| "WRONG" \| "BURNED" }`, only to the sender | `NOT_YOUR_TURN`, `ANSWER_WINDOW_CLOSED`, `EMPTY_ANSWER`, `ROUND_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `bridge:pick` | `{ clientMsgId, battleId, roundNo, line }` | `BRIDGE` (08 §16). The player on turn, while picking: an open line of the board (numbered as in `round:start`) | `NOT_YOUR_TURN`, `INVALID_LINE`, `LINE_TAKEN`, `PICK_WINDOW_CLOSED`, `ROUND_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `bridge:answer` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `BRIDGE`. The player on turn, once per picked line. The server judges the text against the players who scored against both clubs of the line. The ack carries `data: { result: "RIGHT" \| "WRONG" \| "USED" }`, only to the sender (`USED`: a scorer already named right on this board) | `NOT_YOUR_TURN`, `ANSWER_WINDOW_CLOSED`, `EMPTY_ANSWER`, `ROUND_CLOSED`, `NOT_ACTIVE_SOCKET` |
| `hex:answer` | `{ clientMsgId, battleId, roundNo, answer: { text } }` | `HEX`. Anyone not locked out, while a race is on. The typed text must start with the cell's letter in the sender's language: a right name with another first letter is refused `WRONG_LETTER` (no lockout) | `NOT_RACING`, `LOCKED_OUT`, `WRONG_LETTER`, `EMPTY_ANSWER`, `ANSWER_WINDOW_CLOSED`, `NOT_ACTIVE_SOCKET` |
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
| `round:start` | Reveal and buzz: `{ roundNo, gameType, answerKind, stepCount, category? }`. Grid: `{ roundNo, gameType, rows: GridCriterion[3], cols: GridCriterion[3], firstTurnParticipantId }`. Mines: `{ roundNo, gameType, criteria: MinesCriterion[2], answerCount, minesPerPlayer, hearts, buryDeadlineAt, firstTurnParticipantId }`, where `MinesCriterion` is a `GridCriterion` or `{ kind: "DECADE", fromYear }`. Auction: `{ roundNo, gameType, lists: [{ title, answerCount }×3], pickerParticipantId, pickDeadlineAt }`, the title in the viewer's language. Vault: `{ roundNo, gameType, questions: string[], digits, roundDeadlineAt, firstLeakAt: string \| null }`, each question in the viewer's language (never its digit). Hex: `{ roundNo, gameType, size, board: string[], sides: { [participantId]: "WEST_EAST" \| "NORTH_SOUTH" }, firstPickerParticipantId, pickDeadlineAt, clearsLeft: { [participantId]: number } }`, each cell's letter in the viewer's language. Lineup: `{ roundNo, gameType, title, slots: [{ slot, line: "GK" \| "DEF" \| "MID" \| "FWD", role: string \| null, captain }×11], shown: EntityRef[3], roundDeadlineAt, hintsAt: string \| null }`, the title in the viewer's language; never a slot's player or shirt number. One-two: `{ roundNo, gameType, seed: EntityRef, passerId }`, then `oneTwo:offer`. Bridge: `{ roundNo, gameType, size, clubs: EntityRef[size × size], lines: [{ line, from, to }], firstPickerId, goalsSince }`, clubs row by row, `from` and `to` index `clubs`, `goalsSince` the first season of the goals behind the answers (e.g. `2012-13`, shown on the board, DEC-85); then `bridge:turn` | Each round. Never contains unrevealed steps or accepted answers |
| `round:clue` | `{ roundNo, index, clue: string, nextClueAt: string \| null }` | Reveal and buzz: step `index` (1-based) revealed, text in the viewer's locale. `nextClueAt` is null after the last step (final window) |
| `round:buzzed` | `{ roundNo, participantId, answerDeadlineAt }` | A buzz was accepted; the reveal is paused |
| `round:wrong` | `{ roundNo, participantId, answer?: EntityRef \| { number } , timedOut: boolean }` | The buzz holder answered wrong or ran out of time and is locked out. `answer` is present only when `showWrongAnswers` is on (DEC-60) |
| `round:resumed` | `{ roundNo, nextClueAt: string \| null }` | Reveal continues after a wrong answer (or the final window continues) |
| `grid:turn` | `{ roundNo, participantId, turnDeadlineAt, attemptsLeft }` | Grid: whose turn it is |
| `grid:claimed` | `{ roundNo, cell, participantId, player: EntityRef }` | Grid: a correct answer took the cell |
| `grid:missed` | `{ roundNo, cell, participantId, answer?: EntityRef, timedOut: boolean, skipped: boolean }` | Grid: a wrong answer, a timeout or a skip. `answer` only when `showWrongAnswers` is on |
| `mines:turn` | `{ roundNo, participantId, turnNo, turnDeadlineAt, yourMines? }` | Mines: whose turn it is. The first one (`turnNo: 1`) ends `BURYING` and carries `yourMines: [{ player: EntityRef, auto, exploded }]`, each viewer's own mines only |
| `mines:answered` | `{ roundNo, participantId, outcome: "SAFE" \| "MINE" \| "WRONG" \| "REPEATED" \| "OWN_MINE" \| "TIMEOUT", player?: EntityRef, buriedBy?: string, hearts: [{ participantId, hearts }], answersLeft, minesLeft: [{ participantId, minesLeft }] }` | Mines: a judged answer or a timeout. `player` for `SAFE`, `MINE`, `REPEATED`, and for `WRONG` only when `showWrongAnswers` is on; never for `OWN_MINE`. `buriedBy` for `MINE` |
| `mines:scanned` | `{ roundNo, participantId, turnDeadlineAt, result?: "MINE" \| "CLEAR" }` | Mines: the detector was used. `result` only in the scanner's copy |
| `auction:picked` | `{ roundNo, list, title, answerCount, auto }` | Auction: the list for this round |
| `auction:turn` | `{ roundNo, participantId, currentBid: number \| null, currentBidderId: string \| null, turnDeadlineAt }` | Auction: whose bidding turn |
| `auction:bid` | `{ roundNo, participantId, amount, allIn }` | Auction: a bid |
| `auction:proof` | `{ roundNo, proverParticipantId, amount, maxWrong, proofDeadlineAt, reason: "CALL" \| "ALL_IN" \| "TIMEOUT" }` | Auction: the proof starts |
| `auction:answered` | `{ roundNo, participantId, phase: "PROOF" \| "STEAL", outcome: "CORRECT" \| "WRONG" \| "REPEATED", player?: EntityRef, found, strikes }` | Auction: a judged name. `player` for `CORRECT` and `REPEATED`, and for `WRONG` only when `showWrongAnswers` is on |
| `auction:steal` | `{ roundNo, stealerParticipantId, names, stealDeadlineAt }` | Auction: the prover busted; the other player may steal |
| `hex:turn` | `{ roundNo, participantId, pickDeadlineAt }` | Hex: whose pick |
| `hex:race` | `{ roundNo, cell, pickedBy, auto, cleared, question, letter, answerDeadlineAt }` | Hex: both players race on the cell's question; `question` and `letter` in the viewer's language. `cleared`: the cell was the opponent's and is open again |
| `hex:answered` | `{ roundNo, participantId, player?: EntityRef, lockedUntil }` | Hex: a wrong name locks that player out of this race. `player` only when `showWrongAnswers` is on |
| `hex:claimed` | `{ roundNo, cell, participantId, player: EntityRef, rightNames: EntityRef[] }` | Hex: a right name took the cell. `rightNames`: up to 5 other right names for the viewer's letter |
| `lineup:placed` | `{ roundNo, slot, player: EntityRef, participantId: string \| null }` | Lineup: a name went on the board. `participantId` is null for the real shown names placed after the fake was unmasked |
| `lineup:wrong` | `{ roundNo, participantId, player?: EntityRef }` | Lineup: a wrong name; that player is locked out (the ack says until when). `player` (whom the text matched) only when `showWrongAnswers` is on; the typed text is never sent |
| `lineup:accused` | `{ roundNo, participantId, right, player?: EntityRef }` | Lineup: a shown name was typed. `player` (the fake) only when `right`; a wrong accusation does not say which shown name is real |
| `lineup:hint` | `{ roundNo, letters: [{ slot, letter }] }` | Lineup: the first letter of each empty slot's player, in the viewer's language |
| `oneTwo:offer` | `{ roundNo, ball: EntityRef, passerId, passTypes: string[], pickDeadlineAt }` | One-two: the pass types the passer may pick for the next pass (up to `offerCount`); the answer counts are never sent (DEC-81). At the deadline the server picks one at random |
| `oneTwo:passed` | `{ roundNo, passType, receiverId, answerDeadlineAt, random }` | One-two: the pass was made; `random` when the server picked it |
| `oneTwo:returned` | `{ roundNo, entity: EntityRef, passType, evidence, participantId }` | One-two: a right, unburned answer. It is the next ball and `participantId` passes next. `evidence`: the match that makes the link true, in the viewer's language |
| `oneTwo:missed` | `{ roundNo, participantId, reason: "WRONG" \| "BURNED" \| "TIME_UP", entity?: EntityRef }` | One-two: the receiver lost the rally. `entity` (what the text matched) for `BURNED`, and for `WRONG` only when `showWrongAnswers` is on; the typed text is never sent |
| `bridge:turn` | `{ roundNo, participantId, pickDeadlineAt }` | Bridge: who picks the next line. At the deadline the server picks a random open line |
| `bridge:question` | `{ roundNo, line, clubs: EntityRef[2], auto, answerDeadlineAt }` | Bridge: the picked line and its two clubs; `auto` when the server picked it. The answer count is never sent |
| `bridge:drawn` | `{ roundNo, line, participantId, right, result: "RIGHT" \| "WRONG" \| "USED" \| "TIME_UP", scorer?: EntityRef, evidence?: string[2], entity?: EntityRef, squares: [{ square, ownerId: string \| null }], scores: { [participantId]: number } }` | Bridge: the line is drawn, in the player's name when `right`, grey otherwise. `scorer` and `evidence` (the two matches, one per club, in the viewer's language) only when right. `entity` (what the text matched) for `USED`, and for `WRONG` only when `showWrongAnswers` is on: a known player who is not linked, which the app shows as "not in our records" because the goals start at `goalsSince` (DEC-85). `squares` lists the squares this line closed (row by row over `(size − 1)²`) and who got them (null: nobody, under `wrongLine: GREY_GIVES_NOTHING`). After a right line that closed a square the same player picks again |
| `hex:expired` | `{ roundNo, cell, rightNames: EntityRef[] }` | Hex: nobody answered in time; the cell stays open with its next question |
| `vault:tried` | `{ roundNo, participantId, tries }` | Vault: a player's wrong try. Only the count: never the code, never their lockout (08 §12.2) |
| `vault:leak` | `{ roundNo, position, digit, nextLeakAt: string \| null }` | Vault: a digit revealed to everyone (`position` 0-based); `nextLeakAt` is null after the last leak |
| `round:result` | `{ roundNo, questionId, winnerParticipantIds: string[], reveal, points: [{ participantId, points }], scores: [{ participantId, score }] }` | Round closed. `questionId` is what a player sends to `POST /v1/questions/{questionId}/reports` (`08` §5.7); it is never sent before the round ends. `winnerParticipantIds` holds the round winner (the correct answerer, or the grid line owner); it is empty when nobody won or the grid was a draw. `reveal`: reveal and buzz: `{ steps: string[], answer: EntityRef \| { number }, explanation? }`; grid: `{ line?: cell[3], sampleAnswers: [{ cell, player: EntityRef }] }`; mines: `{ reason: "LAST_HEART" \| "NO_SAFE_ANSWERS" \| "MAX_TURNS" \| "FORFEIT", mines: [{ participantId, mines: [{ player: EntityRef, exploded, auto }] }], sampleAnswers: EntityRef[] }`; auction: `{ list, outcome: "PROVED" \| "STOLEN" \| "BUST" \| "FORFEIT", bid, answers: [{ player: EntityRef, saidBy?: string }] }`; vault: `{ code, outcome: "OPENED" \| "NOBODY", openedBy?, answers: [{ position, digit }] }`; hex: `{ outcome: "CONNECTED" \| "MAX_PICKS" \| "FORFEIT", path?: cell[], owners: (participantId \| null)[] }`; lineup: `{ slots: [{ slot, player: EntityRef, shirtNumber, placedBy: string \| null }×11], fake: { player: EntityRef, reason: "BENCH", unmaskedBy: string \| null } }`, where `winnerParticipantIds` holds the player with the most points this round (empty on a tie); one-two: `{ seed: EntityRef, chain: [{ entity: EntityRef, passType, returnedBy, evidence }], endReason: "MISSED" \| "DEAD_END" \| "MAX_PASSES" \| "FORFEIT", missed: { participantId, reason, passType } \| null, examples: EntityRef[] }`, where `examples` holds up to 3 right answers nobody named after a miss; bridge: `{ lines: [{ line, drawnBy: string \| null, right: boolean \| null, scorer?: EntityRef, examples: EntityRef[] }], squares: (string \| null)[] }`, where `examples` holds up to 3 scorers nobody named on that line |
| `player:disconnected` | `{ participantId, graceUntil }` | A human's last socket dropped |
| `player:reconnected` | `{ participantId }` | |
| `player:forfeited` | `{ participantId, reason: "GRACE_EXPIRED" \| "FORFEIT" \| "NOT_READY" }` | Participant out of the battle |
| `battle:completed` | `{ endReason: "COMPLETED" \| "FORFEIT" \| "ABANDONED", you?: { placement, outcome: "WIN" \| "LOSS" \| "DRAW", score, points }, placements: [{ participantId, placement, score }], pointsPending: boolean }` | End. Those who left are placed after everyone still in, as losses. `ABANDONED` (no human left) has no placements. `you.points` is what this battle adds to your `BATTLES` leaderboards (`08` §6.1); it reaches them asynchronously, so `pointsPending` is true when it is above 0 (always false vs a bot or in a room, DEC-41) |
| `battle:snapshot` | `{ status, gameType, mode, players, firstMover?, currentRound?: { roundNo, phase, revealedClues \| board, buzzHolder?, lockedOut[], deadlines }, rounds: [...results so far], scores, seq }` | Reply to resync and on reconnect. Contains only what was already revealed. `status` is `PICKING_FIRST` during rock-paper-scissors; then `firstMover` is `{ attempt, pickDeadlineAt, youPicked, attempts }` (finished attempts only, never the other player's current pick), and `{ participantId }` once decided. For `MINES`, `currentRound` holds `criteria`, `answerCount`, `phase` (`BURYING` \| `TURNS` \| `CLOSED`), `buryDeadlineAt`, `yourMines`, `wrongTriesLeft`, `exploded: [{ buriedBy, player }]`, `said: [{ participantId, outcome, player? }]`, `hearts`, `answersLeft`, `minesLeft`, `turnOf`, `turnNo`, `detectorUsesLeft` and `deadlines.turnDeadlineAt` (08 §10.7); never another player's live mines. For `AUCTION`, `currentRound` holds `lists`, `phase` (`PICKING` \| `BIDDING` \| `PROVING` \| `STEALING` \| `CLOSED`), `picker`, `pickedList`, `bids`, `turnOf`, `prover`, `amount`, `allIn`, `maxWrong`, `found: [{ player, saidBy }]`, `strikes`, `stealer` and the current phase's deadline (08 §11.7). For `VAULT`, `currentRound` holds `questions`, `digits`, `leaked: [{ position, digit }]`, `tries` (per participant), the viewer's own `lockedUntil`, `roundDeadlineAt` and `nextLeakAt` (08 §12.7). For `HEX`, `currentRound` holds `size`, `board` (letters in the viewer's language), `owners`, `sides`, `phase` (`PICKING` \| `RACING` \| `CLOSED`), `turnOf`, `racingCell` with its `question` and `letter`, `lockedUntil` per participant, `clearsLeft`, `picks` and `deadline` (08 §13.8). For `LINEUP`, `currentRound` holds `title`, `slots` (each with `placed: { player, participantId } \| null`), `shown`, `fake: { player, unmaskedBy } \| null`, `hints` (letters of the empty slots once out), the viewer's own `lockedUntil` and `accusationUsed`, `points` (this round, per participant), `roundDeadlineAt` and `hintsAt` (08 §14.7) For `BRIDGE`, `currentRound` holds `size`, `clubs`, `goalsSince`, `lines` (each with `drawnBy`, `right`, and `scorer` and `evidence` when right), `squares`, `turnId`, `phase` (`PICKING` \| `ANSWERING` \| `CLOSED`), the picked `line`, `deadline` and `points` |

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
