# ADR-0015: Several game types on one shared battle engine; answers are typed, not chosen

- **Status:** Accepted (product decision by the owner, 2026-11-10); point 5 superseded by ADR-0021 (typed text with typo tolerance)
- **Date:** 2026-11-10
- **Related:** amends ADR-0010 and ADR-0006; DEC-53..DEC-59; PRD §5.4; ROADMAP P5.2, P6, P8, Track D

## Context
Until now a battle was one thing: rounds of multiple-choice questions, where a player taps one of the options (`SINGLE_CHOICE`, `round:answer {optionId}`). The product owner decided the trivia feature is instead **a set of different games**, none of them multiple choice:

- Players **type** the answer and the server judges it.
- The first game is the **Buzzer**: the question appears gradually, the first player to buzz answers.
- The product's edge is meant to be many games, so adding a game must be cheap.

Market research (2026-11-10) showed this format already works for Arabic-speaking players (the "تحدي الثلاثين" YouTube show and its app, and the KickBrain app both use buzzer, career and grid games), so the risk is execution, not demand.

Constraints that still hold: real-time PvP only, 2..N participants, bot fallback, private rooms, server authoritative, zero budget, offline question generation (ADR-0010, ADR-0007).

## Decision
1. **A battle has a game type.** v1.0 game types (DEC-53):
   - `BUZZER`: the question text is revealed word by word.
   - `CAREER`: a player's clubs are revealed one by one; name the player.
   - `WHO_IS_PLAYER`: clues about a player (nationality, position, age, club...) are revealed one by one; name the player.
   - `GRID`: football tic-tac-toe on a 3×3 grid of row and column criteria; turn-based; a cell is taken by naming a player who fits both criteria. Approved on the condition that our data can support it (see Consequences).
   - `IMPOSTER`: private rooms only, built with P8. Its rules are still open (DEC-58).
2. **One shared engine, one small rules object per game type.** The engine owns what every game needs: participants, readiness, the round loop, timers, the event sequence (`seq`), persistence, reconnection and resync, forfeit, bots, scoring hand-off and completion. A game type supplies only its own mechanics: what a round contains, which player commands are legal now, what a timer tick does, and what each outcome is worth. Game rules are plain domain code (no NestJS, no sockets, time from the injected clock), so each game is unit-tested alone.
3. **Three of the four launch games are one mechanic.** `BUZZER`, `CAREER` and `WHO_IS_PLAYER` are all "reveal clues step by step → buzz → typed answer". They share one rules implementation and differ only in what the clues are. `GRID` is the second mechanic (turns on a board).
4. **Buzz mechanic (DEC-54), server authoritative:**
   - The server reveals clues one at a time. The client never receives clues it should not show yet; it only displays and animates what arrived.
   - The server decides who buzzed first and accepts only the first valid buzz.
   - An accepted buzz **pauses** the reveal. That player gets an answer window.
   - Correct answer: the round ends and the question and answer are shown to everyone.
   - Wrong answer or no answer in time: that player is locked out for the rest of the round, and the reveal resumes for the others.
   - Everyone locked out, or the reveal and the final timer end with no correct answer: the round ends with no winner.
   - Every number (reveal pace, answer window, attempts per player, final timer) is configuration.
5. **Superseded by ADR-0021 (2026-11-12).** **Typed answers are matched by id, not by spelling (DEC-55).** The app ships an **answer catalog** of football entities (players, clubs, national teams, competitions) with names and alternative names in Arabic and English. The player types, picks a suggestion, and the client sends the entity id. The server compares ids. Numeric answers (a year, a count) are sent as numbers. No fuzzy text matching.
6. **Game content comes from the offline pipeline**, as before (ADR-0007). The bundle grows to carry the answer catalog and the new content shapes (buzzer questions with an answer entity, careers, clue sets, grid criteria). `GRID`, `CAREER` and `WHO_IS_PLAYER` content is generated from data, not written by hand.
7. **Multiple choice is not a game type.** The P5.1 import machinery (bundles, checksums, content hash, versions, reviews) stays as built. The question content shape gets a typed-answer form in the P5.2 design; options become optional.
8. **Rules stay adjustable.** Anything that is a number or a yes/no rule of a game lives in that game's configuration, per game type.

## Alternatives considered
| Option | Why not |
|---|---|
| Keep multiple choice and add typing later | Rejected by the product owner. It also doubles the protocol: every payload would have two shapes |
| A separate engine per game | Reconnection, timers, persistence, bots and scoring would be written and debugged four times. Adding a game would cost weeks instead of days |
| One fully generic "game DSL" configured in JSON | Over-engineering: a grid and a buzzer do not share mechanics. A small code interface per mechanic is simpler to read and test |
| Free-text answers with fuzzy matching | Arabic spelling variants (أ/ا, ة/ه, ى/ي), transliteration and nicknames make it either too strict or too loose; two different players can be one typo apart. Id matching has no false results |
| Send the whole question and let the client reveal it | A modified client would read the full question at once. The server must hold back what is not revealed yet |
| Reveal keeps running while someone answers | Unfair to the player who is typing, and harder to follow on a phone |

## Consequences
- \+ Three launch games for the cost of one mechanic; later candidates (Top 10, Higher/Lower, DEC-57) plug into the same engine.
- \+ Spelling can never decide a round.
- − **The design written for P5.2 and P6 must be redone before code:** `WEBSOCKET.md` (buzz, typed answers, turns), `03-workflows.md` §4, `02-database.md` (battle rounds and answers, catalog tables), `07` (bundle shapes). P5.1 is unaffected.
- − **Data is now the critical path.** Our local openfootball copy has about 32,000 players with position, birth date and country, but **no career history**. `CAREER` and `GRID` need "player P played for club C" facts, and every entity needs Arabic names. The planned source is Wikidata (CC0: team memberships and Arabic labels), loaded in Track D. `GRID` stays conditional until a data check shows enough players per club pair.
- − Buzz fairness depends on network delay: the server orders buzzes by arrival time. Accepted for v1.0; revisit with measurements.
- − Bots need a behaviour per mechanic (when to buzz and how often to be right; which cell to take).
- − Random matchmaking now has a game type dimension, which splits a small player base across queues (DEC-59).
- Revisit if a new game needs something the engine cannot express without special cases in shared code.
