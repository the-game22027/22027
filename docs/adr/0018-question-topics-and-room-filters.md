# ADR-0018: Question topics, and topic and difficulty filters in private rooms

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** DEC-63, DEC-64, DEC-44, DEC-38; ADR-0015; `08-battle-games.md` §8; `07` §5.9

## Context
The product owner wants a room's host to choose what the questions are about and how hard they are: general questions, or only La Liga, only the Premier League, and so on, each at a difficulty level. Today a round has a `category` (what kind of question: careers, transfers, nationalities) and a `difficulty` (1-5). Nothing says which competition a round is about. A Career round can touch several leagues: Ronaldo's career is Premier League, La Liga, Serie A and Saudi league at once.

Constraints: the bank must stay large enough per filter (risk K-09), matchmaking already splits players by game type (DEC-59), and open rules stay configuration.

## Decision
- **Topics are a new dimension of content, separate from `category`.** Every round carries `topics: string[]` (for example `la-liga`, `premier-league`, `world-cup`, `national-teams`). The pipeline assigns them; the bundle manifest lists every topic with its names in both languages, like categories. The app stores them in `questions.topics` with a GIN index.
- **"General" is no filter**, not a topic: it plays everything.
- **Difficulty levels are named ranges in config** (`room.difficultyLevels`, e.g. `EASY → [1, 2]`). `MIXED` is no filter.
- **Only private rooms filter** (for now). The host picks topics and a level while in `LOBBY`; the battle snapshots them. Random matchmaking stays unfiltered (DEC-64).
- **The app never offers an empty choice.** `GET /v1/battle-topics?gameType=` returns the topics that have published content in the caller's locale, with counts per difficulty level. Starting a room whose filters cannot fill `roundCount` rounds fails with `409 NOT_ENOUGH_CONTENT`.
- **`ContentSelector`** gets `topics` (any of them) next to `difficulties`. The exposure window (DEC-44) still applies inside the filter.

## Alternatives considered
| Option | Why not |
|---|---|
| Reuse `category` for the league | A round is one category but can be several leagues; mixing "what kind of question" with "what it is about" breaks both filters |
| One topic per round (its "main" league) | Needs a rule for the main league that people would argue about, and throws away content: a Ronaldo career would never appear under La Liga |
| Topics in matchmaking too | Splits a small player base by game type × topic × level; the bot fallback would hide the problem by making most battles bot battles |
| Compute topics in the app from the catalog | The app does not know club leagues or match competitions; that knowledge lives in `football_kb` (07 §3) |

## Consequences
- **Good:** fans of one league get their league; the same content serves General and every topic it touches; difficulty is configuration.
- **Bad:** content now needs topic tags, and a narrow filter can run out of fresh content sooner. The availability endpoint and `NOT_ENOUGH_CONTENT` make that visible instead of silent.
- **Revisit:** if players want topics in random matchmaking, once traffic shows the queues would still fill.
