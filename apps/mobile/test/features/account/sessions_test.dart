import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/app/app.dart';
import 'package:the_game/features/account/presentation/sign_in_screen.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/in_memory_token_storage.dart';
import '../../helpers/test_overrides.dart';

Map<String, Object?> _sessionJson(String id, {required bool current}) => {
  'id': id,
  'platform': 'android',
  'createdAt': '2026-11-01T10:00:00Z',
  'lastUsedAt': '2026-11-10T21:30:00Z',
  'current': current,
};

void main() {
  late InMemoryTokenStorage storage;
  late List<String> sessionIdsOnServer;
  late FakeHttpAdapter adapter;

  setUp(() {
    storage = InMemoryTokenStorage(testSession);
    sessionIdsOnServer = ['this-phone', 'old-tablet'];
    adapter = FakeHttpAdapter((request) {
      if (request.method == 'DELETE') {
        sessionIdsOnServer.remove(request.path.split('/').last);
        return ResponseBody.fromString('', 204);
      }
      if (request.path == '/v1/auth/logout') {
        return ResponseBody.fromString('', 204);
      }
      if (request.path == '/v1/auth/sessions') {
        return jsonResponse([
          for (final id in sessionIdsOnServer)
            _sessionJson(id, current: id == 'this-phone'),
        ]);
      }
      return jsonResponse(meJson);
    });
  });

  Future<void> openSessionsScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: await createTestOverrides(
          tokenStorage: storage,
          httpClientAdapter: adapter,
        ),
        child: const TheGameApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('open-account')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('open-sessions')));
    await tester.pumpAndSettle();
  }

  Future<void> revokeAndConfirm(WidgetTester tester, String sessionId) async {
    await tester.tap(find.byKey(Key('revoke-session-$sessionId')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('confirm-revoke-session')));
    await tester.pumpAndSettle();
  }

  testWidgets('lists the sessions and marks this device', (tester) async {
    await openSessionsScreen(tester);

    expect(find.byKey(const Key('session-this-phone')), findsOneWidget);
    expect(find.byKey(const Key('session-old-tablet')), findsOneWidget);
    expect(
      find.descendant(
        of: find.byKey(const Key('session-this-phone')),
        matching: find.text('This device'),
      ),
      findsOneWidget,
    );
    expect(find.textContaining('Last used'), findsNWidgets(2));
  });

  testWidgets('revoking another device removes it from the list', (
    tester,
  ) async {
    await openSessionsScreen(tester);

    await revokeAndConfirm(tester, 'old-tablet');

    expect(
      adapter.sentRequests.any(
        (request) =>
            request.method == 'DELETE' &&
            request.path == '/v1/auth/sessions/old-tablet',
      ),
      isTrue,
    );
    expect(find.byKey(const Key('session-old-tablet')), findsNothing);
    expect(storage.session, isNotNull);
  });

  testWidgets('revoking this device signs out', (tester) async {
    await openSessionsScreen(tester);

    await revokeAndConfirm(tester, 'this-phone');

    expect(storage.session, isNull);
    expect(find.byType(SignInScreen), findsOneWidget);
  });
}
