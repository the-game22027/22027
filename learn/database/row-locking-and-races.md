# Row locks and race conditions
> When two requests change the same data at once, let the database decide who goes first.

**Problem:** "read, check, write" in code breaks under concurrency. Two refreshes both read "active", both rotate, and one token becomes two sessions. Two first sign-ins both read "no identity", and you get two users.

**How:**
- `SELECT … FOR UPDATE` locks the row until COMMIT. The second request waits, then reads the **updated** row ("already rotated").
- A `UNIQUE` constraint is the final guard. `INSERT … ON CONFLICT DO NOTHING` (Prisma `createMany` + `skipDuplicates`) waits for the other insert and returns 0 rows instead of throwing.
- On a lost race: roll back, retry once, and find what the winner created.

**In our code:** `findByTokenHashForUpdate` in [prisma-session.repository.ts](../../apps/backend/src/modules/auth/infrastructure/prisma-session.repository.ts), `create` in [prisma-identity.repository.ts](../../apps/backend/src/modules/auth/infrastructure/prisma-identity.repository.ts), the retry in [sign-in.service.ts](../../apps/backend/src/modules/auth/application/sign-in.service.ts), race tests in [sign-in.int-spec.ts](../../apps/backend/test/integration/sign-in.int-spec.ts).

**Watch out:** in Postgres, a failed statement aborts the whole transaction. That's why we use `ON CONFLICT DO NOTHING` instead of catching the unique-violation error.

**Check yourself:** why can't a unit test with a mocked repository catch these bugs?
<details><summary>Answer</summary>The mock runs one call at a time and never locks or conflicts. Only a real database with concurrent transactions shows the race.</details>
