# Request id and structured logs
> Every request gets an id that appears in every log line and in the error response.

**Problem:** a user reports "it failed". Among thousands of log lines, which ones belong to their request?

**How:**
- Accept a safe incoming `X-Request-Id`, or generate a UUID. Echo it back in the response header.
- Store it in the request context (CLS, which works like thread-local storage for async code) so any log line can include it.
- Log JSON (pino), not text: machines can filter `requestId = "abc"`.
- **Redact** secrets before they reach the logs: tokens, auth codes, passwords.

**In our code:** [request-id.ts](../../apps/backend/src/shared/infrastructure/request-context/request-id.ts), [logger-options.ts](../../apps/backend/src/shared/infrastructure/logging/logger-options.ts) (redaction), `traceId` in problem+json.

**Watch out:** validate the incoming id (charset, length). Otherwise attackers can inject fake log lines.

**Check yourself:** why is CLS needed in Node when Java uses thread-locals?
<details><summary>Answer</summary>Node runs every request on one thread, interleaved by `await`. CLS (AsyncLocalStorage) keeps data per async call chain instead of per thread.</details>
