/// Friends, blocks and user search (API §5 "Social", §6.9).
library;

class PublicUser {
  const PublicUser({
    required this.id,
    required this.displayName,
    this.username,
    this.avatarUrl,
  });

  final String id;
  final String displayName;
  final String? username;
  final String? avatarUrl;
}

enum UserRelationship {
  self,
  none,
  friends,
  requestSent,
  requestReceived,
  unknown,
}

/// Another player's public profile and how the signed-in player relates to them.
class UserProfile {
  const UserProfile({
    required this.user,
    required this.relationship,
    this.requestId,
  });

  final PublicUser user;
  final UserRelationship relationship;

  /// The pending friend request between the two players, for accept, decline or cancel.
  final String? requestId;
}

enum FriendRequestDirection { incoming, outgoing }

enum FriendRequestStatus { pending, accepted, declined, cancelled, unknown }

class FriendRequest {
  const FriendRequest({
    required this.id,
    required this.from,
    required this.to,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final PublicUser from;
  final PublicUser to;
  final FriendRequestStatus status;
  final DateTime createdAt;
}

/// A friend or a blocked player; [since] is when the friendship or the block started.
class ConnectedUser {
  const ConnectedUser({required this.user, required this.since});

  final PublicUser user;
  final DateTime since;
}

/// Why the server refused a social action (`docs/api/API.md` §4).
enum SocialFailureReason {
  friendRequestExists,
  alreadyFriends,
  friendRequestNotFound,
  friendRequestNotPending,
  userNotFound,
  cannotTargetYourself,
  idempotencyKeyReused,
}

const socialFailureReasonsByCode = {
  'FRIEND_REQUEST_EXISTS': SocialFailureReason.friendRequestExists,
  'ALREADY_FRIENDS': SocialFailureReason.alreadyFriends,
  'FRIEND_REQUEST_NOT_FOUND': SocialFailureReason.friendRequestNotFound,
  'FRIEND_REQUEST_NOT_PENDING': SocialFailureReason.friendRequestNotPending,
  'USER_NOT_FOUND': SocialFailureReason.userNotFound,
  'CANNOT_TARGET_YOURSELF': SocialFailureReason.cannotTargetYourself,
  'IDEMPOTENCY_KEY_REUSED': SocialFailureReason.idempotencyKeyReused,
};
