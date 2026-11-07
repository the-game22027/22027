# ADR-0010: The quiz is real-time PvP only (matchmaking, private rooms, bot fallback); Daily Quiz removed

- **Status:** Accepted (product decision by the owner, 2026-11-07)
- **Date:** 2026-11-07
- **Related:** amends ADR-0006; DEC-31..33, DEC-37..44; 01-modules.md §2.8; 02-database.md §4.8; 03-workflows.md §3-4; api/WEBSOCKET.md

## Context
The first design had two trivia features: a shared, once-per-day **Daily Quiz** (solo, REST, `quiz` module) and **real-time 1v1 battles** (`battles` module). The product owner clarified that there is no daily quiz. The trivia feature is a **core** feature where users play **against each other at any time**, with these decisions:

- Real-time only. No async (turn-based) play.
- Two ways to find opponents: **random matchmaking**, and **private rooms** with a unique code to invite friends.
- A **bot** fills in when matchmaking finds no real opponent.
- No solo mode.

## Decision
1. Remove the `quiz` module and its tables (`quizzes`, `quiz_questions`, `quiz_sessions`, `quiz_session_questions`, `quiz_answers`), its REST endpoints, its jobs, and the `QUIZ` game type and leaderboard category. Every trivia point now comes from battles (`BATTLE`).
2. `battles` becomes the single trivia module. It owns matchmaking, private rooms, the battle engine and bots.
3. The battle engine is generalized from "you vs opponent" to **2..N participants**. A participant is either `HUMAN` (`user_id`) or `BOT` (`bot_profile`). Random matchmaking always creates 1v1 battles. Private rooms may hold more players; the room size is DEC-38.
4. **Bots are server-side participants inside the battle engine.** They have no socket. They answer through the same `submitAnswer` path as humans, so scoring, persistence and events never special-case bots. Their behaviour comes from a bot profile (DEC-43) and an injected random source, so tests are deterministic. Bots never receive ledger points.
5. **Private rooms are lobbies persisted in PostgreSQL** (`battle_rooms`, `battle_room_members`). Lifecycle commands (create, join by code, leave, remove, start) are REST. Live lobby updates are pushed over the existing `/battles` WebSocket namespace. Starting a room creates a normal battle with `mode = ROOM`.
6. Every battle records `mode` (`MATCHMAKING` | `ROOM`) and `has_bot`. These travel in `BattleCompleted` and in the ledger `context`. The BATTLE rule set can then score each mode differently (DEC-41) without code changes.

## Alternatives considered
| Option | Why not |
|---|---|
| Keep a solo Daily Quiz next to PvP | Rejected by the product owner (no solo mode) |
| Async turn-based challenges | Rejected by the product owner (real-time only). It was the main mitigation for empty queues; the bot fallback replaces it |
| Keep the engine strictly 1v1 and add rooms later | Rooms with friends imply "more than two" soon. A participant list costs little now; retrofitting `opponent`-shaped payloads and tables later means a breaking WS protocol change |
| Bots as fake user accounts in `users` | They would pollute users, friends, leaderboards and deletion flows, and need special-casing everywhere. A participant kind keeps bots out of every user-facing table |
| Rooms held only in memory/Redis | Rooms live for minutes, change rarely, and must survive an API restart for "play again". Postgres is simpler and durable; the WS gateway only pushes changes |

## Consequences
+ One trivia engine, one module, one protocol. Fewer tables and endpoints than before.
+ The bot fallback keeps the core feature playable even with very few users online (risk K-04 mitigated).
+ Per-mode scoring is a configuration matter (DEC-41), so the monthly prize can exclude collusion-prone modes (rooms, bots) without code changes.
− Real-time play at any time consumes questions much faster than one daily set. **Question-bank volume becomes a primary constraint** (risk K-09, DEC-44).
− Bots add a trust question (are users told they are playing a bot? DEC-40) and a farming risk if bot games earn points (DEC-41).
− Private rooms add collusion and second-account risks for prize-linked leaderboards (DEC-41, `06-cross-cutting.md` §1.2).
− Revisit if the product later wants async challenges or a solo mode. Both would be new battle modes or a new module consuming `question-bank`, and need no change to the ledger.
