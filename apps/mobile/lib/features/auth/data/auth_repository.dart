import 'package:api_client/api_client.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/storage/token_storage.dart';

class AuthRepository {
  AuthRepository(this._devApi);

  final DevApi _devApi;

  /// `POST /v1/_dev/auth/sign-in`: signs in as a made-up account. The route exists only on a
  /// backend running in development (`docs/architecture/04-auth.md` §11).
  Future<StoredSession> signInWithDevAccount({
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
    return convertAuthTokensToStoredSession(tokens);
  }
}

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

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider).getDevApi()),
);
