# Out-of-order and duplicate updates
> Networks and retries deliver messages late, twice, or in the wrong order.

**Problem:** "live 1-0" arrives after "finished 2-1" and overwrites the final score.

**How:**
- Store the source's timestamp (`provider_updated_at`).
- Incoming time **≤** stored time → ignore. `<` handles old messages; `=` handles duplicates.
- Identify the record by the source's key: `UNIQUE (provider, provider_match_id)`, so a second delivery can't create a second match.

**In our code:** the first check in [match-lifecycle.ts](../../apps/backend/src/modules/football/domain/match-lifecycle.ts), [apply-provider-match-update.ts](../../apps/backend/src/modules/football/application/apply-provider-match-update.ts), tests in [match-updates.int-spec.ts](../../apps/backend/test/integration/match-updates.int-spec.ts).

**Watch out:** this trusts the source's clock. If a provider has none, use its version number or your own receive order.

**Check yourself:** is this the same as idempotency?
<details><summary>Answer</summary>Related, not the same. Idempotency handles the same message twice. Ordering handles different messages arriving in the wrong order. The `≤` check covers both.</details>
