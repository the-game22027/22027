# Snapshot the rules a game started with
> Read the active rules once, when the game starts, and keep that copy until it ends.

**Problem:** an operator activates new scoring while a battle runs. If completion reads "the active rules" again, two players in the same battle can be scored by different rules, and nobody can say which.

**How:**
- Rules are versioned rows (`scoring_rule_sets`); activating a new one retires the old one in the same transaction. Old versions are never edited.
- The battle copies its mode's section into its config snapshot and stores `rule_set_id` at creation.
- Completion uses only the snapshot. The new version applies from the next battle.
- The module that owns the rules validates them (`battles` checks a BATTLE rule set); the module that stores them (`points`) keeps them as opaque JSON.

**In our code:** `findLeaderboardPointsOfMatchmakingBattle` in [battle-engine.ts](../../apps/backend/src/modules/battles/application/battle-engine.ts); `ScoringRuleSets.activateRuleSet` in [scoring-rule-sets.ts](../../apps/backend/src/modules/points/application/scoring-rule-sets.ts).

**Watch out:** validate at activation, not at use. A bad file found during matchmaking would break every new battle; found by the CLI, it breaks nothing.

**Check yourself:** why does activating the same config twice not create version 2?
<details><summary>Answer</summary>A version should mean "the rules changed". Re-running a deploy script must be safe (idempotent), so equal config is a no-op and the CLI says so.</details>
