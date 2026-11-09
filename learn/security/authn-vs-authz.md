# Authentication vs authorization
> Authentication: who are you? Authorization: may you do this?

**Problem:** mixing them gives the classic bug: the token is valid, so the API returns anyone's data by id.

**How:**
- **Authn** happens once, in one place: a global guard verifies the JWT and attaches `{userId, sessionId}` to the request. Failure → **401**.
- Secure by default: every route needs a token unless it says `@Public()`. Forgetting a decorator makes a route closed, not open.
- **Authz** happens per resource, in the module that owns it: "is this session yours?". Failure → **403**, or **404** when even its existence is private.

**In our code:** [jwt-auth.guard.ts](../../apps/backend/src/modules/auth/presentation/jwt-auth.guard.ts), [public.decorator.ts](../../apps/backend/src/shared/infrastructure/http/public.decorator.ts), the owner check `findOwned` in [sessions.service.ts](../../apps/backend/src/modules/auth/application/sessions.service.ts).

**Watch out:** a JWT stays valid after revocation until it expires (15 min for us). The guard doesn't touch the database, so sensitive actions like deleting an account re-check the session.

**Check yourself:** why does deleting someone else's session return 404 and not 403?
<details><summary>Answer</summary>403 confirms that id exists. 404 reveals nothing, so ids can't be probed.</details>
