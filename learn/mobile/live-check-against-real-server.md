# Live check: the client against the real server
> Unit tests check the app against fakes; a live check runs the same data layer against the running backend, to test the assumptions the fakes were built from.

**Problem:** a fake answers what *you* think the server sends. When you misread the contract, the fake and the code agree with each other and every test is green. Our battle fixtures had no `questionId` in `round:result`, so nobody noticed the app dropped it, and a screen could never report a question.

**How:**
- Build the real providers (Dio, the generated client, the Socket.IO connection); swap only what needs a device (secure storage, shared preferences).
- Fresh dev users per test, so runs never depend on each other; leave no queue ticket or battle behind (`play-state` must be idle).
- Play like a screen: react to the state the server builds, never to known answers or local timers.
- Keep it out of `flutter test` and CI (a `live` tag, its own folder); stop at once, with one message, when the backend is down.
- Every mismatch found becomes a unit test built from the **recorded** payload, so the fast suite keeps it fixed.

**In our code:** [test_live/](../../apps/mobile/test_live/) ([live_backend.dart](../../apps/mobile/test_live/live_backend.dart), [live_battle.dart](../../apps/mobile/test_live/live_battle.dart)), [battle_fixtures.dart](../../apps/mobile/test/features/battles/battle_fixtures.dart) (`recorded…Json`).

**Watch out:**
- Parsing without a `FormatException` is not enough: a field the app never reads also parses. Compare raw payloads with the models, field by field.
- A live failure can be your test's wrong idea: a forfeit vs a bot ends `ABANDONED`, not `FORFEIT` (`WEBSOCKET.md` §6.4). Check the contract before "fixing" the app.
- A revoked session still passes requests until its access token expires (a signed JWT is checked without the database, `04-auth.md`). Test revocation through the refresh token, which the server does look up.
- A loop that runs on its own timer (the `VAULT` tries) outlives the test unless the teardown stops it before the container is disposed.

**Check yourself:** why not run the live check in CI instead of the unit tests?
<details><summary>Answer</summary>It needs a running backend, a database with published content and minutes of real timers, and it fails for reasons outside the app (the bot, the data). Unit tests stay fast and exact; the live check is a periodic proof that the fakes still match reality.</details>
