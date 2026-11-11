import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';

/// What the home screen shows about the signed-in player.
class PlayerProfile {
  const PlayerProfile({required this.displayName, required this.locale});

  final String displayName;
  final String locale;
}

class HomeRepository {
  HomeRepository({required MeApi meApi, required AuthApi authApi})
    : _meApi = meApi,
      _authApi = authApi;

  final MeApi _meApi;
  final AuthApi _authApi;

  /// `GET /v1/me`
  Future<PlayerProfile> fetchCurrentPlayerProfile() async {
    final me = await sendRequestAndReadData(_meApi.meControllerGetMeV1);
    return PlayerProfile(displayName: me.displayName, locale: me.locale);
  }

  /// `POST /v1/auth/logout`: revokes this device's session on the server.
  Future<void> revokeCurrentSessionOnServer() =>
      sendRequestWithoutData(_authApi.sessionsControllerLogoutV1);
}

final homeRepositoryProvider = Provider<HomeRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return HomeRepository(
    meApi: apiClient.getMeApi(),
    authApi: apiClient.getAuthApi(),
  );
});
