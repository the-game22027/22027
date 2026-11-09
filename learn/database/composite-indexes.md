# Composite indexes
> One index over several columns, sorted by the first, then the second.

**Problem:** without an index, "matches in this league by date" scans the whole table.

**How:**
- Think of a phone book: sorted by last name, then first name. Last name alone works; first name alone doesn't.
- `(competition_id, kickoff_at)`: jump to the competition, and the rows are already in date order. No sort step.
- Rule of thumb: columns compared with `=` first, then the range or `ORDER BY` column.
- Each index costs writes and disk, so add one per real query.

**In our code:** `@@index` lines on `Match` in [football.prisma](../../apps/backend/prisma/schema/football.prisma): `(kickoff_at)`, `(status, kickoff_at)`, `(competition_id, kickoff_at)`.

**Watch out:** a wrong column order silently gives a slow query. Check with `EXPLAIN ANALYZE`; tiny dev tables can hide the problem because Postgres scans them anyway.

**Check yourself:** will `(status, kickoff_at)` help a query filtering only on `kickoff_at`?
<details><summary>Answer</summary>Not efficiently: it's sorted by status first, so one date is scattered across every status. That's why `(kickoff_at)` exists too.</details>
