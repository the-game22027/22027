import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/l10n/generated/app_localizations.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final selectedLanguage = ref.watch(appLanguageControllerProvider);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: ListView(
        children: [
          Padding(
            padding: const EdgeInsetsDirectional.fromSTEB(16, 16, 16, 8),
            child: Text(
              l10n.languageSectionTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          RadioGroup<AppLanguage>(
            groupValue: selectedLanguage,
            onChanged: (language) {
              if (language == null) return;
              ref
                  .read(appLanguageControllerProvider.notifier)
                  .changeLanguage(language);
            },
            child: Column(
              children: [
                for (final language in AppLanguage.values)
                  RadioListTile<AppLanguage>(
                    key: Key('language-${language.code}'),
                    value: language,
                    // Each language is written in itself, so a player can always find their own.
                    title: Text(switch (language) {
                      AppLanguage.arabic => l10n.languageNameArabic,
                      AppLanguage.english => l10n.languageNameEnglish,
                    }),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
