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
  HomeRepository(this._meApi);

  final MeApi _meApi;

  /// `GET /v1/me`
  Future<PlayerProfile> fetchCurrentPlayerProfile() async {
    final me = await sendRequestAndReadData(_meApi.meControllerGetMeV1);
    return PlayerProfile(displayName: me.displayName, locale: me.locale);
  }
}

final homeRepositoryProvider = Provider<HomeRepository>(
  (ref) => HomeRepository(ref.watch(apiClientProvider).getMeApi()),
);
