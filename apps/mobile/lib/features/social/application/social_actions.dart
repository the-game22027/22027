import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/social/application/social_providers.dart';
import 'package:the_game/features/social/data/blocks_repository.dart';
import 'package:the_game/features/social/data/friends_repository.dart';
import 'package:the_game/features/social/data/social_models.dart';

/// What a player can do to their friends and blocks. Each action calls the server, then
/// refreshes the lists and profiles it changed. Refusals are thrown as
/// `KnownProblemError<SocialFailureReason>`.
class SocialActions {
  SocialActions(this._ref);

  final Ref _ref;

  /// Sends a friend request to [userId]. A screen creates one [idempotencyKey] per "add
  /// friend" action and passes the same key to every retry until one succeeds, so a retry
  /// after a lost response does not create a second request. Without a key, each call gets
  /// a new one.
  Future<FriendRequest> sendFriendRequest(
    String userId, {
    String? idempotencyKey,
  }) async {
    final request = await _ref
        .read(friendsRepositoryProvider)
        .sendFriendRequest(userId, idempotencyKey: idempotencyKey);
    _ref.invalidate(userProfileProvider(userId));
    _ref.invalidate(friendRequestsProvider(FriendRequestDirection.outgoing));
    return request;
  }

  /// Only the addressee accepts, so the other player is the sender.
  Future<FriendRequest> acceptFriendRequest(String requestId) async {
    final request = await _ref
        .read(friendsRepositoryProvider)
        .acceptFriendRequest(requestId);
    _ref.invalidate(friendRequestsProvider(FriendRequestDirection.incoming));
    _ref.invalidate(friendsProvider);
    _ref.invalidate(userProfileProvider(request.from.id));
    return request;
  }

  /// Only the addressee declines, so the other player is the sender.
  Future<FriendRequest> declineFriendRequest(String requestId) async {
    final request = await _ref
        .read(friendsRepositoryProvider)
        .declineFriendRequest(requestId);
    _ref.invalidate(friendRequestsProvider(FriendRequestDirection.incoming));
    _ref.invalidate(userProfileProvider(request.from.id));
    return request;
  }

  /// [addresseeUserId] is the player the request was sent to, whose profile shows it.
  Future<void> cancelFriendRequest(
    String requestId, {
    required String addresseeUserId,
  }) async {
    await _ref.read(friendsRepositoryProvider).cancelFriendRequest(requestId);
    _ref.invalidate(friendRequestsProvider(FriendRequestDirection.outgoing));
    _ref.invalidate(userProfileProvider(addresseeUserId));
  }

  Future<void> removeFriend(String userId) async {
    await _ref.read(friendsRepositoryProvider).removeFriend(userId);
    _ref.invalidate(friendsProvider);
    _ref.invalidate(userProfileProvider(userId));
  }

  /// The server also ends the friendship and pending requests, and hides each player from
  /// the other's search.
  Future<void> blockUser(String userId) async {
    await _ref.read(blocksRepositoryProvider).blockUser(userId);
    _ref.invalidate(blockedUsersProvider);
    _ref.invalidate(friendsProvider);
    _ref.invalidate(friendRequestsProvider);
    _ref.invalidate(userProfileProvider(userId));
    _ref.invalidate(userSearchProvider);
  }

  Future<void> unblockUser(String userId) async {
    await _ref.read(blocksRepositoryProvider).unblockUser(userId);
    _ref.invalidate(blockedUsersProvider);
    _ref.invalidate(userProfileProvider(userId));
    _ref.invalidate(userSearchProvider);
  }
}

final socialActionsProvider = Provider<SocialActions>(SocialActions.new);
