# Battle games: shared engine, game rules, answer catalog

How the game types of ADR-0015 run on one battle engine. Read with `03-workflows.md` §3-4 (matchmaking, rooms, engine lifecycle), `api/WEBSOCKET.md` (messages), `02-database.md` §4.6 and §4.8 (tables), and `07-football-data-and-questions.md` (where content comes from).

Every number in this file is configuration (per game type), never a constant. Names in `code` font are config keys.

## 1. Game types and mechanics

| Game type (`gameType`) | Mechanic | What is revealed step by step | The answer | Players |
|---|---|---|---|---|
| `BUZZER` | Reveal and buzz | The words of a question | An entity from the answer catalog, or a number | 2..N |
| `CAREER` | Reveal and buzz | A player's clubs, oldest first, with years if `showYears` | A player | 2..N |
| `WHO_IS_PLAYER` | Reveal and buzz | Clues about one player (nationality, position, birth year, a club, a trophy...), hardest first | A player | 2..N |
| `GRID` | Turns on a board | Nothing: the whole 3×3 board of criteria is shown | A player who fits a cell's row and column | exactly 2 (DEC-61) |
| `IMPOSTER` | Chat and vote (P8, DEC-58) | Not designed yet | — | rooms only |
| `MINES` (لغم) | Turns with hearts, hidden mines (N1) | A category; each player first buries mines in secret | Players of the category, no repeats | 2 |
| `AUCTION` (المزاد) | Bidding, then proof (N2) | A list title and its answer count | As many names of the list as you bid | 2 |
| `VAULT` (الخزنة) | Simultaneous race (N3) | Four questions whose answers are digits 0–9; leaks on a timer | The whole 4-digit code, all or nothing | 2 |
| `HEX` (الهجمة) | Hex board race (N4) | A board of letters; a question per picked cell | A name starting with the cell's letter | 2 |
| `LINEUP` (التشكيلة) | Simultaneous slot filling (N5) | A famous match's formation, 3 shown names (one fake) | The starting XI; accuse the fake | 2 |
| `TIME_MACHINE` (آلة الزمن) | Turns with hearts, years going back (N6) | A tournament edition per turn | One fact about that edition | 2 |
| `THREAD` (الخيط) | Simultaneous chained race (N7) | Five rooms, each question pointing at the previous answer | Each room's single answer | 2 |

The seven new game types (DEC-68) are designed one by one in track N; §9 holds what they share. A battle has **one** game type, chosen when it is created: by the queue the player joined (DEC-59), or by the host in a room. A battle is `roundCount` rounds of that game (DEC-31, per game type).

## 2. Engine and game rules

### 2.1 Who does what

| Part | Layer | Knows about |
|---|---|---|
| **Battle engine** | application (`battles`) | Participants, readiness, the round loop, timers, `seq`, persistence, reconnection, forfeits, bots, completion. It runs **one battle at a time per battle**: commands and timer firings for a battle are processed one after another, in arrival order, so two buzzes can never both "win" |
| **Game rules** | domain (`battles/domain/games/`) | One mechanic: what a round's state is, which commands are legal now, what a timer firing does, how the round ends and what it is worth. Plain TypeScript: no NestJS, no sockets, no database, time passed in |
| **Bot strategy** | domain, one per mechanic | When a bot buzzes and whether it is right (reveal and buzz); which cell it takes and whether it is right (grid) |

### 2.2 The game rules interface

The rules never perform side effects. They receive the round state and an input, and return the new state plus a list of **effects** that the engine carries out. This is the "functional core, imperative shell" pattern: the rules are pure and fully unit-testable with a fake clock, and all I/O lives in one place.

```ts
// battles/domain/games/game-rules.ts (shape, not final code)
interface GameRules<RoundState> {
  startRound(round: RoundSetup, now: Date): RulesStep<RoundState>;
  handleCommand(state: RoundState, from: ParticipantId, command: PlayerCommand, now: Date): RulesStep<RoundState> | Rejection;
  handleTimer(state: RoundState, timer: TimerKey, now: Date): RulesStep<RoundState>;
  participantLeft(state: RoundState, who: ParticipantId, now: Date): RulesStep<RoundState>;   // forfeit mid-round
}
interface RulesStep<S> { state: S; effects: Effect[] }
type Effect =
  | { type: 'EMIT'; to: 'ALL' | ParticipantId; event: BattleEvent }      // engine adds seq + serverTime
  | { type: 'SCHEDULE'; timer: TimerKey; at: Date }
  | { type: 'CANCEL'; timer: TimerKey }
  | { type: 'RECORD_ACTION'; action: RoundAction }                       // persisted to battle_round_actions
  | { type: 'END_ROUND'; result: RoundResult };                          // winner(s), points per participant
interface Rejection { code: string }                                     // becomes the ack's error code
```

- The registry maps `gameType → { rules, botStrategy, configSchema }`. `BUZZER`, `CAREER` and `WHO_IS_PLAYER` share `RevealAndBuzzRules`; `GRID` uses `GridRules`.
- Adding a game = a new rules class (or a new content kind for an existing mechanic), its bot strategy, its config schema, its content shape (§4) and its protocol events. The engine does not change.
- Rule: if the engine needs an `if (gameType === ...)`, the abstraction is wrong. Fix the interface instead.

### 2.3 What stays in the engine (all games)

Readiness and `WAITING_READY`; the first-mover phase `PICKING_FIRST` (rock-paper-scissors, §9.1); round sequencing and `roundCount`; timers (one scheduler per battle, keyed by `TimerKey`; all cancelled at battle end); `seq` and `serverTime` on every event; persistence of rounds and actions; disconnect grace and forfeit; `battle:resync` snapshots (built from the rules' state through a `snapshotFor(participant)` method, so a client only ever sees what was revealed); bot scheduling (bots send commands through the same `handleCommand` path, with no `clientMsgId`); scoring hand-off (`BattleScorer` totals the rounds' points; placements as before); completion and `BattleCompleted`.

### 2.4 Round runners (P6.4)

The engine (`LiveBattle`) owns the battle; one **round runner** per mechanic owns a round. `RevealRoundRunner` serves `BUZZER`, `CAREER` and `WHO_IS_PLAYER`; `GridRoundRunner` serves `GRID`. A runner wraps its pure rules, renders its events per viewer, drives its bot and builds its part of the snapshot. It calls back into the battle to emit, schedule timers, record actions and end the round. Picking the runner from the content's game type is the registry of §2.2; nothing else in the engine looks at the game type.

## 3. Mechanics

### 3.1 Reveal and buzz (`BUZZER`, `CAREER`, `WHO_IS_PLAYER`)

Product rules: DEC-54 (decided structure), DEC-60 (wrong answers visible), DEC-33 (points).

```mermaid
stateDiagram-v2
  [*] --> REVEALING: round starts, step 1 revealed
  REVEALING --> REVEALING: reveal timer → next step
  REVEALING --> ANSWERING: first valid buzz (reveal paused)
  REVEALING --> FINAL_WINDOW: last step revealed
  FINAL_WINDOW --> ANSWERING: first valid buzz
  ANSWERING --> CLOSED: correct answer (winner)
  ANSWERING --> REVEALING: wrong / no answer in time, steps remain (buzzer locked out, reveal resumes)
  ANSWERING --> FINAL_WINDOW: wrong / no answer in time, all steps revealed
  ANSWERING --> CLOSED: every active participant locked out
  FINAL_WINDOW --> CLOSED: final timer ends (no winner)
  CLOSED --> [*]
```

1. **Start:** the engine loads the round content (server side only). The rules emit `round:start` (game type, `answerKind`, `stepCount`, no clue text) and reveal step 1 with `round:clue`. They schedule the next reveal at `now + revealIntervalMs`.
2. **Reveal:** each reveal timer emits `round:clue { index, clue }`, localized per player. A client never receives a step before it is revealed.
3. **Buzz:** `round:buzz` is accepted when the round is `REVEALING` or `FINAL_WINDOW`, the sender is active and not locked out, and nobody else holds the buzz. The first accepted buzz wins because the engine processes a battle's commands in arrival order. Later buzzes get `BUZZ_TAKEN`. On acceptance: cancel the reveal timer and remember how much of the interval was left; emit `round:buzzed { participantId, answerDeadlineAt }`; schedule the answer timer at `now + answerWindowMs + latencyGraceMs`.
4. **Answer:** only the buzz holder may send `round:answer`, once per buzz. The answer is the typed text, or a number when `answerKind = NUMBER`. The server judges it (`AnswerChecker`, §5.3).
   - **Correct:** record it, `END_ROUND` with the winner. `round:result` reveals every step and the answer to everyone.
   - **Wrong or timed out:** record it; the player is locked out for this round (`attemptsPerPlayer`, default 1). Emit `round:wrong { participantId, answer? }`. Whether the wrong answer is shown is `showWrongAnswers` (DEC-60). Then resume: the next reveal fires after the remaining part of the interval, or after `resumeDelayMs` when that is larger. Emit `round:resumed { nextClueAt }`.
5. **End without a winner:** after the last step, the round stays open for `finalWindowMs` (`FINAL_WINDOW`). If nobody answers correctly by then, or every active participant is locked out, the round closes with no winner and `round:result` shows the answer.
6. **Points (DEC-33, per game type):** the winner gets `points.correct`, plus `points.perUnrevealedStep × steps not yet revealed` when that is non-zero (an early answer is worth more). `points.wrong` (default 0, may be negative) applies to a wrong answer. Everyone else gets 0.
7. **Forfeit during `ANSWERING`:** the buzz is released as a wrong answer with no penalty, and the reveal resumes.

**Content per game type** (prepared by the pipeline, §4):
- `BUZZER`: the question split into `stepCount` reveal segments **per locale, with the same count in every locale**. Arabic and English sentences have different word counts, so revealing "word by word" literally would show the two languages different amounts of the question. The pipeline splits both texts into the same number of meaningful chunks, so both players see the same share of the question at the same time.
- `CAREER`: the spells in order (`clubEntityId`, `fromYear`, `toYear`). Club names are rendered from the answer catalog in each player's locale, so no translation is needed. Loans are kept; consecutive spells at the same club are merged; youth teams are dropped (config in the pipeline).
- `WHO_IS_PLAYER`: an ordered list of clues, each with a `kind` and localized text, hardest first.

**How the engine turns content into steps** (P6.2): one step per spell or clue, in the player's locale.
- `CAREER`: `Sporting CP (2002–2003)` / `سبورتينغ لشبونة (2002–2003)`. An open spell ends with `present` / `حتى الآن`, and a loan adds `, loan` / `، إعارة` inside the brackets. With `showYears` off, only the club and the loan mark are shown. Club names come from the answer catalog.
- `WHO_IS_PLAYER`: the clue text as the pipeline wrote it (07 §5.8).
- `BUZZER`: the steps as written.

### 3.2 Grid (`GRID`, football tic-tac-toe)

Approved on condition that the data supports it. The 2026-11-10 check passed (`07` §4.1).

1. **Board:** 3 row criteria and 3 column criteria. A criterion is `{ kind: CLUB | NATIONALITY | COMPETITION_WON, entityId }`. Every cell has at least `minAnswersPerCell` valid players, guaranteed by the pipeline. The whole board is sent in `round:start`.
2. **Turns:** players alternate. Round 1 starts with the rock-paper-scissors winner (§9.1, ADR-0023); later rounds follow `firstMoverAfterRound1` (default `ALTERNATE`). The player on turn has `turnMs` to send `grid:claim { cell, answer: { text } }`.
   - Valid when: it is their turn and the cell is free. The text is judged against the cell's valid players (§5.3); naming a player already used on this board is rejected (`PLAYER_ALREADY_USED`).
   - **Correct** (the player fits both criteria): the cell is theirs. `grid:claimed`.
   - **Wrong:** the cell stays free. `grid:missed { cell, participantId, answer? }` (DEC-60). After `attemptsPerTurn` wrong tries (default 1) the turn passes.
   - **Timeout or `grid:skip`:** the turn passes. `skipsPerRound` limits skips; a skip beyond it gives the round to the opponent (as in KickBrain; config, default off).
3. **End:** three cells in a line wins the round (`round:result` with the line). A full board, or `maxTurns` reached, is a draw. At the end everyone sees one valid answer per empty cell (`revealAnswersAtEnd`).
4. **Points:** `points.roundWin`, `points.roundDraw`, plus optional `points.perCell`.
5. **Players:** exactly 2 (DEC-61). A room can start a `GRID` battle only with 2 members.
6. **Details (P6.4):**
   - Who starts round 1 comes from the first-mover phase (§9.1); it was a seeded draw until ADR-0023. Replays still start the same way, because the duel's fallbacks use the seeded random source.
   - A turn number counts every turn started. Starting turn `maxTurns + 1` ends the round as a draw (`MAX_TURNS`).
   - A wrong answer keeps the turn while `attemptsLeft > 0`, with the same deadline; it never uses the player up.
   - `skipsPerRound: null` means unlimited. With a number, the skip after the last allowed one gives the round to the opponent (`SKIP_LIMIT`).
   - A participant who leaves mid-round gives it to the other (`FORFEIT`, no points).
   - Every cell is a slot of `question_answers` (`row * 3 + col`), so `AnswerChecker` judges a claim like any typed answer, with the cell's valid players as the accepted answers.

### 3.3 Bots

Bots exist only in matchmaking (DEC-39), and their behaviour comes from a profile (DEC-43) plus the injected random source, so a battle with a fixed seed replays identically.

| Mechanic | At round start the bot strategy returns | The engine then |
|---|---|---|
| Reveal and buzz | `{ buzzAfterStep: k \| null, answersCorrectly, typingDelayMs }`, from `difficulty`, the profile's skill per difficulty, and `stepCount` | Schedules a buzz after step k is revealed (if nobody else holds the buzz), then the answer after `typingDelayMs`: the correct entity, or a wrong entity of the same kind from the catalog |
| Grid | On each of its turns: `{ cell, answersCorrectly, thinkDelayMs }`. The cell: one that wins, else one that blocks the opponent's line, else the centre, else a random free cell. Correctness comes from the profile's `knowsAnswerByDifficulty`; the delay from `typingDelayMs` | Sends `grid:claim` with the most popular valid unused player, or a wrong player of the same kind |

Bot commands go through `handleCommand` like human commands. Bots never earn ledger points (DEC-41).

## 4. Content shapes

Round content lives in `question-bank` (`02-database.md` §4.6) and comes from bundles (`07` §5.4). One content item = one round. All content is **immutable once it could have been served** (P5.1 versioning rules apply unchanged).

| `gameType` | Content (`content` JSON, validated at import) | Accepted answers (`question_answers`) |
|---|---|---|
| `BUZZER` | `{ answerKind, steps: { en: string[], ar: string[] }, explanation?: {en, ar} }`, equal step counts per locale | 1+ entity ids (slot 0), or `{ number }` in content for `NUMBER` |
| `CAREER` | `{ playerEntityId, spells: [{ clubEntityId, fromYear, toYear \| null, loan }] }` | The player (slot 0) |
| `WHO_IS_PLAYER` | `{ playerEntityId, clues: [{ kind, text: {en, ar} }] }` | The player (slot 0) |
| `GRID` | `{ rows: [criterion ×3], cols: [criterion ×3] }` | For each cell (slot 0..8), every valid player id |
| `MINES` | `{ criteria: [criterion ×2] }` (§10.4) | Slot 0: every player of the category |
| `AUCTION` | `{ lists: [{ kind, title } ×3] }` (§11.4) | Slots 0..2: every name of each list |

`answerKind` is `PLAYER`, `CLUB`, `NATIONAL_TEAM`, `COUNTRY`, `COMPETITION`, `COACH`, or `NUMBER`. Catalog entities of kind `COUNTRY` also name the nationality criteria of `GRID`. The client uses it to filter suggestions; it gives nothing away.

## 5. Answer catalog and typed answers (DEC-55)

### 5.1 What it is
A list of football entities a typed answer can be, with names in both languages: `answer_entities` (id, external ref such as `wikidata:Q11571`, kind, `names {en, ar}`, `popularity`, normalized `search_forms`, distinctive `name_words`) and `answer_entity_aliases` (alternative names per locale: "CR7", "رونالدو", "كريستيانو"). It is imported from the bundle with the content (`07` §5.4) and **stays on the server** (ADR-0021): it judges typed text and gives names to events. The pipeline guarantees that every accepted answer is in the catalog.

### 5.2 What the player does
The player types the answer and sends it. **No suggestions are shown** (ADR-0021, DEC-55). The app sends `{ text }` (at most `answers.maxLength` characters) or `{ number }`. The app never receives the accepted answers or the catalog.

### 5.3 Judging an answer
`AnswerChecker.judgeTypedText(contentId, slot, text, rules)` compares the text **only with the accepted answers of that slot**:

1. **Normalize** the text (`07` §5.7). Empty: rejected with `EMPTY_ANSWER`, no attempt used.
2. **Exact match** with a form of an accepted answer: `CORRECT`.
3. **Exact match** with a full name or alias of **another** entity of the round's `answerKind`: `WRONG`, and that entity is the shown wrong answer (`تشابي` is Xabi Alonso, not a typo of `تشافي`).
4. **Within the typo tolerance** of a form of an accepted answer: `CORRECT`.
5. Otherwise `WRONG`, with nothing to show.

- **Forms of an entity:** its full names (`ar`, `en`), its aliases, and each distinctive single word of its names: at least 3 letters, shared by at most `answers.singleWordMaxSharedBy` entities of the same kind (default 15; `name_words`, computed by the pipeline over the whole knowledge base). `ليونيل` counts alone for Messi; `محمد` does not count alone for Mohamed Salah.
- **Typo tolerance:** edit distance in letters (one letter added, missing, changed, or two neighbours swapped is one edit), by the form's letter count without spaces: `answers.typoTolerance`, default up to 3 letters exact, 4-7 letters 1 edit, 8+ letters 2 edits. `ميسب`, `مبسي` and `ميسيي` are one edit from `ميسي`.
- **`GRID`:** the accepted answers are the cell's valid players. When the text fits several: the closest first, then one not used on this board, then the most popular. Only used players fit: `PLAYER_ALREADY_USED`.
- **Result:** `{ verdict: CORRECT | WRONG, entityId | null, match: EXACT | TYPO | OTHER_ENTITY | NONE }`. The engine records the text, the entity and `match` on the action (for tuning the tolerance), and never shows the raw text to other players (DEC-60 shows only an `OTHER_ENTITY` match).
- **Bots** answer with an entity id inside the server; they skip text judging.
- A `NUMBER` answer is compared by the game rules with `answerNumber` from the round content.

### 5.4 What `question-bank` gives the engine (P5.2b)
The interface is in `01-modules.md` §2.6. All of it is server side; the game rules decide what each event shows.

- **`ContentSelector.pickContentIds(criteria)`** returns up to `count` random content ids that pass every check in its criteria:
  - **`gameType` and `count`:** that game type, at most that many ids.
  - **`locales`:** available in every one of them.
  - **`excludeContentIds`:** none of these ids.
  - **`difficulties`, optional:** only these difficulties.
  - **`minAnswersPerSlot`, optional (`GRID`):** every cell has at least that many accepted answers.
  - **Always:** `PUBLISHED`, and not expired (`valid_until` checked with the database clock).

  It returns fewer ids when the bank is short; the difficulty mix is the caller's (`selection.difficulties` config).
- **`ContentSelector.pickContentIdsInGivenOrder(criteria, candidateContentIds)`** returns, in the candidates' order, the first `count` of them that pass the same checks (no `excludeContentIds`). `battles` uses it when the first call came back short: the candidates are the players' seen questions, longest ago first, so the refill repeats what they are least likely to remember (DEC-44). The order is `ORDER BY random()`, which reads every matching row: fine for a bank of thousands. Revisit above about 100k rows per game type.
- **`RoundContentQuery.getContentForEngine(contentId, locales)`** returns the content with every catalog `externalRef` replaced by the entity id, texts only in the requested locales, and the accepted answers per slot (for the reveal at the end of a round). Any status: a battle keeps playing the content it picked at creation, even if that content is disabled later.
- **`AnswerCatalogQuery.findEntitiesByIds(ids)`** returns names in both locales, because one battle can have players of both languages.
- **`QuestionBankFacade.disableQuestion(id, reason)`** is used by the CLI now and by moderation later. Selection skips the content at once.

### 5.5 `GET /v1/answer-catalog` (removed)
Built in P5.2 for on-device search. With no suggestions (ADR-0021) the app does not need the catalog, so P6.6 removed the endpoint and its in-memory gzip cache.

### 5.6 Publishing and disabling (CLI)
- **`questions:publish <bundleVersion>`:**
  - Every `APPROVED` question of that bundle becomes `PUBLISHED`, with `published_at` set.
  - `DRAFT` questions are counted as "waiting for review" and stay as they are.
  - Writes one `QuestionsPublished { batchId, publishedCount }` event.
  - Running it again publishes nothing new and writes no event.
  - `--include-drafts` also publishes `DRAFT` questions. It is for development bundles only, and is refused when `NODE_ENV=production` (`07` §5.8).
- **`questions:disable <questionId> --reason <text>`:**
  - The question becomes `DISABLED` with that reason, and a `QuestionDisabled { questionId, reason }` event is written.
  - A question that is already disabled stays as it is, with no event.
  - An unknown id is an error.

### 5.7 Question stats and reports (P6.5c)

**Stats** feed difficulty calibration later (`calibrated_difficulty`, a future job). They count **humans only**: a bot's answers come from its profile, not from knowing football.

- `BattleCompleted.questionResults` has one item per round: `{ questionId, roundNo, endReason, served, solved, wrongAnswers, stepsRevealed }`.
  - `served`: the round started (a battle ended by forfeit has rounds that never did).
  - `solved`: a human won the round. In reveal games that is the correct answer; in `GRID` it is the round's winner.
  - `wrongAnswers`: wrong `ANSWER` and `GRID_CLAIM` actions by humans.
  - `stepsRevealed`: how far the reveal got (reveal games).
- The `question-bank` handler (queue `question-bank`, subscriber `question-bank.update-question-stats`) inserts the battle id into `question_stats_applied` and, only when that insert is new, adds each served round to `question_stats` in the same transaction. Here an increment is safe: the dedup row and the increments commit or roll back together.
- `ABANDONED` and `CANCELLED` battles write no `BattleCompleted`, so they add no stats.

**Reports:** `POST /v1/questions/{questionId}/reports { reason }`, for a player who thinks a question is wrong.

- **Only content the caller was served:** a round of a battle they took part in, with `started_at` set. Anything else, including an unknown id, is `404 QUESTION_NOT_FOUND`, so the endpoint cannot be used to probe question ids.
- **One report per player per question:** a repeat changes nothing and answers `204` again (idempotent). `reason` is free text, 1 to 500 characters.
- **Where it lives:** the controller is in `battles`, the only module that knows what was served (`question-bank` cannot call `battles`: that would be a cycle). It checks the served rule, then calls `QuestionReports.reportQuestion`, which writes `question_reports`, owned by `question-bank`.
- **Moderation:** `npm run cli -- questions:reports` lists the most reported questions with their latest reasons; an operator then uses `questions:disable`. There is no automatic disabling: a threshold would be a product rule nobody has decided.

## 6. Configuration (per game type)

Stored in the battle config by game type, snapshotted on the battle row at creation (as today). Dev seeds use obviously fake `DEV_ONLY` values. Product values are picked at playtesting.

| Key | Applies to | Decision |
|---|---|---|
| `roundCount` | all | DEC-31 |
| `revealIntervalMs`, `resumeDelayMs`, `answerWindowMs`, `finalWindowMs`, `attemptsPerPlayer` | reveal and buzz | DEC-54 |
| `turnMs`, `attemptsPerTurn`, `skipsPerRound` (`null` = unlimited), `maxTurns`, `minAnswersPerCell`, `revealAnswersAtEnd`, `points.roundWin`, `points.roundDraw`, `points.perCell` | grid | DEC-54, DEC-61 |
| `showWrongAnswers` | all | DEC-60 |
| `answers.maxLength`, `answers.typoTolerance` (letters → edits), `answers.singleWordMaxSharedBy` | all typed answers | DEC-55 |
| `showYears` | `CAREER` | DEC-54 |
| `burying.*`, `hearts`, `ownMine`, `detector.*`, `points.perSafeAnswer` | `MINES` (§10.6) | DEC-72, DEC-73, DEC-75 |
| `targetScore`, `pickMs`, `bidding.*`, `proof.*`, `allIn.maxWrong`, `steal.*`, `points.allInWin` | `AUCTION` (§11.6) | DEC-76, DEC-77 |
| `room.difficultyLevels` (`EASY`, `MEDIUM`, `HARD` → difficulty ranges) | rooms | DEC-64 |
| `points.*` | all | DEC-33 |
| `latencyGraceMs`, `readyTimeoutMs`, `reconnectGraceMs`, `betweenRoundsMs` (pause after `round:result`) | engine | DEC-32 |
| `matchmaking.botFallbackAfterMs`, `tickMs`, `queueDisconnectGraceMs` | matchmaking | DEC-39 |
| `bots.profiles.*` (`knowsAnswerByDifficulty`, `guessChance`, `buzzAtShareOfSteps`, `reactionDelayMs`, `typingDelayMs`) | bots | DEC-43 |
| `selection.difficulties` | all | DEC-44 |

### 6.1 Leaderboard points (the `BATTLE` rule set, P6.5)

The in-game `score` (`points.*` above) decides placements inside one battle. **Ledger points** are what a battle adds to the `BATTLES` leaderboards. They come from the active `BATTLE` scoring rule set (`scoring_rule_sets`, stored by `points`), not from the battle config file, because every ledger entry records the rule set that produced it.

```json
{ "modes": {
    "matchmakingVsHuman": { "pointsByOutcome": { "WIN": 30, "DRAW": 10, "LOSS": 0 }, "forfeitWinEarnsPoints": true },
    "matchmakingVsBot":   { "pointsByOutcome": { "WIN": 0, "DRAW": 0, "LOSS": 0 }, "forfeitWinEarnsPoints": false },
    "room":               { "pointsByOutcome": { "WIN": 0, "DRAW": 0, "LOSS": 0 }, "forfeitWinEarnsPoints": false } } }
```

- **Values:** `DEV_ONLY` placeholders (DEC-33), except vs bot and room, which earn nothing (DEC-41). Points are whole numbers ≥ 0: a lost battle never removes leaderboard points (negative values would need a decision).
- **Who computes:** `battles` (the ledger only records, 01 §2.9). At creation the engine reads the active rule set, keeps the section for the battle's mode in the config snapshot and stores `battles.rule_set_id`. A rule set activated during a battle applies from the next battle; past battles keep their points.
- **At completion:** each human gets `pointsByOutcome[outcome]`, and 0 for a win by forfeit when `forfeitWinEarnsPoints` is false. Bots never get points. `CANCELLED` and `ABANDONED` battles have no placements and no points.
- **No active rule set:** the battle plays normally, `rule_set_id` stays NULL, every human gets 0 and the API logs a warning. Production activates one before launch.
- **Activation:** `npm run cli -- battles:activate-rule-set <file>`. `battles` validates the shape; `points` stores it as the next version and retires the previous `ACTIVE` one in the same transaction, and writes `ScoringRuleSetActivated`. Activating a config equal to the active one changes nothing. Dev file: `apps/backend/config/scoring/battle.dev.json`.
- **To the ledger:** `BattleCompleted` carries `ruleSetId`, `endReason` and each participant's `points`. The `points` handler writes one `point_entries` row per human with points > 0, then `PointsRecorded`. `battle:completed` tells each player `you.points`; `pointsPending` is true when they are above 0.

## 7. Fairness and abuse

- **The client never holds what it should not show:** unrevealed steps, accepted answers, valid grid answers. Snapshots on resync contain only revealed steps.
- **Buzz order is server arrival order.** A player on a slower network buzzes "later". Accepted for v1.0. Measure buzz-to-receive delays (`battle_buzz_latency_ms` from client timestamps, used for metrics only, never for ordering) before deciding whether compensation is needed.
- **Answer lookups:** a cheater could search the web during the answer window. The window is short by design (`answerWindowMs`). Not solvable on the client; accepted.
- **Monetization hook:** starting play still goes through the two entry use cases only (ADR-0016).

## 8. Question topics and difficulty in private rooms (ADR-0020, DEC-64)

- **Topics:** every round carries `topics` (07 §5.9), separate from its `category`. "General" plays everything.
- **Room setup:** in `LOBBY` the host sets `topics` (empty = General) and `difficultyLevel` (`MIXED`, `EASY`, `MEDIUM`, `HARD`; ranges in `room.difficultyLevels`). Members see them in `room:updated`. The battle snapshots them into `battles.config.selection`.
- **Selection:** `ContentSelector.pickContentIds` gets `topics` (any of them) and the level's `difficulties`. Seen questions are still skipped inside the filter, and the refill takes seen questions that match the filter (DEC-44).
- **Availability:** `GET /v1/battle-topics?gameType=` lists topics with published content in the caller's locale and counts per level, so the app only offers choices that can fill a battle. A room start that cannot fill `roundCount` rounds fails with `409 NOT_ENOUGH_CONTENT` and changes nothing.
- **Random matchmaking** stays unfiltered (DEC-65).

## 9. New game types: shared pieces (N0, DEC-68, ADR-0023)

Each new game gets its own section after this one when its N phase starts (rules, state diagram, content shape, bot, config, open rules as DECs; `MINES` is §10, `AUCTION` §11). This section holds only what several of them share.

### 9.1 Who starts: rock-paper-scissors

For a game type with `firstMover: "RPS"` the engine adds a phase between `WAITING_READY` and round 1. It is engine work: the rules only receive `RoundSetup.firstMoverId`.

```mermaid
stateDiagram-v2
  [*] --> PICKING_FIRST: everyone ready
  PICKING_FIRST --> PICKING_FIRST: both picked, tie, replays left
  PICKING_FIRST --> ROUND_1: both picked, a winner
  PICKING_FIRST --> ROUND_1: tie after maxReplays → seeded draw
  ROUND_1 --> [*]
```

1. The server emits `battle:rps-start { attempt, pickDeadlineAt }` to both players.
2. Each player sends `battle:rps-pick { choice: ROCK | PAPER | SCISSORS }` once per attempt. The server keeps the picks secret: no event says who has already picked.
3. When both have picked, or `pickDeadlineAt` passes, the server emits `battle:rps-result { attempt, picks: [{ participantId, choice, auto }], winnerId | null }`. A missing pick is drawn from the seeded random source and marked `auto: true`.
4. A tie with replays left starts the next attempt. A tie after `rps.maxReplays` replays ends the phase with a seeded draw (`winnerId` set, `decidedBy: "DRAW"`).
5. Bots pick from the seeded random source after a human-like delay (`rps.botPickDelayMs`).
6. The outcome is stored on `battles.first_mover` (picks per attempt, winner, how it was decided), so the start replays identically and can be audited.
7. Later rounds: `firstMoverAfterRound1` per game type, `ALTERNATE` (default), `LOSER_STARTS` or `RPS_EACH_ROUND` (DEC-71).
8. Rooms with 3 or more players: a seeded random order instead of a duel (DEC-70).
9. Forfeit during the phase: the battle ends as a forfeit, as in any other phase.

Config (per game type): `firstMover` (`RPS` | `RANDOM` | `NONE` for games where everyone plays at once, like `VAULT` and `THREAD`), `rps.pickMs` (default 5000), `rps.maxReplays` (default 2), `rps.revealMs` (how long a result shows before the next attempt or round 1, default 2000), `rps.botPickDelayMs` (`{ min, max }`, never sent to clients), `firstMoverAfterRound1` (required unless `firstMover` is `NONE`; `RPS_EACH_ROUND` needs `RPS`). The boot check refuses a game type with `RPS` and no `rps` section.

Implementation notes (N0, built 2026-11-19):
- The duel is pure domain (`battles/domain/first-mover/`); `LiveBattle` runs it as the engine status `PICKING_FIRST`. The database keeps `battles.status = IN_PROGRESS` during the phase.
- `battles.first_mover` holds an array with one entry per decided round: `{ beforeRound, winnerId, decidedBy: RPS | DRAW | RANDOM | ALTERNATE | LOSER_STARTS, attempts? }`.
- During the phase, `battle:snapshot` carries `firstMover: { attempt, pickDeadlineAt, youPicked, attempts }`; afterwards `firstMover: { participantId }`.

| Game type | `firstMover` | Why |
|---|---|---|
| `GRID`, `MINES`, `HEX`, `TIME_MACHINE`, `AUCTION` | `RPS` | One player moves, picks or bids first |
| `VAULT`, `THREAD`, `LINEUP` | `NONE` | Both players race on the same content at the same time |
| Reveal and buzz | `NONE` | The first buzz decides, not a turn order |

### 9.2 Shared rule helpers

Plain TypeScript in `battles/domain/games/shared/`, called by each game's own rules (ADR-0023). They are values plus pure functions with the clock passed in, unit-tested once. Each helper is written in the N phase of the first game that uses it (`UsedAnswers`, `Hearts` and `SecretChoices` with N1 `MINES`), so its shape comes from a real caller, not a guess.

| Helper | State it keeps | Config | Used by |
|---|---|---|---|
| `LockoutLadder` | wrong tries per player, locked-until time | `lockoutMs: number[]` (last value repeats) | `VAULT`, `HEX`, `THREAD` |
| `HintSchedule` | which hints are out | `hints: { firstAtMs, everyMs, max }` | `VAULT` (digit leaks), `THREAD` (first letter), `LINEUP` (first letters) |
| `UsedAnswers` | entity ids named this round | `repeatCountsAsWrong: boolean` | `MINES`, `AUCTION`, `LINEUP`, `HEX` |
| `Hearts` | lives per player | `hearts: number` | `MINES`, `TIME_MACHINE` |
| `SecretChoices` | choices per player before play | `secretChoices: { count, deadlineMs }` | `MINES` |

### 9.3 Hidden information

- A snapshot or event never carries another player's secret choices, typed answers that the game keeps private, or anything not yet revealed. This is already the rule for clues (§2.3); each new game adds a test that renders every event for the opponent and finds no hidden value.
- Per game: `MINES` hides the opponent's mines until one explodes. `THREAD` shows the opponent's room number only. `VAULT` shows the opponent's attempt count only. `AUCTION` bids are public. In `LINEUP`, which shown name is the fake is hidden until someone accuses it or the round ends.

### 9.4 Order of work

N0 (this section and the first-mover phase in the engine, built 2026-11-19) comes first; the helpers arrive with their first game. Then N1 `MINES` (data ready today), N2 `AUCTION`, N3 `VAULT`, N4 `HEX`, N5 `LINEUP`, N6 `TIME_MACHINE`, N7 `THREAD` (ROADMAP track N). Each N phase writes its own section (§10 onward) before any code.


## 10. `MINES` (لغم, N1)

Chosen by the product owner on 2026-11-17 (DEC-68; demo page: https://claude.ai/artifact/YKW4nz4GNuJsgaaavhW64X). Each player secretly buries mines among the answers of a category, then the two take turns naming answers without stepping on the other's mines. The data exists today: careers and citizenships from D.1.

### 10.1 A round

```mermaid
stateDiagram-v2
  [*] --> BURYING: round:start
  BURYING --> TURNS: both buried all mines, or buryDeadlineAt
  TURNS --> TURNS: answer or timeout, the turn passes
  TURNS --> [*]: a player has no hearts, no safe answer left, maxTurns, or a forfeit
```

1. **Category:** two criteria that every accepted answer meets: `CLUB` plus `NATIONALITY` (citizenship, as in `GRID`) or `DECADE` (a spell at the club in those ten years) (DEC-74). The generator keeps categories with `20`–`40` answers (§10.4). `round:start` shows the category, `answerCount` and `minesPerPlayer`.
2. **Burying (`BURYING`):** each player buries `burying.minesPerPlayer` mines (default 3) within `burying.ms` by typing answers of the category, one per command. The server judges each one like any typed answer (§5.3).
   - A name outside the category is refused (`NOT_IN_CATEGORY`) and uses one of `burying.maxWrongTries`: without a cap, burying would be a free check of which names are valid. After the cap, further tries are refused (`NO_TRIES_LEFT`).
   - Burying the same player twice is refused (`ALREADY_BURIED`, no try used). A buried mine cannot be swapped in N1.
   - The phase ends early when both have buried all their mines. At the deadline, empty slots are filled from the category with the seeded random source and marked `auto` (DEC-73).
   - The opponent gets no event while you bury. Both players may bury the same player; the name is then a mine for each of them.
3. **Turns (`TURNS`):** round 1 starts with the rock-paper-scissors winner (§9.1); later rounds follow `firstMoverAfterRound1` (default `ALTERNATE`). Turns alternate, also after a lost heart. The player on turn has `turnMs` to send one answer.
4. **Judging an answer**, checked in this order:

   | The text matches | Outcome | Effect |
   |---|---|---|
   | nothing in the category | `WRONG` | −1 heart |
   | a player already said this round (safe or exploded) | `REPEATED` | −1 heart (`UsedAnswers` with `repeatCountsAsWrong`) |
   | one of the speaker's own live mines | per `ownMine` (DEC-72) | `REJECT` (default): refused with `OWN_MINE`, the turn and its clock go on, nothing is revealed. `COSTS_HEART`: outcome `OWN_MINE`, −1 heart, the mine stays hidden |
   | an opponent's live mine | `MINE` | The mine explodes: −1 heart; everyone sees the player and who buried it; the name counts as said |
   | any other player of the category | `SAFE` | `points.perSafeAnswer`; the name counts as said |
   | no answer by `turnDeadlineAt + latencyGraceMs` | `TIMEOUT` | −1 heart |

   After every outcome except a refusal, the turn passes. A name buried by both players is caught by the own-mine check first, so with `REJECT` neither of them can say it.
5. **Mine detector:** `detector.usesPerBattle` (default 1). On your turn, `mines:scan` with a name costs `detector.costMs` of your turn (a deadline already passed is a timeout). Only you get the result: `MINE` when the name is a live mine of the opponent, otherwise `CLEAR`, also for a wrong or already said name (the detector finds mines; it does not check answers). The opponent sees that you scanned and your new deadline, never the name or the result. The turn goes on.
6. **Round end:**
   - A player loses the last heart: the other wins the round (`LAST_HEART`).
   - The player on turn has no safe answer left (every unsaid answer is a live mine), or turn `maxTurns + 1` would start: the player with more hearts wins, then more safe answers this round, else a draw (`NO_SAFE_ANSWERS`, `MAX_TURNS`; DEC-75).
   - A participant leaves: the other wins (`FORFEIT`, no points).
   - Every mine is then revealed (who buried it, exploded or not, `auto`), with up to `revealAnswersAtEnd` unsaid answers.
7. **Hearts:** `hearts` per player (default 3), full again each round.
8. **Points:** `points.roundWin`, `points.roundDraw`, `points.perSafeAnswer`.
9. **On screen:** `answersLeft` (unsaid answers of the category, mines included) and `minesLeft` per player (not yet exploded) are public, so the app shows "safe answers left ≈ answersLeft − both minesLeft". It is approximate on purpose: the exact count would tell the players when they buried the same name.
10. **Players:** exactly 2 in N1. Rooms with 3 or more players (P8) would explode a mine for anyone except who buried it, with a seeded turn order (DEC-70); not built in N1.

### 10.2 Hidden information

- A live mine reaches only the player who buried it (the `mines:bury` ack, their own copy of the first `mines:turn`, their snapshot) until it explodes or the round ends. A private event would leave a `seq` gap for the other player and force a resync, so private results travel in acks or in per-viewer copies of a shared event.
- No event tells the opponent how many mines you have buried so far, and a scan result goes only to the scanner.
- The bot strategy never receives the human's mines; it can step on them like anyone.
- Test (§9.3): render every event and snapshot of a round for the opponent and find no live mine's entity id or name.

### 10.3 Protocol (details in `api/WEBSOCKET.md`)

| Direction | Message | Purpose |
|---|---|---|
| C→S | `mines:bury { roundNo, answer: { text } }` | Bury one mine; the ack carries your mines so far and `wrongTriesLeft` |
| C→S | `mines:answer { roundNo, answer: { text } }` | Your turn's answer |
| C→S | `mines:scan { roundNo, answer: { text } }` | Use the detector |
| S→C | `round:start` | Category, `answerCount`, `minesPerPlayer`, `buryDeadlineAt` |
| S→C | `mines:turn` | Whose turn, `turnDeadlineAt`, `turnNo`; the first one (burying closed) carries each viewer's own final mines, `auto` ones included |
| S→C | `mines:answered` | Outcome, the player named (wrong text only with `showWrongAnswers`), who buried an exploded mine, hearts, `answersLeft`, `minesLeft` |
| S→C | `mines:scanned` | Who scanned and the new deadline; `result` only for the scanner |
| S→C | `round:result` | `reveal: { reason, mines, sampleAnswers }` |

### 10.4 Content and generator

| `gameType` | Content | Accepted answers |
|---|---|---|
| `MINES` | `{ criteria: [{ kind: "CLUB", entityId }, { kind: "NATIONALITY", entityId } \| { kind: "DECADE", fromYear }] }` | Slot 0: every player of the category, most popular first |

Generator (`kb bundle --mines N`, 07 §5.8):
- **Category answers:** catalog players with a spell at the club and that citizenship, or with a dated spell at the club that overlaps `fromYear`..`fromYear + 9` (an open spell runs to today). Undated spells never count for a decade. Years before the player turned 17 do not count, and a spell that ended before then puts him in no category: Wikidata often stores youth years on the senior club's item (Marc-André ter Stegen at Gladbach "1996–2010").
- **Clubs:** only the `--mines-clubs` most popular clubs of the catalog (default 100), so players know the names. Without the limit most categories are small clubs nobody can name (1,076 categories, 764 of them difficulty 5).
- **Size:** kept only with `--mines-min-answers` to `--mines-max-answers` answers (default 20 to 40). Measured on 2026-11-19: 123 categories (87 club × nationality, 36 club × decade; a big club has more than 40 players in a decade).
- **Difficulty:** from the popularity of the category's answers (the median sitelinks band of §5.8): famous names make an easy round.
- **Key:** `mines:<club qid>:nationality:<country qid>` or `mines:<club qid>:decade:<fromYear>`.
- **Variety:** a club appears in at most a few categories of one bundle.

### 10.5 Bot

- **Burying:** `minesPerPlayer` players of the category, drawn with the seeded random source, after a human-like delay.
- **Turn:** after `typingDelayMs`, with the chance `knowsAnswerByDifficulty[difficulty]` it names the most popular unsaid player of the category that is not its own mine. Otherwise it sends a wrong player of the same kind, or lets the turn time out (`guessChance`).
- **Detector:** bots do not use it in N1.

### 10.6 Configuration

| Key | Default (dev) | Decision |
|---|---|---|
| `roundCount` | 1 | DEC-31 |
| `firstMover`, `firstMoverAfterRound1`, `rps.*` | `RPS`, `ALTERNATE` | §9.1, DEC-71 |
| `burying.minesPerPlayer`, `burying.ms`, `burying.maxWrongTries` | 3, 20000, 3 | DEC-73 |
| `turnMs`, `maxTurns` | 10000, 60 | DEC-54 |
| `hearts` | 3 | DEC-75 |
| `ownMine` (`REJECT` \| `COSTS_HEART`) | `REJECT` | DEC-72 |
| `detector.usesPerBattle`, `detector.costMs` | 1, 3000 | DEC-75 |
| `revealAnswersAtEnd`, `showWrongAnswers` | 5, true | DEC-60 |
| `points.roundWin`, `points.roundDraw`, `points.perSafeAnswer` | 3, 1, 1 | DEC-33 |

### 10.7 How it fits the engine

- **Rules:** pure `battles/domain/games/mines-rules.ts`; `MinesRoundRunner` wraps them like `GridRoundRunner` (§2.4). The engine gets no `if (gameType === "MINES")`.
- **Helpers (§9.2), in `battles/domain/games/shared/`:** `UsedAnswers` (entity ids said this round; for `MINES` a repeat always costs a heart, so no config), `Hearts` (`giveEveryoneHearts`, `loseHeart`, `hasHeartsLeft`), `SecretChoices` (`startSecretChoices`, `addSecretChoice`, `findSecretChoiceRejection`, `fillMissingSecretChoices` with the random source).
- **Detector across rounds:** a round can hand opaque state to the next one (`carryOver` on the round result, given to the next runner). The engine stores it without reading it. `MINES` passes the detector uses left; `TIME_MACHINE` and `AUCTION` will need the same.
- **Actions (`battle_round_actions.kind`):** `MINE_BURY` (the typed entity; `is_correct` = in the category), `MINE_AUTO_BURY`, `MINE_ANSWER` (`is_correct` = safe), `MINE_HIT` (stepped on a mine), `MINE_SCAN` (`is_correct` = a mine), `TURN_TIMEOUT`. `kind` is text, so no migration; question stats count a wrong `MINE_ANSWER` as a wrong answer.
- **Acks with data:** a round command may return an accepted ack with `data` (`RoundCommandOutcome`); `mines:bury` uses it.
- **Judging:** `AnswerChecker` with slot 0 as the accepted answers, as for a `GRID` cell.
- **Snapshot `currentRound`:** `phase`, `buryDeadlineAt`, your mines (`exploded`, `auto`), `wrongTriesLeft`, the exploded mines of others, every said name with its outcome (names hidden as in `mines:answered`), hearts, the turn and its deadline, `detectorUsesLeft`, `answersLeft`, `minesLeft`.

## 11. `AUCTION` (المزاد, N2)

Chosen by the product owner on 2026-11-18 (DEC-68; demo page: https://claude.ai/artifact/K9M3P4DBCKH9naFvG9jBbx). Each round offers a list ("Liverpool scorers in the 2018-19 Champions League"). The two players bid on how many names of it they can say; the last bidder must prove it live, and a bust gives the other player a chance to steal the round. First to 3 round wins.

### 11.1 A round

```mermaid
stateDiagram-v2
  [*] --> PICKING: round:start (3 lists)
  PICKING --> BIDDING: a list is picked, or pickDeadlineAt
  BIDDING --> BIDDING: a raise, the turn passes
  BIDDING --> PROVING: a call, a bid of the whole list, or a timeout after a bid
  PROVING --> [*]: enough correct names (PROVED)
  PROVING --> STEALING: too many wrong names, or proofDeadlineAt (bust)
  STEALING --> [*]: a correct unsaid name (STOLEN), or wrong names or stealDeadlineAt (BUST)
```

1. **Three lists:** a round's content is a lot of 3 lists (§11.4); `round:start` shows each one's title and answer count (DEC-76: the count is shown).
2. **Who picks:** round 1, the rock-paper-scissors winner (§9.1); later rounds, the loser of the last round (`firstMoverAfterRound1: LOSER_STARTS`). After a round nobody won, the pick passes to the other player.
   - The picker has `pickMs` to send `auction:pick`; at the deadline the server picks with the seeded random source (`auto`).
3. **Bidding:** the picker opens.
   - Each turn lasts `bidding.turnMs`.
   - The opening bid is at least `bidding.minOpeningBid` (DEC-76: 1); every raise is higher than the current bid, and no bid is above the list's answer count.
   - From the second turn on, a player may call (`auction:call`, "اتفضل ورّيني") instead of raising.
   - A bid equal to the answer count is the all-in ("كله يا عم"). Nobody can raise it, so the proof starts at once.
   - The opener's timeout opens with the minimum bid; any later timeout counts as a call.
4. **Proof:** the last bidder (the prover) has `proof.ms` to type that many different names of the list, one `auction:answer` at a time. Both players see every name live.
   - A correct unsaid name fills a slot. A wrong name, or one already said, is a strike (`UsedAnswers` with repeats counted as wrong).
   - Reaching the bid wins the round (`PROVED`).
   - `proof.maxWrong` strikes (`allIn.maxWrong` for an all-in, DEC-77), or the deadline, is a bust.
5. **Steal:** after a bust the other player has `steal.ms` to name `steal.names` unsaid names (DEC-76: 1).
   - Success wins them the round (`STOLEN`).
   - A wrong name ends the steal at once. A wrong name or the deadline leaves the round with no winner (`BUST`, DEC-77).
6. **Round points:**
   - `points.roundWin` for `PROVED` or `STOLEN`;
   - `points.allInWin` for a proved all-in (the demo: it counts as 2 rounds).
7. **End of the battle:** the first player whose score reaches `targetScore` (3) wins; `roundCount` is only the most rounds a battle can have (7: rounds can end with no winner). If the rounds run out first, scores decide as usual (DEC-77).
8. **Reveal:** at the end of every round, all names of the list, marked with who said them; the unsaid ones are the "how did I forget him!" moment.
9. **Players:** exactly 2.

### 11.2 Hidden information

Nothing is secret between the players: titles, counts, bids and every typed name are public, as on the demo. Only the accepted answers stay on the server until the reveal (§7).

### 11.3 Protocol (details in `api/WEBSOCKET.md`)

| Direction | Message | Purpose |
|---|---|---|
| C→S | `auction:pick { roundNo, list: 0..2 }` | The picker chooses a list |
| C→S | `auction:bid { roundNo, amount }` | Open or raise |
| C→S | `auction:call { roundNo }` | "اتفضل ورّيني" |
| C→S | `auction:answer { roundNo, answer: { text } }` | A name, during the proof (prover) or the steal (the other player) |
| S→C | `round:start` | The 3 lists (title, answer count), the picker, `pickDeadlineAt` |
| S→C | `auction:picked` | The chosen list, `auto` |
| S→C | `auction:turn` | Whose bidding turn, the current bid, `turnDeadlineAt` |
| S→C | `auction:bid` | A bid, `allIn` |
| S→C | `auction:proof` | Prover, amount, `maxWrong`, `proofDeadlineAt`; also how it started (call, all-in, timeout) |
| S→C | `auction:answered` | Phase (`PROOF` \| `STEAL`), outcome (`CORRECT` \| `WRONG` \| `REPEATED`), the name (wrong names only with `showWrongAnswers`), found so far, strikes |
| S→C | `auction:steal` | Stealer, `stealDeadlineAt` |
| S→C | `round:result` | `reveal: { list, outcome: PROVED \| STOLEN \| BUST, bid, answers: [{ player, saidBy? }] }` |

### 11.4 Content and generator

| `gameType` | Content | Accepted answers |
|---|---|---|
| `AUCTION` | `{ lists: [{ kind, title: { en, ar } } ×3] }` | Slots 0..2: every name of each list, most popular first |

The pipeline writes the titles in both languages: competitions are not catalog entities yet (07 §5.10), so titles cannot be built from catalog names at play time.

Generator (`kb bundle --auctions N`, 07 §5.8):
- **Source (N2):** built in Python from `core.goal` (no `derived` view yet). Transfermarkt goal events in usable matches (`core.usable_match`) of tier 1 and 2 competitions, from 2012 (its coverage). This is the first slice of D.3d goals (07 §5.10).
- **List kinds (N2):**
  - `SCORERS`: a club's scorers in one competition season;
  - `ASSISTERS`: its assist providers.
  - Own goals never count. An assist counts only when the assist provider is in the scoring team's lineup for that match; the rest are dropped and counted (the Söyüncü case, 07 §5.10).
  - Later kinds: scorers against a club, national-team tournament scorers, famous XIs, winners lists.
- **Kept when:**
  - 6 to 30 names (`--auction-min-answers`, `--auction-max-answers`);
  - **every name is a catalog entity** (DEC-69 stays at (a)), so any right name can be judged right;
  - at least 60% of names are known players (sitelinks ≥ 40, `--auction-known-share`);
  - no other kept list has the same names.
- **A lot:** 3 lists of close difficulty, from 3 different clubs or kinds; each list is in one lot only.
- **Difficulty:** from the share of known names and the list size.
- **Keys:**
  - a list: `auction:<kind>:<club qid>:<competition>:<season>`;
  - a lot: its three list keys.
- **Measured on 2026-11-19** (lists of 6–30 names, before the known-share filter):
  - tier 1: 1,671 scorer and 1,680 assister lists, of which 768 and 676 have every name in the catalog;
  - tier 2: 1,673 and 1,432, of which 420 and 352.
  - That is about 2,200 lists, or 730 lots.
  - **After every filter (built 2026-11-19):** 990 lists in 330 lots (difficulty 1: 153, 2: 78, 3: 44, 4: 55); the 60% known-players rule removes the most. Team names in titles are trimmed to how fans say them ("Croatia", "آرسنال", not "Croatia men's national football team").

### 11.5 Bot

- **Pick:** the list with the best expected count: answer count × its chance to know a name at that difficulty.
- **Bidding:** it raises by 1 while the current bid is below that expected count, with a small random push from its profile; otherwise it calls.
- **Proof and steal:** each name it sends is the most popular unsaid name of the list with its knowledge chance, otherwise a wrong name or silence, after `typingDelayMs`.

### 11.6 Configuration

| Key | Default (dev) | Decision |
|---|---|---|
| `roundCount` (most rounds), `targetScore` | 7, 3 | DEC-77 |
| `firstMover`, `firstMoverAfterRound1`, `rps.*` | `RPS`, `LOSER_STARTS` | §9.1, DEC-71 |
| `pickMs` | 10000 | DEC-77 |
| `bidding.turnMs`, `bidding.minOpeningBid` | 8000, 1 | DEC-76 (minimum), DEC-77 |
| `proof.ms`, `proof.maxWrong` | 45000, 3 | DEC-77 |
| `allIn.maxWrong` | 1 | DEC-77 |
| `steal.ms`, `steal.names` | 10000, 1 | DEC-76 (names), DEC-77 |
| `showWrongAnswers` | true | DEC-60 |
| `points.roundWin`, `points.allInWin` | 1, 2 | DEC-33 |

### 11.7 How it fits the engine

- **Rules:** pure `battles/domain/games/auction-rules.ts`; `AuctionRoundRunner` wraps them (§2.4), with `UsedAnswers` from §9.2.
- **Engine change (generic):** `targetScore` per game type, nullable. After each round the engine completes the battle when a score reaches it. No game-specific code.
- **Judging:** `AnswerChecker` with the picked list's slot as the accepted answers.
- **Actions:** `AUCTION_PICK`, `AUCTION_BID`, `AUCTION_CALL`, `AUCTION_ANSWER` (`is_correct`), `AUCTION_STEAL`, `TURN_TIMEOUT`. Question stats count a wrong `AUCTION_ANSWER` as a wrong answer.
- **One timer per phase:** each phase sets a single `phase` deadline timer; moving to the next phase cancels it and sets the next one, so a late timer can never act on the wrong phase.
- **Snapshot `currentRound`:**
  - `phase`, the 3 lists and the picked one;
  - the picker, the bids so far and whose turn;
  - the prover, the amount, the names found, the strikes;
  - the stealer, and the deadlines.

## 12. `VAULT` (الخزنة, N3)

Chosen by the product owner on 2026-11-17 (DEC-68; demo page: https://claude.ai/artifact/UemfyXeudLmbqPPw6gZ9ZD). Each round is a vault with a 4-digit code; each digit is the answer to a football question whose answer is 0–9. Both players race on the same vault at the same time. A try is all right or all wrong, with no per-digit feedback, so guessing does not pay. First to open 3 vaults wins.

### 12.1 A round

```mermaid
stateDiagram-v2
  [*] --> OPEN: round:start (4 questions)
  OPEN --> OPEN: a wrong try (that player is locked out), or a leak
  OPEN --> [*]: a right try (OPENED), or roundDeadlineAt (NOBODY)
```

1. **The vault:** a round's content is 4 questions (§12.4), shown to both players at once in `round:start`. Digit `i` of the code is the answer to question `i`.
2. **No first mover:** both play at the same time (`firstMover: NONE`, §9.1).
3. **A try:** `vault:try { code }` with one digit per question. The server compares the whole code.
   - Right: the round ends at once, won by that player (`OPENED`). Two right tries are ordered by arrival; the second is refused with `ROUND_CLOSED`.
   - Wrong: only the player who tried learns it (in the ack, §12.3), and nothing says which digit is wrong. That player is locked out for the next step of `lockoutMs` (`LockoutLadder`, §9.2: 3 s, 6 s, 9 s, then 9 s again); a try while locked is refused with `LOCKED_OUT` (the wrong try's ack and the snapshot carry `lockedUntil`).
4. **Leaks:** if nobody has opened the vault, one digit is revealed to both players at `leaks.firstAtMs`, then another every `leaks.everyMs`, up to `leaks.max` (`HintSchedule`, §9.2). Which digit leaks is drawn from the unleaked ones with the seeded random source. A player who knows more digits opens after fewer leaks.
5. **Round end without an opener:** at `roundMs` the round ends with no winner (end reason `NO_WINNER`, reveal outcome `NOBODY`).
6. **Round points:** `points.vaultOpened` to the opener.
7. **End of the battle:** the first player whose score reaches `targetScore` (3) wins; `roundCount` is the most rounds (5, because a round can end with no winner). If the rounds run out first, scores decide as usual.
8. **Reveal:** at the end of every round, the code and each question's answer, so the players learn the facts they missed.
9. **Players:** 2 now; the rules do not depend on the count, so rooms (P8) can use them as they are.

### 12.2 Hidden information

- The opponent sees only how many tries you made (`vault:tried { participantId, tries }`), never the code you typed or when you are locked out (§9.3).
- The answers stay on the server until a leak or the reveal; `round:start` carries the question texts only.

### 12.3 Protocol (details in `api/WEBSOCKET.md`)

| Direction | Message | Purpose |
|---|---|---|
| C→S | `vault:try { roundNo, code }` | A try at the whole code (a string of `digits` digits) |
| S→C | ack of `vault:try` | Only to the player: `{ accepted: true, data: { opened: false, lockedUntil, tries } }` on a wrong try (§2.4, private results in acks) |
| S→C | `round:start` | The questions in the viewer's language, `digits`, `roundDeadlineAt`, `firstLeakAt` |
| S→C | `vault:tried` | A player's try count after a wrong try (the code is never sent) |
| S→C | `vault:leak` | `position`, `digit`, `nextLeakAt` (null after the last) |
| S→C | `round:result` | `reveal: { code, outcome: OPENED \| NOBODY, openedBy?, answers: [{ position, digit }] }` |

Refusals: `LOCKED_OUT`, `INVALID_CODE` (wrong length or not digits), `ROUND_CLOSED` (opened, or past the deadline).

### 12.4 Content and generator

| `gameType` | Content | Accepted answers |
|---|---|---|
| `VAULT` | `{ questions: [{ template, text: { en, ar }, answerNumber: 0..9 } ×4] }` | None as entities: the code is the four `answerNumber`s, compared by the rules (like a `NUMBER` answer, §5.3) |

The pipeline writes each question in both languages from a hand-written template (EN and AR, like the `BUZZER` templates of 07 §5.8). Team, player and competition names come from the knowledge base; the stage and season are written by the template. The engine strips `answerNumber` before anything reaches a client.

Generator (`kb bundle --vaults N`, 07 §5.8), built from the N3 data slice (07 §5.10):

| Template | Question (EN) | Source | Kept when |
|---|---|---|---|
| `TEAM_GOALS` | How many goals did {team} score against {opponent} in the {stage} of the {competition} {season}? | `core.match` | tier-1 knockouts (round of 16 to final) and tier-2 finals; the leg is named in two-legged ties; goals after extra time, not the shootout |
| `FINAL_TOTAL_GOALS` | How many goals were scored in the {competition} {season} final, not counting the shootout? | `core.match` | finals; total ≤ 9 |
| `PLAYER_GOALS` | How many goals did {player} score against {opponent} in the {stage} of the {competition} {season}? | `core.goal` | 2 or more goals (a "1" is the obvious guess); the match's goal rows equal its score |
| `SHOOTOUT_SCORED` | How many penalties did {team} score in the shootout of the {stage} of the {competition} {season}? | `core.match` | the shootout score is known |
| `SHIRT_NUMBER` | Which shirt number did {player} wear for {team} in the {stage} of the {competition} {season}? | `core.lineup_slot` | a starter with number 1–9; finals and semi-finals first |
| `TITLES_SINCE_2000` | How many {competition} titles have {team} won since 2000? | `core.match` finals | only competitions with a usable final for every edition since 2000; teams that played at least one final (so 0 is a real answer) |

- **Every name is a catalog entity** and every player is a known player (sitelinks ≥ 40, `--vault-min-player-sitelinks`), so a fan can know the fact.
- **A vault:** 4 facts of the same difficulty, from 4 different matches (one fact never gives away another), with at most `--vault-max-per-template` (default 2) of the same template, so every vault mixes at least two kinds of question. Each fact is in one vault only. (A limit of 1 was measured first: it allowed only 152 vaults, because each difficulty needs 4 templates with facts left.)
- **Difficulty:** from the stage (a final is better known than a round of 16), the teams' and player's popularity, and the template.
- **Keys:** a fact `vault:<template>:<match id or team:competition>[:<player qid>]`; a vault, its four fact keys.
- **Measured on 2026-11-19 (dev, before the known-player and vault filters):**
  - 793 usable knockout and final matches (541 tier-1 knockouts before the final, 252 finals; 169 `VERIFIED`), so up to 1,586 `TEAM_GOALS` and 252 `FINAL_TOTAL_GOALS` facts;
  - 758 of them have goal rows equal to the score: 236 `PLAYER_GOALS` facts (braces or more);
  - 79 shootouts: up to 158 `SHOOTOUT_SCORED` facts;
  - 570 of them have Transfermarkt lineups: 4,865 starters with a linked player and a number 1–9 (`SHIRT_NUMBER`);
  - `TITLES_SINCE_2000`: only the World Cup and the Euro have every final since 2000 today; AFCON (2025 final refused), Copa América and the Asian Cup miss one each until the curated finals arrive. Club title counts wait for the 2000–2011 curated finals.
  - That is about 2,000 facts outside `SHIRT_NUMBER`, enough for 400+ vaults with the one-per-template rule.
  - **After every filter (built 2026-11-20):** 2,790 facts (`TEAM_GOALS` 1,582, `SHIRT_NUMBER` 579 after one fact per player, team and number, `FINAL_TOTAL_GOALS` 240, `PLAYER_GOALS` 218, `SHOOTOUT_SCORED` 156, `TITLES_SINCE_2000` 15), giving 545 vaults (difficulty 1: 25, 2: 137, 3: 122, 4: 224, 5: 37). Answers lean low (0–2 are 63% of facts), as football scores do. The 2026 World Cup final (Spain 1–0 Argentina) comes from martj42 only and counts in the title totals.

### 12.5 Bot

- **Knowledge:** for each question it knows the digit with its chance at that difficulty (bot profile); leaked digits are known.
- **Trying:** when at most 1 digit is unknown to it (a runner constant, like the auction bot's decoy pool), it tries a code after `typingDelayMs`, filling the unknown digit with values it has not tried in that position; it waits out its lockout like a player. It looks again after each leak.
- It never reads the opponent's tries (it sees only the count, as a player does).

### 12.6 Configuration

| Key | Default (dev) | Decision |
|---|---|---|
| `roundCount` (most rounds), `targetScore` | 5, 3 | DEC-78 (first to 3: owner, 2026-11-17) |
| Code length | one digit per question: 4 from the generator | owner, 2026-11-17 (content, not config) |
| `firstMover` | `NONE` | §9.1 |
| `lockoutMs` | `[3000, 6000, 9000]` | owner, 2026-11-17 |
| `leaks.firstAtMs`, `leaks.everyMs`, `leaks.max` | 45000, 15000, 3 | DEC-78 (45 s and 15 s: owner, 2026-11-17; the max is open) |
| `roundMs` | 120000 | DEC-78 |
| `latencyGraceMs` | 300 | §2.3 |
| `points.vaultOpened` | 1 | DEC-33 |

### 12.7 How it fits the engine

- **Rules:** pure `battles/domain/games/vault-rules.ts`; `VaultRoundRunner` wraps them (§2.4). The first users of `LockoutLadder` and `HintSchedule` (§9.2), written here.
- **Timers:** one `round` timer (`roundMs`) and one `leak` timer, rescheduled after each leak. Lockouts need no timer: a try is checked against `lockedUntil` with the clock passed in.
- **Judging:** exact comparison of the typed code with the four `answerNumber`s; no `AnswerChecker`, no catalog.
- **Actions:** `VAULT_TRY` (`is_correct`, the typed code kept as the answer text, never shown). Leaks are events only. Question stats count each wrong try as a wrong answer of the round.
- **Snapshot `currentRound`:** the questions, `digits`, the leaked digits, every player's try count, the viewer's own `lockedUntil`, `roundDeadlineAt`, `nextLeakAt`.

## 13. `HEX` (الهجمة, N4)

Chosen by the product owner on 2026-11-18 (DEC-68; demo page: https://claude.ai/artifact/5eXj3vULNojAzdhz3jwftc). A 5×5 board of hexagons with a letter in each cell. The player on turn picks a cell; both players get its question at once, and the first right answer **that starts with the cell's letter** takes the cell. One player connects west to east, the other north to south; the first to connect wins the board. A hex board cannot end in a draw once it is full.

### 13.1 A round (one board)

```mermaid
stateDiagram-v2
  [*] --> PICKING: round:start (board, sides)
  PICKING --> RACING: a cell is picked (or pickDeadlineAt: a random open cell)
  RACING --> PICKING: a right answer takes the cell, or answerDeadlineAt (the cell stays open)
  RACING --> [*]: the taken cell connects its owner's two sides (CONNECTED)
  PICKING --> [*]: maxPicks reached (MAX_PICKS)
```

1. **The board:** `size × size` cells (5), rows offset like the demo, so each cell touches up to 6 others. Each cell shows one letter **in the viewer's language** (§13.2).
2. **Sides:** the round-1 rock-paper-scissors winner (§9.1) picks first and connects `WEST_EAST`; the other player connects `NORTH_SOUTH`.
3. **Pick:** the player on turn has `pickMs` to send `hex:pick { cell }` for an open cell; at the deadline the server picks a random open cell (`auto`).
4. **Race:** the cell's current question goes to both players at once, with `answerMs` to answer.
   - A right answer is a name from the question's list **and** the typed text starts with the cell's letter in that player's language. It takes the cell.
   - A name from the list typed with another first letter is refused with `WRONG_LETTER` (ack only, no lockout, DEC-79): it is a slip, not a wrong fact.
   - A wrong name locks that player out of this question for `lockoutMs` (`LockoutLadder`, §9.2, reset for each question). Others see that you are locked out, as in the demo.
   - Nobody right by `answerDeadlineAt`: the cell stays open and moves to its next question, so a later pick of it asks something new.
5. **Next pick:** the turn alternates after every race, whoever took the cell (DEC-79).
6. **"شيلها" (clear):** once per battle (`clear.usesPerBattle`), on your pick you may send `hex:pick { cell, clear: true }` for one of the opponent's cells. It becomes open with its next question, and that question is raced at once.
7. **Board end:** a taken cell that links its owner's two sides ends the board (`CONNECTED`, `points.boardWin`). If `maxPicks` picks pass first, the board ends with no winner (DEC-79; reveal outcome `MAX_PICKS`, round end reason `MAX_TURNS`), so a board of open cells nobody can answer does not run forever. `clearsLeft` is handed to the next board with the round's `carryOver`.
8. **Battle:** `roundCount` boards with `targetScore` (DEC-79: one board, about 4 minutes). With several boards, `firstMoverAfterRound1` decides who picks first and plays `WEST_EAST`.
9. **Reveal:** at the end of every race, up to 5 other right names for each viewer's letter (a name counts when one of its words starts with the letter; aliases are not loaded for this); at the end of the board, the winning path and the owners.
10. **Players:** exactly 2.

### 13.2 Letters in two languages

A typed answer is judged in the player's own language, and a letter belongs to one alphabet. So each cell carries a letter pair `{ ar, en }`, and every question of that cell has at least `minAnswersPerLetter` right names whose Arabic name or alias starts with the Arabic letter, and at least as many whose English name or alias starts with the English letter. Each player sees and must use their own language's letter. Two players with different languages race on the same question with different (never empty) answer sets; that is the price of mixed-language matchmaking, and it stays within one cell.

Letters are compared in matching form (07 §5.4, ADR-0021): `أ`, `إ` and `آ` are `ا`, case and accents do not count.

### 13.3 Hidden information

Nothing is secret between the players except the right answers (§7): the board, picks, lockouts and every right name are public. A wrong name is shown only with `showWrongAnswers` (DEC-60).

### 13.4 Protocol (details in `api/WEBSOCKET.md`)

| Direction | Message | Purpose |
|---|---|---|
| C→S | `hex:pick { roundNo, cell, clear? }` | The player on turn picks an open cell, or clears an opponent cell |
| C→S | `hex:answer { roundNo, answer: { text } }` | A name during the race |
| S→C | `round:start` | The board (each cell's letter in the viewer's language), `sides`, `size`, the first picker, `pickDeadlineAt`, `clearsLeft` per player |
| S→C | `hex:turn` | Whose pick, `pickDeadlineAt` |
| S→C | `hex:race` | The picked cell, by whom, `auto`, `cleared`, the question title and the letter (viewer's language), `answerDeadlineAt` |
| S→C | `hex:answered` | A wrong name: who, `lockedUntil`, the name only with `showWrongAnswers` |
| S→C | `hex:claimed` | The cell, its new owner, the right name |
| S→C | `hex:expired` | Nobody answered: the cell stays open |
| S→C | `round:result` | `reveal: { outcome: CONNECTED \| MAX_PICKS \| FORFEIT, path?: cell[], owners: (participantId \| null)[] }` |

Refusals: `NOT_YOUR_PICK`, `CELL_TAKEN`, `CELL_NOT_OPPONENTS`, `NO_CLEARS_LEFT`, `NOT_RACING`, `LOCKED_OUT`, `WRONG_LETTER`, `EMPTY_ANSWER`, `ANSWER_WINDOW_CLOSED`.

### 13.5 Content and generator

| `gameType` | Content | Accepted answers |
|---|---|---|
| `HEX` | `{ size, cells: [{ letter: { en, ar }, questions: [{ kind, title: { en, ar } } × questionsPerCell] } × size²] }` | Slot `cell × questionsPerCell + question`: every name of that question's list |

The letter check is not in the accepted answers: the slot holds the whole list, and the rules check the typed text's first letter. So one stored list serves any letter.

Generator (`kb bundle --hexes N`, 07 §5.8):
- **Source (N4):** the AUCTION lists (§11.4: scorers and assisters per club and competition season, every name in the catalog, at least 60% known players). Later: any question whose answer is a name.
- **A board:** `size²` cells. Letter pairs are drawn from letters with enough lists in both languages; a letter repeats only when the board needs more cells than there are such letters (each at most `--hex-max-letter-repeats`, default 2). Each cell gets `--hex-questions-per-cell` (default 3) lists with at least `--hex-min-answers` (default 1) right names for both of its letters; a list appears once per board.
- **Difficulty:** from the known share of the right names for each cell's letters.
- **Keys:** a board, `hex:` plus a hash of its cell list keys and letters.
- **Built 2026-11-20:** `kb bundle --hexes 30` gives 30 boards (difficulty 2 mostly: the AUCTION lists are well known), each a list used at most once; the 60% known-players rule and the both-letters rule leave every common letter with dozens of lists. Board letters include `x` and `z` in English (Xavi, Xabi, Zidane), which pass the 20-list bar.
- **Measured on 2026-11-20 (dev):** 1,026 lists after the AUCTION filters. Arabic letters that start a name in at least 20 lists: 23 (`ا م ك د ج ف ب ر ل س ت ي ن خ غ ه و ش ع ز ص ح ث`; never `ط ق ض ظ ذ`), English: 22. About 8,500 list-and-letter questions per language. So a 25-cell board repeats two or three letters.

### 13.6 Bot

- **Pick:** the first open cell of its own shortest path (`findShortestPathFor`: a 0-1 breadth-first search where its cells cost 0, open cells 1 and the opponent's are blocked); it clears an opponent cell once, when that cell is on the opponent's shortest path and the opponent needs at most 2 more open cells (a runner constant). On a 3×3 board that is almost at once.
- **Race:** it knows a right name with its chance at the question's difficulty; it answers with a right name for its letter after `typingDelayMs`, otherwise it stays silent.

### 13.7 Configuration

| Key | Default (dev) | Decision |
|---|---|---|
| `roundCount`, `targetScore` | 1, 1 | DEC-79 |
| `firstMover`, `firstMoverAfterRound1`, `rps.*` | `RPS`, `ALTERNATE` | §9.1 |
| Board size | 5, from the content (the generator's `size`) | owner, 2026-11-18 (content, not config) |
| `pickMs`, `answerMs` | 5000, 15000 | owner, 2026-11-18 |
| `lockoutMs` | `[3000]` | owner, 2026-11-18 |
| `clear.usesPerBattle` | 1 | owner, 2026-11-18 |
| `maxPicks` | 60 | DEC-79 |
| `showWrongAnswers` | true | DEC-60 |
| `points.boardWin` | 1 | DEC-33 |

### 13.8 How it fits the engine

- **Rules:** pure `battles/domain/games/hex-rules.ts` with the board as data: cell owners, the adjacency of offset rows, and a breadth-first search for a connection. `HexRoundRunner` wraps them (§2.4), with `LockoutLadder` per question.
- **Judging:** `AnswerChecker` against the cell's current slot; the runner checks the first letter of the typed text (matching form) against the viewer's letter before the rules see it.
- **One timer per phase** (§11.7): the pick deadline, then the answer deadline.
- **Actions:** `HEX_PICK`, `HEX_CLEAR`, `HEX_ANSWER` (`is_correct`), `TURN_TIMEOUT`. Question stats count a wrong `HEX_ANSWER` as a wrong answer.
- **Snapshot `currentRound`:** the board (letters in the viewer's language, owners), `sides`, `phase`, whose pick, the racing cell with its question and letter, lockouts, clears left, `picks`, and the current deadline.

## 14. `LINEUP` (التشكيلة, N5)

Chosen by the product owner on 2026-11-17 (DEC-68; demo page: https://claude.ai/artifact/5YroowQ5Qt63dNXH3NHmjo). Each round shows one team's formation in a famous match ("Liverpool, 2019 Champions League final against Tottenham") with 11 empty slots. Both players type names at the same time; the server places each right name in its slot for whoever typed it first. Three names are shown beside the pitch, and one of them is a fake. Three rounds; the most points wins.

### 14.1 A round

```mermaid
stateDiagram-v2
  [*] --> OPEN: round:start (formation, 3 shown names)
  OPEN --> OPEN: a placed name, a wrong name (lockout), an accusation, the first-letter hints
  OPEN --> [*]: every typed slot taken, or roundDeadlineAt
```

1. **The formation:** a round's content is one team's starting XI in one match (§14.4). `round:start` shows the match (competition, season, stage, both teams, score), which team, and 11 slots, each with its line and role (GK, CB, LW, ... as codes the app translates) and the captain's armband on its slot. Names and shirt numbers stay hidden.
2. **No first mover:** both play at the same time (`firstMover: NONE`, §9.1).
3. **Three shown names:** two real starters (never the captain) and one fake: a player who sat on the bench in that match (§14.4). The three are shuffled and not placed in slots, so the board does not give the fake away.
4. **Typing a name:** `lineup:answer { text }`. The server judges it against the XI and the fake (§14.7) and answers in the ack:
   - **A starter in an empty slot:** placed for that player: `points.correct`, or `points.captain` for the captain's slot. Both players see it at once (`lineup:placed`).
   - **A starter already placed:** refused with `ALREADY_TAKEN`, no penalty (knowing it was not a mistake, being slower was).
   - **A shown name:** an accusation, at most `accuse.perPlayer` (1) per player per round. The fake: `points.accuseRight`, the fake is crossed out for both, and the two real shown names are placed in their slots with no owner. A real starter: `points.accuseWrong`.
   - **Anything else:** a wrong name. The player is locked out for the next step of `lockoutMs` (`LockoutLadder`, §9.2), which stops typing every famous player of the club. With `showWrongAnswers` (DEC-60) the opponent sees which player the text matched, never the text itself (ADR-0021).
   - The same wrong name again is refused `ALREADY_TRIED` with no new lockout (`UsedAnswers`, §9.2).
   - The fake, once found, is refused `ALREADY_TAKEN` like a placed starter.
5. **Hints:** at `hints.firstAtMs` (30 s), the first letter of every empty slot's player appears, in the viewer's language (`HintSchedule`, §9.2; `hints.max` 1 for now).
6. **Round end:** when every slot that can be typed is taken (the 9 not shown, or all 11 after the fake is found; end reason `LINEUP_COMPLETE`), or at `roundMs` (60 s, `TIME_UP`). The round's winner is the player with the most points in it (none on a tie); scores add up either way.
7. **Reveal:** the whole XI with shirt numbers, who placed each name, the fake and why it was fake ("on the bench that night"), and who unmasked it.
8. **End of the battle:** after `roundCount` (3) rounds the scores decide, ties as in DEC-33. There is no `targetScore`: points add up across rounds.
9. **Players:** 2 now. The rules do not depend on the count, so rooms (P8) can use them as they are.

### 14.2 Hidden information

- Which shown name is the fake stays on the server until someone unmasks it or the round ends (§9.3).
- A wrong accusation is public only as "X accused wrongly" (`lineup:accused { right: false }` without the name), so it does not tell the opponent which shown name is real.
- Names and shirt numbers of empty slots never leave the server before the reveal; hints carry only the first letter.
- Placed names, the player a wrong name matched (DEC-60) and scores are public; typed text never is.

### 14.3 Protocol (details in `api/WEBSOCKET.md`)

| Direction | Message | Purpose |
|---|---|---|
| C→S | `lineup:answer { roundNo, text }` | A typed name: a slot, an accusation or a wrong name, decided by the server |
| S→C | ack of `lineup:answer` | Only to the player: `data: { result: PLACED \| WRONG \| ACCUSED_RIGHT \| ACCUSED_WRONG, slot?, lockedUntil }` (§2.4, private results in acks) |
| S→C | `round:start` | `title` (the match and the team, in the viewer's language), `slots: [{ slot, line, role, captain }]`, `shown: EntityRef[]`, `roundDeadlineAt`, `hintsAt` |
| S→C | `lineup:placed` | `slot`, `player`, `participantId` (null for the real shown names placed after an unmasking) |
| S→C | `lineup:wrong` | `participantId`; `player` (whom the text matched) with `showWrongAnswers` |
| S→C | `lineup:accused` | `participantId`, `right`; `player` (the fake) only when right |
| S→C | `lineup:hint` | `letters: [{ slot, letter }]` in the viewer's language |
| S→C | `round:result` | `reveal: { slots: [{ slot, player, shirtNumber, placedBy }], fake: { player, reason: "BENCH", unmaskedBy } }` |

Refusals: `LOCKED_OUT`, `ALREADY_TAKEN`, `ACCUSATION_USED` (a shown name after the player's accusation is spent), `ALREADY_TRIED`, `EMPTY_ANSWER`, `ROUND_CLOSED`.

### 14.4 Content and generator

| `gameType` | Content | Accepted answers |
|---|---|---|
| `LINEUP` | `{ title: { en, ar }, slots: [{ line, role, shirtNumber, captain, player } ×11], shown: [player ×3], fake: player }` | Slot 0: the 11 starters; slot 1: the fake |

The slots are in drawing order (goalkeeper, then defenders, midfielders and forwards, each line left to right). The engine never sends `player` or `shirtNumber` of an empty slot, nor which shown name is `fake`. Lines are `GK`, `DEF`, `MID`, `FWD`; roles are codes (`GK`, `LB`, `CB`, `RB`, `DM`, `CM`, `AM`, `LM`, `RM`, `LW`, `RW`, `SS`, `CF`) that the app translates, or null when the source only knows the line (Fjelstul's `DF`, `MF`, `FW`). The title is text written by the pipeline (as for `AUCTION` and `VAULT`), because national teams are not catalog entities yet: "Liverpool against Tottenham Hotspur, final of the 2018-19 UEFA Champions League (2–0)".

Generator (`kb bundle --lineups N`, 07 §5.8), from `core.lineup_slot` (07 §5.10, N5 slice):

- **Famous matches only** (DEC-67, the data plan: nobody remembers an ordinary league XI). Default (DEC-80): tier-1 knockouts from the round of 16 and tier-2 finals.
- **Every starter is a catalog player** with names in both languages, so every slot can be judged; at least `--lineup-min-known` (default 6) are known players (sitelinks ≥ 40).
- **The fake:** the best-known bench player of the same team in the same match (a known catalog player): the most believable starter who was not. A lineup with no such bench player is skipped.
- **The two real shown names:** drawn from the less known starters (never the captain, never the best-known player), so they help without giving away the stars.
- **Captain:** from the source; a lineup with no known captain is played without the armband (every slot `points.correct`).
- **Difficulty:** from the stage (final easiest to remember), the tier, the competition and the known share of the XI.
- **Keys:** `lineup:<competition>:<season>:<stage>[:leg<n>]:<home qid>-<away qid>:<team qid>`, stable across rebuilds (`core.match` ids are not). Both teams of one match are separate rounds; two legs of a tie are separate matches.
- **Measured on 2026-11-19 (dev, Transfermarkt lineups only, before the bench-player and known-player filters):** tier-1 lineups with all 11 starters in the catalog: finals 22, semi-finals 89, quarter-finals 148, round of 16 283 (542, almost all Champions League 2012–2026); tier-2 finals 228. Bench players in the catalog average 7–10 per tier-1 lineup, so a fake is almost always available. The World Cup comes from Fjelstul (220 knockout lineups 2002–2022 with 11 starters, before linking); the Euro has no lineup source yet.
- **Built 2026-11-20 (dev):** 760 rounds (Champions League 513, World Cup 62, super cups and cup finals the rest; finals 213, semi-finals 100, quarter-finals 162, rounds of 16 285), difficulty 1: 30, 2: 234, 3: 191, 4: 244, 5: 61; 693 with a known captain. The 2019 Champions League final comes out right (Henderson captain, Shaqiri the fake). World Cup knockouts lose most rounds to the catalog rule: 67 of 172 have all 11 starters in the catalog, because players of smaller nations are linked entities outside it (DEC-69).

### 14.5 Bot

- **Knowledge:** for each starter it knows the name with its chance at the round's difficulty, more for well-known players (bot profile, like the auction bot).
- **Typing:** it sends one known name every `typingDelayMs`, empty slots first, the captain first when it knows him; a wrong popular name now and then from its guess chance, and it waits out its lockout like a player.
- **Accusing:** only when it knows the fake (its chance at that difficulty), never a blind guess. It never reads the opponent's acks.

### 14.6 Configuration

| Key | Default (dev) | Decision |
|---|---|---|
| `roundCount`, `targetScore` | 3, null | owner, 2026-11-17 (3 rounds) |
| `firstMover` | `NONE` | §9.1 |
| `roundMs` | 60000 | owner, 2026-11-17 |
| `hints.firstAtMs`, `hints.everyMs`, `hints.max` | 30000, 0, 1 | owner, 2026-11-17 (30 s); DEC-80 (one wave) |
| `lockoutMs` | `[2000]` | DEC-80 |
| `accuse.perPlayer` | 1 | DEC-80 |
| `showWrongAnswers` | true | DEC-60 |
| `latencyGraceMs` | 300 | §2.3 |
| `points.correct`, `points.captain`, `points.accuseRight`, `points.accuseWrong` | 1, 2, 3, -2 | owner, 2026-11-17 |

### 14.7 How it fits the engine

- **Rules:** pure `battles/domain/games/lineup-rules.ts`: slot owners, the shown names, accusations per player, lockouts. `LineupRoundRunner` wraps them (§2.4), with `LockoutLadder`, `HintSchedule` and `UsedAnswers` from §9.2 (all three exist already).
- **Judging:** `AnswerChecker` against slot 0 (the XI); no match there, then slot 1 (the fake). The rules turn the matched entity into a placement (its slot from the content), an accusation (a shown entity) or a refusal. A typed name that matches a shown real starter is an accusation, not a placement.
- **Timers:** one `round` timer (`roundMs`) and one `hint` timer. Lockouts need no timer (checked against `lockedUntil` with the clock passed in, as in `VAULT`).
- **Actions:** `LINEUP_ANSWER` (`is_correct`, entity, typed text), `LINEUP_ACCUSE` (`is_correct`, points `accuseRight` or `accuseWrong`). Question stats count a wrong answer or a wrong accusation as wrong.
- **Bot (built):** it accuses the fake first when it knows it, then types the starters it knows (captain first), one per `typingDelayMs`; when it knows no more, it tries one popular wrong player with its guess chance, then stops.
- **Snapshot `currentRound`:** the header, the slots with their placed names and owners, the shown names (the fake crossed out once found), the hints out, the viewer's own `lockedUntil` and whether their accusation is spent, every player's score this round, `roundDeadlineAt`, `hintsAt`.
