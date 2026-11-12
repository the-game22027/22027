# Hide what the caller may not know: answer 404
> When the honest answer would reveal something private ("they blocked you"), answer exactly as if the thing did not exist.

**Problem:** if blocking someone makes their profile answer `403 BLOCKED`, the blocked player learns they were blocked, and can probe ids to map who blocked whom. A different status, message or even response time leaks it.

**How:**
- One answer for "unknown", "deleted" and "blocked either way": `404 USER_NOT_FOUND`, same body.
- Apply it on every path: profile, friend request, search (blocked players simply never appear), and later rooms (`ROOM_NOT_FOUND`) and predictions.
- Check blocks in **both** directions: if A blocked B, B cannot find A and A cannot find B.
- Same idea elsewhere: a question you were never served is `404 QUESTION_NOT_FOUND`, so question ids cannot be probed.

**In our code:** `decideFriendRequest` in [friend-request-rules.ts](../../apps/backend/src/modules/social/domain/friend-request-rules.ts); `getUserProfile` and `searchUsers` in [social-pages.ts](../../apps/backend/src/modules/social/application/social-pages.ts); the "both ways" loop in [social.e2e-spec.ts](../../apps/backend/test/e2e/social.e2e-spec.ts).

**Watch out:** the blocker still sees the block in their own list (`GET /v1/me/blocks`): hiding is for the other side only.

**Check yourself:** why `404` and not `403` for a blocked profile?
<details><summary>Answer</summary>`403` says "it exists, but not for you", which is exactly the private fact. `404` gives the blocked player nothing to learn.</details>
