# learn/

Short concept cards, one concept per file, written while we build. Read a card in about 2 minutes.

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

## Index

### P0 — Foundation
| Card | One line |
|---|---|
| [modular-monolith](modular-monolith.md) | One deployable, strict module walls inside |
| [layers-and-ports](layers-and-ports.md) | Business rules don't know about frameworks |
| [dependency-injection](dependency-injection.md) | Classes ask for what they need; the container builds them |
| [transactional-outbox](transactional-outbox.md) | Save the event in the same transaction as the change |
| [idempotency](idempotency.md) | Doing it twice has the same effect as once |
| [errors-problem-details](errors-problem-details.md) | Domain errors have a kind; one filter maps kind → HTTP |
| [request-id-and-logs](request-id-and-logs.md) | One id follows a request through every log line |
| [health-checks](health-checks.md) | Live = process is up; ready = it can serve traffic |
| [fail-fast-config](fail-fast-config.md) | Bad config crashes at boot, not at 3am |
| [migrations](migrations.md) | Schema changes are versioned code |
| [testing-levels](testing-levels.md) | Unit for rules, integration for the DB, e2e for flows |
| [ci](ci.md) | Every push proves the code still works |

### P1 — Auth + Users
_Cards are added as we build P1._
