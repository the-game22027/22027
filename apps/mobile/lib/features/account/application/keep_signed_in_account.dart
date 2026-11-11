import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/application/account_deletion.dart';
import 'package:the_game/features/account/data/auth_repository.dart';
import 'package:the_game/features/account/data/profile_repository.dart';

/// Keeps a new sign-in and lines up the app language with the profile `locale` (DEC-63),
/// then stores the session (the router then leaves the sign-in screen).
///
/// - Existing account, device where the player never chose a language: adopts the profile's
///   one. This comes before the session: while still signed out, the change is not sent back
///   to the profile by `profileLocaleSyncProvider`.
/// - New account: its `locale` is only the server's default, so the app language wins and is
///   sent to the profile instead.
Future<void> keepSignedInAccount(Ref ref, SignedInAccount account) async {
  // TODO(DEC-63): app language vs profile locale; recommended default implemented here and in
  // profile_locale_sync.dart.
  final languageController = ref.read(appLanguageControllerProvider.notifier);
  final profileLanguage = findLanguageByCode(account.profileLocale);
  if (!account.isNewUser &&
      !languageController.hasSavedLanguage &&
      profileLanguage != null) {
    await languageController.changeLanguage(profileLanguage);
  }

  await ref
      .read(sessionControllerProvider.notifier)
      .startSession(account.session);
  ref.read(accountDeletionNoticeProvider.notifier).dismissNotice();

  if (account.isNewUser) {
    await _sendAppLanguageToNewProfile(ref, account.profileLocale);
  }
}

/// Best effort: offline, the profile keeps the server default until the next language change.
Future<void> _sendAppLanguageToNewProfile(Ref ref, String profileLocale) async {
  final appLanguageCode = ref.read(appLanguageControllerProvider).code;
  if (appLanguageCode == profileLocale) return;
  try {
    await ref
        .read(profileRepositoryProvider)
        .updatePlayerAccountProfile(locale: appLanguageCode);
  } on AppError {
    // The sign-in itself succeeded; nothing to show.
  }
}
