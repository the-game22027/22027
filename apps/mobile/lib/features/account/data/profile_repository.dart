import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';

/// The editable part of `Me` (API §5).
class PlayerAccountProfile {
  const PlayerAccountProfile({
    required this.userId,
    required this.displayName,
    required this.username,
    required this.locale,
  });

  final String userId;
  final String displayName;
  final String? username;
  final String locale;
}

class ProfileRepository {
  ProfileRepository(this._meApi);

  final MeApi _meApi;

  /// `GET /v1/me`
  Future<PlayerAccountProfile> fetchPlayerAccountProfile() async {
    final me = await sendRequestAndReadData(_meApi.meControllerGetMeV1);
    return PlayerAccountProfile(
      userId: me.id,
      displayName: me.displayName,
      username: me.username,
      locale: me.locale,
    );
  }

  /// `PATCH /v1/me` with only the given fields: absent fields stay unchanged on the server,
  /// and unknown fields would be rejected (API §1).
  Future<void> updatePlayerAccountProfile({
    String? displayName,
    String? username,
    bool removeUsername = false,
    String? locale,
  }) async {
    await sendRequestAndReadData(
      () => _meApi.meControllerUpdateMeV1(
        updateMeDto: _UpdateMeRequest(
          displayName: displayName,
          username: username,
          locale: locale == null
              ? null
              : UpdateMeDtoLocaleEnum.values.firstWhere(
                  (value) => value.value == locale,
                ),
          removeUsername: removeUsername,
        ),
      ),
    );
  }

  /// `DELETE /v1/me` → `202`: the server signs out every device and deletes the account after
  /// a grace period, unless the player signs in again. `403 RECENT_SIGN_IN_REQUIRED` when the
  /// last real sign-in is too old (DEC-50).
  Future<void> requestAccountDeletion() =>
      sendRequestWithoutData(_meApi.meControllerDeleteMeV1);
}

/// The generated DTO leaves out null fields, but the API removes a username only when it
/// receives `"username": null` (API §6.2). The generated client calls `toJson()` itself, so
/// overriding it here sends the null without editing generated code.
class _UpdateMeRequest extends UpdateMeDto {
  _UpdateMeRequest({
    super.displayName,
    super.username,
    super.locale,
    required this.removeUsername,
  });

  final bool removeUsername;

  @override
  Map<String, dynamic> toJson() => {
    ...super.toJson(),
    if (removeUsername) 'username': null,
  };
}

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(ref.watch(apiClientProvider).getMeApi()),
);
