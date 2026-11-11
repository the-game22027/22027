import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/api_problem.dart';
import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/application/profile_form_errors.dart';
import 'package:the_game/features/account/application/profile_locale_sync.dart';
import 'package:the_game/features/account/data/profile_repository.dart';
import 'package:the_game/features/account/presentation/profile_screen.dart';
import 'package:the_game/features/home/application/home_providers.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/in_memory_token_storage.dart';
import '../../helpers/test_overrides.dart';

void main() {
  final english = lookupAppLocalizations(const Locale('en'));

  Map<String, Object?> readJsonBody(RequestOptions request) =>
      jsonDecode(request.data as String) as Map<String, Object?>;

  Future<ProviderContainer> createContainer(
    FakeHttpAdapter adapter, {
    bool isSignedIn = true,
  }) async {
    final container = ProviderContainer(
      overrides: await createTestOverrides(
        tokenStorage: InMemoryTokenStorage(isSignedIn ? testSession : null),
        httpClientAdapter: adapter,
        savedLanguageCode: 'en',
      ),
    );
    addTearDown(container.dispose);
    await container.read(sessionControllerProvider.future);
    return container;
  }

  group('PATCH /v1/me body', () {
    late FakeHttpAdapter adapter;
    late ProfileRepository repository;

    setUp(() async {
      adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
      repository = (await createContainer(
        adapter,
      )).read(profileRepositoryProvider);
    });

    test('sends only the changed fields', () async {
      await repository.updatePlayerAccountProfile(displayName: 'Alice B');

      expect(readJsonBody(adapter.sentRequests.single), {
        'displayName': 'Alice B',
      });
    });

    test('removing the username sends an explicit null', () async {
      await repository.updatePlayerAccountProfile(removeUsername: true);

      final body = readJsonBody(adapter.sentRequests.single);
      expect(body, {'username': null});
    });

    test('sends the locale as its code', () async {
      await repository.updatePlayerAccountProfile(locale: 'ar');

      expect(readJsonBody(adapter.sentRequests.single), {'locale': 'ar'});
    });
  });

  group('assignProfileSaveErrorToFields', () {
    ProfileFormErrors assign(
      String code, {
      List<ApiFieldError> errors = const [],
    }) => assignProfileSaveErrorToFields(
      ApiProblemError(ApiProblem(status: 400, code: code, errors: errors)),
      english,
    );

    test('puts username and display-name codes on their fields', () {
      expect(assign('USERNAME_TAKEN').username, english.usernameTaken);
      expect(assign('USERNAME_INVALID').username, english.usernameInvalid);
      expect(
        assign('DISPLAY_NAME_INVALID').displayName,
        english.displayNameInvalid,
      );
    });

    test('puts VALIDATION_FAILED field errors on the matching field', () {
      final errors = assign(
        'VALIDATION_FAILED',
        errors: const [ApiFieldError(field: 'username', code: 'maxLength')],
      );

      expect(errors.username, english.fieldValueInvalid);
      expect(errors.displayName, isNull);
      expect(errors.form, isNull);
    });

    test('shows anything else above the form', () {
      final errors = assignProfileSaveErrorToFields(
        const ServerUnreachableError(),
        english,
      );

      expect(errors.form, english.errorServerUnreachable);
    });
  });

  group('app language follows to the profile (DEC-62)', () {
    Future<void> changeLanguageToArabic(ProviderContainer container) async {
      container.listen(profileLocaleSyncProvider, (_, _) {});
      await container
          .read(appLanguageControllerProvider.notifier)
          .changeLanguage(AppLanguage.arabic);
      await pumpEventQueue();
    }

    test('a signed-in language change sends PATCH /v1/me {locale}', () async {
      final adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
      final container = await createContainer(adapter);

      await changeLanguageToArabic(container);

      final request = adapter.sentRequests.single;
      expect(request.method, 'PATCH');
      expect(readJsonBody(request), {'locale': 'ar'});
    });

    test('a failed PATCH keeps the local choice', () async {
      final adapter = FakeHttpAdapter(
        (request) => throw DioException.connectionError(
          requestOptions: request,
          reason: 'offline',
        ),
      );
      final container = await createContainer(adapter);

      await changeLanguageToArabic(container);

      expect(container.read(appLanguageControllerProvider), AppLanguage.arabic);
    });

    test(
      'a saved language change refetches the profile shown on home',
      () async {
        final adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
        final container = await createContainer(adapter);
        container.listen(currentPlayerProfileProvider, (_, _) {});
        await container.read(currentPlayerProfileProvider.future);

        await changeLanguageToArabic(container);

        expect(adapter.sentRequests.map((request) => request.method), [
          'GET',
          'PATCH',
          'GET',
        ]);
      },
    );

    test('a signed-out language change sends nothing', () async {
      final adapter = FakeHttpAdapter((_) => jsonResponse(meJson));
      final container = await createContainer(adapter, isSignedIn: false);

      await changeLanguageToArabic(container);

      expect(adapter.sentRequests, isEmpty);
    });
  });

  testWidgets('a taken username shows its message under the username field', (
    tester,
  ) async {
    final adapter = FakeHttpAdapter(
      (request) => request.method == 'PATCH'
          ? problemResponse(409, 'USERNAME_TAKEN')
          : jsonResponse(meJson),
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: await createTestOverrides(
          tokenStorage: InMemoryTokenStorage(testSession),
          httpClientAdapter: adapter,
        ),
        child: const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ProfileScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('profile-username')), 'bob');
    await tester.tap(find.byKey(const Key('profile-save')));
    await tester.pumpAndSettle();

    expect(find.text('This username is already taken.'), findsOneWidget);
  });
}
