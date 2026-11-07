# ADR-0001: Modular monolith with separate API and worker entrypoints

- **Status:** Accepted
- **Date:** 2026-11-07
- **Related:** docs/architecture/00-overview.md §6, 01-modules.md

## Context
Solo developer / small team, zero budget, many interconnected game systems (predictions, MOTM, real-time quiz battles, leagues, leaderboards). Requirements change often. No measured scaling bottleneck exists yet.

## Decision
One NestJS codebase organized as a modular monolith with 12 modules and enforced boundaries. Two process roles from the same code: `main.api.ts` (HTTP + WebSocket) and `main.worker.ts` (BullMQ processors and schedulers). One PostgreSQL app database, one Redis.

## Alternatives considered
| Option | Why not |
|---|---|
| Microservices | Network failures, distributed transactions, deployment and observability overhead with no current benefit |
| Single process for everything | Jobs and real-time traffic compete for the same event loop; cannot scale them independently |
| Serverless functions | Poor fit for WebSockets and long-running timers; vendor cost/limits |

## Consequences
+ Simple local dev, one deploy artifact, in-process calls, single DB transactions.
+ Modules can be extracted later because they talk through public interfaces and events.
− Discipline is required: boundaries are enforced by dependency-cruiser and review, not by the network.
Revisit when a single module needs independent scaling or release cadence (likely `battles`).
