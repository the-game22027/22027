# Bulk upsert with `unnest`
> Send whole columns as arrays and let Postgres turn them into rows: one statement for thousands of rows.

**Problem:** the answer catalog has 22,645 entities. One `INSERT ... ON CONFLICT` per entity means 22,645 round trips to the database inside one transaction: minutes instead of seconds.

**How:**
- Build one array per column in TypeScript: ids, refs, kinds, names...
- `unnest($ids::uuid[], $refs::text[], ...)` expands them side by side into rows.
- `INSERT INTO ... SELECT ... FROM unnest(...) ON CONFLICT (external_ref) DO UPDATE SET ...` inserts new rows and updates existing ones in one statement.
- Send the rows in chunks (2,000 here), so no single statement gets huge.
- JSON and nested arrays (`names`, `search_forms`) travel as text and are cast back inside SQL (`::jsonb`, `json_array_elements_text`).

**In our code:** `replaceActiveCatalog` in [prisma-question-import.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-import.repository.ts). The full catalog imports in about 2 seconds of database time.

**Watch out:**
- All arrays must have the same length and the same order, or rows get mixed up. Build them from the same list in one place.
- `ON CONFLICT DO UPDATE` cannot touch the same row twice in one statement: duplicate keys in the input are an error. The parser rejects repeated `externalRef`s first.

**Check yourself:** why not use Prisma's `createMany` with `skipDuplicates`?
<details><summary>Answer</summary>`skipDuplicates` only skips existing rows; it never updates them. A renamed entity would keep its old name. An upsert needs `ON CONFLICT DO UPDATE`.</details>
