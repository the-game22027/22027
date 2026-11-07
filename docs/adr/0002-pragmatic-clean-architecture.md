# ADR-0002: Pragmatic clean architecture inside each module

- **Status:** Accepted
- **Date:** 2026-11-07
- **Related:** docs/architecture/01-modules.md §4-5

## Context
Business rules (locks, windows, scoring, visibility) must be testable without NestJS or a database and must survive changes to infrastructure. Over-abstraction would slow a small team.

## Decision
Each module has `domain`, `application`, `infrastructure`, `presentation` folders. Domain is plain TypeScript (no NestJS, Prisma, Redis, Socket.IO, Ollama, env). Application owns use cases and ports. Infrastructure implements ports with Prisma/Redis. Presentation holds all inbound adapters (HTTP, WS, jobs, CLI). Transactions propagate with `@nestjs-cls/transactional` (Prisma adapter). Ports exist only when they solve a real problem (swap implementations, test seams for time/randomness, shape translation).

## Alternatives considered
| Option | Why not |
|---|---|
| Nest "services + Prisma everywhere" | Rules leak into controllers and Prisma calls; hard to unit test; refactors become risky |
| Full hexagonal with ports for everything and generic repositories | Boilerplate without benefit; generic repositories hide intent |
| Switch ORM for a "purer" domain mapping | Prisma is a confirmed stack decision; mapping functions are enough |

## Consequences
+ Scoring, locking, visibility, period math are pure and exhaustively unit-testable.
− Mapping code between Prisma models and domain objects.
