# JWT access tokens
> A signed JSON blob the server can check with a key, without a database lookup.

**Problem:** looking up a session row on every request costs a DB hit. But a token nobody looks up can't be revoked, so it must die fast.

**How:**
- `header.payload.signature`, each part base64url. The payload is **readable by anyone**: it is signed, not encrypted.
- ES256 is asymmetric: the private key signs, the public key verifies. `kid` in the header says which key, so keys can rotate.
- Verify everything: pin `alg` to ES256, check signature, `iss`, `aud`, `exp`.
- Short life (15 min) + a revocable refresh token = fast requests and revocation that works.

**In our code:** [jose-access-tokens.ts](../../apps/backend/src/modules/auth/infrastructure/jose-access-tokens.ts) and its [spec](../../apps/backend/src/modules/auth/infrastructure/jose-access-tokens.spec.ts) (expired, wrong audience, forged key, HS256 trick, edited payload, rotation).

**Watch out:** never let the token pick its own algorithm (`alg: none`, or HS256 signed with your public key). Never put secrets or personal data in the payload.

**Check yourself:** an access token is stolen. What limits the damage?
<details><summary>Answer</summary>It expires within 15 minutes. Revoking the session stops the refresh token, so the thief can't get a new access token.</details>
