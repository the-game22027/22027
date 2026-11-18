# TTL: keys that delete themselves
> Give a key a time to live (`EX` seconds, `PX` milliseconds); Redis removes it when the time runs out.

**Problem:** a process crashes before it cleans up. Without a TTL, the "user is in a battle" flag stays forever and the player can never queue again.

**How:**
- Set the value and the TTL in one command: `SET key value EX 7200`. A separate `EXPIRE` after `SET` can be skipped by a crash in between.
- `TTL key` shows seconds left (`-1` no expiry, `-2` no key). `PERSIST` removes the expiry.
- Redis expires keys lazily (when you touch them) and by sampling in the background, so memory is freed soon after, not at the exact millisecond.

**In our code:**
- `ACTIVITY_TTL_SECONDS` (2 hours) in [redis-activity-guard.ts](../../apps/backend/src/modules/battles/infrastructure/redis-activity-guard.ts): a backstop, not the rule. The engine releases the flag normally.
- The rate limit script sets `PEXPIRE` only on the first hit of a window ([redis-throttler.storage.ts](../../apps/backend/src/shared/infrastructure/rate-limit/redis-throttler.storage.ts)).

**Watch out:** a plain `SET key value` drops the existing TTL. Pass `EX` again or use `KEEPTTL`.

**Check yourself:** why does the rate limit script check `hits == 1` before setting the expiry?
<details><summary>Answer</summary>Setting it on every hit would push the window's end forward forever, so a client hitting steadily would never be reset. The window starts at the first hit and ends a fixed time later.</details>
