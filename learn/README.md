# learn/

Short concept cards, one concept per file, grouped by track, written while we build. Read a card in about 2 minutes.

## Card format (keep it this short)

```
# Concept
> One-line definition.

**Problem:** what breaks without it.
**How:** 2-4 bullets.
**In our code:** links.
**Watch out:** 1-2 traps.
**Check yourself:** one interview-style question, answer folded below.
```

Rules: no history lessons, no filler, max ~30 lines. If it needs more, it is two concepts.

## Tracks

| Folder | What goes in it |
|---|---|
| [architecture/](architecture/) | How the code is split and wired: modules, layers, DI, patterns |
| [backend/](backend/) | Server-side building blocks: APIs, errors, events, config, auth |
| [database/](database/) | Schema design, migrations, transactions, indexes, locking |
| [testing/](testing/) | Test levels, test design, test tooling |
| [devops/](devops/) | CI/CD, Docker, health checks, monitoring, deployment |
| [mobile/](mobile/) | Flutter side: API client, state, real-time, store release |

New tracks (for example `security/`) are added when the first card needs one.

## Index

| Card | Phase | One line |
|---|---|---|
| [architecture/modular-monolith](architecture/modular-monolith.md) | P0 | One deployable, strict module walls inside |
| [architecture/layers-and-ports](architecture/layers-and-ports.md) | P0 | Business rules don't know about frameworks |
| [architecture/dependency-injection](architecture/dependency-injection.md) | P0 | Classes ask for what they need; the container builds them |
| [backend/transactional-outbox](backend/transactional-outbox.md) | P0 | Save the event in the same transaction as the change |
| [backend/idempotency](backend/idempotency.md) | P0 | Doing it twice has the same effect as once |
| [backend/errors-problem-details](backend/errors-problem-details.md) | P0 | Domain errors have a kind; one filter maps kind → HTTP |
| [backend/request-id-and-logs](backend/request-id-and-logs.md) | P0 | One id follows a request through every log line |
| [backend/fail-fast-config](backend/fail-fast-config.md) | P0 | Bad config crashes at boot, not at 3am |
| [database/migrations](database/migrations.md) | P0 | Schema changes are versioned code |
| [testing/testing-levels](testing/testing-levels.md) | P0 | Unit for rules, integration for the DB, e2e for flows |
| [devops/ci](devops/ci.md) | P0 | Every PR proves the code still works |
| [devops/health-checks](devops/health-checks.md) | P0 | Live = process is up; ready = it can serve traffic |
