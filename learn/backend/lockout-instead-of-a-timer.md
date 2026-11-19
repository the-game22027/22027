# Lockout without a timer
> A "you can't act until T" rule is a timestamp stored in state and compared with the clock on the next command; it needs no scheduled job.

**Problem:** in VAULT a wrong try locks that player out for 3 s, then 6 s, then 9 s. Scheduling an "unlock" timer per wrong try means more timers to cancel at round end, and a lost timer would leave a player locked forever.

**How:**
- `LockoutLadder` keeps, per player, `wrongTries` and `lockedUntil`.
- A wrong try sets `lockedUntil = now + lockoutMs[wrongTries - 1]`; after the last step the last value repeats.
- A new try first asks `findLockedUntil(lockouts, who, now)`: a date means `LOCKED_OUT`, null means go.
- Nothing has to happen when the lockout ends, so nothing is scheduled. Time passing is enough.

**In our code:** [lockout-ladder.ts](../../apps/backend/src/modules/battles/domain/games/shared/lockout-ladder.ts), used by `handleCommand` in [vault-rules.ts](../../apps/backend/src/modules/battles/domain/games/vault-rules.ts). The leaks, which *do* need to happen on their own, use a real timer (`LEAK_TIMER`).

**Watch out:** `now` is passed in (the engine's clock), never `Date.now()` inside the rules, so tests can jump time and replays stay exact. The bot reads the same `lockedUntil` and waits for it instead of hitting `LOCKED_OUT`.

**Check yourself:** why does a leak need a timer but an unlock does not?
<details><summary>Answer</summary>A leak must reach players even if nobody sends anything, so the server has to act on its own. An unlock only matters when the player tries again, and that try brings its own `now` to compare.</details>
