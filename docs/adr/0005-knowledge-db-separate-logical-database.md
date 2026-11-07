# ADR-0005: Football knowledge base in a separate logical database owned by the Python pipeline

- **Status:** Proposed
- **Date:** 2026-11-07
- **Related:** 07-football-data-and-questions.md §3-4

## Context
The knowledge base is large, batch-written, curated slowly, licence-tracked, and built by Python tooling. Gameplay needs only published questions and operational match data.

## Decision
Create `football_kb` as a separate logical database on the same PostgreSQL server. The Python pipeline owns its schema and migrations. The app never connects to it; the only interface is a versioned, validated JSONL question bundle imported by the `question-bank` module.

## Alternatives considered
| Option | Why not |
|---|---|
| Same database and schema as the app | Batch loads compete with gameplay; mixed migration lifecycles; Prisma schema bloat |
| Separate service now | Operational cost with no current benefit |

## Consequences
+ Isolation at zero cost; independent evolution; clean contract.
− No cross-database joins (not needed by design).
