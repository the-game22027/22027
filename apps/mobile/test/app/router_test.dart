import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:the_game/app/app.dart';
import 'package:the_game/app/router.dart';
import 'package:the_game/core/routing/app_routes.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/auth/presentation/dev_sign_in_screen.dart';
import 'package:the_game/features/auth/presentation/sign_in_screen.dart';
import 'package:the_game/features/home/presentation/home_screen.dart';

import '../helpers/fake_http_adapter.dart';
import '../helpers/in_memory_token_storage.dart';
import '../helpers/test_overrides.dart';

void main() {
  group('findRedirectForSession', () {
    const signedOut = AsyncData<StoredSession?>(null);
    final signedIn = AsyncData<StoredSession?>(testSession);
    const restoring = AsyncLoading<StoredSession?>();

    test('sends signed-out players to dev sign-in in the dev flavor', () {
      expect(
        findRedirectForSession(
          session: signedOut,
          location: AppRoutes.home,
          isDevFlavor: true,
        ),
        AppRoutes.devSignIn,
      );
    });

    test('sends signed-out players to the sign-in placeholder in prod', () {
      expect(
        findRedirectForSession(
          session: signedOut,
          location: AppRoutes.home,
          isDevFlavor: false,
        ),
        AppRoutes.signIn,
      );
    });

    test('sends signed-in players away from sign-in and splash to home', () {
      for (final location in [
        AppRoutes.devSignIn,
        AppRoutes.signIn,
        AppRoutes.splash,
      ]) {
        expect(
          findRedirectForSession(
            session: signedIn,
            location: location,
            isDevFlavor: true,
          ),
          AppRoutes.home,
        );
      }
    });

    test(
      'keeps everyone on the splash screen while the session is restoring',
      () {
        expect(
          findRedirectForSession(
            session: restoring,
            location: AppRoutes.home,
            isDevFlavor: true,
          ),
          AppRoutes.splash,
        );
      },
    );

    test('lets anyone open server status and settings', () {
      for (final session in [signedOut, signedIn, restoring]) {
        expect(
          findRedirectForSession(
            session: session,
            location: AppRoutes.serverStatus,
            isDevFlavor: false,
          ),
          isNull,
        );
      }
    });
  });

  group('routes per flavor', () {
    Future<List<String>> listRoutePaths(List<Override> overrides) async {
      final container = ProviderContainer(overrides: overrides);
      addTearDown(container.dispose);
      return container
          .read(routerProvider)
          .configuration
          .routes
          .whereType<GoRoute>()
          .map((route) => route.path)
          .toList();
    }

    test('the prod flavor has no dev sign-in route', () async {
      final paths = await listRoutePaths(
        await createTestOverrides(config: prodConfig),
      );

      expect(paths, isNot(contains(AppRoutes.devSignIn)));
      expect(paths, contains(AppRoutes.signIn));
    });

    test('the dev flavor has the dev sign-in route', () async {
      final paths = await listRoutePaths(await createTestOverrides());

      expect(paths, contains(AppRoutes.devSignIn));
    });
  });

  group('app start', () {
    testWidgets('a signed-out player lands on dev sign-in', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: await createTestOverrides(),
          child: const TheGameApp(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(DevSignInScreen), findsOneWidget);
    });

    testWidgets(
      'a signed-out player in prod lands on the sign-in placeholder',
      (tester) async {
        await tester.pumpWidget(
          ProviderScope(
            overrides: await createTestOverrides(config: prodConfig),
            child: const TheGameApp(),
          ),
        );
        await tester.pumpAndSettle();

        expect(find.byType(SignInScreen), findsOneWidget);
      },
    );

    testWidgets('a signed-in player lands on home', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: await createTestOverrides(
            tokenStorage: InMemoryTokenStorage(testSession),
            httpClientAdapter: FakeHttpAdapter((_) => jsonResponse(meJson)),
          ),
          child: const TheGameApp(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
      expect(find.text('Hello, Alice'), findsOneWidget);
    });
  });
}
