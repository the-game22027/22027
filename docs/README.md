# Documentation Index

Technical reference for the Football Social Prediction & Trivia Game. The repository is a monorepo: `apps/backend`, `apps/mobile`, `data/`, `docs/` (ADR-0011).
Status: **Architecture Design v0.1 (2026-11-07)**. Everything marked *Pending* needs the product owner's approval.

## Read in this order

0. [`PRD.md`](PRD.md): what the product does in v1.0, user stories, decided rules, open items by phase.
1. [`architecture/00-overview.md`](architecture/00-overview.md): vision, scope split (confirmed / MVP / future), assumptions, risks, system diagrams.
2. [`architecture/01-modules.md`](architecture/01-modules.md): module catalog, ownership, dependency rules, events, folder layout.
3. [`architecture/02-database.md`](architecture/02-database.md): ERD, tables, constraints, indexes, retention.
4. [`architecture/03-workflows.md`](architecture/03-workflows.md): prediction, MOTM, quiz battle (matchmaking, private rooms, bots, engine), leaderboard and league workflows, with race conditions.
5. [`architecture/04-auth.md`](architecture/04-auth.md): providers, identity linking, sessions, authorization.
6. [`architecture/05-background-jobs.md`](architecture/05-background-jobs.md): what is async, queues, retries, idempotency.
7. [`architecture/06-cross-cutting.md`](architecture/06-cross-cutting.md): security, scalability, observability, testing.
8. [`architecture/07-football-data-and-questions.md`](architecture/07-football-data-and-questions.md): mock data, provider port, knowledge DB, offline question generation with Ollama.
8b. [`architecture/08-battle-games.md`](architecture/08-battle-games.md): the game types (Buzzer, Career, Who is the player?, Grid) on one shared engine, typed answers and the answer catalog.
9. [`api/API.md`](api/API.md): REST contract (conventions + endpoint inventory).
10. [`api/WEBSOCKET.md`](api/WEBSOCKET.md): real-time quiz battle protocol (battles, matchmaking, room lobby pushes).
11. [`DECISIONS.md`](DECISIONS.md): open decisions register (TBD items, options, recommendations).
12. [`adr/`](adr/): architecture decision records.
13. [`ROADMAP.md`](ROADMAP.md): implementation phases and exit criteria.
14. [`GLOSSARY.md`](GLOSSARY.md): domain vocabulary.
15. [`prompts/`](prompts/): self-contained prompts for coding agents.

## Status legend used across docs

| Label | Meaning |
|---|---|
| **Confirmed** | Agreed product/tech decision. Do not reopen without a strong reason. |
| **Recommended** | Architect's recommendation, implemented as the default, still changeable. |
| **Pending (DEC-xx)** | Open business decision. Must stay configurable; see `DECISIONS.md`. |
| **Assumption (A-xx)** | Filled gap so design can proceed; listed in `00-overview.md` §4. |
| **Future** | Supported architecturally, not built in the MVP. |

## Change policy

- A design change updates the relevant doc **and** adds or supersedes an ADR in the same commit.
- An answered open decision moves from *Pending* to *Decided* in `DECISIONS.md` with the date and the chosen option, and the affected config/defaults are updated.
