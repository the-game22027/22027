# READ COMMITTED: each statement has its own snapshot
> In Postgres' default isolation level, a statement sees only what was committed when that statement started.

**Problem:** our revoke was one `UPDATE … WHERE family_id = X`. A refresh in flight was inserting a new session in that family. The UPDATE waited for the refresh's lock, but its snapshot was older than the new row, so the new session survived a "revoke everything".

**How:**
- A blocked `UPDATE` re-checks the row it waited for. It does **not** look for new rows.
- Fix with two statements: `SELECT … FOR UPDATE` to wait for in-flight work, then `UPDATE`. The second statement gets a fresh snapshot and sees the committed row.
- `ORDER BY id` in the lock query, so two revokes take locks in the same order.

**In our code:** `lockThenRevoke` in [prisma-session.repository.ts](../../apps/backend/src/modules/auth/infrastructure/prisma-session.repository.ts), test "revokes the session a concurrent refresh is still creating" in [refresh.int-spec.ts](../../apps/backend/test/integration/refresh.int-spec.ts).

**Watch out:** inside one transaction, READ COMMITTED can give two different answers to the same query. `REPEATABLE READ` keeps one snapshot, but then you must retry on serialization errors.

**Check yourself:** why does locking rows in a different order cause problems?
<details><summary>Answer</summary>Deadlock: A holds 1 and wants 2, B holds 2 and wants 1. Postgres kills one transaction. A consistent order removes the cycle.</details>
