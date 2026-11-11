# learn/

Short concept cards, one concept per file, grouped by track, written while we build. Read a card in about 2 minutes.

**Start here:** [WHAT-WE-BUILT.md](WHAT-WE-BUILT.md), the whole project so far, in Egyptian Arabic.

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
| [backend/leases](backend/leases.md) | P0 | Claim work for a limited time; a crash cleans itself up |
| [backend/retries-and-dead-letters](backend/retries-and-dead-letters.md) | P0 | Growing gaps with jitter, then set it aside for a person |
| [backend/errors-problem-details](backend/errors-problem-details.md) | P0 | Domain errors have a kind; one filter maps kind → HTTP |
| [backend/request-id-and-logs](backend/request-id-and-logs.md) | P0 | One id follows a request through every log line |
| [backend/fail-fast-config](backend/fail-fast-config.md) | P0 | Bad config crashes at boot, not at 3am |
| [database/migrations](database/migrations.md) | P0 | Schema changes are versioned code |
| [testing/testing-levels](testing/testing-levels.md) | P0 | Unit for rules, integration for the DB, e2e for flows |
| [devops/ci](devops/ci.md) | P0 | Every PR proves the code still works |
| [devops/health-checks](devops/health-checks.md) | P0 | Live = process is up; ready = it can serve traffic |
| [devops/git-worktrees](devops/git-worktrees.md) | M0 | One repo, several folders, one branch each: parallel sessions |
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
| [database/keyset-pagination](database/keyset-pagination.md) | P2 | "Rows after this one", not "skip N" |
| [database/composite-indexes](database/composite-indexes.md) | P2 | Equality columns first, then the sort column |
| [backend/translated-names](backend/translated-names.md) | P2 | `names` JSONB; pick the language at the edge |
| [backend/request-pipeline](backend/request-pipeline.md) | P2 | Middleware → guard → interceptor → pipe → handler → filter |
| [backend/state-machines](backend/state-machines.md) | P2 | Allowed states, allowed moves, events from transitions |
| [backend/out-of-order-updates](backend/out-of-order-updates.md) | P2 | Ignore anything not newer than what you stored |
| [database/optimistic-vs-pessimistic-locking](database/optimistic-vs-pessimistic-locking.md) | P2 | Lock and wait, or detect the conflict when writing |
| [backend/scheduled-jobs](backend/scheduled-jobs.md) | P2 | Timers in a worker; idempotent, retried, recorded |
| [backend/cli-entry-points](backend/cli-entry-points.md) | P2 | Same app, started by a command; commands are thin like controllers |
| [backend/simulating-time](backend/simulating-time.md) | P2 | Plan the steps as pure data; speed only divides the waits |
| [database/database-clock-deadlines](database/database-clock-deadlines.md) | P3 | One clock judges the deadline: `now()` in SQL |
| [database/shared-vs-exclusive-locks](database/shared-vs-exclusive-locks.md) | P3 | `FOR SHARE` for many readers, `FOR UPDATE` for one writer |
| [backend/content-hash](backend/content-hash.md) | P5 | Fingerprint what matters; one string tells same from changed |
| [backend/immutable-served-content](backend/immutable-served-content.md) | P5 | Once players may have seen it, add a version instead of editing |
| [database/partial-unique-index](database/partial-unique-index.md) | P5 | Unique only among rows matching a `WHERE`: one correct option |
| [database/advisory-locks](database/advisory-locks.md) | P5 | Lock a name, not a row, when there is no row to lock yet |
| [architecture/functional-core-imperative-shell](architecture/functional-core-imperative-shell.md) | G0 | Pure rules return effects; the engine does the I/O |
| [backend/one-at-a-time-per-game](backend/one-at-a-time-per-game.md) | G0 | One input queue per battle makes "first buzz" exact |
| [database/wikidata-truthy-vs-full-statements](database/wikidata-truthy-vs-full-statements.md) | G0 | `wdt:` hides former clubs; read `p:/ps:/pq:` |
| [database/cache-external-responses](database/cache-external-responses.md) | D.1 | Keep raw answers keyed by the request; re-runs are offline |
| [database/bulk-upsert-with-unnest](database/bulk-upsert-with-unnest.md) | P5.2 | Columns as arrays, one statement for thousands of rows |
| [backend/discriminated-unions](backend/discriminated-unions.md) | P5.2 | One shape per kind; the tag narrows the type |
| [backend/http-caching-etag](backend/http-caching-etag.md) | P5.2 | Tag the version; `304` when the client already has it |
| [database/random-rows-in-sql](database/random-rows-in-sql.md) | P5.2 | Filter in `WHERE`, then `ORDER BY random() LIMIT n` |
| [mobile/generated-rest-client](mobile/generated-rest-client.md) | M0 | The contract generates the client; regenerate, never hand-edit |
| [mobile/secure-token-storage](mobile/secure-token-storage.md) | M0 | Tokens in the OS keystore; the server's 401 decides expiry |
| [mobile/riverpod-providers-as-di](mobile/riverpod-providers-as-di.md) | M0 | Providers build dependencies; tests swap them with overrides |
| [mobile/go-router-redirect-guard](mobile/go-router-redirect-guard.md) | M0 | One pure function decides where each player may go |
| [mobile/rtl-and-localization](mobile/rtl-and-localization.md) | M0 | ARB strings and directional layouts; Arabic flips to RTL |
| [testing/real-data-smoke-run](testing/real-data-smoke-run.md) | D.2 | Run the real pipeline once; the strict importer finds what fixtures miss |
| [devops/deterministic-output](devops/deterministic-output.md) | D.2 | Same input, same bytes: sort everything, no randomness, no timestamps |
| [backend/never-block-boot-on-a-dependency](backend/never-block-boot-on-a-dependency.md) | P6.1 | Start even when Redis or Postgres is down; clean up in the background |
| [testing/seeded-randomness](testing/seeded-randomness.md) | P6.1 | A stored seed makes bot decisions replayable and testable |
| [backend/localize-per-viewer](backend/localize-per-viewer.md) | P6.2 | Store facts; render each player's text in their language at send time |
