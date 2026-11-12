# One row per unordered pair
> A friendship between A and B is the same as between B and A: store it once, with a fixed order, so duplicates are impossible.

**Problem:** stored as `(user_id, friend_id)`, both `(A, B)` and `(B, A)` can be inserted, a unique index does not see them as equal, and every query has to look both ways.

**How:**
- Order the pair before storing: `user_low_id < user_high_id` (a `CHECK` enforces it), primary key on both.
- For directed rows that must still be unique per pair (one pending request, whoever sent it), index the ordered pair: `UNIQUE (LEAST(a, b), GREATEST(a, b)) WHERE status = 'PENDING'`.
- Order in code exactly as the database does. UUIDs are lowercase hex of equal length, so string order matches `uuid` order.

**In our code:** `orderFriendPair` in [friend-pair.ts](../../apps/backend/src/modules/social/domain/friend-pair.ts); the constraints at the end of the `social` migration in [prisma/migrations](../../apps/backend/prisma/migrations/).

**Watch out:** lists of "my friends" must read both columns (`WHERE user_low_id = me OR user_high_id = me`) and pick the other id; index both (`PRIMARY KEY` covers low, `IX (user_high_id)` covers high).

**Check yourself:** two players tap "add friend" on each other at the same second. What stops two pending requests?
<details><summary>Answer</summary>The partial unique index on `LEAST/GREATEST` treats both directions as one pair, so the second insert conflicts. We also lock the pair first, so the second request sees the first and answers `FRIEND_REQUEST_EXISTS`.</details>
