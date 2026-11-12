# Library state shared by two apps in one test process
> Some libraries keep process-wide (static) state; two Nest apps started in one test share it, and the last one created wins.

**Problem:** an e2e test started the API, then a worker module to fill the boards, then closed the worker. Every API request then failed with 500: `@nestjs-cls/transactional` keeps one `TransactionHost` per process, the worker had replaced the API's, and closing the worker closed that database client.

**How:**
- Production is fine: the API and the worker are separate processes.
- In tests, either create and close the helper app before the main one (as `battles.e2e-spec.ts` does), or keep it open until `afterAll`.
- When a closed module breaks another, look for `static` maps or module-level singletons in the libraries it uses.

**In our code:** the `afterAll` in [leaderboards.e2e-spec.ts](../../apps/backend/test/e2e/leaderboards.e2e-spec.ts); `TransactionHost._instanceMap` in `@nestjs-cls/transactional`.

**Watch out:** the failure shows up far from its cause (a 500 on an unrelated GET), so note the reason in a comment next to the workaround.

**Check yourself:** why does the same code never fail like this in production?
<details><summary>Answer</summary>The API and the worker run as separate Node processes (`main.api.ts`, `main.worker.ts`), so each has its own static state. Only a test puts both apps in one process.</details>
