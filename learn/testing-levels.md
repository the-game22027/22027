# Testing levels
> Unit tests for rules, integration tests for the DB and queues, e2e tests for full flows.

**Problem:** mocking the database hides the bugs that matter (SQL, transactions, locks). Testing everything e2e is slow and hard to debug.

**How:**
- **Unit** (`*.spec.ts`): pure domain logic, no Nest, no DB, milliseconds. Most tests live here.
- **Integration** (`*.int-spec.ts`): real Postgres and Redis in throwaway Docker containers (Testcontainers). Tests transactions, `SKIP LOCKED`, queues.
- **E2E** (`*.e2e-spec.ts`): boot the real app, call HTTP with Supertest, assert status and body.

**In our code:** [outbox.int-spec.ts](../apps/backend/test/integration/outbox.int-spec.ts) caught a real deadlock; [http.e2e-spec.ts](../apps/backend/test/e2e/http.e2e-spec.ts); [global-setup.ts](../apps/backend/test/support/global-setup.ts).

**Watch out:** a test that never fails proves nothing. Break the code once on purpose and watch the test go red.

**Check yourself:** where do you test "two publishers never send the same event"?
<details><summary>Answer</summary>Integration, against real Postgres. Only the real database shows how `FOR UPDATE SKIP LOCKED` behaves; a mock would just return whatever you told it to.</details>
