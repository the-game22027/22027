import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/home/data/home_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/in_memory_token_storage.dart';
import '../../helpers/test_overrides.dart';

/// A tiny stand-in for the backend's rotation rules: each refresh token works once, and only
/// the latest access token is accepted.
class _FakeAuthServer {
  String validAccessToken = 'not-issued-yet';
  String validRefreshToken = 'refresh-1';
  int refreshCalls = 0;
  int _generation = 1;
  final List<RequestOptions> refreshRequests = [];

  /// The `Authorization` value of every non-refresh request, captured when it arrives
  /// (a retry later changes the same `RequestOptions` object).
  final List<Object?> receivedAuthorizationHeaders = [];

  /// Replaces the normal refresh answer, for failure cases.
  ResponseBody Function(RequestOptions request)? answerRefresh;

  /// When true, even a freshly issued access token is refused.
  bool refuseEveryAccessToken = false;

  ResponseBody answerRequest(RequestOptions request) {
    if (request.path == '/v1/auth/refresh') return _refresh(request);
    receivedAuthorizationHeaders.add(request.headers['Authorization']);
    final isValid =
        request.headers['Authorization'] == 'Bearer $validAccessToken';
    return isValid && !refuseEveryAccessToken
        ? jsonResponse(meJson)
        : problemResponse(401, 'TOKEN_EXPIRED');
  }

  ResponseBody _refresh(RequestOptions request) {
    refreshCalls++;
    refreshRequests.add(request);
    final customAnswer = answerRefresh;
    if (customAnswer != null) return customAnswer(request);

    final body = jsonDecode(request.data as String) as Map<String, Object?>;
    if (body['refreshToken'] != validRefreshToken) {
      return problemResponse(401, 'REFRESH_TOKEN_REUSED');
    }
    _generation++;
    validAccessToken = 'access-$_generation';
    validRefreshToken = 'refresh-$_generation';
    return jsonResponse({
      'accessToken': validAccessToken,
      'accessTokenExpiresAt': '2030-01-01T00:00:00Z',
      'refreshToken': validRefreshToken,
      'user': meJson,
      'isNewUser': false,
    });
  }
}

void main() {
  late _FakeAuthServer server;
  late InMemoryTokenStorage storage;
  late FakeHttpAdapter adapter;

  setUp(() {
    server = _FakeAuthServer();
    storage = InMemoryTokenStorage(
      StoredSession(
        accessToken: 'expired-access',
        accessTokenExpiresAt: DateTime.utc(2020),
        refreshToken: 'refresh-1',
      ),
    );
    adapter = FakeHttpAdapter((request) => server.answerRequest(request));
  });

  Future<ProviderContainer> createSignedInContainer() async {
    final container = ProviderContainer(
      overrides: await createTestOverrides(
        tokenStorage: storage,
        httpClientAdapter: adapter,
      ),
    );
    addTearDown(container.dispose);
    await container.read(sessionControllerProvider.future);
    return container;
  }

  Future<void> fetchProfile(ProviderContainer container) =>
      container.read(homeRepositoryProvider).fetchCurrentPlayerProfile();

  test('an expired token is refreshed once and the request retried', () async {
    final container = await createSignedInContainer();

    await fetchProfile(container);

    expect(server.refreshCalls, 1);
    expect(storage.session?.accessToken, 'access-2');
    expect(storage.session?.refreshToken, 'refresh-2');
    expect(server.receivedAuthorizationHeaders, [
      'Bearer expired-access',
      'Bearer access-2',
    ]);
  });

  test('the refresh request carries no access token', () async {
    final container = await createSignedInContainer();

    await fetchProfile(container);

    expect(
      server.refreshRequests.single.headers,
      isNot(contains('Authorization')),
    );
  });

  test('three parallel 401s cause exactly one refresh', () async {
    final container = await createSignedInContainer();

    await Future.wait([
      fetchProfile(container),
      fetchProfile(container),
      fetchProfile(container),
    ]);

    expect(
      server.receivedAuthorizationHeaders.where(
        (header) => header == 'Bearer expired-access',
      ),
      hasLength(3),
    );
    expect(server.refreshCalls, 1);
    expect(container.read(sessionControllerProvider).value, isNotNull);
  });

  test('a reused refresh token ends the session', () async {
    storage.session = StoredSession(
      accessToken: 'expired-access',
      accessTokenExpiresAt: DateTime.utc(2020),
      refreshToken: 'already-rotated',
    );
    final container = await createSignedInContainer();

    await expectLater(fetchProfile(container), throwsA(isA<ApiProblemError>()));

    expect(container.read(sessionControllerProvider).value, isNull);
    expect(storage.session, isNull);
  });

  test('a disabled account (403 on refresh) ends the session', () async {
    server.answerRefresh = (_) => problemResponse(403, 'ACCOUNT_DISABLED');
    final container = await createSignedInContainer();

    await expectLater(fetchProfile(container), throwsA(isA<ApiProblemError>()));

    expect(container.read(sessionControllerProvider).value, isNull);
  });

  test('no network during the refresh keeps the session', () async {
    server.answerRefresh = (request) => throw DioException.connectionError(
      requestOptions: request,
      reason: 'Connection refused',
    );
    final container = await createSignedInContainer();

    await expectLater(
      fetchProfile(container),
      throwsA(isA<ServerUnreachableError>()),
    );

    expect(container.read(sessionControllerProvider).value, isNotNull);
    expect(storage.session?.refreshToken, 'refresh-1');
  });

  test('429 and 503 during the refresh keep the session', () async {
    for (final status in [429, 503]) {
      server.answerRefresh = (_) => problemResponse(status, 'ANY');
      final container = await createSignedInContainer();

      await expectLater(
        fetchProfile(container),
        throwsA(
          isA<ApiProblemError>().having(
            (error) => error.problem.status,
            'status',
            status,
          ),
        ),
      );

      expect(container.read(sessionControllerProvider).value, isNotNull);
    }
  });

  test(
    'a retry refused again ends the session without a second refresh',
    () async {
      server.refuseEveryAccessToken = true;
      final container = await createSignedInContainer();

      await expectLater(
        fetchProfile(container),
        throwsA(isA<ApiProblemError>()),
      );

      expect(server.refreshCalls, 1);
      expect(container.read(sessionControllerProvider).value, isNull);
    },
  );
}
