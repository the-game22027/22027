import 'package:api_client/api_client.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/storage/token_storage.dart';

/// The result of a sign-in, before the app decides to keep it.
///
/// Deletion re-authentication compares [userId] with the current player before storing
/// [session]: signing in as someone else must never delete their account (ADR-0017 §6).
class SignedInAccount {
  const SignedInAccount({
    required this.session,
    required this.userId,
    required this.profileLocale,
    required this.isNewUser,
  });

  final StoredSession session;
  final String userId;
  final String profileLocale;

  /// True when this sign-in created the account: its [profileLocale] is then the server's
  /// default, not a language the player chose.
  final bool isNewUser;
}

class AuthRepository {
  AuthRepository({required DevApi devApi, required AuthApi authApi})
    : _devApi = devApi,
      _authApi = authApi;

  final DevApi _devApi;
  final AuthApi _authApi;

  /// `POST /v1/_dev/auth/sign-in`: signs in as a made-up account. The route exists only on a
  /// backend running in development (`docs/architecture/04-auth.md` §11).
  Future<SignedInAccount> signInWithDevAccount({
    required String subject,
    String? displayName,
  }) async {
    final tokens = await sendRequestAndReadData(
      () => _devApi.devAuthControllerDevSignInV1(
        devSignInDto: DevSignInDto(
          subject: subject,
          displayName: displayName,
          device: DeviceDto(platform: _describeCurrentPlatform()),
        ),
      ),
    );
    return _convertAuthTokensToSignedInAccount(tokens);
  }

  /// `POST /v1/auth/google`: the backend verifies the Google ID token itself (DEC-25).
  Future<SignedInAccount> signInWithGoogle({required String idToken}) async {
    final tokens = await sendRequestAndReadData(
      () => _authApi.authControllerSignInWithGoogleV1(
        googleSignInDto: GoogleSignInDto(
          idToken: idToken,
          device: DeviceDto(platform: _describeCurrentPlatform()),
        ),
      ),
    );
    return _convertAuthTokensToSignedInAccount(tokens);
  }
}

SignedInAccount _convertAuthTokensToSignedInAccount(AuthTokensDto tokens) =>
    SignedInAccount(
      session: convertAuthTokensToStoredSession(tokens),
      userId: tokens.user.id,
      profileLocale: tokens.user.locale,
      isNewUser: tokens.isNewUser,
    );

StoredSession convertAuthTokensToStoredSession(AuthTokensDto tokens) {
  final expiresAt = DateTime.tryParse(tokens.accessTokenExpiresAt);
  if (expiresAt == null) {
    throw UnexpectedResponseError(
      'accessTokenExpiresAt is not ISO-8601: ${tokens.accessTokenExpiresAt}',
    );
  }
  return StoredSession(
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: expiresAt,
    refreshToken: tokens.refreshToken,
  );
}

DeviceDtoPlatformEnum _describeCurrentPlatform() =>
    defaultTargetPlatform == TargetPlatform.iOS
    ? DeviceDtoPlatformEnum.ios
    : DeviceDtoPlatformEnum.android;

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return AuthRepository(
    devApi: apiClient.getDevApi(),
    authApi: apiClient.getAuthApi(),
  );
});
