# API error codes as typed failures
> The server explains a refusal with a stable problem+json `code`; the app turns the codes it knows into a feature enum.

**Problem:** `catch (e) { if (e.problem.code == 'FRIEND_REQUEST_NOT_PENDING') ... }` spreads magic strings over every screen, and a typo compiles fine.

**How:**
- Each feature lists its codes once, as `Map<String, Reason>` next to its models (`socialFailureReasonsByCode`).
- `convertKnownProblems` wraps a repository call: a known `code` is rethrown as `KnownProblemError<Reason>`; an unknown code, a 5xx or a network failure passes through as the usual `AppError`.
- A screen does `on KnownProblemError<SocialFailureReason> catch (e)` and a `switch` on `e.reason`. The compiler checks the switch is complete.
- The raw `problem` stays attached (status, `traceId`, and `requestId` for `FRIEND_REQUEST_EXISTS`).

**In our code:** [known_problem_error.dart](../../apps/mobile/lib/core/errors/known_problem_error.dart), [social_models.dart](../../apps/mobile/lib/features/social/data/social_models.dart), [friends_repository.dart](../../apps/mobile/lib/features/social/data/friends_repository.dart), [social_test.dart](../../apps/mobile/test/features/social/social_test.dart).

**Watch out:**
- An unknown `code` is not an error in the mapping: the server may add codes (API §8). Keep the fallthrough.
- Never show `problem.detail` to players; it is English for developers. Texts come from the ARB files by `reason`.

**Check yourself:** the server adds `FRIEND_LIMIT_REACHED` to `POST /friend-requests`. What does the old app do?
<details><summary>Answer</summary>`findReasonByCode` returns null, so the `ApiProblemError` is rethrown and the screen shows its generic message. Add the enum value and the map entry to handle it properly.</details>
