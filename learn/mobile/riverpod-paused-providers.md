# Riverpod 3 pauses providers nobody listens to
> A provider with no listener is paused: its retries and stream updates wait until someone listens again.

**Problem:** a test (or a use case) that only does `await container.read(myProvider.future)` on a provider that fails with a network error never finishes. Riverpod 3 schedules a retry, but the provider has no listener, so the retry never runs and the future stays pending.

**How:**
- Listen first, then read: `container.listen(myProvider, (_, _) {})`, then `await container.read(myProvider.future)`.
- In widgets, `ref.watch` is a listener, so screens are not affected.
- The app's retry policy (`chooseRetryDelayForFailedProvider`) retries only transient failures, 3 times; test containers use the same policy (`createSignedInTestContainer`).

**In our code:** [retry_policy.dart](../../apps/mobile/lib/core/errors/retry_policy.dart), [test_overrides.dart](../../apps/mobile/test/helpers/test_overrides.dart), the catalog tests in [answer_catalog_test.dart](../../apps/mobile/test/features/answer_catalog/answer_catalog_test.dart).

**Watch out:**
- The symptom is a test timeout after 30 s, then "disposed during loading state" — not the real error.
- Application code that awaits a provider's future without a widget watching it needs a listener too (or calls the repository directly).

**Check yourself:** the catalog provider is not `autoDispose`. Why did the test still report it "disposed during loading"?
<details><summary>Answer</summary>The provider stayed paused (no listener) until the test timed out; the container was then disposed at teardown while the provider was still loading.</details>
