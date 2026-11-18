# GIN index for "array contains"
> A GIN index lists every element of every array, so `WHERE forms @> ARRAY['x']` finds the rows holding `x` without reading the table.

**Problem:** judging a typed answer asks "is this text exactly the name of another player?". The names live in `answer_entities.search_forms text[]`, 20k+ rows. A B-tree index on an array column only helps compare whole arrays, so the query reads every row, on every answer of every battle.

**How:**
- `@@index([searchForms], type: Gin)` in Prisma creates `CREATE INDEX ... USING GIN (search_forms)`.
- GIN is an inverted index: element → rows, like the index at the back of a book.
- Write the condition as containment, `search_forms @> ARRAY[$form]::text[]`. `$form = ANY(search_forms)` means the same but cannot use the index.
- Other filters (`kind`, `status`) are checked on the few rows the index returns.

**In our code:** `findEntityIdNamedExactly` in [prisma-question-read.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-read.repository.ts); the index in [question-bank.prisma](../../apps/backend/prisma/schema/question-bank.prisma).

**Watch out:**
- GIN makes writes slower than B-tree. Fine here: the catalog changes once per bundle import, and is read on every answer.
- Check the plan with `EXPLAIN` on realistic data. A tiny test table is read sequentially even with the index.

**Check yourself:** why does `x = ANY(arr)` not use the GIN index while `arr @> ARRAY[x]` does?
<details><summary>Answer</summary>Indexes serve operators, not meanings. GIN's array operator class supports `@>`, `<@`, `&&` and `=`; `= ANY` is a scalar comparison repeated per element, which the planner cannot map to the index.</details>
