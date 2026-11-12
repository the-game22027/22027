# MULTI/EXEC, pipelines and Lua scripts
> Three ways to send several commands: a pipeline saves round trips, MULTI/EXEC runs them together, a Lua script can also decide.

**Problem:** "remove the ticket from the queue and delete its data" is two commands. Sent one by one, another client can run in between, or a crash leaves half the change.

**How:**
| Tool | Atomic? | Can read then decide? | Use for |
|---|---|---|---|
| Pipeline | No | No | Many independent commands, fewer network trips |
| `MULTI` … `EXEC` | Yes, runs as one block | No: results come after `EXEC` | Writes that must happen together |
| Lua (`EVAL`) | Yes | Yes: `if GET == x then …` | Read, check, write as one step |

- `WATCH key` + `MULTI` gives optimistic locking (`EXEC` fails if the key changed). A script is usually simpler.
- Redis does not roll back: if one command in `MULTI` fails, the others still apply. Validate first.

**In our code:** `addTicket` uses `multi()` (ticket data and queue entry together); `TAKE_OLDEST_PAIR`, `REMOVE_TICKET` and `TAKE_QUEUED_BEFORE` are Lua in [redis-matchmaking-queue.ts](../../apps/backend/src/modules/battles/infrastructure/redis-matchmaking-queue.ts). Deeper: [atomic-redis-scripts](../database/atomic-redis-scripts.md).

**Watch out:** a script blocks Redis while it runs. Keep scripts short and bounded (`LIMIT 0 100` in `TAKE_QUEUED_BEFORE`).

**Check yourself:** why can `takeOldestPair` not be a `MULTI` block?
<details><summary>Answer</summary>It must read the two oldest ids and then remove exactly those. `MULTI` cannot use a result inside the same block; a script can.</details>
