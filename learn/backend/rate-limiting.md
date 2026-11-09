# Rate limiting
> Cap how many requests one client can make in a time window.

**Problem:** without it, one client can flood sign-in, burn CPU verifying tokens, or guess values forever.

**How:**
- **Fixed window:** `INCR` a Redis key, set an expiry on the first hit, block when the count passes the limit. Answer `429` with `Retry-After`.
- Redis, not memory, so every API instance shares one count.
- A Lua script makes INCR + EXPIRE atomic. If the app died between them, the key would never expire and the client would stay blocked.

**In our code:** [redis-throttler.storage.ts](../../apps/backend/src/shared/infrastructure/rate-limit/redis-throttler.storage.ts), [auth-rate-limit.guard.ts](../../apps/backend/src/shared/infrastructure/rate-limit/auth-rate-limit.guard.ts), [rate-limit.e2e-spec.ts](../../apps/backend/test/e2e/rate-limit.e2e-spec.ts).

**Watch out:**
- Behind a reverse proxy every request has the proxy's IP, so all users share one bucket. `TRUST_PROXY_HOPS` tells Express how many `X-Forwarded-For` hops to believe. Too high, and clients can fake their IP.
- We **fail open**: Redis down means no limit. Failing closed would turn a Redis outage into nobody can sign in.

**Check yourself:** what's the weakness of a fixed window?
<details><summary>Answer</summary>A burst across the boundary: the full limit at the end of one window and again at the start of the next, so double the limit in a moment. A sliding window fixes it at higher cost.</details>
