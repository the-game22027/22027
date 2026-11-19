# 0-1 breadth-first search
> When every step costs 0 or 1, a plain queue that puts free steps at the front finds the cheapest path, with no priority queue.

**Problem:** in HEX two questions come up again and again: did this player just join their two sides, and which open cells are on their cheapest way there? Owned cells cost nothing, open cells cost one pick, the opponent's cells are walls.

**How:**
- Start from every cell on the player's first edge that is not a wall.
- Take the next cell from the front of the queue. For each neighbour: its cost is 0 (own) or 1 (open). If going through here is cheaper than what we knew, remember it and the cell we came from.
- A 0-cost neighbour goes to the **front** of the queue, a 1-cost one to the **back**. So cells come out in cost order, like Dijkstra, in linear time.
- The cheapest cell on the far edge, walked back through "came from", is the path.
- "Connected" is the same search where open cells are walls too: any path at all means the player won.

**In our code:** `findShortestPath` and `findNeighbourCells` in [hex-rules.ts](../../apps/backend/src/modules/battles/domain/games/hex-rules.ts); the bot aims at and blocks with `findShortestPathFor` in [hex-round-runner.ts](../../apps/backend/src/modules/battles/application/rounds/hex-round-runner.ts).

**Watch out:** a hex board with offset rows has two neighbour patterns: even rows look up and down at columns `c-1` and `c`, odd rows at `c` and `c+1`. A wrong offset makes paths that are not real.

**Check yourself:** why not a normal breadth-first search that counts steps?
<details><summary>Answer</summary>It would count owned cells as steps too, so it would prefer a short path through open cells over a longer one through cells the player already has, which is not what "picks still needed" means.</details>
