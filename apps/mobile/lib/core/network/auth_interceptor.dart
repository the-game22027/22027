import 'package:dio/dio.dart';

import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/core/storage/token_storage.dart';

const _retriedAfterRefreshKey = 'retriedAfterRefresh';

/// Sends the bearer token on routes the OpenAPI document marks as secured, and ends the
/// session when the server rejects it.
///
/// A [QueuedInterceptor] handles one request at a time, so several parallel `401`s trigger a
/// single refresh (M1) instead of one per request.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required this.dio,
    required this.readSession,
    required this.startSession,
    required this.endSession,
    required this.accessTokenRefresher,
  });

  /// Used only to retry a request after a successful refresh.
  final Dio dio;
  final StoredSession? Function() readSession;
  final Future<void> Function(StoredSession session) startSession;
  final Future<void> Function() endSession;
  final AccessTokenRefresher accessTokenRefresher;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final session = readSession();
    if (session != null && isBearerTokenRequired(options)) {
      options.headers['Authorization'] = 'Bearer ${session.accessToken}';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final request = err.requestOptions;
    final wasSentWithToken = request.headers.containsKey('Authorization');
    // A 401 from a public route (for example a rejected Google credential) is not about our session.
    if (err.response?.statusCode != 401 || !wasSentWithToken) {
      return handler.next(err);
    }

    final session = readSession();
    final alreadyRetried = request.extra[_retriedAfterRefreshKey] == true;
    final refreshedSession = session == null || alreadyRetried
        ? null
        : await accessTokenRefresher.refreshAccessToken(session);

    if (refreshedSession == null) {
      await endSession();
      return handler.next(err);
    }

    await startSession(refreshedSession);
    request.extra[_retriedAfterRefreshKey] = true;
    request.headers['Authorization'] = 'Bearer ${refreshedSession.accessToken}';
    try {
      handler.resolve(await dio.fetch<Object?>(request));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }
}

/// The generated client puts the operation's OpenAPI `security` entries into `extra['secure']`.
bool isBearerTokenRequired(RequestOptions options) {
  final security = options.extra['secure'];
  return security is List &&
      security.any((entry) => entry is Map && entry['scheme'] == 'bearer');
}
