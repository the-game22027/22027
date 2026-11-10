import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:the_game/app/app.dart';
import 'package:the_game/core/config/app_config.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';

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
      overrides: [
        appConfigProvider.overrideWithValue(config),
        sharedPreferencesProvider.overrideWithValue(sharedPreferences),
      ],
      child: const TheGameApp(),
    ),
  );
}
