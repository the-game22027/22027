import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/storage/token_storage.dart';

/// The player's session. Loading = still reading storage at startup,
/// data(null) = signed out, data(session) = signed in.
class SessionController extends AsyncNotifier<StoredSession?> {
  @override
  Future<StoredSession?> build() async {
    final storage = ref.watch(tokenStorageProvider);
    try {
      return await storage.readSession();
    } on Object {
      // A broken keystore entry (for example after a restore to a new device) cannot be fixed:
      // start signed out instead of crashing at every launch.
      await storage.deleteSession();
      return null;
    }
  }

  Future<void> startSession(StoredSession session) async {
    await ref.read(tokenStorageProvider).writeSession(session);
    state = AsyncData(session);
  }

  /// Forgets the tokens on this device only. Revoking the session on the server is the
  /// caller's job (`POST /v1/auth/logout`), done before this while the token still works.
  Future<void> endSession() async {
    await ref.read(tokenStorageProvider).deleteSession();
    state = const AsyncData(null);
  }
}

final sessionControllerProvider =
    AsyncNotifierProvider<SessionController, StoredSession?>(
      SessionController.new,
    );

/// The access token for outgoing requests, or null when signed out or still restoring.
String? readCurrentAccessToken(Ref ref) =>
    ref.read(sessionControllerProvider).value?.accessToken;
