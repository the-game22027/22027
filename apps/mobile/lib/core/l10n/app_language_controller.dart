import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The languages the backend supports (`Accept-Language: ar | en`, API §1).
enum AppLanguage {
  arabic('ar'),
  english('en');

  const AppLanguage(this.code);

  final String code;

  Locale get locale => Locale(code);
}

/// Overridden in `main.dart` with the instance loaded before `runApp`, so reading the saved
/// language is synchronous and the first frame already has the right direction.
final sharedPreferencesProvider = Provider<SharedPreferences>(
  (ref) =>
      throw UnimplementedError('sharedPreferencesProvider must be overridden'),
);

class AppLanguageController extends Notifier<AppLanguage> {
  static const _preferenceKey = 'app_language';

  @override
  AppLanguage build() {
    final savedCode = ref
        .watch(sharedPreferencesProvider)
        .getString(_preferenceKey);
    return findLanguageByCode(savedCode) ??
        findLanguageByCode(PlatformDispatcher.instance.locale.languageCode) ??
        AppLanguage.english;
  }

  Future<void> changeLanguage(AppLanguage language) async {
    state = language;
    await ref
        .read(sharedPreferencesProvider)
        .setString(_preferenceKey, language.code);
  }
}

AppLanguage? findLanguageByCode(String? code) =>
    AppLanguage.values.where((language) => language.code == code).firstOrNull;

final appLanguageControllerProvider =
    NotifierProvider<AppLanguageController, AppLanguage>(
      AppLanguageController.new,
    );
