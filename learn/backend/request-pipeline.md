# The NestJS request pipeline
> Every request passes through the same stages, in a fixed order.

**How:** Middleware → Guards → Interceptors (before) → Pipes → Controller → Interceptors (after) → Exception filters.

| Stage | Job | Ours |
|---|---|---|
| Middleware | Raw request work | Metrics, helmet |
| Guard | May this request continue? | `JwtAuthGuard`, rate limit |
| Interceptor | Wrap the handler | Request language |
| Pipe | Validate and convert input | DTO validation |
| Filter | Turn errors into responses | problem+json |

**In our code:** [jwt-auth.guard.ts](../../apps/backend/src/modules/auth/presentation/jwt-auth.guard.ts), [request-locale.interceptor.ts](../../apps/backend/src/modules/auth/presentation/request-locale.interceptor.ts), [problem-details.filter.ts](../../apps/backend/src/shared/infrastructure/http/problem-details.filter.ts).

**Watch out:** the order is why the language code can use `request.auth`: guards have already run. In middleware it would still be empty.

**Check yourself:** why must the token check run before DTO validation?
<details><summary>Answer</summary>An anonymous caller shouldn't learn your validation rules or cost you the parsing. Reject 401 first.</details>
