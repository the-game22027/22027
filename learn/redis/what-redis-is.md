# What Redis is, and what it is not
> An in-memory key-value server: every value lives in RAM behind a key, and commands run one at a time.

**Problem:** some state must be shared by every API instance and read in microseconds: "is this user already in a battle?", "who is waiting for a match?", "how many sign-ins from this IP this minute?". Postgres can store it, but a disk-backed row lock per request is slow and heavy for short-lived, high-traffic state.

**How:**
- A key (`act:<userId>`) maps to a typed value (string, hash, list, set, sorted set, stream).
- One thread executes commands, one after another, so every single command is atomic. Several commands need a script or a transaction (see [atomic-redis-scripts](../database/atomic-redis-scripts.md)).
- RAM is fast and limited: keep values small and give short-lived data a TTL.
- **Postgres is the source of truth; Redis holds what we can lose or rebuild.** Battles, points and boards are in Postgres. Queue tickets and activity flags in Redis are rebuilt or cleared on boot.

**In our code:** six uses: rate limits, the activity guard, matchmaking, BullMQ jobs, the health check and the server config in [docker-compose.yml](../../docker-compose.yml). The shared client is in [redis.module.ts](../../apps/backend/src/shared/infrastructure/redis/redis.module.ts).

**Watch out:** "it's fast, let's store X there too" leads to two sources of truth. Ask first: if Redis lost this key now, what breaks?

**Check yourself:** why is `INCR counter` safe from two API instances at once, but `GET` then `SET` is not?
<details><summary>Answer</summary>`INCR` is one command, and Redis runs commands one at a time. `GET` + `SET` are two: another client's command can run between them, and one increment is lost.</details>
