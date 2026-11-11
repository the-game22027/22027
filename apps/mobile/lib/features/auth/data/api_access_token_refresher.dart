import 'package:api_client/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/session/access_token_refresher.dart';
import 'package:the_game/core/storage/token_storage.dart';
import 'package:the_game/features/auth/data/auth_repository.dart';

/// `POST /v1/auth/refresh`: swaps the refresh token for a new pair (rotation, `04-auth.md` §5).
class ApiAccessTokenRefresher implements AccessTokenRefresher {
  ApiAccessTokenRefresher(this._authApiWithoutAuth);

  final AuthApi _authApiWithoutAuth;

  @override
  Future<RefreshOutcome> refreshAccessToken(
    StoredSession currentSession,
  ) async {
    final Response<AuthTokensDto> response;
    try {
      response = await _authApiWithoutAuth.authControllerRefreshV1(
        refreshDto: RefreshDto(refreshToken: currentSession.refreshToken),
      );
    } on DioException catch (exception) {
      return isRefreshRejectedStatus(exception.response?.statusCode)
          ? const RefreshRejected()
          : RefreshNotCompleted(exception);
    }

    final tokens = response.data;
    try {
      if (tokens == null) {
        throw const UnexpectedResponseError('refresh body was empty');
      }
      return TokensRefreshed(convertAuthTokensToStoredSession(tokens));
    } on UnexpectedResponseError catch (error) {
      return RefreshNotCompleted(
        DioException(requestOptions: response.requestOptions, error: error),
      );
    }
  }
}

/// `400`/`401`/`403` mean the server refused this refresh token for good (revoked, reused,
/// expired, account disabled). `429` and `5xx` may pass, so they are not a rejection.
bool isRefreshRejectedStatus(int? statusCode) =>
    statusCode == 400 || statusCode == 401 || statusCode == 403;

final apiAccessTokenRefresherProvider = Provider<ApiAccessTokenRefresher>(
  (ref) => ApiAccessTokenRefresher(
    ref.watch(apiClientWithoutAuthProvider).getAuthApi(),
  ),
);
