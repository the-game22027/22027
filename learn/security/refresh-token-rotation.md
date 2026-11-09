# Refresh token rotation and reuse detection
> Every refresh swaps the token for a new one. If an old one comes back, someone copied it: kill the whole chain.

**Problem:** a refresh token lives for weeks. If it's stolen, the thief can mint access tokens until it expires.

**How:**
- Each sign-in starts a **family**. Each refresh creates a new session row in that family and marks the old one `ROTATED`.
- A `ROTATED` token presented again → either the user or the thief is replaying it → revoke the **whole family**. Both get signed out; the real user signs in again, the thief can't.
- Sliding expiry (60 days from last use), capped by an absolute limit (180 days) so a family can't live forever.

**In our code:** [refresh-policy.ts](../../apps/backend/src/modules/auth/domain/refresh-policy.ts) (pure rules), [refresh-session.service.ts](../../apps/backend/src/modules/auth/application/refresh-session.service.ts), [refresh.int-spec.ts](../../apps/backend/test/integration/refresh.int-spec.ts).

**Watch out:** throw the error **after** the transaction commits. Throwing inside rolls back the family revocation, and the thief keeps access.

**Check yourself:** the app sends two refreshes at once with the same token (a bug, not an attack). What happens?
<details><summary>Answer</summary>One wins, the other looks like reuse and revokes the family, so the user must sign in again. Strict, but safe. The app should send refreshes one at a time.</details>
