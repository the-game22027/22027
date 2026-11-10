# Secure token storage
> Tokens live in the platform keystore (Android Keystore, iOS Keychain), never in plain preferences.

**Problem:** `shared_preferences` is a plain XML/plist file. On a rooted phone, in a backup, or through a debug build, anyone can read the refresh token and stay signed in as the player for weeks.

**How:**
- `flutter_secure_storage` encrypts values with a key held by the OS keystore; the key never leaves the secure hardware (where available).
- We store three values: `accessToken`, `accessTokenExpiresAt`, `refreshToken`. The session controller reads them at startup, so the player stays signed in after an app restart.
- A `TokenStorage` interface lets tests swap the keystore for an in-memory fake through a Riverpod override.
- Non-secret settings (the app language) stay in `shared_preferences`: cheaper, and synchronous after startup.

**In our code:** [token_storage.dart](../../apps/mobile/lib/core/storage/token_storage.dart), [session_controller.dart](../../apps/mobile/lib/core/session/session_controller.dart).

**Watch out:**
- Android auto-backup can restore encrypted values to a new phone without the key; reading them then fails. The session controller treats an unreadable entry as "signed out" and deletes it instead of crashing.
- The client does not decide that a token is expired: its clock can be wrong. It sends the token and lets a `401` decide (the server is authoritative).

**Check yourself:** why keep `accessTokenExpiresAt` at all if the server decides?
<details><summary>Answer</summary>For M1 refresh: the app can refresh shortly before expiry to avoid a failed request, while still treating the server's `401` as the final word.</details>
