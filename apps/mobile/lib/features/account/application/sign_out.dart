import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/account/data/google_identity_gateway.dart';
import 'package:the_game/features/account/data/sessions_repository.dart';

/// Revokes the session on the server, forgets the Google account, then forgets the tokens
/// locally. The local part always runs: a player who taps "Sign out" while offline must
/// still end up signed out.
Future<void> signOutOfThisDevice(WidgetRef ref) async {
  try {
    await ref.read(sessionsRepositoryProvider).revokeCurrentSessionOnServer();
  } on AppError {
    // The server session expires on its own (refresh-token lifetime).
  }
  try {
    await ref.read(googleIdentityGatewayProvider).forgetGoogleAccount();
  } on Object {
    // Only affects which account the picker preselects next time.
  }
  await ref.read(sessionControllerProvider.notifier).endSession();
}
