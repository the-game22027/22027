# Errors and problem details (RFC 9457)
> The domain throws errors with a stable `code` and a `kind`. One global filter turns them into HTTP responses.

**Problem:** if domain code throws `new HttpException(409)`, business rules depend on HTTP and can't be reused over WebSockets or in a worker. And clients get a different error shape per endpoint.

**How:**
- `DomainError` has `code` (`PREDICTION_LOCKED`) and `kind` (`CONFLICT`). It never has an HTTP status.
- `ProblemDetailsFilter` (`@Catch()`) maps `kind` → status and renders `application/problem+json`: `type`, `title`, `status`, `code`, `instance`, `traceId`.
- Unknown errors become `500 INTERNAL` with no internals leaked.

**In our code:** [domain-error.ts](../../apps/backend/src/shared/kernel/domain-error.ts), [problem-details.ts](../../apps/backend/src/shared/infrastructure/http/problem-details.ts), [problem-details.filter.ts](../../apps/backend/src/shared/infrastructure/http/problem-details.filter.ts).

**Watch out:** clients should branch on `code`, never on the `title` text (it can change or be translated).

**Check yourself:** 400 vs 409 vs 422?
<details><summary>Answer</summary>400: the request is malformed (bad JSON, failed validation). 409: valid, but conflicts with the current state (already joined). 422: well-formed but semantically unprocessable.</details>
