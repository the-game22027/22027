import 'package:api_client/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/paging/cursor_page.dart';
import 'package:the_game/features/social/data/social_mappers.dart';
import 'package:the_game/features/social/data/social_models.dart';

/// Blocking players (API §6.9). Blocking also removes the friendship and pending requests,
/// on the server.
class BlocksRepository {
  BlocksRepository(this._socialApi);

  final SocialApi _socialApi;

  /// `PUT /v1/me/blocks/{userId}`. `404 USER_NOT_FOUND`, `422 CANNOT_TARGET_YOURSELF`.
  Future<void> blockUser(String userId) =>
      _sendRequestWithoutDataAndConvertSocialProblems(
        () => _socialApi.myConnectionsControllerBlockV1(userId: userId),
      );

  /// `DELETE /v1/me/blocks/{userId}`.
  Future<void> unblockUser(String userId) =>
      _sendRequestWithoutDataAndConvertSocialProblems(
        () => _socialApi.myConnectionsControllerUnblockV1(userId: userId),
      );

  /// `GET /v1/me/blocks`: the players the signed-in player blocked.
  Future<CursorPage<ConnectedUser>> listBlockedUsers({
    int? limit,
    String? cursor,
  }) async => convertConnectedUserPage(
    await convertKnownProblems(
      () => sendRequestAndReadData(
        () => _socialApi.myConnectionsControllerBlocksV1(
          limit: limit,
          cursor: cursor,
        ),
      ),
      (problem) => findReasonByCode(problem, socialFailureReasonsByCode),
    ),
  );

  Future<void> _sendRequestWithoutDataAndConvertSocialProblems(
    Future<Response<void>> Function() sendRequest,
  ) => convertKnownProblems(
    () => sendRequestWithoutData(sendRequest),
    (problem) => findReasonByCode(problem, socialFailureReasonsByCode),
  );
}

final blocksRepositoryProvider = Provider<BlocksRepository>(
  (ref) => BlocksRepository(ref.watch(apiClientProvider).getSocialApi()),
);
