# Riverpod providers as dependency injection
> A provider says how to build one object; widgets and other providers ask for it with `ref`; tests replace it with an override.

**Problem:** if `HomeRepository` creates its own `Dio`, a test cannot stop it from calling the real server, and every screen builds its own copy.

**How:**
- Each dependency is a provider: `dioProvider`, `apiClientProvider`, `tokenStorageProvider`, `homeRepositoryProvider`. A provider builds its object from other providers with `ref.watch`.
- Values only known at startup (`AppConfig`, `SharedPreferences`) are providers that throw until `main.dart` overrides them in `ProviderScope`.
- Tests build a `ProviderContainer` (or `ProviderScope`) with overrides: an in-memory token storage, a fake HTTP adapter, a prod config. The code under test is unchanged.
- This is the same idea as NestJS DI on the backend, with providers instead of constructor tokens.

**In our code:** [main.dart](../../apps/mobile/lib/main.dart), [api_client_provider.dart](../../apps/mobile/lib/core/network/api_client_provider.dart), [test_overrides.dart](../../apps/mobile/test/helpers/test_overrides.dart), [interceptors_test.dart](../../apps/mobile/test/core/network/interceptors_test.dart).

**Watch out:**
- `ref.watch` inside `build` rebuilds when the dependency changes; `ref.read` inside callbacks reads once. Watching in a callback or reading in `build` are classic bugs.
- Override at the lowest useful level (the HTTP adapter), so the test still runs the real interceptors and repositories. In M0 the server status screen showed "down" on a healthy backend: its widget test faked the whole repository, so nobody noticed that the generated client cannot parse the untyped health body. [health_repository_test.dart](../../apps/mobile/test/features/server_status/health_repository_test.dart) now goes through the real client.
- Riverpod 3 retries a failed provider on its own (up to 10 times). Retrying a 4xx only repeats the same answer, so we pass our own policy to `ProviderScope(retry: ...)`: [retry_policy.dart](../../apps/mobile/lib/core/errors/retry_policy.dart).

**Check yourself:** why override `httpClientAdapterProvider` rather than `homeRepositoryProvider` in the interceptor tests?
<details><summary>Answer</summary>Because the interceptors are what we test. Replacing the repository would skip them; replacing only the network adapter keeps every real layer between the repository and the wire.</details>
