# ADR-0006: Socket.IO with a single-owner in-memory battle engine and PostgreSQL durability

- **Status:** Proposed. Amended by ADR-0010: battles have 2..N participants (humans and bots), plus private rooms. The transport and engine decisions below are unchanged.
- **Date:** 2026-11-07
- **Related:** ADR-0010, 03-workflows.md §3-4, api/WEBSOCKET.md, 06-cross-cutting.md §2

## Context
Real-time quiz battles need low-latency, server-authoritative rounds with millisecond deadlines, reconnection, and duplicate handling. WebSockets do not guarantee ordering, exactly-once delivery, or persistence.

## Decision
Use Socket.IO through `@nestjs/websockets`. Each battle is run by one in-memory engine (the instance that created it) with its own timers. Every state transition (battle, rounds, answers, result) is persisted to PostgreSQL before or as it is announced. Commands carry `clientMsgId` and use acks; events carry a per-battle `seq`; reconnection uses a full snapshot. Matchmaking queue in Redis. Multi-instance later via sticky sessions, the Socket.IO Redis adapter, and a Redis ownership lock.

## Alternatives considered
| Option | Why not |
|---|---|
| Raw `ws` | We would rebuild acks, rooms, reconnection, heartbeats |
| BullMQ delayed jobs for round deadlines | Too coarse and slow for per-round timing |
| Redis as primary battle state store | Second source of truth; persistence and consistency complexity |
| Managed real-time service | Paid; conflicts with zero budget |

## Consequences
+ Simple, fast, testable; the DB holds the truth for disputes and history.
− MVP restart abandons in-progress battles (documented); multi-instance needs the steps above.
