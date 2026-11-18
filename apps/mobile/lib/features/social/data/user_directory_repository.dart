import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/paging/cursor_page.dart';
import 'package:the_game/features/social/data/social_mappers.dart';
import 'package:the_game/features/social/data/social_models.dart';

/// Finding other players (API §6.2).
class UserDirectoryRepository {
  UserDirectoryRepository(this._socialApi);

  final SocialApi _socialApi;

  /// `GET /v1/users?query=`: username prefix or display name containing [query] (2 to 50
  /// characters, checked by the server). The server leaves out the player and blocks both ways.
  Future<CursorPage<PublicUser>> searchUsers(
    String query, {
    int? limit,
    String? cursor,
  }) async {
    final page = await sendRequestAndReadData(
      () => _socialApi.userDirectoryControllerSearchV1(
        query: query,
        limit: limit,
        cursor: cursor,
      ),
    );
    return CursorPage(
      items: [for (final user in page.items) convertPublicUser(user)],
      nextCursor: page.nextCursor,
    );
  }

  /// `GET /v1/users/{userId}`. `404 USER_NOT_FOUND` also covers a block in either direction.
  Future<UserProfile> fetchUserProfile(String userId) async {
    final profile = await convertKnownProblems(
      () => sendRequestAndReadData(
        () => _socialApi.userDirectoryControllerProfileV1(userId: userId),
      ),
      (problem) => findReasonByCode(problem, socialFailureReasonsByCode),
    );
    return UserProfile(
      user: PublicUser(
        id: profile.id,
        displayName: profile.displayName,
        username: profile.username,
        avatarUrl: profile.avatarUrl,
      ),
      relationship: switch (profile.relationship) {
        UserProfileDtoRelationshipEnum.SELF => UserRelationship.self,
        UserProfileDtoRelationshipEnum.NONE => UserRelationship.none,
        UserProfileDtoRelationshipEnum.FRIENDS => UserRelationship.friends,
        UserProfileDtoRelationshipEnum.REQUEST_SENT =>
          UserRelationship.requestSent,
        UserProfileDtoRelationshipEnum.REQUEST_RECEIVED =>
          UserRelationship.requestReceived,
        UserProfileDtoRelationshipEnum.unknownDefaultOpenApi =>
          UserRelationship.unknown,
      },
      requestId: profile.requestId,
    );
  }
}

final userDirectoryRepositoryProvider = Provider<UserDirectoryRepository>(
  (ref) => UserDirectoryRepository(ref.watch(apiClientProvider).getSocialApi()),
);
