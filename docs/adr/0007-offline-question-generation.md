# ADR-0007: Offline question generation — SQL templates first, local LLM optional, validated bundles

- **Status:** Accepted
- **Date:** 2026-11-07
- **Related:** 07-football-data-and-questions.md §5

## Context
Zero budget rules out paid LLM APIs. Small local models (Ollama) are weaker, especially in Arabic. Gameplay must not depend on an LLM being online. Answers must be supported by verified facts.

## Decision
Generate questions offline in Python: SQL templates over verified facts produce canonical EN/AR text, answers and DB-sourced distractors; an optional Ollama step only rephrases and explains, guarded by deterministic checks with fallback to template text; deterministic validation and human review sampling; output is a versioned JSONL bundle that the app imports and publishes.

## Alternatives considered
| Option | Why not |
|---|---|
| LLM writes questions and answers | Hallucinated answers; unverifiable |
| Paid LLM APIs | Violates the zero-budget constraint (can be added later as an optional adapter) |
| Generate on demand in the request path | Latency, availability coupling to Ollama, nondeterminism |

## Consequences
+ Correctness comes from data, not the model; app availability is independent of AI.
− Template authoring effort; Arabic quality depends on human-written templates and review.
