# Unique conflicts inside a transaction
> In Postgres, any error aborts the whole transaction; to try an insert that may conflict and carry on, use `ON CONFLICT DO NOTHING` and check the row count.

**Problem:** "insert, and if it is a duplicate, catch the error and continue" works outside a transaction. Inside one, after the unique violation every next statement fails with `current transaction is aborted`, so the rest of the use case (outbox event, other updates) cannot run.

**How:**
- `INSERT … ON CONFLICT DO NOTHING` returns 0 rows instead of failing; the transaction stays healthy. Prisma: `createMany({ skipDuplicates: true })` (count) or `createManyAndReturn` (rows).
- Use the count to decide: 1 = new, 0 = already there.
- Conditional updates work the same way: `UPDATE … WHERE status = 'PENDING'` changes 0 or 1 row, never errors.
- Savepoints (`SAVEPOINT`/`ROLLBACK TO`) also work, but are heavier and easy to forget.

**In our code:** `insertPendingRequest`, `insertBlock`, `closePendingRequest` in [prisma-social.repository.ts](../../apps/backend/src/modules/social/infrastructure/prisma-social.repository.ts); `insertNewEntries` in the points ledger.

**Watch out:** `ON CONFLICT DO NOTHING` without a target swallows **every** unique conflict on the table. Fine when the table has one meaningful unique rule; name the target when it has several.

**Check yourself:** why does accept-vs-cancel use `WHERE status = 'PENDING'` instead of reading the status first?
<details><summary>Answer</summary>Read-then-update leaves a gap where both see PENDING and both write. The conditional update checks and changes in one statement: one wins (1 row), the other gets 0 rows and answers `FRIEND_REQUEST_NOT_PENDING`.</details>
