import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';

class SessionsRepository {
  SessionsRepository(this._authApi);

  final AuthApi _authApi;

  /// `POST /v1/auth/logout`: revokes this device's session on the server.
  Future<void> revokeCurrentSessionOnServer() =>
      sendRequestWithoutData(_authApi.sessionsControllerLogoutV1);
}

final sessionsRepositoryProvider = Provider<SessionsRepository>(
  (ref) => SessionsRepository(ref.watch(apiClientProvider).getAuthApi()),
);
