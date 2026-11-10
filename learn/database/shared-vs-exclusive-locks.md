# Shared vs exclusive row locks
> Readers who need a row to stay the same can share it. A writer needs it alone.

**Problem:** a prediction checks "kickoff is in the future", and at that moment the provider moves kickoff earlier. Both succeed, and a prediction is accepted against an old kickoff.

**How:**
- `FOR SHARE`: many transactions can hold it. Nobody can change the row until they finish.
- `FOR UPDATE`: only one holder, and it also blocks `FOR SHARE`.
- Predictions take `FOR SHARE` on the match, so thousands can run at once.
- A kickoff change takes `FOR UPDATE`, so it waits for them, and they wait for it.
- After waiting, Postgres checks the `WHERE` again against the new row.

**In our code:** `lockMatchIfPredictable` in [prisma-prediction.repository.ts](../../apps/backend/src/modules/predictions/infrastructure/prisma-prediction.repository.ts) and `findForUpdate` in [prisma-match-write.repository.ts](../../apps/backend/src/modules/football/infrastructure/prisma-match-write.repository.ts). Test: "refuses when kickoff is moved earlier" in [predictions.int-spec.ts](../../apps/backend/test/integration/predictions.int-spec.ts).

**Watch out:** locks last until commit, so never make a network call while holding one.

**Check yourself:** why not use `FOR UPDATE` for predictions too?
<details><summary>Answer</summary>Predictions on the same match would run one at a time. At kickoff, when everyone submits, they would all queue behind each other for no benefit.</details>
