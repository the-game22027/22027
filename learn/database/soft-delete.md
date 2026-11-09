# Soft delete
> Mark a row as deleted instead of removing it.

**Problem:** a real `DELETE` can't be undone, and it breaks everything pointing at that row: leaderboards, prize history, votes.

**How:**
- `status = PENDING_DELETION` and `deleted_at = now`. The row stays; sessions are revoked.
- Grace period: signing in sets the status back to `ACTIVE`.
- Other modules react through outbox events (`UserDeletionRequested`), written in the same transaction.
- Later, personal data is anonymized and the status becomes `DELETED`. Points stay, shown as "Deleted user".

**In our code:** [account-deletion.service.ts](../../apps/backend/src/modules/auth/application/account-deletion.service.ts), `requestDeletion` in [users.facade.ts](../../apps/backend/src/modules/users/application/users.facade.ts).

**Watch out:**
- Every query must now consider the status. One missed filter shows deleted users.
- Soft delete alone doesn't satisfy privacy law: personal data still has to be erased or anonymized.

**Check yourself:** why write the status change and the outbox event in one transaction?
<details><summary>Answer</summary>Otherwise a crash between them leaves a pending user no module heard about, or an event for a change that rolled back.</details>
