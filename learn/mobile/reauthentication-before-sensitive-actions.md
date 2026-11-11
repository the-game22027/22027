# Re-authentication before sensitive actions
> For a destructive action, prove again who you are, recently, not just "this phone has a valid token".

**Problem:** a stolen or forgotten unlocked phone stays signed in for weeks thanks to silent token refresh. Deleting the account should need more than that.

**How:**
- The server measures the time since the **real** sign-in (the oldest session in the family), not since the last refresh (DEC-50). Too old → `403 RECENT_SIGN_IN_REQUIRED`.
- The app asks "Confirm it is you", runs the provider sign-in again, and retries the action once.
- The new sign-in is held **without** starting a session until its `user.id` is compared with the current player.
- Same player: keep the new session, retry `DELETE /v1/me`. Different player: revoke the new session with its own token and delete nothing.

**In our code:** [account_deletion.dart](../../apps/mobile/lib/features/account/application/account_deletion.dart), [account_deletion_test.dart](../../apps/mobile/test/features/account/account_deletion_test.dart), ADR-0017 §6, `docs/architecture/04-auth.md` §8.

**Watch out:**
- The different-account trap: without the id check, picking another Google account in the dialog would delete **that** account.
- Sign-in is also sign-up: re-authenticating with an unknown account creates a new one on the server. Only a dedicated re-auth endpoint avoids it.

**Check yourself:** why not just check the access token's `iat` (issued at)?
<details><summary>Answer</summary>Every silent refresh issues a new access token with a fresh `iat`. Anyone holding the refresh token could pass the check without ever signing in again.</details>
