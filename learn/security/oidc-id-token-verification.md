# Verifying a Google ID token (OpenID Connect)
> The app gets a signed JWT from Google; the backend checks it with Google's public keys before trusting who the user is.

**Problem:** if the backend trusts `{ "googleId": "123" }` from the app, anyone can claim to be anyone.

**How:**
- Google signs the ID token (RS256). Its public keys are published as a **JWKS** URL; cache them and refetch when a token names an unknown `kid`.
- Check: signature, `iss` = Google, `aud` = **our** client ids, `exp`.
- The user is `sub` (stable). Email and name are hints only: they can change, and email can be missing.

**In our code:** [jose-google-token-verifier.ts](../../apps/backend/src/modules/auth/infrastructure/jose-google-token-verifier.ts), [fake-google.ts](../../apps/backend/test/support/fake-google.ts) (a local JWKS server, so tests run the real verification code).

**Watch out:** skipping the `aud` check lets a token issued for *someone else's* app sign in to ours. Never use email as the account key.

**Check yourself:** why can't an attacker make their own valid Google ID token?
<details><summary>Answer</summary>They don't have Google's private key. A token signed with any other key fails the signature check against Google's published public keys.</details>
