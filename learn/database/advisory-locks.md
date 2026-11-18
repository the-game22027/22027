# Advisory locks
> A lock on a number you choose, not on a row or table. Postgres only keeps track of who holds it.

**Problem:** two `questions:import` runs at the same time would both read "this key does not exist yet", both decide INSERT, and one would fail on the unique index halfway through (or worse, both decide on stale data).

**How:**
- `SELECT pg_advisory_xact_lock(hashtext('question-bank:import'))` at the start of the import transaction.
- The second run waits on that line until the first commits or rolls back.
- `_xact_` means it is released automatically when the transaction ends: no unlock call to forget.
- Rows need no `FOR UPDATE`, because there may be no rows yet to lock (new keys).

**In our code:** `waitForOtherImports` in [prisma-question-import.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-import.repository.ts); `waitForOtherChangesOfPair` (one lock per pair of players) in [prisma-social.repository.ts](../../apps/backend/src/modules/social/infrastructure/prisma-social.repository.ts).

**Watch out:** it only protects code that takes the same lock. Anything that writes questions without it is not serialized.

**Check yourself:** why not a row lock on `question_import_batches`?
<details><summary>Answer</summary>The batch row does not exist until we insert it, and two different bundle versions would lock different rows while still touching the same questions.</details>
