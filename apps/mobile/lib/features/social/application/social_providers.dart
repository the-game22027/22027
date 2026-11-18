import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/paging/cursor_page.dart';
import 'package:the_game/features/social/data/blocks_repository.dart';
import 'package:the_game/features/social/data/friends_repository.dart';
import 'package:the_game/features/social/data/social_models.dart';
import 'package:the_game/features/social/data/user_directory_repository.dart';

/// First pages; later pages come from the repositories with the `nextCursor`.
final friendsProvider = FutureProvider.autoDispose<CursorPage<ConnectedUser>>(
  (ref) => ref.watch(friendsRepositoryProvider).listFriends(),
);

final blockedUsersProvider =
    FutureProvider.autoDispose<CursorPage<ConnectedUser>>(
      (ref) => ref.watch(blocksRepositoryProvider).listBlockedUsers(),
    );

final friendRequestsProvider = FutureProvider.autoDispose
    .family<CursorPage<FriendRequest>, FriendRequestDirection>(
      (ref, direction) =>
          ref.watch(friendsRepositoryProvider).listFriendRequests(direction),
    );

final userProfileProvider = FutureProvider.autoDispose
    .family<UserProfile, String>(
      (ref, userId) =>
          ref.watch(userDirectoryRepositoryProvider).fetchUserProfile(userId),
    );

/// Search results for [query]; the screen decides when to search (the server wants 2 to 50
/// characters and limits searches to 30 per minute).
final userSearchProvider = FutureProvider.autoDispose
    .family<CursorPage<PublicUser>, String>(
      (ref, query) =>
          ref.watch(userDirectoryRepositoryProvider).searchUsers(query),
    );
