# State machines
> A list of allowed states and the only moves between them.

**Problem:** with a bare `status` column, a late message can move a finished match back to live, and scoring runs twice.

**How:**
- One table of legal moves: `LIVE → FINISHED` yes, `FINISHED → LIVE` no.
- A pure function takes the current state and the update, and returns a plan: what to change, which events to publish. No database, so every pair of states is cheap to test.
- Events come from the **transition**, so a repeated "finished" message publishes nothing.

**In our code:** [match-lifecycle.ts](../../apps/backend/src/modules/football/domain/match-lifecycle.ts); its [spec](../../apps/backend/src/modules/football/domain/match-lifecycle.spec.ts) checks all 36 state pairs.

**Watch out:** real data skips states. A provider polled hourly can jump from `SCHEDULED` to `FINISHED`, so we treat that as passing through `LIVE`.

**Check yourself:** why return a plan instead of saving inside the function?
<details><summary>Answer</summary>The rules stay pure and testable, and the caller decides the transaction, so state and events commit together.</details>
