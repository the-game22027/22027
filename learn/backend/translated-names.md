# Translated reference data
> Store every language in the row; pick one when answering.

**Problem:** a team needs an Arabic and an English name. A column per language means a migration per language.

**How:**
- `names jsonb` holds `{"en": "Liverpool", "ar": "ليفربول"}`; `en` is required.
- The API returns one `name`. Language comes from `Accept-Language`, else the user's profile.
- Missing translation → fall back to English rather than showing nothing.

**In our code:** [localized-names.ts](../../apps/backend/src/modules/football/domain/localized-names.ts), [locale.ts](../../apps/backend/src/shared/kernel/locale.ts), [request-locale.interceptor.ts](../../apps/backend/src/modules/auth/presentation/request-locale.interceptor.ts).

**Watch out:** JSONB suits a name with no workflow. Question text uses translation tables instead, because each translation has its own review status.

**Check yourself:** why does the interceptor live in `auth`, not `football`?
<details><summary>Answer</summary>Reading the profile language needs `users`, and `football` must depend on nothing. `auth` sets it on the request; football only reads the result.</details>
