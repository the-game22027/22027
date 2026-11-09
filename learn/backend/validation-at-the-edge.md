# Validate at the edge, and again in the domain
> The DTO checks the shape of the input; the domain checks the business rule.

**Problem:** with only DTO checks, a worker or another module can write bad data. With only domain checks, every use case handles garbage types.

**How:**
- **Edge** (`class-validator`): right type, right length, no unknown fields (`forbidNonWhitelisted` stops someone sending `status`).
- **Domain:** rules that need meaning or config: a blank name after trimming, the username pattern.
- **Database:** the last guard for what only it can see: `UNIQUE` on username.

**In our code:** [update-me.dto.ts](../../apps/backend/src/modules/auth/presentation/dto/update-me.dto.ts), [display-name.ts](../../apps/backend/src/modules/users/domain/display-name.ts), `updateProfile` in [prisma-user.repository.ts](../../apps/backend/src/modules/users/infrastructure/prisma-user.repository.ts).

**Watch out:** `@IsOptional()` also allows `null`. For a field that can be omitted but never null, use `@ValidateIf(value !== undefined)`.

**Check yourself:** why not check "is this username free?" in the DTO?
<details><summary>Answer</summary>It's a race: two users can pass the check at once. Only the UNIQUE constraint is safe, so we catch its error and return 409.</details>
