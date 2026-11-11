import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/l10n/app_language_controller.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/data/profile_repository.dart';

/// TODO(DEC-62): recommended default. When a signed-in player changes the app language, the
/// profile `locale` follows, so the server answers in the same language on every device.
/// Best effort: offline, the local choice still applies.
///
/// Watched by the root widget so the listener lives as long as the app.
final profileLocaleSyncProvider = Provider<void>((ref) {
  ref.listen(appLanguageControllerProvider, (previous, next) async {
    if (previous == null || previous == next) return;
    final isSignedIn = ref.read(sessionControllerProvider).value != null;
    if (!isSignedIn) return;
    try {
      await ref
          .read(profileRepositoryProvider)
          .updatePlayerAccountProfile(locale: next.code);
    } on AppError {
      // The next language change sends it again.
    }
  });
});
