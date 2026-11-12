# Append-only ledger
> Never update a score in place: add a row for every award, and compute totals from the rows.

**Problem:** a `users.points` column that each game does `+= 30` on cannot answer "where did these points come from?", cannot be rebuilt after a bug, and cannot tell this week's points from last month's.

**How:**
- One row per award in `point_entries`: who, how many, from what (`source_type`, `source_id`), with which rule set, at what business time (`occurred_at`).
- Leaderboards are projections: a sum over rows in a time window. Delete a board and rebuild it from the ledger.
- A correction is a new row that supersedes the old one (`superseded_at`), never an edit, so the history stays.
- Games compute points; the ledger only records them. The `points` module never knows battle rules.

**In our code:** `listLedgerEntriesOfBattle` in [battle-ledger-entries.ts](../../apps/backend/src/modules/points/domain/battle-ledger-entries.ts); the table in [points.prisma](../../apps/backend/prisma/schema/points.prisma).

**Watch out:**
- Business time ≠ write time. A battle that ended at 23:59 Sunday counts for that week even if the worker records it at 00:01 Monday.
- The ledger grows forever. That is fine with the right indexes (`user_id, category, occurred_at`) and, much later, partitioning by month.

**Check yourself:** why store `rule_set_id` on every entry?
<details><summary>Answer</summary>Rules change. With the rule set on each row you can explain any total, rescore only the entries of one version, and prove a prize ranking used the rules in force at the time.</details>
