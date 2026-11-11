import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/app/app.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/application/account_deletion.dart';
import 'package:the_game/features/account/data/google_identity_gateway.dart';
import 'package:the_game/features/account/presentation/sign_in_screen.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/in_memory_token_storage.dart';
import '../../helpers/test_overrides.dart';

const _currentUserId = '0193a000-0000-7000-8000-000000000001';

class _CancellingGoogleGateway implements GoogleIdentityGateway {
  @override
  Future<GoogleIdentityResult> requestGoogleIdToken() async =>
      const GoogleSignInCancelled();

  @override
  Future<void> forgetGoogleAccount() async {}
}

/// `DELETE /v1/me` needs a recent sign-in until the player signs in again.
class _FakeDeletionServer {
  _FakeDeletionServer({required this.requiresRecentSignIn});

  bool requiresRecentSignIn;
  String reauthenticatedUserId = _currentUserId;
  final List<String> receivedRequests = [];
  final List<Object?> logoutAuthorizationHeaders = [];

  ResponseBody answerRequest(RequestOptions request) {
    receivedRequests.add('${request.method} ${request.path}');
    switch ((request.method, request.path)) {
      case ('DELETE', '/v1/me'):
        return requiresRecentSignIn
            ? problemResponse(403, 'RECENT_SIGN_IN_REQUIRED')
            : ResponseBody.fromString('', 202);
      case ('POST', '/v1/_dev/auth/sign-in'):
        requiresRecentSignIn = reauthenticatedUserId != _currentUserId;
        return jsonResponse({
          'accessToken': 'fresh-access',
          'accessTokenExpiresAt': '2030-01-01T00:00:00Z',
          'refreshToken': 'fresh-refresh',
          'user': {...meJson, 'id': reauthenticatedUserId},
          'isNewUser': false,
        });
      case ('POST', '/v1/auth/logout'):
        logoutAuthorizationHeaders.add(request.headers['Authorization']);
        return ResponseBody.fromString('', 204);
      default:
        return jsonResponse(meJson);
    }
  }
}

void main() {
  late InMemoryTokenStorage storage;
  late _FakeDeletionServer server;

  setUp(() {
    storage = InMemoryTokenStorage(testSession);
    server = _FakeDeletionServer(requiresRecentSignIn: false);
  });

  Future<List<Override>> createOverrides() async => [
    ...await createTestOverrides(
      tokenStorage: storage,
      httpClientAdapter: FakeHttpAdapter(server.answerRequest),
    ),
    googleIdentityGatewayProvider.overrideWithValue(_CancellingGoogleGateway()),
  ];

  Future<ProviderContainer> createContainer() async {
    final container = ProviderContainer(overrides: await createOverrides());
    addTearDown(container.dispose);
    await container.read(sessionControllerProvider.future);
    return container;
  }

  test('202 signs out locally and shows the notice', () async {
    final container = await createContainer();

    final outcome = await container
        .read(accountDeletionServiceProvider)
        .requestAccountDeletion();

    expect(outcome, isA<AccountDeletionRequested>());
    expect(storage.session, isNull);
    expect(container.read(accountDeletionNoticeProvider), isTrue);
  });

  test(
    'an old sign-in asks for re-authentication and keeps the session',
    () async {
      server.requiresRecentSignIn = true;
      final container = await createContainer();

      final outcome = await container
          .read(accountDeletionServiceProvider)
          .requestAccountDeletion();

      expect(outcome, isA<ReauthenticationRequired>());
      expect(storage.session, isNotNull);
    },
  );

  test('re-authenticating as the same player retries and deletes', () async {
    server.requiresRecentSignIn = true;
    final container = await createContainer();

    final outcome = await container
        .read(accountDeletionServiceProvider)
        .reauthenticateWithDevAccountAndRequestDeletion('alice');

    expect(outcome, isA<AccountDeletionRequested>());
    expect(server.receivedRequests.last, 'DELETE /v1/me');
    expect(storage.session, isNull);
  });

  test('re-authenticating as another player deletes nothing', () async {
    server
      ..requiresRecentSignIn = true
      ..reauthenticatedUserId = 'someone-else';
    final container = await createContainer();

    final outcome = await container
        .read(accountDeletionServiceProvider)
        .reauthenticateWithDevAccountAndRequestDeletion('bob');

    expect(outcome, isA<ReauthenticatedAsDifferentAccount>());
    expect(server.receivedRequests, isNot(contains('DELETE /v1/me')));
    // The other account's new session is revoked with its own token, not ours.
    expect(server.logoutAuthorizationHeaders, ['Bearer fresh-access']);
    expect(storage.session?.accessToken, testSession.accessToken);
  });

  test('cancelling the Google re-authentication changes nothing', () async {
    server.requiresRecentSignIn = true;
    final container = await createContainer();

    final outcome = await container
        .read(accountDeletionServiceProvider)
        .reauthenticateWithGoogleAndRequestDeletion();

    expect(outcome, isA<ReauthenticationCancelled>());
    expect(server.receivedRequests, ['GET /v1/me']);
    expect(storage.session, isNotNull);
  });

  testWidgets(
    'deleting from the account screen lands on sign-in with a notice',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: await createOverrides(),
          child: const TheGameApp(),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('open-account')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('delete-account')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('confirm-delete-account')));
      await tester.pumpAndSettle();

      expect(find.byType(SignInScreen), findsOneWidget);
      expect(find.byKey(const Key('account-deletion-notice')), findsOneWidget);
    },
  );
}
