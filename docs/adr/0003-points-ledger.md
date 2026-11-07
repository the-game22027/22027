# ADR-0003: Append-only points ledger as the single source for all scoring

- **Status:** Proposed
- **Date:** 2026-11-07
- **Related:** DEC-01, DEC-18, DEC-23, DEC-33, DEC-41; 02-database.md §4.9; 03-workflows.md §5

## Context
Points come from predictions, real-time quiz battles and possibly MOTM (the Daily Quiz was removed by ADR-0010). Leaderboards (4 periods, several categories, league scopes) must be recalculable when rules or results change. Scoring formulas are undecided.

## Decision
Every awarded point is a row in `point_entries` keyed by `(source_type, source_id, rule_set_id, source_revision)`. Corrections supersede entries instead of updating them. Game modules compute points with their own rule-set-driven calculators; the `points` module only records. Leaderboards are rebuildable projections of the ledger; league rankings are ledger aggregations over member sets.

## Alternatives considered
| Option | Why not |
|---|---|
| Each game module updates leaderboard tables directly | Couples every game to every board; recalculation becomes impossible to reason about |
| Compute leaderboards from game tables on every read | Expensive joins across modules; breaks module ownership |
| Event sourcing | No requirement for full history replay of every aggregate; heavy |

## Consequences
+ One place to answer "why does this user have N points"; idempotent recording; trivial rebuilds; new categories are cheap.
− One more write per award and eventual consistency (seconds) for leaderboards.
