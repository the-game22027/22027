# Retries, backoff and dead letters
> Retry with growing gaps, and stop after a limit so one bad item can't retry forever.

**Problem:** retrying at once hammers a system that is already struggling. Retrying forever hides a broken event and wastes every poll on it.

**How:**
- **Exponential backoff:** each failure doubles the wait, up to a maximum.
- **Jitter:** a random part of the wait, so items that failed together don't all return together.
- **Dead letter:** after the last attempt, set the item aside with its error and alert a person.
- **Separate outages from bad items:** we don't claim anything while Redis is down, or an outage would use up every event's attempts.

**In our code:** [outbox-retry.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox-retry.ts), `recordFailure` and `deadLetterExhausted` in [outbox.publisher.ts](../../apps/backend/src/shared/infrastructure/outbox/outbox.publisher.ts). Replay steps: `docs/architecture/05-background-jobs.md` §4.

**Watch out:** decide what an attempt means and keep to it. Ours counts publishes **started**, so a crash counts, and work handed back untried doesn't.

**Check yourself:** why count an attempt when the row is claimed, not when the publish fails?
<details><summary>Answer</summary>A publish that crashes the process never reaches the failure code. Counting at claim time means that event still reaches the limit and gets dead-lettered.</details>
