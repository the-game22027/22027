# Backtracking search
> Build a path one step at a time, undo the last step when it leads nowhere, and keep every path that reaches the end.

**Problem:** a الخيط thread is five rooms where each answer must lead to the next with exactly one right answer. From one final there are dozens of possible next steps, and most chains die before room 5 (a player who scored in no other final, a country that leads nowhere). We need every chain that survives, quickly and in the same order every run.

**How:**
- **Walk:** keep the path so far in a list. For the last room, list the rooms that can follow it (`next_rooms`), each already checked to have one answer.
- **Prune early:** skip a step that breaks a rule now (same hop twice in a row, an answer already used, an unknown player, a country before the last room). A pruned branch never costs more work.
- **Recurse, then undo:** `path.append(room)`, go deeper, then `path.pop()`. That pop is the "backtrack": the same list is reused for every branch, nothing is copied until a path is complete.
- **Stop at the goal:** a path of five rooms is a thread; copy it into the results and return.
- **Deterministic:** sort the candidates the same way every time (hop order, then entity id), so the same knowledge base always gives the same bundle.

**In our code:** `_walk` and `next_rooms` in [threads.py](../../data/kb/threads.py); tests in [test_threads.py](../../data/tests/test_threads.py).

**Watch out:** the number of paths grows fast (each room multiplies them). It stays small here because every hop names one match, so a room has only a few possible next rooms; a hop like "any club he ever played for" would explode the tree.

**Check yourself:** why check "no country before the last room" while walking instead of filtering finished threads afterwards?
<details><summary>Answer</summary>Filtering afterwards is still correct, but the walk would first explore every branch that continues from a country, and they all die later anyway. Pruning at the step cuts the whole subtree at once.</details>
