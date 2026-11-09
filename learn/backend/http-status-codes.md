# HTTP status codes that matter
> The status tells the client what to do next, without reading the body.

**How:**

| Code | Means | Ours |
|---|---|---|
| 200 / 201 | OK / created | Sign-in: 201 new account, 200 existing |
| 202 | Accepted, finishes later | `DELETE /v1/me` |
| 204 | Done, no body | Logout |
| 400 | Malformed input | Validation failed |
| 401 | I don't know who you are | Bad token → refresh or sign in |
| 403 | I know you, and no | Account disabled |
| 404 | Not there, or not yours to know | Someone else's session |
| 409 | Conflicts with current state | Username taken |
| 429 | Slow down | Rate limited |

**In our code:** domain errors have a `kind`, mapped once in [problem-details.ts](../../apps/backend/src/shared/infrastructure/http/problem-details.ts).

**Watch out:** the app's reaction depends on this. Treat 403 like 401 and it will loop refreshing forever. 5xx means our bug; 4xx means the client must change something.

**Check yourself:** valid token, but the username is taken. Which code, and why not 400?
<details><summary>Answer</summary>409. The request is well formed; it conflicts with existing data. The same request would succeed for a free name.</details>
