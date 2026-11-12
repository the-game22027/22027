import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/app/app.dart';
import 'package:the_game/features/account/data/google_identity_gateway.dart';
import 'package:the_game/features/account/presentation/sign_in_screen.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/in_memory_token_storage.dart';
import '../../helpers/test_overrides.dart';

class _RecordingGoogleIdentityGateway implements GoogleIdentityGateway {
  bool wasForgotten = false;

  @override
  Future<GoogleIdentityResult> requestGoogleIdToken() async =>
      const GoogleSignInCancelled();

  @override
  Future<void> forgetGoogleAccount() async => wasForgotten = true;
}

void main() {
  late InMemoryTokenStorage storage;
  late _RecordingGoogleIdentityGateway gateway;

  setUp(() {
    storage = InMemoryTokenStorage(testSession);
    gateway = _RecordingGoogleIdentityGateway();
  });

  Future<void> signOutFromAccountScreen(
    WidgetTester tester,
    FakeHttpAdapter adapter,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          ...await createTestOverrides(
            tokenStorage: storage,
            httpClientAdapter: adapter,
          ),
          googleIdentityGatewayProvider.overrideWithValue(gateway),
        ],
        child: const TheGameApp(),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('open-account')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('sign-out')));
    await tester.pumpAndSettle();
  }

  testWidgets(
    'sign-out revokes the session, forgets Google, lands on sign-in',
    (tester) async {
      final adapter = FakeHttpAdapter(
        (request) => request.path == '/v1/auth/logout'
            ? ResponseBody.fromString('', 204)
            : jsonResponse(meJson),
      );

      await signOutFromAccountScreen(tester, adapter);

      expect(
        adapter.sentRequests.map((request) => request.path),
        contains('/v1/auth/logout'),
      );
      expect(gateway.wasForgotten, isTrue);
      expect(storage.session, isNull);
      expect(find.byType(SignInScreen), findsOneWidget);
    },
  );

  testWidgets('sign-out still works offline', (tester) async {
    final adapter = FakeHttpAdapter(
      (request) => request.path == '/v1/auth/logout'
          ? throw DioException.connectionError(
              requestOptions: request,
              reason: 'offline',
            )
          : jsonResponse(meJson),
    );

    await signOutFromAccountScreen(tester, adapter);

    expect(storage.session, isNull);
    expect(find.byType(SignInScreen), findsOneWidget);
  });
}
