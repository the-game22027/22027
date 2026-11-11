# Google sign-in with an ID token
> The app asks Google for a signed ID token (a JWT about the player) and sends it to our backend, which verifies it and issues our own tokens.

**Problem:** the app cannot be trusted to say "this is alice@gmail.com". Anyone can call our API with a made-up email. We need proof signed by Google that our backend can check on its own.

**How:**
- `google_sign_in` 7 shows the account picker and returns an ID token; no Firebase (DEC-25).
- It is initialized with `serverClientId` = our **web** OAuth client id. Google writes that id into the token's `aud` (audience).
- `POST /v1/auth/google {idToken}`: the backend checks Google's signature, `iss`, `exp`, and that `aud` is one of `GOOGLE_CLIENT_IDS`. Then it uses `sub` (Google's user id) as the identity.
- The Android OAuth client is never sent by the app: Google matches it by package name and signing SHA-1.

**In our code:** [google_identity_gateway.dart](../../apps/mobile/lib/features/account/data/google_identity_gateway.dart), [auth_repository.dart](../../apps/mobile/lib/features/account/data/auth_repository.dart), [google_sign_in_test.dart](../../apps/mobile/test/features/account/google_sign_in_test.dart), `docs/architecture/04-auth.md` §3.1.

**Watch out:**
- Client ids are public; client **secrets** never go in an app (anyone can unzip an APK).
- A cancelled account picker is not an error: show nothing.

**Check yourself:** why does the backend check `aud`, if the signature is already Google's?
<details><summary>Answer</summary>Because any app can get a valid Google-signed token for its own client id. Without the `aud` check, a token issued to someone else's app would sign in to ours.</details>
