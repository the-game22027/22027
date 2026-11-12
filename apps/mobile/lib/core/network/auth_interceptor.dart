import 'package:dio/dio.dart';

import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/core/storage/token_storage.dart';

/// Sends the bearer token on routes the OpenAPI document marks as secured, and handles a `401`
/// by refreshing the tokens once and retrying (ADR-0017).
///
/// A [QueuedInterceptor] handles one error at a time. When several requests fail together,
/// the first one refreshes; the others see that the token has changed since they were sent and
/// retry with the new one. Refreshing again would present a used refresh token, which the
/// server treats as theft and answers by revoking the whole session family.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required this.retryDio,
    required this.readSession,
    required this.startSession,
    required this.endSession,
    required this.accessTokenRefresher,
  });

  /// Sends retries. It has no auth interceptor: a retry that went through this queued
  /// interceptor again would wait forever behind the error handler that is waiting for it.
  final Dio retryDio;
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
    final sentAccessToken = readBearerToken(err.requestOptions);
    // A 401 from a public route (for example a rejected Google credential) is not about our session.
    if (err.response?.statusCode != 401 || sentAccessToken == null) {
      return handler.next(err);
    }
    final session = readSession();
    if (session == null) return handler.next(err);

    if (session.accessToken != sentAccessToken) {
      return _retryWithAccessToken(err, session.accessToken, handler);
    }

    switch (await accessTokenRefresher.refreshAccessToken(session)) {
      case TokensRefreshed(session: final refreshedSession):
        // Saved before the retry: if the app dies now, the next launch has the new tokens.
        await startSession(refreshedSession);
        return _retryWithAccessToken(
          err,
          refreshedSession.accessToken,
          handler,
        );
      case RefreshRejected():
        await endSession();
        return handler.next(err);
      case RefreshNotCompleted(:final cause):
        return handler.next(cause);
    }
  }

  /// Retries once. A second `401` means the new token is refused too: the session is over.
  Future<void> _retryWithAccessToken(
    DioException originalError,
    String accessToken,
    ErrorInterceptorHandler handler,
  ) async {
    final request = originalError.requestOptions;
    request.headers['Authorization'] = 'Bearer $accessToken';
    try {
      handler.resolve(await retryDio.fetch<Object?>(request));
    } on DioException catch (retryError) {
      if (retryError.response?.statusCode == 401) await endSession();
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

/// The access token a request was sent with, or null for a request without one.
String? readBearerToken(RequestOptions options) {
  final header = options.headers['Authorization'];
  if (header is! String || !header.startsWith('Bearer ')) return null;
  return header.substring('Bearer '.length);
}
