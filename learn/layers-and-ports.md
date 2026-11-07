# Layers and ports
> Business rules sit in the middle and depend on nothing. Frameworks and databases plug in from the outside.

**Problem:** if the "kickoff lock" rule calls Prisma and `Date.now()` directly, you can't unit-test it without a DB and a real clock, and changing the DB means rewriting rules.

**How:**
- `presentation` (controllers, gateways) → `application` (use cases) → `domain` (pure rules).
- A **port** is an interface the inner layer defines (`Clock`, `FootballDataProvider`). `infrastructure` implements it (`SystemClock`, `MockFootballProvider`).
- Dependencies point inward only. The domain never imports NestJS, Prisma or `process.env`.

**In our code:** [clock.ts](../apps/backend/src/shared/kernel/clock.ts) (port `Clock`, adapters `SystemClock` and `FixedClock` for tests), [modules/README.md](../apps/backend/src/modules/README.md).

**Watch out:** don't add a port "just in case". Add one only to swap an implementation or to control time or randomness in tests.

**Check yourself:** why inject a `Clock` instead of calling `new Date()`?
<details><summary>Answer</summary>Tests can freeze time (`FixedClock`) and check "one second before kickoff" exactly, with no flaky timing.</details>
