import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/auth/data/auth_repository.dart';
import 'package:the_game/features/home/data/home_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/in_memory_token_storage.dart';
import '../../helpers/test_overrides.dart';

class _RotatingRefresher implements AccessTokenRefresher {
  int calls = 0;

  @override
  Future<StoredSession?> refreshAccessToken(StoredSession expired) async {
    calls++;
    return StoredSession(
      accessToken: 'rotated-access-token',
      accessTokenExpiresAt: DateTime.utc(2031),
      refreshToken: 'rotated-refresh-token',
    );
  }
}

void main() {
  late List<String> logLines;

  setUp(() {
    logLines = [];
    final originalDebugPrint = debugPrint;
    debugPrint = (message, {wrapWidth}) => logLines.add(message ?? '');
    addTearDown(() => debugPrint = originalDebugPrint);
  });

  Future<ProviderContainer> createSignedInContainer(
    FakeHttpAdapter adapter, {
    TokenStorage? storage,
    List<Override> extraOverrides = const [],
  }) async {
    final container = ProviderContainer(
      overrides: [
        ...await createTestOverrides(
          tokenStorage: storage ?? InMemoryTokenStorage(testSession),
          httpClientAdapter: adapter,
          savedLanguageCode: 'ar',
        ),
        ...extraOverrides,
      ],
    );
    addTearDown(container.dispose);
    await container.read(sessionControllerProvider.future);
    return container;
  }

  test(
    'an authenticated call carries the bearer token, language and a request id',
    () async {
      final adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
      final container = await createSignedInContainer(adapter);

      final profile = await container
          .read(homeRepositoryProvider)
          .fetchCurrentPlayerProfile();

      expect(profile.displayName, 'Alice');
      final headers = adapter.sentRequests.single.headers;
      expect(headers['Authorization'], 'Bearer ${testSession.accessToken}');
      expect(headers['Accept-Language'], 'ar');
      expect(headers['X-Request-Id'], matches(RegExp(r'^[0-9a-f-]{36}$')));
    },
  );

  test('every request gets its own request id', () async {
    final adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
    final container = await createSignedInContainer(adapter);
    final repository = container.read(homeRepositoryProvider);

    await repository.fetchCurrentPlayerProfile();
    await repository.fetchCurrentPlayerProfile();

    final ids = adapter.sentRequests.map((r) => r.headers['X-Request-Id']);
    expect(ids.toSet(), hasLength(2));
  });

  test('Accept-Language follows a language change immediately', () async {
    final adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
    final container = await createSignedInContainer(adapter);

    await container
        .read(appLanguageControllerProvider.notifier)
        .changeLanguage(AppLanguage.english);
    await container.read(homeRepositoryProvider).fetchCurrentPlayerProfile();

    expect(adapter.sentRequests.single.headers['Accept-Language'], 'en');
  });

  test('a public route does not carry the bearer token', () async {
    final adapter = FakeHttpAdapter(
      (_) => jsonResponse({
        'accessToken': 'new-access',
        'accessTokenExpiresAt': '2030-01-01T00:00:00Z',
        'refreshToken': 'new-refresh',
        'user': meJson,
        'isNewUser': true,
      }, status: 201),
    );
    final container = await createSignedInContainer(adapter);

    await container
        .read(authRepositoryProvider)
        .signInWithDevAccount(subject: 'alice');

    expect(
      adapter.sentRequests.single.headers,
      isNot(contains('Authorization')),
    );
  });

  test('a 401 on an authenticated call ends the session', () async {
    final storage = InMemoryTokenStorage(testSession);
    final adapter = FakeHttpAdapter(
      (_) => problemResponse(401, 'TOKEN_EXPIRED'),
    );
    final container = await createSignedInContainer(adapter, storage: storage);

    await expectLater(
      container.read(homeRepositoryProvider).fetchCurrentPlayerProfile(),
      throwsA(isA<ApiProblemError>()),
    );

    expect(container.read(sessionControllerProvider).value, isNull);
    expect(storage.session, isNull);
  });

  test(
    'a 401 retries once with refreshed tokens when a refresher is wired (M1 seam)',
    () async {
      final refresher = _RotatingRefresher();
      final adapter = FakeHttpAdapter(
        (request) =>
            request.headers['Authorization'] == 'Bearer rotated-access-token'
            ? jsonResponse(meJson)
            : problemResponse(401, 'TOKEN_EXPIRED'),
      );
      final container = await createSignedInContainer(
        adapter,
        extraOverrides: [
          accessTokenRefresherProvider.overrideWithValue(refresher),
        ],
      );

      final profile = await container
          .read(homeRepositoryProvider)
          .fetchCurrentPlayerProfile();

      expect(profile.displayName, 'Alice');
      expect(refresher.calls, 1);
      expect(
        container.read(sessionControllerProvider).value?.accessToken,
        'rotated-access-token',
      );
    },
  );

  test('a 401 from a public route keeps the session', () async {
    final adapter = FakeHttpAdapter(
      (_) => problemResponse(401, 'PROVIDER_TOKEN_INVALID'),
    );
    final container = await createSignedInContainer(adapter);

    await expectLater(
      container.read(authRepositoryProvider).signInWithDevAccount(subject: 'x'),
      throwsA(isA<ApiProblemError>()),
    );

    expect(container.read(sessionControllerProvider).value, isNotNull);
  });

  test('network failures become typed errors', () async {
    final timeoutContainer = await createSignedInContainer(
      FakeHttpAdapter(
        (request) => throw DioException.receiveTimeout(
          timeout: const Duration(seconds: 15),
          requestOptions: request,
        ),
      ),
    );
    await expectLater(
      timeoutContainer.read(homeRepositoryProvider).fetchCurrentPlayerProfile(),
      throwsA(isA<RequestTimedOutError>()),
    );

    final unreachableContainer = await createSignedInContainer(
      FakeHttpAdapter(
        (request) => throw DioException.connectionError(
          requestOptions: request,
          reason: 'Connection refused',
        ),
      ),
    );
    await expectLater(
      unreachableContainer
          .read(homeRepositoryProvider)
          .fetchCurrentPlayerProfile(),
      throwsA(isA<ServerUnreachableError>()),
    );
  });

  test(
    'unknown fields and enum values in a response do not break parsing',
    () async {
      final adapter = FakeHttpAdapter(
        (_) => jsonResponse({
          ...meJson,
          'fieldAddedLater': {'nested': true},
          'identities': [
            {'id': 'i-2', 'provider': 'APPLE', 'label': 'new provider'},
          ],
        }),
      );
      final container = await createSignedInContainer(adapter);

      final profile = await container
          .read(homeRepositoryProvider)
          .fetchCurrentPlayerProfile();

      expect(profile.displayName, 'Alice');
    },
  );

  test('the dev log never contains tokens', () async {
    final adapter = FakeHttpAdapter(
      (request) => request.path.contains('/auth/')
          ? jsonResponse({
              'accessToken': 'secret-new-access-token',
              'accessTokenExpiresAt': '2030-01-01T00:00:00Z',
              'refreshToken': 'secret-new-refresh-token',
              'user': meJson,
              'isNewUser': false,
            }, status: 201)
          : jsonResponse(meJson),
    );
    final container = await createSignedInContainer(adapter);

    await container
        .read(authRepositoryProvider)
        .signInWithDevAccount(subject: 'alice');
    await container.read(homeRepositoryProvider).fetchCurrentPlayerProfile();

    expect(logLines, hasLength(2));
    final allLogs = logLines.join('\n');
    expect(allLogs, contains('/v1/me'));
    for (final secret in [
      testSession.accessToken,
      'secret-new-access-token',
      'secret-new-refresh-token',
      'Bearer',
    ]) {
      expect(allLogs, isNot(contains(secret)));
    }
  });
}
