import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/session/session_controller.dart';
import 'package:the_game/features/home/data/home_repository.dart';

final currentPlayerProfileProvider = FutureProvider.autoDispose<PlayerProfile>(
  (ref) => ref.watch(homeRepositoryProvider).fetchCurrentPlayerProfile(),
);

/// Revokes the session on the server, then forgets the tokens locally. The local part always
/// runs: a player who taps "Sign out" while offline must still end up signed out.
Future<void> signOutOfThisDevice(WidgetRef ref) async {
  try {
    await ref.read(homeRepositoryProvider).revokeCurrentSessionOnServer();
  } on AppError {
    // The server session expires on its own (refresh-token lifetime).
  }
  await ref.read(sessionControllerProvider.notifier).endSession();
}
