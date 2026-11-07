# Hashing tokens at rest
> Store only a hash of each refresh token; the real token exists only on the user's device.

**Problem:** databases and backups leak. If they hold real refresh tokens, a leak signs the attacker in as every user.

**How:**
- Generate 32 random bytes (256 bits) → base64url → send to the client once.
- Store `SHA-256(token)` in a `UNIQUE` column. To check a presented token, hash it and look the hash up.
- A leaked hash is useless: you can't reverse SHA-256, and guessing 2^256 values is impossible.

**In our code:** [refresh-token.ts](../../apps/backend/src/modules/auth/application/refresh-token.ts), `refresh_token_hash` in [auth.prisma](../../apps/backend/prisma/schema/auth.prisma).

**Watch out:** the token must never reach logs either (redaction in [logger-options.ts](../../apps/backend/src/shared/infrastructure/logging/logger-options.ts)).

**Check yourself:** passwords use a slow hash (bcrypt/argon2). Why is fast SHA-256 fine here?
<details><summary>Answer</summary>Passwords have little entropy, so attackers brute-force likely guesses; a slow hash makes each guess expensive. A random 256-bit token can't be guessed at all, and a fast deterministic hash lets us find it with an index.</details>
