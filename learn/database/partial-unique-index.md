# Partial unique index
> A unique index that only covers the rows matching a `WHERE` condition.

**Problem:** "each question has exactly one correct option" cannot be a normal `UNIQUE (question_id, is_correct)`: that would also allow only one *wrong* option.

**How:**
- `CREATE UNIQUE INDEX ... ON question_options (question_id) WHERE is_correct;`
- Only correct options enter the index, so a second correct option for the same question is a duplicate and the insert fails.
- Wrong options are not in the index at all, so a question can have as many as it needs.
- The database guarantees "at most one". "At least one" is checked by the import code, because an index cannot require a row to exist.

**In our code:** the last statement of [the question-bank migration](../../apps/backend/prisma/migrations/20261110153757_question_bank/migration.sql). Test: `lets the database refuse a second correct option` in [question-import.int-spec.ts](../../apps/backend/test/integration/question-import.int-spec.ts).

**Watch out:** Prisma has no syntax for partial indexes, so it lives as raw SQL in the migration. We checked that `prisma migrate diff` does not report it as drift.

**Check yourself:** why not just trust the import code to check "exactly one"?
<details><summary>Answer</summary>Code paths multiply (import, admin fixes, future tools, manual SQL). The constraint holds for all of them; code checks only hold for the path that has them.</details>
