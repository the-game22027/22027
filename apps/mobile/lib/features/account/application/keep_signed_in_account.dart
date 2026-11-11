import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/data/auth_repository.dart';

/// Keeps a new sign-in: on a device where the player never chose a language, adopts the
/// profile's one (DEC-62), then stores the session (the router then leaves the sign-in screen).
///
/// The language comes first: while still signed out, the change is not sent back to the
/// profile by `profileLocaleSyncProvider`.
Future<void> keepSignedInAccount(Ref ref, SignedInAccount account) async {
  final languageController = ref.read(appLanguageControllerProvider.notifier);
  final profileLanguage = findLanguageByCode(account.profileLocale);
  if (!languageController.hasSavedLanguage && profileLanguage != null) {
    await languageController.changeLanguage(profileLanguage);
  }

  await ref
      .read(sessionControllerProvider.notifier)
      .startSession(account.session);
}
