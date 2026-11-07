---
name: adr
description: Record an architecture decision as an ADR in docs/adr and update related docs. Use when a design choice is made or changed (technology, boundary, data model, protocol), or when an open decision in docs/DECISIONS.md is resolved in a way that affects architecture.
---

# Record an architecture decision

1. Read `docs/adr/` to find the next number and any ADR this one supersedes.
2. Copy `docs/adr/0000-template.md` to `docs/adr/NNNN-kebab-title.md`.
3. Fill: Status (`Proposed` unless the user explicitly approved → `Accepted`), Date (today, absolute), Related (DEC-xx, docs sections), Context (forces and constraints, including zero budget and the fixed stack), Decision (plain statement), Alternatives (table with honest reasons), Consequences (+/−, and what would make us revisit).
4. If it supersedes an ADR, set the old one's status to `Superseded by ADR-NNNN` (do not delete it).
5. Update every affected doc in the same change: `docs/architecture/*`, `docs/api/*`, `docs/DECISIONS.md` (mark the DEC as Decided with date and option if applicable), `CLAUDE.md` if a rule changes.
6. Never silently turn a recommendation into a confirmed product rule: product rules need the user's explicit approval.

Reply to the user with: the decision, why, the trade-off, and the files changed.
