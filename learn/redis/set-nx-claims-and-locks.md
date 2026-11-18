# SET NX: claims and simple locks
> `SET key value NX EX n` writes only if the key does not exist, so exactly one caller wins the claim.

**Problem:** a player taps "play" on two phones at once. Both requests check "not busy", both say yes, and the player sits in two battles.

**How:**
- Claim: `SET act:<user> QUEUE:<ticket> NX EX 7200` returns `OK` for the winner and nothing for the loser.
- Release only what you own: compare the value, then delete, in one Lua script (compare-and-delete). A plain `DEL` could remove a newer claim made after yours expired.
- Move between states the same way (compare-and-set): `QUEUE:<ticket>` → `BATTLE:<id>` only if the key still holds that ticket.

**In our code:** `claimActivity`, `replaceActivity` (`REPLACE_IF_CURRENT`) and `releaseActivity` (`DELETE_IF_CURRENT`) in [redis-activity-guard.ts](../../apps/backend/src/modules/battles/infrastructure/redis-activity-guard.ts).

**Watch out:**
- If the work outlives the TTL, the claim disappears while you still act on it. Pick a TTL far longer than the work, or renew it (a heartbeat).
- On several Redis primaries a single `SET NX` is not a safe lock. Redlock exists for that and is debated; for correctness, prefer a database constraint or a fencing token.

**Check yourself:** why store `QUEUE:<ticketId>` as the value and not just `1`?
<details><summary>Answer</summary>The value proves ownership. A late "release my queue ticket" can check it still holds *that* ticket, so it never frees a battle claimed after it.</details>
