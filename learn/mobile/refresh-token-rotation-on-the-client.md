# Refresh-token rotation on the client
> After a `401`, swap the refresh token for a new pair once, then retry. Each refresh token works one time only.

**Problem:** the server treats a refresh token presented twice as theft and revokes the whole session family (`REFRESH_TOKEN_REUSED`). Three screens that load at once, all with an expired access token, would each refresh with the same token: the second refresh signs the player out.

**How:**
- One refresh at a time: the auth interceptor is a `QueuedInterceptor`, so `401`s are handled one after the other.
- The "token already changed" rule: a request sent with an access token that is no longer the current one just retries with the current token. Only the first one refreshes.
- Only a refused refresh (`400`/`401`/`403`) signs out. No network, `429` or `5xx` keeps the session: a tunnel is not a sign-out.
- New tokens are saved **before** the retry; retries go through a Dio without the auth interceptor, so a second `401` cannot loop or deadlock.

**In our code:** [auth_interceptor.dart](../../apps/mobile/lib/core/network/auth_interceptor.dart), [api_access_token_refresher.dart](../../apps/mobile/lib/features/account/data/api_access_token_refresher.dart), [token_refresh_test.dart](../../apps/mobile/test/core/network/token_refresh_test.dart) (three parallel `401`s → one refresh), ADR-0017.

**Watch out:**
- Never decide expiry on the device clock; the server's `401` decides.
- A test can lie: Dio reuses the same `RequestOptions` for the retry, so record headers when the fake server receives them, not afterwards.

**Check yourself:** the app dies right after the server rotated the token but before the app saved the new one. What happens at the next launch?
<details><summary>Answer</summary>The app still has the old refresh token. Its next refresh presents an already-rotated token, the server revokes the family, and the player signs in again. Rare, and it fails closed (safe), which is why the tokens are saved before anything else.</details>
