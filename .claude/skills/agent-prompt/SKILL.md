---
name: agent-prompt
description: Write a self-contained, implementation-oriented prompt (in professional English) for a coding agent to implement a phase, module, or task of this project. Use when the user asks for a prompt for Claude Code/Codex/another agent, or before delegating implementation work.
---

# Write a coding-agent prompt

The receiving agent has **not** seen our conversation. Everything it needs must be in the prompt or in files it is told to read. Use `docs/prompts/phase-00-foundation.md` as the reference for tone and structure. Save new prompts as `docs/prompts/<phase-or-task>.md`.

Required sections, in this order:

1. **Context:** what the product is (2-4 sentences), where this task sits in `docs/ROADMAP.md`, which files to read first (always `CLAUDE.md` + the specific `docs/architecture/*` and `docs/api/*` sections).
2. **Constraints:** fixed stack, modular monolith, zero budget, domain purity, DB-clock rule for deadlines, open decisions stay configurable (list the relevant DEC-xx with their current recommended defaults).
3. **Scope:** numbered, concrete deliverables: tables (by name), use cases, endpoints (method + path), events produced/consumed, jobs, CLI commands.
4. **Expected behavior:** observable behaviours, including edge cases and race conditions from `03-workflows.md`.
5. **Acceptance criteria:** checkbox list, objectively verifiable.
6. **Testing requirements:** unit / integration (Testcontainers) / e2e / WebSocket / concurrency cases, named explicitly; configurable rules tested with ≥ 2 configs.
7. **Non-goals:** explicit list of what not to build or change (future features, other modules, stack changes, invented rules).
8. **Deliverable:** what the PR must contain, including doc updates and a note of any deviation with its reason.

Rules: write in professional English; be specific (names of tables, codes, events); never include secrets; never invent values for TBD rules: tell the agent to read them from config and seed obviously fake `DEV_ONLY` values. After writing, give the user a 3-5 line summary.
