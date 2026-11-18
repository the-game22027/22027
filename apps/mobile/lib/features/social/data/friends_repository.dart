import 'package:api_client/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/paging/cursor_page.dart';
import 'package:the_game/features/social/data/social_mappers.dart';
import 'package:the_game/features/social/data/social_models.dart';
import 'package:uuid/uuid.dart';

/// Friend requests and the friend list (API §6.9). Refusals are thrown as
/// `KnownProblemError<SocialFailureReason>`.
class FriendsRepository {
  FriendsRepository(this._socialApi, {String Function()? createIdempotencyKey})
    : _createIdempotencyKey = createIdempotencyKey ?? const Uuid().v4;

  final SocialApi _socialApi;
  final String Function() _createIdempotencyKey;

  /// `POST /v1/friend-requests`. A retry of the same action passes the same
  /// [idempotencyKey], so the server does not create a second request.
  /// `409 FRIEND_REQUEST_EXISTS` carries the existing request in `problem.requestId`.
  Future<FriendRequest> sendFriendRequest(
    String userId, {
    String? idempotencyKey,
  }) async => convertFriendRequest(
    await _sendRequestAndConvertSocialProblems(
      () => _socialApi.friendRequestsControllerSendV1(
        sendFriendRequestDto: SendFriendRequestDto(userId: userId),
        headers: {'Idempotency-Key': idempotencyKey ?? _createIdempotencyKey()},
      ),
    ),
  );

  /// `GET /v1/friend-requests`: the pending requests sent to the player or by the player.
  Future<CursorPage<FriendRequest>> listFriendRequests(
    FriendRequestDirection direction, {
    int? limit,
    String? cursor,
  }) async {
    final page = await _sendRequestAndConvertSocialProblems(
      () => _socialApi.friendRequestsControllerListV1(
        direction: switch (direction) {
          FriendRequestDirection.incoming => 'incoming',
          FriendRequestDirection.outgoing => 'outgoing',
        },
        limit: limit,
        cursor: cursor,
      ),
    );
    return CursorPage(
      items: [for (final item in page.items) convertFriendRequest(item)],
      nextCursor: page.nextCursor,
    );
  }

  /// `POST /v1/friend-requests/{requestId}/accept` (the addressee only).
  Future<FriendRequest> acceptFriendRequest(String requestId) async =>
      convertFriendRequest(
        await _sendRequestAndConvertSocialProblems(
          () =>
              _socialApi.friendRequestsControllerAcceptV1(requestId: requestId),
        ),
      );

  /// `POST /v1/friend-requests/{requestId}/decline` (the addressee only).
  Future<FriendRequest> declineFriendRequest(String requestId) async =>
      convertFriendRequest(
        await _sendRequestAndConvertSocialProblems(
          () => _socialApi.friendRequestsControllerDeclineV1(
            requestId: requestId,
          ),
        ),
      );

  /// `DELETE /v1/friend-requests/{requestId}` (the requester only).
  Future<void> cancelFriendRequest(String requestId) =>
      _sendRequestWithoutDataAndConvertSocialProblems(
        () => _socialApi.friendRequestsControllerCancelV1(requestId: requestId),
      );

  /// `GET /v1/me/friends`.
  Future<CursorPage<ConnectedUser>> listFriends({
    int? limit,
    String? cursor,
  }) async => convertConnectedUserPage(
    await _sendRequestAndConvertSocialProblems(
      () => _socialApi.myConnectionsControllerFriendsV1(
        limit: limit,
        cursor: cursor,
      ),
    ),
  );

  /// `DELETE /v1/me/friends/{userId}`.
  Future<void> removeFriend(String userId) =>
      _sendRequestWithoutDataAndConvertSocialProblems(
        () => _socialApi.myConnectionsControllerUnfriendV1(userId: userId),
      );

  Future<T> _sendRequestAndConvertSocialProblems<T>(
    Future<Response<T>> Function() sendRequest,
  ) => convertKnownProblems(
    () => sendRequestAndReadData(sendRequest),
    (problem) => findReasonByCode(problem, socialFailureReasonsByCode),
  );

  Future<void> _sendRequestWithoutDataAndConvertSocialProblems(
    Future<Response<void>> Function() sendRequest,
  ) => convertKnownProblems(
    () => sendRequestWithoutData(sendRequest),
    (problem) => findReasonByCode(problem, socialFailureReasonsByCode),
  );
}

final friendsRepositoryProvider = Provider<FriendsRepository>(
  (ref) => FriendsRepository(ref.watch(apiClientProvider).getSocialApi()),
);
