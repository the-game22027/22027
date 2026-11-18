import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/features/social/application/social_actions.dart';
import 'package:the_game/features/social/application/social_providers.dart';
import 'package:the_game/features/social/data/blocks_repository.dart';
import 'package:the_game/features/social/data/friends_repository.dart';
import 'package:the_game/features/social/data/social_models.dart';
import 'package:the_game/features/social/data/user_directory_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

Map<String, Object?> userJson(String id, {String? username}) => {
  'id': id,
  'displayName': 'User $id',
  'username': username,
  'avatarUrl': null,
};

Map<String, Object?> requestJson({String status = 'PENDING'}) => {
  'id': 'req-1',
  'from': userJson('u-1'),
  'to': userJson('u-2', username: 'bob'),
  'status': status,
  'createdAt': '2026-11-17T10:00:00Z',
};

Map<String, Object?> connectedPage() => {
  'items': [
    {'user': userJson('u-3'), 'since': '2026-11-01T08:00:00Z'},
  ],
  'nextCursor': 'next-1',
};

Matcher failsWith(SocialFailureReason reason) => throwsA(
  isA<KnownProblemError<SocialFailureReason>>().having(
    (error) => error.reason,
    'reason',
    reason,
  ),
);

void main() {
  group('friend requests', () {
    test('sending posts the user id with an Idempotency-Key', () async {
      final adapter = FakeHttpAdapter(
        (_) => jsonResponse(requestJson(), status: 201),
      );
      final container = await createSignedInTestContainer(adapter);

      final request = await container
          .read(friendsRepositoryProvider)
          .sendFriendRequest('u-2');

      expect(request.status, FriendRequestStatus.pending);
      expect(request.to.username, 'bob');
      expect(request.createdAt, DateTime.utc(2026, 11, 17, 10));
      final sent = adapter.sentRequests.single;
      expect(sent.method, 'POST');
      expect(sent.path, '/v1/friend-requests');
      expect(jsonDecode(sent.data as String), {'userId': 'u-2'});
      expect(sent.headers['Idempotency-Key'], isNotEmpty);
    });

    test('a request that exists keeps the existing request id', () async {
      final adapter = FakeHttpAdapter(
        (_) => jsonResponse(
          {
            'status': 409,
            'code': 'FRIEND_REQUEST_EXISTS',
            'requestId': 'req-9',
          },
          status: 409,
          contentType: 'application/problem+json',
        ),
      );
      final container = await createSignedInTestContainer(adapter);

      await expectLater(
        container.read(friendsRepositoryProvider).sendFriendRequest('u-2'),
        throwsA(
          isA<KnownProblemError<SocialFailureReason>>()
              .having(
                (e) => e.reason,
                'reason',
                SocialFailureReason.friendRequestExists,
              )
              .having((e) => e.problem.requestId, 'requestId', 'req-9'),
        ),
      );
    });

    test('listing asks for the direction and maps the page', () async {
      final adapter = FakeHttpAdapter(
        (_) => jsonResponse({
          'items': [requestJson()],
          'nextCursor': null,
        }),
      );
      final container = await createSignedInTestContainer(adapter);

      final page = await container
          .read(friendsRepositoryProvider)
          .listFriendRequests(FriendRequestDirection.incoming, cursor: 'c1');

      expect(page.items.single.id, 'req-1');
      expect(page.hasMorePages, isFalse);
      final query = adapter.sentRequests.single.queryParameters;
      expect(query['direction'], 'incoming');
      expect(query['cursor'], 'c1');
    });

    test('a retry through SocialActions sends the key it was given', () async {
      final adapter = FakeHttpAdapter(
        (_) => jsonResponse(requestJson(), status: 201),
      );
      final container = await createSignedInTestContainer(adapter);
      final actions = container.read(socialActionsProvider);

      await actions.sendFriendRequest('u-2', idempotencyKey: 'key-1');
      await actions.sendFriendRequest('u-2', idempotencyKey: 'key-1');

      expect(adapter.sentRequests.map((r) => r.headers['Idempotency-Key']), [
        'key-1',
        'key-1',
      ]);
    });

    test(
      'accepting through SocialActions refreshes the sender profile',
      () async {
        final adapter = FakeHttpAdapter(
          (request) => request.method == 'POST'
              ? jsonResponse(requestJson(status: 'ACCEPTED'))
              : jsonResponse({
                  ...userJson('u-1'),
                  'relationship': 'REQUEST_RECEIVED',
                  'requestId': 'req-1',
                }),
        );
        final container = await createSignedInTestContainer(adapter);
        container.listen(userProfileProvider('u-1'), (_, _) {});
        await container.read(userProfileProvider('u-1').future);
        adapter.sentRequests.clear();

        await container
            .read(socialActionsProvider)
            .acceptFriendRequest('req-1');
        await container.read(userProfileProvider('u-1').future);

        expect(adapter.sentRequests.map((r) => '${r.method} ${r.path}'), [
          'POST /v1/friend-requests/req-1/accept',
          'GET /v1/users/u-1',
        ]);
      },
    );

    test('accept and decline return the updated request', () async {
      final adapter = FakeHttpAdapter(
        (request) => jsonResponse(
          requestJson(
            status: request.path.endsWith('accept') ? 'ACCEPTED' : 'DECLINED',
          ),
        ),
      );
      final container = await createSignedInTestContainer(adapter);
      final repository = container.read(friendsRepositoryProvider);

      expect(
        (await repository.acceptFriendRequest('req-1')).status,
        FriendRequestStatus.accepted,
      );
      expect(
        (await repository.declineFriendRequest('req-1')).status,
        FriendRequestStatus.declined,
      );
      expect(adapter.sentRequests.map((r) => r.path), [
        '/v1/friend-requests/req-1/accept',
        '/v1/friend-requests/req-1/decline',
      ]);
    });

    test(
      'accepting a request that is not pending is a typed failure',
      () async {
        final adapter = FakeHttpAdapter(
          (_) => problemResponse(409, 'FRIEND_REQUEST_NOT_PENDING'),
        );
        final container = await createSignedInTestContainer(adapter);

        await expectLater(
          container
              .read(friendsRepositoryProvider)
              .acceptFriendRequest('req-1'),
          failsWith(SocialFailureReason.friendRequestNotPending),
        );
      },
    );

    test('cancelling sends DELETE; an unknown request is typed', () async {
      var answerWithProblem = false;
      final adapter = FakeHttpAdapter(
        (_) => answerWithProblem
            ? problemResponse(404, 'FRIEND_REQUEST_NOT_FOUND')
            : ResponseBody.fromString('', 204),
      );
      final container = await createSignedInTestContainer(adapter);
      final repository = container.read(friendsRepositoryProvider);

      await repository.cancelFriendRequest('req-1');
      expect(adapter.sentRequests.single.method, 'DELETE');

      answerWithProblem = true;
      await expectLater(
        repository.cancelFriendRequest('req-1'),
        failsWith(SocialFailureReason.friendRequestNotFound),
      );
    });
  });

  group('friends', () {
    test('listing maps friends and the cursor', () async {
      final adapter = FakeHttpAdapter((_) => jsonResponse(connectedPage()));
      final container = await createSignedInTestContainer(adapter);

      final page = await container.read(friendsProvider.future);

      expect(page.items.single.user.id, 'u-3');
      expect(page.items.single.since, DateTime.utc(2026, 11, 1, 8));
      expect(page.nextCursor, 'next-1');
      expect(adapter.sentRequests.single.path, '/v1/me/friends');
    });

    test('removing a friend and refreshing the list', () async {
      final adapter = FakeHttpAdapter(
        (request) => request.method == 'DELETE'
            ? ResponseBody.fromString('', 204)
            : jsonResponse(connectedPage()),
      );
      final container = await createSignedInTestContainer(adapter);
      container.listen(friendsProvider, (_, _) {});
      await container.read(friendsProvider.future);

      await container.read(socialActionsProvider).removeFriend('u-3');
      await container.read(friendsProvider.future);

      expect(adapter.sentRequests.map((r) => r.method), [
        'GET',
        'DELETE',
        'GET',
      ]);
      expect(adapter.sentRequests[1].path, '/v1/me/friends/u-3');
    });

    test(
      'a server failure on remove passes through as ApiProblemError',
      () async {
        final adapter = FakeHttpAdapter(
          (_) => problemResponse(500, 'INTERNAL'),
        );
        final container = await createSignedInTestContainer(adapter);

        await expectLater(
          container.read(friendsRepositoryProvider).removeFriend('u-3'),
          throwsA(
            isA<ApiProblemError>().having(
              (error) => error.problem.code,
              'code',
              'INTERNAL',
            ),
          ),
        );
      },
    );
  });

  group('blocks', () {
    test('block, unblock and list', () async {
      final adapter = FakeHttpAdapter(
        (request) => request.method == 'GET'
            ? jsonResponse(connectedPage())
            : ResponseBody.fromString('', 204),
      );
      final container = await createSignedInTestContainer(adapter);
      final repository = container.read(blocksRepositoryProvider);

      await repository.blockUser('u-3');
      await repository.unblockUser('u-3');
      final page = await repository.listBlockedUsers();

      expect(adapter.sentRequests.map((r) => '${r.method} ${r.path}'), [
        'PUT /v1/me/blocks/u-3',
        'DELETE /v1/me/blocks/u-3',
        'GET /v1/me/blocks',
      ]);
      expect(page.items.single.user.id, 'u-3');
    });

    test(
      'blocking through SocialActions refreshes lists and the profile',
      () async {
        final adapter = FakeHttpAdapter(
          (request) => switch (request.method) {
            'PUT' => ResponseBody.fromString('', 204),
            _ when request.path == '/v1/users/u-3' => jsonResponse({
              ...userJson('u-3'),
              'relationship': 'FRIENDS',
              'requestId': null,
            }),
            _ => jsonResponse(connectedPage()),
          },
        );
        final container = await createSignedInTestContainer(adapter);
        container
          ..listen(blockedUsersProvider, (_, _) {})
          ..listen(friendsProvider, (_, _) {})
          ..listen(userProfileProvider('u-3'), (_, _) {});
        await container.read(blockedUsersProvider.future);
        await container.read(friendsProvider.future);
        await container.read(userProfileProvider('u-3').future);
        adapter.sentRequests.clear();

        await container.read(socialActionsProvider).blockUser('u-3');
        await container.read(blockedUsersProvider.future);
        await container.read(friendsProvider.future);
        await container.read(userProfileProvider('u-3').future);

        expect(
          adapter.sentRequests.map((r) => '${r.method} ${r.path}'),
          unorderedEquals([
            'PUT /v1/me/blocks/u-3',
            'GET /v1/me/blocks',
            'GET /v1/me/friends',
            'GET /v1/users/u-3',
          ]),
        );
        expect(adapter.sentRequests.first.method, 'PUT');
      },
    );

    test('a refused block through SocialActions keeps the lists', () async {
      final adapter = FakeHttpAdapter(
        (request) => request.method == 'PUT'
            ? problemResponse(404, 'USER_NOT_FOUND')
            : jsonResponse(connectedPage()),
      );
      final container = await createSignedInTestContainer(adapter);
      container.listen(blockedUsersProvider, (_, _) {});
      await container.read(blockedUsersProvider.future);
      adapter.sentRequests.clear();

      await expectLater(
        container.read(socialActionsProvider).blockUser('u-9'),
        failsWith(SocialFailureReason.userNotFound),
      );
      await container.read(blockedUsersProvider.future);

      expect(adapter.sentRequests.map((r) => r.method), ['PUT']);
    });

    test('blocking yourself is a typed failure', () async {
      final adapter = FakeHttpAdapter(
        (_) => problemResponse(422, 'CANNOT_TARGET_YOURSELF'),
      );
      final container = await createSignedInTestContainer(adapter);

      await expectLater(
        container.read(blocksRepositoryProvider).blockUser('me'),
        failsWith(SocialFailureReason.cannotTargetYourself),
      );
    });
  });

  group('user directory', () {
    test('search sends the query and maps the users', () async {
      final adapter = FakeHttpAdapter(
        (_) => jsonResponse({
          'items': [userJson('u-4', username: 'carol')],
          'nextCursor': null,
        }),
      );
      final container = await createSignedInTestContainer(adapter);

      final page = await container
          .read(userDirectoryRepositoryProvider)
          .searchUsers('car');

      expect(page.items.single.username, 'carol');
      expect(adapter.sentRequests.single.queryParameters['query'], 'car');
    });

    test('a search the server rejects keeps the problem code', () async {
      final adapter = FakeHttpAdapter(
        (_) => problemResponse(400, 'VALIDATION_FAILED'),
      );
      final container = await createSignedInTestContainer(adapter);

      await expectLater(
        container.read(userDirectoryRepositoryProvider).searchUsers('c'),
        throwsA(
          isA<Object>().having(
            (error) => error.toString(),
            'text',
            contains('VALIDATION_FAILED'),
          ),
        ),
      );
    });

    test('profile maps the relationship and the pending request', () async {
      final adapter = FakeHttpAdapter(
        (_) => jsonResponse({
          ...userJson('u-5'),
          'relationship': 'REQUEST_RECEIVED',
          'requestId': 'req-5',
        }),
      );
      final container = await createSignedInTestContainer(adapter);

      final profile = await container
          .read(userDirectoryRepositoryProvider)
          .fetchUserProfile('u-5');

      expect(profile.relationship, UserRelationship.requestReceived);
      expect(profile.requestId, 'req-5');
    });

    test('a blocked or unknown profile is USER_NOT_FOUND', () async {
      final adapter = FakeHttpAdapter(
        (_) => problemResponse(404, 'USER_NOT_FOUND'),
      );
      final container = await createSignedInTestContainer(adapter);

      await expectLater(
        container.read(userDirectoryRepositoryProvider).fetchUserProfile('x'),
        failsWith(SocialFailureReason.userNotFound),
      );
    });
  });
}
