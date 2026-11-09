# Public/private keys and key rotation
> The private key signs; the public key can only verify.

**Problem:** with one shared secret (HS256), everything that verifies tokens could also forge them.

**How:**
- ES256: only the API holds the private key. Anyone with the public key can check a signature but can't create one.
- Google works the same way: it signs, we fetch its public keys (JWKS) and verify.
- Each token's header carries a `kid` (key id), saying which key signed it.
- **Rotation:** sign with a new key, keep accepting the old public key until the old tokens expire. Nobody gets logged out.

**In our code:** [jose-access-tokens.ts](../../apps/backend/src/modules/auth/infrastructure/jose-access-tokens.ts), `JWT_PREVIOUS_PUBLIC_KEY` in [app-config.ts](../../apps/backend/src/shared/infrastructure/config/app-config.ts), [generate-jwt-keys.mts](../../apps/backend/scripts/generate-jwt-keys.mts).

**Watch out:** always pin the algorithm when verifying. Trusting the token's own `alg` lets an attacker choose `none`.

**Check yourself:** the private key leaks. Is rotating enough?
<details><summary>Answer</summary>Don't keep the leaked key valid during rotation: drop it immediately. Everyone re-authenticates with their refresh token, which is a small price.</details>
