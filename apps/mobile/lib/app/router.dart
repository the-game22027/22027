import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/routing/app_routes.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/account/presentation/dev_sign_in_screen.dart';
import 'package:the_game/features/account/presentation/sign_in_screen.dart';
import 'package:the_game/features/home/presentation/home_screen.dart';
import 'package:the_game/features/server_status/presentation/server_status_screen.dart';
import 'package:the_game/features/settings/presentation/settings_screen.dart';
import 'package:the_game/features/splash/presentation/splash_screen.dart';

/// Screens anyone can open, signed in or not.
const _publicRoutes = {AppRoutes.serverStatus, AppRoutes.settings};

/// The redirect guard, kept pure so it can be tested without widgets.
/// Returns where to go instead of [location], or null to stay.
String? findRedirectForSession({
  required AsyncValue<StoredSession?> session,
  required String location,
  required bool isDevFlavor,
}) {
  if (_publicRoutes.contains(location)) return null;

  final isOnSignInScreen =
      location == AppRoutes.signIn ||
      (isDevFlavor && location == AppRoutes.devSignIn);

  return switch (session) {
    AsyncData(value: null) ||
    AsyncError() => isOnSignInScreen ? null : AppRoutes.signIn,
    AsyncData() =>
      isOnSignInScreen || location == AppRoutes.splash ? AppRoutes.home : null,
    _ => location == AppRoutes.splash ? null : AppRoutes.splash,
  };
}

final routerProvider = Provider<GoRouter>((ref) {
  final config = ref.watch(appConfigProvider);

  // go_router asks for a Listenable; this one fires on every session change so the guard
  // runs again (for example after sign-in, sign-out or a 401).
  final sessionChanges = ValueNotifier<AsyncValue<StoredSession?>>(
    ref.read(sessionControllerProvider),
  );
  ref
    ..listen(
      sessionControllerProvider,
      (_, next) => sessionChanges.value = next,
    )
    ..onDispose(sessionChanges.dispose);

  final router = GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: sessionChanges,
    redirect: (context, state) => findRedirectForSession(
      session: sessionChanges.value,
      location: state.matchedLocation,
      isDevFlavor: config.isDevFlavor,
    ),
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: AppRoutes.signIn,
        builder: (context, state) => const SignInScreen(),
      ),
      if (config.isDevFlavor)
        GoRoute(
          path: AppRoutes.devSignIn,
          builder: (context, state) => const DevSignInScreen(),
        ),
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.serverStatus,
        builder: (context, state) => const ServerStatusScreen(),
      ),
      GoRoute(
        path: AppRoutes.settings,
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
