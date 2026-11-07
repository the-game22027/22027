# Modular monolith
> One app, one database, one deploy, but split into modules with strict walls.

**Problem:** a plain monolith turns into spaghetti (everything imports everything). Microservices fix that but add network calls, distributed transactions and many deploys: too much for a small team.

**How:**
- Each module (`predictions`, `battles`, …) owns its tables. Nobody else writes to them.
- Modules talk only through the other module's `index.ts` (its public API), or through events.
- A tool (dependency-cruiser) fails the build when someone breaks a wall.

**In our code:** [.dependency-cruiser.cjs](../../apps/backend/.dependency-cruiser.cjs), [ADR-0001](../../docs/adr/0001-modular-monolith.md), `npm run depcheck:boundaries`.

**Watch out:** walls only work if they are enforced by a tool. Rules in a doc alone get broken in a week.

**Check yourself:** when would you split a module into a microservice?
<details><summary>Answer</summary>When you measure a real need: it must scale or deploy independently, or a separate team owns it. Clean module walls make that split cheap later.</details>
