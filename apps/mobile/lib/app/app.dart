import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/app/router.dart';
import 'package:the_game/app/theme.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/features/account/application/profile_locale_sync.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

class TheGameApp extends ConsumerWidget {
  const TheGameApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(profileLocaleSyncProvider);
    final language = ref.watch(appLanguageControllerProvider);
    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      // Setting the locale also sets the text direction: Arabic → right-to-left.
      locale: language.locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      theme: buildAppTheme(Brightness.light),
      darkTheme: buildAppTheme(Brightness.dark),
      routerConfig: ref.watch(routerProvider),
    );
  }
}
