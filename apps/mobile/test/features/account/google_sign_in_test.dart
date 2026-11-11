import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/application/google_sign_in_controller.dart';
import 'package:the_game/features/account/data/google_identity_gateway.dart';
import 'package:the_game/features/account/presentation/sign_in_screen.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

class _FakeGoogleIdentityGateway implements GoogleIdentityGateway {
  _FakeGoogleIdentityGateway(this.result);

  GoogleIdentityResult result;
  bool wasForgotten = false;

  @override
  Future<GoogleIdentityResult> requestGoogleIdToken() async => result;

  @override
  Future<void> forgetGoogleAccount() async => wasForgotten = true;
}

const _configuredDevConfig = AppConfig(
  flavor: AppFlavor.dev,
  apiBaseUrl: 'http://api.test',
  googleServerClientId: 'web-client.apps.googleusercontent.com',
);

Map<String, Object?> _authTokensJson({String locale = 'en'}) => {
  'accessToken': 'google-access',
  'accessTokenExpiresAt': '2030-01-01T00:00:00Z',
  'refreshToken': 'google-refresh',
  'user': {...meJson, 'locale': locale},
  'isNewUser': true,
};

void main() {
  late FakeHttpAdapter adapter;
  late _FakeGoogleIdentityGateway gateway;

  setUp(() {
    adapter = FakeHttpAdapter(
      (_) => jsonResponse(_authTokensJson(), status: 201),
    );
    gateway = _FakeGoogleIdentityGateway(
      const GoogleIdTokenReceived('google-id-token'),
    );
  });

  Future<ProviderContainer> createContainer({String? savedLanguageCode}) async {
    final container = ProviderContainer(
      overrides: [
        ...await createTestOverrides(
          config: _configuredDevConfig,
          httpClientAdapter: adapter,
          savedLanguageCode: savedLanguageCode,
        ),
        googleIdentityGatewayProvider.overrideWithValue(gateway),
      ],
    );
    addTearDown(container.dispose);
    await container.read(sessionControllerProvider.future);
    // Keep the auto-dispose controller alive between the calls of a test.
    container.listen(googleSignInControllerProvider, (_, _) {});
    return container;
  }

  Future<AsyncValue<void>> signInWithGoogle(ProviderContainer container) async {
    await container
        .read(googleSignInControllerProvider.notifier)
        .signInWithGoogle();
    return container.read(googleSignInControllerProvider);
  }

  test(
    'a Google ID token is sent to the backend and starts a session',
    () async {
      final container = await createContainer();

      final state = await signInWithGoogle(container);

      expect(state, isA<AsyncData<void>>());
      final request = adapter.sentRequests.single;
      expect(request.path, '/v1/auth/google');
      expect(
        (jsonDecode(request.data as String) as Map)['idToken'],
        'google-id-token',
      );
      expect(
        container.read(sessionControllerProvider).value?.accessToken,
        'google-access',
      );
    },
  );

  test(
    'cancelling the account picker is not an error and calls nothing',
    () async {
      gateway.result = const GoogleSignInCancelled();
      final container = await createContainer();

      final state = await signInWithGoogle(container);

      expect(state, isA<AsyncData<void>>());
      expect(adapter.sentRequests, isEmpty);
      expect(container.read(sessionControllerProvider).value, isNull);
    },
  );

  test('Google being unavailable on the device is a typed error', () async {
    gateway.result = const GoogleSignInUnavailable('uiUnavailable');
    final container = await createContainer();

    final state = await signInWithGoogle(container);

    expect(state.error, isA<GoogleSignInUnavailableError>());
  });

  test(
    'a token the backend rejects or a disabled account surfaces its code',
    () async {
      for (final (status, code) in [
        (401, 'PROVIDER_TOKEN_INVALID'),
        (403, 'ACCOUNT_DISABLED'),
      ]) {
        adapter = FakeHttpAdapter((_) => problemResponse(status, code));
        final container = await createContainer();

        final state = await signInWithGoogle(container);

        expect(
          state.error,
          isA<ApiProblemError>().having((e) => e.problem.code, 'code', code),
        );
        expect(container.read(sessionControllerProvider).value, isNull);
      }
    },
  );

  group('profile language on sign-in (DEC-62)', () {
    test('a device with no saved language adopts the profile locale', () async {
      adapter = FakeHttpAdapter(
        (_) => jsonResponse(_authTokensJson(locale: 'ar'), status: 201),
      );
      final container = await createContainer();

      await signInWithGoogle(container);

      expect(container.read(appLanguageControllerProvider), AppLanguage.arabic);
    });

    test('a language the player already chose is kept', () async {
      adapter = FakeHttpAdapter(
        (_) => jsonResponse(_authTokensJson(locale: 'ar'), status: 201),
      );
      final container = await createContainer(savedLanguageCode: 'en');

      await signInWithGoogle(container);

      expect(
        container.read(appLanguageControllerProvider),
        AppLanguage.english,
      );
    });
  });

  testWidgets(
    'without a client id the Google button is disabled and explained',
    (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: await createTestOverrides(),
          child: const MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: SignInScreen(),
          ),
        ),
      );

      final button = tester.widget<FilledButton>(
        find.byKey(const Key('continue-with-google')),
      );
      expect(button.onPressed, isNull);
      expect(
        find.text('Google sign-in is not set up for this build.'),
        findsOneWidget,
      );
    },
  );
}
