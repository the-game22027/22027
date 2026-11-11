import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:the_game/app/app.dart';
import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/errors/retry_policy.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/features/auth/data/api_access_token_refresher.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  final config = AppConfig.fromEnvironment();
  // `appFlavor` comes from `--flavor` (Android build flavor). It must match the define file,
  // or a dev-labelled app would talk to the prod URL, or the other way round.
  if (appFlavor != null && appFlavor != config.flavor.name) {
    throw InvalidAppConfigError(
      '--flavor $appFlavor does not match flavor "${config.flavor.name}" in the define file',
    );
  }
  final sharedPreferences = await SharedPreferences.getInstance();

  runApp(
    ProviderScope(
      retry: chooseRetryDelayForFailedProvider,
      overrides: [
        appConfigProvider.overrideWithValue(config),
        sharedPreferencesProvider.overrideWithValue(sharedPreferences),
        accessTokenRefresherProvider.overrideWith(
          (ref) => ref.watch(apiAccessTokenRefresherProvider),
        ),
      ],
      child: const TheGameApp(),
    ),
  );
}
