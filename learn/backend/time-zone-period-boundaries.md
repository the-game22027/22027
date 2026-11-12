# Period boundaries in a time zone
> Store every instant in UTC; cut weeks and months on the local calendar, then turn those local midnights back into UTC.

**Problem:** "this week" for a player in Cairo starts Monday 00:00 Cairo time, which is Sunday 22:00 UTC in winter and 21:00 UTC in summer. Cutting weeks in UTC moves two or three hours of Sunday night into the wrong week, and a fixed "+2 hours" breaks twice a year.

**How:**
- Find the local day of an instant with `Intl.DateTimeFormat(…, { timeZone })`, do day arithmetic on plain dates, then convert the local midnight back to UTC.
- The offset can change between the guess and the answer (daylight saving), so convert, check the offset at the result, and correct once.
- When the clock jumps over midnight (Cairo, last Friday of April: 00:00 → 01:00), the day starts at the first instant that exists.
- Name periods by keys that never depend on UTC: `2026-W46`, `2026-11`.

**In our code:** [period-calendar.ts](../../apps/backend/src/modules/leaderboards/domain/period-calendar.ts) and its spec (both 2026 Cairo clock changes); config in [leaderboards.dev.json](../../apps/backend/config/leaderboards.dev.json).

**Watch out:**
- A week is not always 7 × 24 hours: the one with the October change is 169 hours.
- Time zone rules change by law (Egypt brought daylight saving back in 2023). They come from the runtime's tz data (`process.versions.tz`), so keep Node updated.

**Check yourself:** why not store points with a `week_key` column computed when they are recorded?
<details><summary>Answer</summary>The key depends on config (time zone, week start). Store the instant (`occurred_at`) and compute keys from config, so a config change only means rebuilding the boards, not rewriting the ledger.</details>
