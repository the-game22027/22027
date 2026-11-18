import 'package:api_client/api_client.dart';

import 'package:the_game/core/paging/cursor_page.dart';
import 'package:the_game/core/time/parse_server_timestamp.dart';
import 'package:the_game/features/social/data/social_models.dart';

PublicUser convertPublicUser(PublicUserDto user) => PublicUser(
  id: user.id,
  displayName: user.displayName,
  username: user.username,
  avatarUrl: user.avatarUrl,
);

FriendRequest convertFriendRequest(FriendRequestDto request) => FriendRequest(
  id: request.id,
  from: convertPublicUser(request.from),
  to: convertPublicUser(request.to),
  status: switch (request.status) {
    FriendRequestDtoStatusEnum.PENDING => FriendRequestStatus.pending,
    FriendRequestDtoStatusEnum.ACCEPTED => FriendRequestStatus.accepted,
    FriendRequestDtoStatusEnum.DECLINED => FriendRequestStatus.declined,
    FriendRequestDtoStatusEnum.CANCELLED => FriendRequestStatus.cancelled,
    FriendRequestDtoStatusEnum.unknownDefaultOpenApi =>
      FriendRequestStatus.unknown,
  },
  createdAt: parseServerTimestamp(request.createdAt),
);

CursorPage<ConnectedUser> convertConnectedUserPage(ConnectedUserPageDto page) =>
    CursorPage(
      items: [
        for (final item in page.items)
          ConnectedUser(
            user: convertPublicUser(item.user),
            since: parseServerTimestamp(item.since),
          ),
      ],
      nextCursor: page.nextCursor,
    );
