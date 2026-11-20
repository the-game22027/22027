# A graph in a plain table
> Store each edge as a row keyed by where you start from, and a one-hop lookup is one index range.

**Problem:** وان تو needs "every player who faced Ramos in a final" in milliseconds, out of about 560,000 edges, on every pass. A graph database would be one more service to run.

**How:**
- An edge is a row: `(from, type, to)`. Make that the primary key, in that order: the B-tree is sorted by `from`, then `type`, so "Ramos + FACED_IN_FINAL" is one contiguous range (see [composite indexes](composite-indexes.md)).
- Store an edge once per direction you read it from. A symmetric link ("faced each other") becomes two rows; a directed one ("set up his goal") becomes `ASSIST_GIVEN` from one end and `ASSIST_RECEIVED` from the other. Twice the rows, but every query starts from the ball.
- Keep counts you need often (`neighbour_count` per entity and type) in a small table filled at import, so an offer never runs `count(*)` over the big one.
- One hop is all the game asks. Multi-hop searches (shortest path, six degrees) are where a graph database starts to pay off.

**In our code:** `EntityLink` and `EntityLinkCount` in [question-bank.prisma](../../apps/backend/prisma/schema/question-bank.prisma); `findLinkedAnswers` and `countUnusedLinks` in [prisma-question-read.repository.ts](../../apps/backend/src/modules/question-bank/infrastructure/prisma-question-read.repository.ts); the readings in [link-graph.ts](../../apps/backend/src/modules/question-bank/domain/link-graph.ts). Decision: ADR-0024.

**Watch out:** replacing the whole graph with `TRUNCATE` locks readers out until the import commits; `DELETE` keeps old rows visible to running battles (MVCC) until then.

**Check yourself:** why is the key `(from, type, to)` and not `(type, from, to)`?
<details><summary>Answer</summary>Both find "Ramos + FACED_IN_FINAL" as one range. But a query with only `from` (for example all of Ramos's links) can use `(from, …)` and not `(type, …)`. Equality columns first, the most selective one leading.</details>
