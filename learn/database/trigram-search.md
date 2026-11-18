# Trigram search for "contains"
> `pg_trgm` splits text into 3-letter pieces and indexes them, so `name ILIKE '%dina%'` can use an index instead of reading every row.

**Problem:** a normal B-tree index helps `LIKE 'dina%'` (prefix) at best, never `'%dina%'` (anywhere in the name). User search by display name would scan the whole table on every keystroke.

**How:**
- `CREATE EXTENSION pg_trgm;` then `CREATE INDEX … USING GIN (display_name gin_trgm_ops);`
- The same index serves `ILIKE`, `LIKE` and similarity (`%`, `similarity()`), case-insensitive with `ILIKE`.
- For a `citext` column, index the text form: `GIN ((username::text) gin_trgm_ops)` and query `username::text ILIKE …`.
- Escape `%`, `_` and `\` in the user's text, or `%` matches everyone.

**In our code:** `searchActiveUsers` in [prisma-user.repository.ts](../../apps/backend/src/modules/users/infrastructure/prisma-user.repository.ts); the indexes in the `social` and `user_search_username_index` migrations.

**Watch out:**
- Queries shorter than 3 characters barely benefit; we require 2 and accept a scan for those.
- Arabic letters work, but variants (أ إ آ ا, ة/ه) do not match each other. Normalization is a later step.

**Check yourself:** why is the search query's `%` escaped before it reaches `ILIKE`?
<details><summary>Answer</summary>`%` is a wildcard: a user typing `%` would match every row, turning search into "list all players" and an expensive scan.</details>
