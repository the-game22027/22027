# ADR-0017: Battle configuration in a validated JSON file

- **Status:** Accepted
- **Date:** 2026-11-11
- **Related:** DEC-31, DEC-32, DEC-33, DEC-39, DEC-43, DEC-44, DEC-54, DEC-60; `08-battle-games.md` §6; ADR-0015

## Context
Every battle number is configuration, and most of them are still open: round count, timers, points, bot wait, bot skill, the exposure window. The product owner picks the values at playtesting. The engine needs them from the first battle (P6.1). There is no place for them yet: `scoring_rule_sets` (the points module) is built at the end of P6 and holds only ledger points (DEC-41), not game timers.

Constraints: zero budget, no admin UI yet, values must never be hard-coded (CLAUDE.md §2.7), and a battle must keep the values it started with even if the config changes mid-battle.

## Decision
- **One JSON file per environment** holds the battle config: per game type (round count, reveal and answer timers, attempts, `showWrongAnswers`, `points.*`, `selection.*`), plus the engine timers (ready timeout, latency grace), matchmaking (`botFallbackAfterMs`) and bot profiles. Its path comes from `BATTLE_CONFIG_PATH`. The repository ships `apps/backend/config/battles.dev.json`.
- **It is validated with zod at boot** (fail fast), like the rest of the app config. A bad file stops the process with the exact path of the problem.
- **`"devOnly": true`** marks a file whose values are placeholders (`DEV_ONLY`, DECISIONS.md §0). A production process refuses to start with such a file, so placeholder values can never reach players by accident.
- **Each battle snapshots** its game type's section into `battles.config` at creation. Changing the file (and restarting) affects new battles only.

## Alternatives considered
| Option | Why not |
|---|---|
| A database table with versions (like `scoring_rule_sets`) | Needs an admin path (CLI or UI) and versioning before any value is known. Worth it if playtesting needs live changes without a restart; the snapshot on each battle makes a later switch painless |
| Environment variables | About 30 nested values per game type; unreadable and untyped |
| Constants in code | Forbidden: open rules must be configuration (CLAUDE.md §2.7) |
| Reuse `scoring_rule_sets` | It is the ledger's rule set (DEC-41), versioned with activation dates for recalculation. Timers and bot skill are not scoring rules and must not trigger ledger recalculation |

## Consequences
- **Good:** typed config from day one; impossible to ship placeholders to production by mistake; battles are reproducible because they carry their config.
- **Bad:** changing a value needs a deploy or restart.
- **Revisit:** if playtesting wants to tune values live, or several API instances need to agree on a config version without a deploy. Then: a versioned `battle_configs` table with the same schema.
