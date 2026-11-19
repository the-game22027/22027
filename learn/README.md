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
| [redis/](redis/) | Redis and in-memory tools: data types, atomicity, TTLs, queues, persistence, production |

New tracks are added when the first card needs one.

### Redis track: reading order

About 35 minutes in total. Cards marked *later* explain tools we have not needed yet, and when we will.

1. [what-redis-is](redis/what-redis-is.md): in memory, one command at a time, Postgres stays the truth
2. [data-types](redis/data-types.md): strings, hashes, lists, sets, sorted sets, streams
3. [keys-naming-and-scan](redis/keys-naming-and-scan.md): `area:kind:id`, and `SCAN` instead of `KEYS`
4. [ttl-and-expiry](redis/ttl-and-expiry.md): keys that clean themselves up after a crash
5. [set-nx-claims-and-locks](redis/set-nx-claims-and-locks.md): one winner, release only what you own
6. [multi-exec-pipelines-and-scripts](redis/multi-exec-pipelines-and-scripts.md): batch, transaction or script
7. [atomic-redis-scripts](database/atomic-redis-scripts.md): read, decide and change in one Lua script
8. [sorted-sets-for-queues-and-rankings](redis/sorted-sets-for-queues-and-rankings.md): matchmaking queue; why boards stayed in Postgres
9. [client-connections-and-outages](redis/client-connections-and-outages.md): fail fast, fail open or pause, per feature
10. [bullmq-on-redis](redis/bullmq-on-redis.md): queues, jobs, workers, retries, schedulers
11. [persistence-rdb-and-aof](redis/persistence-rdb-and-aof.md): surviving a restart; persistence is not a backup
12. [memory-and-eviction](redis/memory-and-eviction.md): `noeviction` for queues, LRU for caches
13. [rate-limit-algorithms](redis/rate-limit-algorithms.md): fixed window (ours) vs sliding vs token bucket
14. [inspecting-redis](redis/inspecting-redis.md): `redis-cli` commands for our keys
15. [caching-patterns](redis/caching-patterns.md) *later*: cache-aside, invalidation, stampedes
16. [pub-sub-and-streams](redis/pub-sub-and-streams.md) *later*: several API instances, Socket.IO adapter
17. [redis-in-production](redis/redis-in-production.md) *later*: replicas, Sentinel, Cluster, security, licence
18. [peek-then-take](redis/peek-then-take.md): decide with data Redis lacks, then take only if nothing changed
19. [alternatives-and-similar-tools](redis/alternatives-and-similar-tools.md): Valkey, Memcached, RabbitMQ, Kafka, Postgres queues

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
| [backend/secret-simultaneous-moves](backend/secret-simultaneous-moves.md) | N0 | Hold both picks on the server, reveal them together, auto-pick at the deadline |
| [backend/private-results-in-acks](backend/private-results-in-acks.md) | N1 | One player's private result goes in their ack or their copy of a shared event, never in a lone event that leaves a `seq` gap |
| [database/wikidata-truthy-vs-full-statements](database/wikidata-truthy-vs-full-statements.md) | G0 | `wdt:` hides former clubs; read `p:/ps:/pq:` |
| [database/cache-external-responses](database/cache-external-responses.md) | D.1 | Keep raw answers keyed by the request; re-runs are offline |
| [database/bulk-upsert-with-unnest](database/bulk-upsert-with-unnest.md) | P5.2 | Columns as arrays, one statement for thousands of rows |
| [backend/discriminated-unions](backend/discriminated-unions.md) | P5.2 | One shape per kind; the tag narrows the type |
| [backend/http-caching-etag](backend/http-caching-etag.md) | P5.2 | Tag the version; `304` when the client already has it |
| [database/random-rows-in-sql](database/random-rows-in-sql.md) | P5.2 | Filter in `WHERE`, then `ORDER BY random() LIMIT n` |
| [mobile/generated-rest-client](mobile/generated-rest-client.md) | M0 | The contract generates the client; regenerate, never hand-edit |
| [mobile/build-runner-part-files](mobile/build-runner-part-files.md) | M1.5 | What `.g.dart` files are: JSON and `copyWith` code written by `build_runner` |
| [mobile/secure-token-storage](mobile/secure-token-storage.md) | M0 | Tokens in the OS keystore; the server's 401 decides expiry |
| [mobile/riverpod-providers-as-di](mobile/riverpod-providers-as-di.md) | M0 | Providers build dependencies; tests swap them with overrides |
| [mobile/go-router-redirect-guard](mobile/go-router-redirect-guard.md) | M0 | One pure function decides where each player may go |
| [mobile/rtl-and-localization](mobile/rtl-and-localization.md) | M0 | ARB strings and directional layouts; Arabic flips to RTL |
| [mobile/refresh-token-rotation-on-the-client](mobile/refresh-token-rotation-on-the-client.md) | M1 | One refresh for parallel 401s; only a refused refresh signs out |
| [mobile/google-id-token-sign-in](mobile/google-id-token-sign-in.md) | M1 | Google signs a token for our client id; the backend checks it |
| [mobile/reauthentication-before-sensitive-actions](mobile/reauthentication-before-sensitive-actions.md) | M1 | Sign in again, check it is the same player, then delete |
| [mobile/dispose-controllers-with-their-widget](mobile/dispose-controllers-with-their-widget.md) | M1 | Controllers live and die with their widget's `State` |
| [mobile/etag-conditional-download](mobile/etag-conditional-download.md) | M1.5 | Download a big file only when its version changed (used for the answer catalog until ADR-0021) |
| [mobile/riverpod-paused-providers](mobile/riverpod-paused-providers.md) | M1.5 | A provider without a listener does not retry |
| [mobile/server-clock-offset](mobile/server-clock-offset.md) | M1.5 | Countdowns use the server clock, estimated from the fastest `time:sync` |
| [mobile/sequenced-events-and-resync](mobile/sequenced-events-and-resync.md) | M1.5 | Apply battle events strictly by `seq`; a gap means resync |
| [testing/real-data-smoke-run](testing/real-data-smoke-run.md) | D.2 | Run the real pipeline once; the strict importer finds what fixtures miss |
| [devops/deterministic-output](devops/deterministic-output.md) | D.2 | Same input, same bytes: sort everything, no randomness, no timestamps |
| [backend/never-block-boot-on-a-dependency](backend/never-block-boot-on-a-dependency.md) | P6.1 | Start even when Redis or Postgres is down; clean up in the background |
| [testing/seeded-randomness](testing/seeded-randomness.md) | P6.1 | A stored seed makes bot decisions replayable and testable |
| [backend/localize-per-viewer](backend/localize-per-viewer.md) | P6.2 | Store facts; render each player's text in their language at send time |
| [database/atomic-redis-scripts](database/atomic-redis-scripts.md) | P6.3 | Read, decide and change inside one Lua script: no race between matcher and leave |
| [redis/what-redis-is](redis/what-redis-is.md) | Redis | In-memory key-value server; Postgres stays the source of truth |
| [redis/data-types](redis/data-types.md) | Redis | Pick the type by the question you need answered in one command |
| [redis/keys-naming-and-scan](redis/keys-naming-and-scan.md) | Redis | `area:kind:id` names; walk keys with `SCAN`, never `KEYS` |
| [redis/ttl-and-expiry](redis/ttl-and-expiry.md) | Redis | Set value and expiry in one command; a TTL is a crash backstop |
| [redis/set-nx-claims-and-locks](redis/set-nx-claims-and-locks.md) | Redis | `SET NX EX` picks one winner; compare before release |
| [redis/multi-exec-pipelines-and-scripts](redis/multi-exec-pipelines-and-scripts.md) | Redis | Pipeline saves trips, `MULTI` groups writes, Lua can decide |
| [redis/sorted-sets-for-queues-and-rankings](redis/sorted-sets-for-queues-and-rankings.md) | Redis | Score by time for queues, by points for rankings |
| [redis/client-connections-and-outages](redis/client-connections-and-outages.md) | Redis | Fail fast in the client; choose fail open or closed per feature |
| [redis/bullmq-on-redis](redis/bullmq-on-redis.md) | Redis | Jobs in Redis: queues, workers, retries, schedulers, Bull Board |
| [redis/persistence-rdb-and-aof](redis/persistence-rdb-and-aof.md) | Redis | Snapshots or a write log to survive restarts; not a backup |
| [redis/memory-and-eviction](redis/memory-and-eviction.md) | Redis | `noeviction` for queues and state, LRU only for caches |
| [redis/rate-limit-algorithms](redis/rate-limit-algorithms.md) | Redis | Fixed window, sliding log/counter, token bucket |
| [redis/inspecting-redis](redis/inspecting-redis.md) | Redis | `redis-cli` commands to see our real keys |
| [redis/caching-patterns](redis/caching-patterns.md) | later | Cache-aside, invalidation, stampedes; display data only |
| [redis/pub-sub-and-streams](redis/pub-sub-and-streams.md) | later | Fire-and-forget broadcast vs a stored, acknowledged log |
| [redis/redis-in-production](redis/redis-in-production.md) | later | Replicas, Sentinel, Cluster hash slots, security, licence |
| [redis/alternatives-and-similar-tools](redis/alternatives-and-similar-tools.md) | Redis | Valkey, Dragonfly, Memcached, RabbitMQ, Kafka, Postgres queues |
| [architecture/one-runner-per-mechanic](architecture/one-runner-per-mechanic.md) | P6.4 | The engine keeps what games share; one runner per mechanic owns a round |
| [testing/test-what-the-build-ships](testing/test-what-the-build-ships.md) | fix | Tests must compile like the build: Swagger plugin metadata in e2e |
| [backend/edit-distance-typo-tolerance](backend/edit-distance-typo-tolerance.md) | P6.6 | Few enough one-letter edits for the name's length: a typo, not a wrong answer |
| [database/gin-index-array-contains](database/gin-index-array-contains.md) | P6.6 | Element → rows; `arr @> ARRAY[x]` uses it, `x = ANY(arr)` does not |
| [testing/shared-test-vectors](testing/shared-test-vectors.md) | P6.6 | Two implementations, one table of inputs and outputs, run in both |
| [architecture/append-only-ledger](architecture/append-only-ledger.md) | P6.5 | Add a row per award; totals and leaderboards are rebuildable sums |
| [backend/snapshot-rules-at-start](backend/snapshot-rules-at-start.md) | P6.5 | A battle keeps the rule set it started with; new rules apply from the next one |
| [backend/time-zone-period-boundaries](backend/time-zone-period-boundaries.md) | P6.5b | Store UTC; cut weeks and months at local midnight, across daylight saving |
| [database/recompute-instead-of-increment](database/recompute-instead-of-increment.md) | P6.5b | Write the sum from the source rows under a lock, never `+=` |
| [testing/library-state-shared-across-apps](testing/library-state-shared-across-apps.md) | P6.5b | Two Nest apps in one test process share static library state |
| [database/dedup-table-for-increments](database/dedup-table-for-increments.md) | P6.5c | Mark the event applied in the same transaction as the `+=` |
| [security/hide-existence-with-404](security/hide-existence-with-404.md) | P7 | A block answers like an unknown player, in both directions |
| [database/unordered-pair-rows](database/unordered-pair-rows.md) | P7 | Store A–B once, low id first; unique per pair with LEAST/GREATEST |
| [database/conflicts-inside-transactions](database/conflicts-inside-transactions.md) | P7 | An error aborts the transaction: use `ON CONFLICT DO NOTHING` and count rows |
| [database/trigram-search](database/trigram-search.md) | P7 | `pg_trgm` makes `ILIKE '%text%'` indexable; escape `%` and `_` |
| [redis/peek-then-take](redis/peek-then-take.md) | P7 | Read, decide with outside data, then take atomically only if unchanged |
| [backend/graceful-shutdown](backend/graceful-shutdown.md) | P7 | Refuse new work, finish queued work, then close the database |
| [mobile/api-error-codes-as-typed-failures](mobile/api-error-codes-as-typed-failures.md) | M1.5 | Map problem+json codes to a feature enum so screens switch on typed reasons |
| [database/raw-landing-zone](database/raw-landing-zone.md) | D.3a | Keep outside files exactly as they arrived, with a checksum; clean in a later step |
| [database/copy-for-bulk-loads](database/copy-for-bulk-loads.md) | D.3a | `COPY … FROM STDIN` streams millions of rows; build names with `sql.Identifier` |
| [database/id-crosswalk](database/id-crosswalk.md) | D.3b | Map every outside id to our one id; exact ids first, names only with review |
| [database/wikidata-mul-labels](database/wikidata-mul-labels.md) | D.1 fix | `mul` = one name for all languages; use it as English only when `en` is missing |
| [database/youth-years-in-wikidata-careers](database/youth-years-in-wikidata-careers.md) | N1 | Wikidata mixes academy years into senior spells; clip careers to age 17 before building questions |
