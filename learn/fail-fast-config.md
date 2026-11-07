# Fail-fast config
> Validate all environment variables at startup. If something is missing or wrong, refuse to boot.

**Problem:** a typo in `REDIS_URL` shows up hours later as a crash on the first request that needs Redis, often in production at night.

**How:**
- One zod schema describes every variable: type, default, format.
- `loadConfig()` parses `process.env` once and returns a typed `AppConfig`; the rest of the code never reads `process.env`.
- An ESLint rule bans `process.env` outside the config and bootstrap files.

**In our code:** [app-config.ts](../apps/backend/src/shared/infrastructure/config/app-config.ts), [load-config.ts](../apps/backend/src/bootstrap/load-config.ts), [.env.example](../apps/backend/.env.example) (fake values, committed; the real `.env` is git-ignored).

**Watch out:** never commit real secrets, even "temporary" ones. Git history keeps them forever.

**Check yourself:** why inject `AppConfig` instead of reading `process.env.X` where it's needed?
<details><summary>Answer</summary>Typed, validated once, easy to override in tests (`testConfig({ REDIS_URL: … })`), and all config lives in one place.</details>
