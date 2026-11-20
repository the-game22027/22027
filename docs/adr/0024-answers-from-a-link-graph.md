# ADR-0024: Answers from a link graph (ONE_TWO)

- **Status:** Proposed
- **Date:** 2026-11-20
- **Related:** DEC-81, DEC-44, DEC-67, ADR-0015, ADR-0021, docs/architecture/08-battle-games.md §15, docs/architecture/07-football-data-and-questions.md §5.4 and §5.10 (N8 slice)

## Context
Every game so far stores its accepted answers per question (`question_answers`, one or more slots). `ONE_TWO` (وان تو) cannot: each answer becomes the next question, so the set of accepted answers depends on the ball, which depends on what the players typed. The product owner wants a game whose questions do not run out; storing every possible (ball, pass type) pair as a question would mean hundreds of thousands of rows that are only fragments of a rally, and DEC-44 bookkeeping for each.

Constraints: the backend stays authoritative and judges typed text with the same rules as every game (ADR-0021); no LLM on the gameplay path; zero budget (Postgres only, no graph database); question-bank owns content and the catalog.

## Decision
- The pipeline exports the links between catalog entities as a graph (`links.jsonl`, `link-matches.jsonl` in the bundle), not as questions. Only the rally seeds are questions (`gameType: ONE_TWO`, content `{ seed }`, no stored answers).
- Question-bank stores the graph in `entity_links`, one row per pass-type reading, with the primary key `(from_entity_id, pass_type, to_entity_id)`, plus `entity_link_counts` and `link_matches`. A bundle that carries a graph replaces the whole graph in one transaction.
- The answer checker gains `judgeTypedTextAgainstLinks`: the candidates are the ball's neighbours for the picked pass type, loaded with one indexed query, then judged by the ADR-0021 rules unchanged.

## Alternatives considered
| Option | Why not |
|---|---|
| Generate every (ball, pass type) as a stored question | About 730,000 fragment questions with their answer slots; DEC-44 and question stats would count fragments, not rounds; a rally would still need to chain them at run time |
| A graph database (Neo4j and similar) | A new service to run and back up for one game; the queries are one hop from a known node, which a B-tree primary key already answers in milliseconds |
| Keep the graph in Redis or in API memory | Redis is not the system of record and the graph must survive restarts; loading 730,000 rows into every API process wastes memory when a turn needs one ball's neighbours |
| Query the knowledge base (`football_kb`) at play time | The app must not depend on the Python-owned database (07 §3); bundles are the only contract |

## Consequences
- **Positive:** content that does not run out (rallies are new every time); judging stays one code path (ADR-0021); one query per pass; the graph rebuilds from the knowledge base like any bundle.
- **Negative:** a second kind of content in question-bank (a graph next to questions); a bigger import (about 730,000 rows) that replaces rather than adds; question stats only see the seed question, not each pass.
- **Revisit if:** another game needs multi-hop queries at play time (for example a live shortest path), or the graph grows past what one Postgres index serves within a turn's latency budget.
