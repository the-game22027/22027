# Keyset (cursor) pagination
> "Give me the rows after this one" instead of "skip the first N".

**Problem:** `OFFSET 10000` makes Postgres read and throw away 10,000 rows. If a row is inserted while paging, the user sees duplicates or misses one.

**How:**
- Sort by something unique: `(kickoff_at, id)`. Kickoff alone isn't unique; 10 matches can start at 20:00.
- The cursor stores the last row's `(kickoff_at, id)`. Next page: `kickoff_at > k OR (kickoff_at = k AND id > i)`.
- Fetch `limit + 1` rows. An extra row means there's another page, with no `COUNT`.
- The cursor is opaque base64, so clients can't depend on its shape.

**In our code:** `listMatches` in [football.query.ts](../../apps/backend/src/modules/football/application/football.query.ts) and [prisma-football-read.repository.ts](../../apps/backend/src/modules/football/infrastructure/prisma-football-read.repository.ts), page-walking test in [football.e2e-spec.ts](../../apps/backend/test/e2e/football.e2e-spec.ts). Mixed directions (`points DESC … user_id ASC`) cannot use a row comparison `(a, b) < (x, y)`, so the leaderboard writes the OR chain out: `comesAfter` in [prisma-leaderboard.repository.ts](../../apps/backend/src/modules/leaderboards/infrastructure/prisma-leaderboard.repository.ts).

**Watch out:** you can't jump to page 7. Fine for a scrolling feed; wrong for a numbered table. A cursor is user input, so validate it (`INVALID_CURSOR`).

**Check yourself:** why does the cursor need `id` as well as `kickoff_at`?
<details><summary>Answer</summary>With equal kickoffs spanning a page break, `kickoff_at > k` skips the rest of that group, and `>=` repeats it. The id breaks the tie.</details>
