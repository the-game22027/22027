import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/session/player_profile_revision.dart';

/// The signed-in player's own profile: `Me` (API §5).
class PlayerAccountProfile {
  const PlayerAccountProfile({
    required this.userId,
    required this.displayName,
    required this.username,
    required this.locale,
    this.avatarUrl,
    this.favouriteTeamId,
    this.linkedIdentities = const [],
    this.predictionVisibility,
  });

  final String userId;
  final String displayName;
  final String? username;
  final String locale;
  final String? avatarUrl;
  final String? favouriteTeamId;

  /// The sign-in providers linked to this account; read only until identity linking ships.
  final List<LinkedIdentity> linkedIdentities;

  /// Read only in v1.0 (DEC-21: friends after kickoff); `null` = the server default.
  final String? predictionVisibility;
}

enum SignInProvider { google, facebook, x, unknown }

class LinkedIdentity {
  const LinkedIdentity({
    required this.id,
    required this.provider,
    required this.label,
  });

  final String id;
  final SignInProvider provider;

  /// What the provider shows for the account, for example an email address.
  final String label;
}

class ProfileRepository {
  ProfileRepository(this._meApi, {void Function()? onProfileChanged})
    : _onProfileChanged = onProfileChanged;

  final MeApi _meApi;
  final void Function()? _onProfileChanged;

  /// `GET /v1/me`
  Future<PlayerAccountProfile> fetchPlayerAccountProfile() async =>
      _convertMeToProfile(
        await sendRequestAndReadData(_meApi.meControllerGetMeV1),
      );

  /// `PATCH /v1/me` with only the given fields: absent fields stay unchanged on the server,
  /// and unknown fields would be rejected (API §1). The `remove…` flags send an explicit
  /// `null`, which clears the field. Returns the profile as the server saved it.
  Future<PlayerAccountProfile> updatePlayerAccountProfile({
    String? displayName,
    String? username,
    bool removeUsername = false,
    String? locale,
    String? avatarUrl,
    bool removeAvatar = false,
    String? favouriteTeamId,
    bool removeFavouriteTeam = false,
  }) async {
    final me = await sendRequestAndReadData(
      () => _meApi.meControllerUpdateMeV1(
        updateMeDto: _UpdateMeRequest(
          displayName: displayName,
          username: username,
          locale: locale == null
              ? null
              : UpdateMeDtoLocaleEnum.values.firstWhere(
                  (value) => value.value == locale,
                ),
          avatarUrl: avatarUrl,
          favouriteTeamId: favouriteTeamId,
          fieldsToClear: {
            if (removeUsername) 'username',
            if (removeAvatar) 'avatarUrl',
            if (removeFavouriteTeam) 'favouriteTeamId',
          },
        ),
      ),
    );
    _onProfileChanged?.call();
    return _convertMeToProfile(me);
  }

  /// `DELETE /v1/me` → `202`: the server signs out every device and deletes the account after
  /// a grace period, unless the player signs in again. `403 RECENT_SIGN_IN_REQUIRED` when the
  /// last real sign-in is too old (DEC-50).
  Future<void> requestAccountDeletion() =>
      sendRequestWithoutData(_meApi.meControllerDeleteMeV1);
}

PlayerAccountProfile _convertMeToProfile(MeDto me) => PlayerAccountProfile(
  userId: me.id,
  displayName: me.displayName,
  username: me.username,
  locale: me.locale,
  avatarUrl: me.avatarUrl,
  favouriteTeamId: me.favouriteTeamId,
  linkedIdentities: [
    for (final identity in me.identities)
      LinkedIdentity(
        id: identity.id,
        provider: switch (identity.provider) {
          IdentityDtoProviderEnum.GOOGLE => SignInProvider.google,
          IdentityDtoProviderEnum.FACEBOOK => SignInProvider.facebook,
          IdentityDtoProviderEnum.X => SignInProvider.x,
          IdentityDtoProviderEnum.unknownDefaultOpenApi =>
            SignInProvider.unknown,
        },
        label: identity.label,
      ),
  ],
  predictionVisibility: me.privacy.predictionVisibility,
);

/// The generated DTO leaves out null fields, but the API clears `username`, `avatarUrl` and
/// `favouriteTeamId` only when it receives an explicit `null` (API §6.2). The generated client
/// calls `toJson()` itself, so overriding it here sends the nulls without editing generated
/// code.
class _UpdateMeRequest extends UpdateMeDto {
  _UpdateMeRequest({
    super.displayName,
    super.username,
    super.locale,
    super.avatarUrl,
    super.favouriteTeamId,
    required this.fieldsToClear,
  });

  final Set<String> fieldsToClear;

  @override
  Map<String, dynamic> toJson() => {
    ...super.toJson(),
    for (final field in fieldsToClear) field: null,
  };
}

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepository(
    ref.watch(apiClientProvider).getMeApi(),
    onProfileChanged: () =>
        ref.read(playerProfileRevisionProvider.notifier).recordProfileChange(),
  ),
);
