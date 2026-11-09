# Optimistic vs pessimistic locking
> Pessimistic: lock first, others wait. Optimistic: don't lock, detect the conflict when writing.

**How:**

| | Pessimistic | Optimistic |
|---|---|---|
| Mechanism | `SELECT … FOR UPDATE` | `UPDATE … WHERE version = 3` |
| On conflict | Second request waits | 0 rows updated → retry or 409 |
| Best when | Conflicts are likely, or the check must block others | Conflicts are rare; user holds a form open for minutes |

**In our code:** provider updates use `FOR UPDATE` in [prisma-match-write.repository.ts](../../apps/backend/src/modules/football/infrastructure/prisma-match-write.repository.ts). It has to be a real lock: a prediction arriving while kickoff moves must wait for the new time. `version` still rises on each change, as a marker of the row's history.

**Watch out:** never hold a database lock while a human decides or during a network call. That's where optimistic wins.

**Check yourself:** a user edits a profile for 5 minutes, then saves. Which one, and why?
<details><summary>Answer</summary>Optimistic. A 5-minute row lock would block everyone else and hold a connection. Check the version when saving.</details>
