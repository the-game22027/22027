# Picking random rows in SQL
> `ORDER BY random() LIMIT n` gives n random rows that pass the filters, in one query.

**Problem:** a battle needs, say, 7 rounds of published Career content in both players' languages, not seen recently. Loading every id into Node to shuffle them moves the whole table over the network for 7 rows.

**How:**
- Put every rule in `WHERE`: status, game type, `available_locales @> $locales`, `valid_until > now()`, `NOT (id = ANY($excluded))`.
- `ORDER BY random() LIMIT $count` shuffles only the rows that passed and keeps the first n.
- Fewer rows than asked is an answer too: the bank is short, so the caller relaxes its exposure window and asks again.

**In our code:** `pickRandomContentIds` in [prisma-question-read.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-read.repository.ts).

**Watch out:**
- `random()` is computed for every matching row, then sorted: O(n log n). Fine for thousands of rows per game type. At about 100k, switch to `TABLESAMPLE` or a stored random key with an index.
- Optional filters are added as SQL fragments (`Prisma.sql` / `Prisma.empty`), never by gluing strings together, so values stay parameters.

**Check yourself:** why is `valid_until > now()` checked in SQL instead of in Node?
<details><summary>Answer</summary>One clock decides: the database's. Node's clock can drift, and checking in Node means loading rows only to throw them away.</details>
