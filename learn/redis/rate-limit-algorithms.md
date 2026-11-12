# Rate limit algorithms
> Four common ways to count requests per client; they differ in how they treat bursts at window edges.

**Problem:** a fixed one-minute window allows 2× the limit across a boundary (the last second of one minute plus the first second of the next).

**How:**
| Algorithm | Redis shape | Burst behavior | Cost |
|---|---|---|---|
| Fixed window | `INCR` + expiry per window | Up to 2× at the edge | One key, cheapest |
| Sliding log | Sorted set of timestamps, trim old ones | Exact | One member per request |
| Sliding window counter | Two fixed windows, weighted | Close to exact | Two keys |
| Token bucket | Tokens + last refill time (script) | Allows a set burst, then a steady rate | One hash, a small script |

**In our code:** fixed window per client, `INCR` + `PEXPIRE` in one script ([redis-throttler.storage.ts](../../apps/backend/src/shared/infrastructure/rate-limit/redis-throttler.storage.ts)), used for sign-in. Basics: [rate-limiting](../backend/rate-limiting.md).

**Watch out:** the key decides fairness. Per IP punishes players behind one mobile carrier NAT; per user does not protect sign-in (no user yet). Sign-in limits by IP, the rest later by user.

**Check yourself:** when would you move from fixed window to token bucket?
<details><summary>Answer</summary>When edge bursts matter (an expensive endpoint, abuse at minute boundaries) or when you want "short bursts OK, steady rate limited". For sign-in at launch, fixed window is simple and enough.</details>
