## What and why

<!-- One or two sentences. Link the issue: Closes #123 -->

## Phase / scope

<!-- e.g. P0 Foundation. Anything intentionally left out? -->

## How it was tested

<!-- Unit / integration (Testcontainers) / e2e / WebSocket tests, and the commands you ran -->

## Checklist

- [ ] Follows the layering and module-boundary rules (`docs/architecture/01-modules.md`); `depcheck:boundaries` passes
- [ ] No open business rule hard-coded: TBD values come from config or carry `// TODO(DEC-xx)` (`docs/DECISIONS.md`)
- [ ] Time-critical checks use the DB clock / injected `Clock`, never client time
- [ ] Design change? Updated the relevant doc **and** added/superseded an ADR
- [ ] API change? Updated `docs/api/API.md` / `WEBSOCKET.md` (breaking change → new version) and regenerated the mobile API client (or opened a follow-up issue)
- [ ] New or changed commands documented in `CLAUDE.md` §6
- [ ] No secrets, tokens, or real personal data committed
