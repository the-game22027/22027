import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/data/auth_repository.dart';

/// Keeps a new sign-in: stores the session (the router then leaves the sign-in screen) and,
/// on a device where the player never chose a language, adopts the profile's one.
Future<void> keepSignedInAccount(Ref ref, SignedInAccount account) async {
  await ref
      .read(sessionControllerProvider.notifier)
      .startSession(account.session);

  // TODO(DEC-62): app language vs profile locale; recommended default implemented here and in
  // profile_locale_sync.dart.
  final languageController = ref.read(appLanguageControllerProvider.notifier);
  final profileLanguage = findLanguageByCode(account.profileLocale);
  if (!languageController.hasSavedLanguage && profileLanguage != null) {
    await languageController.changeLanguage(profileLanguage);
  }
}
