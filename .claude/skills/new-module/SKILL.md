---
name: new-module
description: Scaffold or review a NestJS module of this modular monolith following the project's layering, ownership and boundary rules. Use when creating a new module, adding a use case/repository/controller to a module, or checking that a module respects the architecture.
---

# New module / module change

Follow `CLAUDE.md` §3 and `docs/architecture/01-modules.md` (§2 catalog, §4 layering, §5 folder template, §6 events). Steps:

1. **Confirm the module exists in the catalog** (`01-modules.md` §1-2). If it does not, stop and explain why a new module is needed (or which existing module should own the behaviour). A new module requires a catalog entry + an ADR.
2. **Check the design is documented** for the behaviour you are adding (workflow in `03-workflows.md`, tables in `02-database.md`, endpoints in `docs/api/API.md`). If not, write the design first.
3. **Check open decisions** in `docs/DECISIONS.md`. Any TBD rule becomes configuration (rule set / config JSON) or `TODO(DEC-xx)`. Never hard-code values or add DB constraints for them.
4. **Create files from the template** (`01-modules.md` §5):
   - `index.ts` exports only facades, query services, DTO types, event types.
   - `domain/`: plain TypeScript only. Time via injected `Clock`. Typed `DomainError`s with stable `code`s (add new codes to `docs/api/API.md` §4).
   - `application/`: use cases, ports. Transaction boundaries with `@Transactional()`. Outbox writes in the same transaction as state changes.
   - `infrastructure/`: Prisma repositories (only this module's tables), adapters.
   - `presentation/`: controllers + DTOs (class-validator + Swagger decorators), WS gateways, BullMQ processors, CLI commands.
5. **Tables:** only this module writes them. Add indexes for every new query. Time-critical checks use the DB clock in the write statement (ADR-0009).
6. **Cross-module needs:** import only `@modules/<other>`; add the edge to the dependency graph in `01-modules.md` §3 if new (no cycles). Reverse reactions go through outbox events, handlers idempotent.
7. **Tests:** unit tests for domain rules (FixedClock), integration tests for repositories/SQL/concurrency/handler idempotency, e2e for the endpoint flow. Configurable rules are tested with at least two config values.
8. **Docs:** update the catalog entry, events table, API inventory, and DECISIONS if a rule surfaced.

Output a short summary: files created/changed, events added, decisions touched, tests added.
