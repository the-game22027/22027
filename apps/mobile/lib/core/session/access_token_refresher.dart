import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/storage/token_storage.dart';

/// What happened when the app tried to swap its refresh token for new tokens (ADR-0017).
sealed class RefreshOutcome {
  const RefreshOutcome();
}

class TokensRefreshed extends RefreshOutcome {
  const TokensRefreshed(this.session);

  final StoredSession session;
}

/// The server refused the refresh token (revoked, reused, expired, account disabled).
/// Only this outcome signs the player out.
class RefreshRejected extends RefreshOutcome {
  const RefreshRejected();
}

/// The refresh could not be completed right now (no network, timeout, 429, 5xx).
/// The session stays; the original request fails with this error instead.
class RefreshNotCompleted extends RefreshOutcome {
  const RefreshNotCompleted(this.cause);

  final DioException cause;
}

/// Port between the auth interceptor (`core/`) and the refresh call (`features/account/data`).
abstract interface class AccessTokenRefresher {
  Future<RefreshOutcome> refreshAccessToken(StoredSession currentSession);
}

/// Overridden in `main.dart` with the account feature's implementation, so `core/` does not
/// import a feature.
final accessTokenRefresherProvider = Provider<AccessTokenRefresher>(
  (ref) => throw UnimplementedError(
    'accessTokenRefresherProvider must be overridden',
  ),
);
