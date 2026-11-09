# Transactions (ACID)
> A group of statements that succeed together or fail together.

**Problem:** sign-up writes 5 rows. A crash after row 3 leaves a user with no profile.

**How:**
- **Atomic:** all or nothing. Any error → `ROLLBACK`.
- **Consistent:** constraints hold before and after.
- **Isolated:** concurrent transactions don't see each other's half-done work.
- **Durable:** after `COMMIT`, the data survives a crash.
- `@Transactional()` opens one; nested calls join it through request-scoped context (CLS).

**In our code:** `attempt` in [sign-in.service.ts](../../apps/backend/src/modules/auth/application/sign-in.service.ts), `rotate` in [refresh-session.service.ts](../../apps/backend/src/modules/auth/application/refresh-session.service.ts).

**Watch out:**
- Throwing inside the transaction undoes its writes. That's why `rotate` returns an outcome and the error is thrown after commit.
- Keep transactions short. No network calls inside: we verify Google's token first, because locks are held until commit.

**Check yourself:** why is the Google check outside the transaction?
<details><summary>Answer</summary>A slow HTTP call would hold a database connection and any locks the whole time, starving other requests.</details>
