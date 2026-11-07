# Database migrations
> Every schema change is a versioned SQL file in git, applied in order.

**Problem:** "I added a column on my machine" doesn't reach CI, teammates or production. Manual changes drift apart.

**How:**
- Edit the Prisma schema → `npm run prisma:migrate -- --name add_users` generates SQL in `prisma/migrations/` and applies it to your dev DB.
- `npm run prisma:deploy` (`migrate deploy`) applies pending migrations without generating anything. Use it in CI, tests and production.
- Prisma records applied migrations in `_prisma_migrations`.

**In our code:** [prisma/migrations/](../../apps/backend/prisma/migrations/), [global-setup.ts](../../apps/backend/test/support/global-setup.ts) (runs `migrate deploy` on the test container).

**Watch out:** never edit a migration that is already merged. Write a new one. On big tables, a column with a default or a new index can lock writes: split risky changes into steps.

**Check yourself:** why `migrate deploy` and not `migrate dev` in production?
<details><summary>Answer</summary>`dev` can generate new migrations and may offer to reset the DB. `deploy` only applies what was reviewed and committed.</details>
