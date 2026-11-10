# Database clock for deadlines
> When a deadline decides who wins, one clock has to be the judge.

**Problem:** with several servers, each has a slightly different time. If Node checks `Date.now()` and then writes later, a prediction can slip in after kickoff.

**How:**
- Put the check in SQL: `kickoff_at > now()`. Every server now uses the same clock.
- In Postgres, `now()` is the **start of the transaction**. It doesn't move while the transaction runs.
- So "the request reached us before kickoff" is what counts, even if it waited a moment for a lock.
- Use the app `Clock` only for display, such as `predictable` or `locked`.

**In our code:** `lockMatchIfPredictable` in [prisma-prediction.repository.ts](../../apps/backend/src/modules/predictions/infrastructure/prisma-prediction.repository.ts). ADR: [0009](../../docs/adr/0009-database-clock-for-deadlines.md).

**Watch out:** Prisma's `@default(now())` can be filled in by the client side. For deadline evidence, write `now()` in the SQL yourself, as we do for `submitted_at`.

**Check yourself:** a user sends a prediction 50 ms before kickoff and it waits 200 ms for a lock. Is it accepted?
<details><summary>Answer</summary>Yes, if its transaction started before kickoff and kickoff didn't move. `now()` is the transaction start, so the wait doesn't count against the user.</details>
