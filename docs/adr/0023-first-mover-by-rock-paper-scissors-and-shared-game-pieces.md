# ADR-0023: First mover by rock-paper-scissors, and shared pieces for the new game types

- **Status:** Accepted (product owner, 2026-11-18: rock-paper-scissors decides who starts in every game with a first mover)
- **Date:** 2026-11-18
- **Related:** DEC-68, DEC-61, DEC-70, DEC-71; ADR-0015, ADR-0021; `08-battle-games.md` §2, §3.2, §9; `api/WEBSOCKET.md` §3, §4.3

## Context
DEC-68 adds seven game types: `MINES`, `AUCTION`, `VAULT`, `HEX`, `LINEUP`, `TIME_MACHINE`, `THREAD`. Before each one is designed (track N), the pieces several of them share must be settled once, or the games will reinvent them seven times:
- **Who starts.** Today `GRID` draws its first player at random per round. The product owner wants a visible, fair duel instead: rock-paper-scissors, in every game where one player moves first.
- **Recurring mechanics** across the seven designs: answers locked out for 3, 6, then 9 seconds after a wrong try; hints or leaks that appear on a timer; rounds with many accepted answers where a repeat counts as wrong; hidden choices made before play; lives (hearts).

ADR-0015 says a new game must not change the engine (no `if (gameType === ...)`). ADR-0001 and CLAUDE.md §3 forbid speculative abstractions.

## Decision
1. **Rock-paper-scissors is an engine phase, not game rules.** For a game type whose config says `firstMover: "RPS"`, the engine runs a `PICKING_FIRST` phase between `WAITING_READY` and round 1:
   - Both players pick in secret before `rps.pickMs`.
   - The server reveals both picks together in one event.
   - A tie replays, up to `rps.maxReplays` times; after that the server draws the first mover from the battle's seeded random source.
   - A player who does not pick in time gets a random pick, marked `auto`.
   - Bots pick from the seeded random source.
   - The result is stored on `battles.first_mover` and passed to the game rules in `RoundSetup.firstMoverId`.
2. **After round 1** the first mover follows `firstMoverAfterRound1`: `ALTERNATE` (default), `LOSER_STARTS`, or `RPS_EACH_ROUND`, chosen per game type. This is config (DEC-71).
3. **Rooms with 3 or more players** get a seeded random order instead of a duel (DEC-70, Pending): rock-paper-scissors between more than two people takes too long and needs its own bracket rules.
4. **Shared domain helpers, not a framework.** Plain TypeScript helpers in `battles/domain/games/shared/`, each extracted because at least two of the seven games use it:

   | Helper | What it does | Used by |
   |---|---|---|
   | `LockoutLadder` | Lock time after the n-th wrong try, from a config list (e.g. `[3000, 6000, 9000]`) | `VAULT`, `HEX`, `THREAD` |
   | `HintSchedule` | Hints or leaks released at times from round start (e.g. first at 45 s, then every 15 s) | `VAULT`, `THREAD`, `LINEUP` |
   | `UsedAnswers` | Entities already named in a round; a repeat counts as a wrong try | `MINES`, `AUCTION`, `LINEUP`, `HEX` |
   | `Hearts` | Lives per player; losing the last one ends the round or the battle | `MINES`, `TIME_MACHINE` |
   | `SecretChoices` | Choices each player submits before play, kept server-side, never in any other player's snapshot | `MINES` (buried mines), `AUCTION` (none: bids are public) |

   Each game still has its own pure rules class and round runner (§2.2, §2.4). The helpers are values and functions the rules call. They are not base classes.
5. **Hidden information stays on the server.** Snapshots and events are rendered per viewer (§2.3), and that rule is tested per game:
   - a player's secret choices
   - the other player's typed answers in `THREAD` (only the opponent's room number is shown)
   - `VAULT` attempts (only the opponent's attempt count is shown)

## Alternatives considered
| Option | Why not |
|---|---|
| Keep a seeded random first mover | The product owner chose a visible duel; random feels unfair on stream and gives no moment to the players |
| Rock-paper-scissors inside each game's rules | Seven copies of the same phase, and it would break the rule that the engine knows nothing game-specific in the other direction too: the rules would have to manage pre-round timers |
| A generic "mechanics framework" (configurable turn/race/lives engine) | Speculative: the seven designs differ in their core loop (bidding, hex paths, chained rooms). Helpers cover what is actually shared without forcing one shape |
| Rock-paper-scissors for 3+ players (rounds of elimination) | Slow, needs bracket rules, and rooms are P8; deferred to DEC-70 |

## Consequences
- **+** One fair, visible start for every game. The event is a natural clip moment, and it replays identically with a fixed seed.
- **+** The seven games share tested building blocks, and the engine change is one phase.
- **−** Up to `rps.pickMs × (1 + rps.maxReplays)` extra seconds before round 1. Defaults keep it under about 15 s.
- **−** `GRID` changes: its first round is now decided by rock-paper-scissors instead of a seeded draw (08 §3.2).
- **Revisit** if playtests show players skip or dislike the duel (then make it `firstMover: "RANDOM"` per game type, which is already config), or if a third game needs a helper that is not here.
