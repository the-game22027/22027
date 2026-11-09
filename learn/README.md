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
| [security/](security/) | Auth, tokens, keys, secrets, common attacks |
| [devops/](devops/) | CI/CD, Docker, health checks, monitoring, deployment |
| [mobile/](mobile/) | Flutter side: API client, state, real-time, store release |

New tracks are added when the first card needs one.

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
| [security/jwt](security/jwt.md) | P1 | Signed, readable, short-lived; verify alg, iss, aud, exp |
| [security/hashing-tokens-at-rest](security/hashing-tokens-at-rest.md) | P1 | Store SHA-256 of the token, never the token |
| [security/oidc-id-token-verification](security/oidc-id-token-verification.md) | P1 | Check Google's signature, issuer, our audience, expiry; the user is `sub` |
| [security/refresh-token-rotation](security/refresh-token-rotation.md) | P1 | New token on every refresh; an old one coming back revokes the family |
| [database/row-locking-and-races](database/row-locking-and-races.md) | P1 | `FOR UPDATE` and `UNIQUE` + `ON CONFLICT` beat read-check-write |
| [security/authn-vs-authz](security/authn-vs-authz.md) | P1 | 401: who are you. 403/404: may you do this |
| [backend/rate-limiting](backend/rate-limiting.md) | P1 | Redis counter per client and window; 429 with `Retry-After` |
| [database/soft-delete](database/soft-delete.md) | P1 | Mark as deleted, keep the row, allow undo |
| [database/read-committed](database/read-committed.md) | P1 | Each statement has its own snapshot; lock first, then update |
| [backend/websocket-handshake-auth](backend/websocket-handshake-auth.md) | P1 | Refuse the socket at the handshake |
| [database/transactions-acid](database/transactions-acid.md) | P1 | All or nothing; no network calls inside |
| [backend/http-status-codes](backend/http-status-codes.md) | P1 | The status tells the client what to do next |
| [security/public-private-keys](security/public-private-keys.md) | P1 | Private signs, public verifies; `kid` enables rotation |
| [backend/validation-at-the-edge](backend/validation-at-the-edge.md) | P1 | Shape in the DTO, rules in the domain, uniqueness in the database |
