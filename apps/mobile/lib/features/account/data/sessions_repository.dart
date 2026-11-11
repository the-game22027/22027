import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';

/// One signed-in device (`SessionInfo`, API §5).
class PlayerSession {
  const PlayerSession({
    required this.id,
    required this.deviceName,
    required this.platform,
    required this.lastUsedAt,
    required this.isThisDevice,
  });

  final String id;
  final String? deviceName;
  final String? platform;

  /// Null when the server sends a date the app cannot read; the row still shows.
  final DateTime? lastUsedAt;
  final bool isThisDevice;
}

class SessionsRepository {
  SessionsRepository(this._authApi);

  final AuthApi _authApi;

  /// `GET /v1/auth/sessions`
  Future<List<PlayerSession>> fetchSignedInSessions() async {
    final sessions = await sendRequestAndReadData(
      _authApi.sessionsControllerListV1,
    );
    return [
      for (final session in sessions)
        PlayerSession(
          id: session.id,
          deviceName: session.deviceName,
          platform: session.platform,
          lastUsedAt: DateTime.tryParse(session.lastUsedAt),
          isThisDevice: session.current,
        ),
    ];
  }

  /// `DELETE /v1/auth/sessions/{sessionId}`: signs that device out.
  Future<void> revokeSessionOnServer(String sessionId) =>
      sendRequestWithoutData(
        () => _authApi.sessionsControllerRevokeV1(sessionId: sessionId),
      );

  /// `POST /v1/auth/logout`: revokes this device's session on the server.
  Future<void> revokeCurrentSessionOnServer() =>
      sendRequestWithoutData(_authApi.sessionsControllerLogoutV1);
}

final sessionsRepositoryProvider = Provider<SessionsRepository>(
  (ref) => SessionsRepository(ref.watch(apiClientProvider).getAuthApi()),
);
