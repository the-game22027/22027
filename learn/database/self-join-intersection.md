# Intersecting two neighbour lists with a self-join
> Join a table to itself on the shared column, and "in both lists" becomes one query on two index ranges.

**Problem:** a الكوبري line needs every player who scored against both Real Madrid and Bayern. That is two neighbour lists from the same graph table (`entity_links`), and only the players in both count.

**How:**
- Give the table two aliases, one per list: `first_link` for Real Madrid's `CONCEDED_TO` rows, `second_link` for Bayern's.
- Join them on the column they share, the neighbour: `second_link.to_entity_id = first_link.to_entity_id`. A row survives only when the player is in both lists: that is the intersection.
- Each side starts with an equality on the primary key prefix `(from_entity_id, pass_type)`, so Postgres reads two small index ranges instead of the whole table (see [graph in a table](graph-in-a-table.md)).
- Join every other table you need once per side when the two sides carry different facts: here each link has its own evidence match, so `link_matches` is joined twice.
- The alternative, two queries and an intersection in Node, sends every scorer of both clubs over the wire to keep a few dozen.

**In our code:** `findCommonNeighbours` in [prisma-question-read.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-read.repository.ts); the generator does the same in Python with sets (`scorers_by_club` in [bridges.py](../../data/kb/bridges.py)) to check every board line before it is written.

**Watch out:** a self-join on a non-unique column multiplies rows (every pair of matches). It is safe here because `(from, pass_type, to)` is the primary key: one row per club and player on each side.

**Check yourself:** why can the query not start from `to_entity_id` (the players) instead?
<details><summary>Answer</summary>The key is ordered `(from, pass_type, to)`, so `to` alone is not a range in the index. We know the clubs, not the players: start from what you know, and let the join find the rest.</details>
