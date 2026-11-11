import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/storage/token_storage.dart';

/// Seam for refresh-token rotation (M1, `docs/architecture/04-auth.md` §5).
///
/// When an authenticated request gets a `401`, the auth interceptor asks this for new tokens
/// before giving up. A non-null result means "retry the request with these tokens".
abstract interface class AccessTokenRefresher {
  Future<StoredSession?> refreshAccessToken(StoredSession expiredSession);
}

/// M0 behaviour: no refresh, so every `401` signs the player out.
class NoAccessTokenRefresher implements AccessTokenRefresher {
  const NoAccessTokenRefresher();

  @override
  Future<StoredSession?> refreshAccessToken(
    StoredSession expiredSession,
  ) async => null; // TODO(M1): call POST /v1/auth/refresh and rotate the stored tokens.
}

final accessTokenRefresherProvider = Provider<AccessTokenRefresher>(
  (ref) => const NoAccessTokenRefresher(),
);
