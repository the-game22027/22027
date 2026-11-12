import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/app/app.dart';
import 'package:the_game/features/account/presentation/sign_in_screen.dart';

import '../helpers/test_overrides.dart';

void main() {
  Future<void> pumpAppInLanguage(WidgetTester tester, String code) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: await createTestOverrides(savedLanguageCode: code),
        child: const TheGameApp(),
      ),
    );
    await tester.pumpAndSettle();
  }

  TextDirection readTextDirectionOfScreen(WidgetTester tester) =>
      Directionality.of(tester.element(find.byType(SignInScreen)));

  testWidgets('Arabic renders right-to-left with Arabic text', (tester) async {
    await pumpAppInLanguage(tester, 'ar');

    expect(readTextDirectionOfScreen(tester), TextDirection.rtl);
    expect(find.text('تسجيل الدخول'), findsOneWidget);
  });

  testWidgets('English renders left-to-right', (tester) async {
    await pumpAppInLanguage(tester, 'en');

    expect(readTextDirectionOfScreen(tester), TextDirection.ltr);
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('switching language in settings flips the direction at once', (
    tester,
  ) async {
    await pumpAppInLanguage(tester, 'en');

    await tester.tap(find.byTooltip('Settings'));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('language-ar')));
    await tester.pumpAndSettle();

    expect(find.text('الإعدادات'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('الإعدادات'))),
      TextDirection.rtl,
    );
  });
}
