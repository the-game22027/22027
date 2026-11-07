# game-backend

Backend, football knowledge pipeline and architecture docs for a **football social prediction & trivia game**:

- match predictions (top-5 European leagues + national teams), locked at kickoff
- **real-time quiz battles** between players at any time: random 1v1 matchmaking with a bot fallback, and private rooms joined with a code
- Man of the Match community voting, private leagues, friends, and weekly/monthly/seasonal/all-time leaderboards

The mobile app lives in [`game-mobile`](https://github.com/the-game22027/game-mobile). This repo is the source of truth for the API contract it consumes.

## Status

**Architecture design v0.1 is complete; implementation starts with Phase 0 (foundation).** No application code yet. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Stack

NestJS + TypeScript (modular monolith) · PostgreSQL + Prisma · Redis + BullMQ · Socket.IO · Python (knowledge-base ingestion and offline question generation) · Ollama (local, optional, never on the request path) · Docker Compose · Jest. Zero-budget: no paid service is required for development.

## Where to start

| You want to… | Read |
|---|---|
| Understand the product and architecture | [`docs/README.md`](docs/README.md) (reading order) |
| Use the API from the mobile app | [`docs/api/API.md`](docs/api/API.md) and [`docs/api/WEBSOCKET.md`](docs/api/WEBSOCKET.md) |
| See what is still undecided | [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| Implement a phase with a coding agent | [`CLAUDE.md`](CLAUDE.md) and [`docs/prompts/`](docs/prompts/) |

## Repository layout (target)

```
apps/backend/   NestJS API + worker (from Phase 0)
data/           Python knowledge-base pipeline and question bundles (Track D)
docs/           architecture, API contract, decisions, ADRs, roadmap
.claude/        Claude Code project skills
```

## Contributing workflow

Branch from `main` (`feat/…`, `fix/…`, `docs/…`, `chore/…`), use [Conventional Commits](https://www.conventionalcommits.org/), open a pull request using the template, and squash-merge. A design change updates the relevant doc and adds an ADR in the same PR.
