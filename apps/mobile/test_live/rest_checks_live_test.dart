// REST endpoints of every finished backend feature, called through the app's repositories
// against the local backend, so each real response goes through the generated client and the
// app's mapping. Two fresh dev players per run. Run by hand, see test_live/README.md.
@Tags(['live'])
library;

import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/features/account/data/profile_repository.dart';
import 'package:the_game/features/account/data/sessions_repository.dart';
import 'package:the_game/features/battles/data/battle_events.dart';
import 'package:the_game/features/battles/data/play_state_repository.dart';
import 'package:the_game/features/football/data/football_models.dart';
import 'package:the_game/features/football/data/football_repository.dart';
import 'package:the_game/features/leaderboards/data/leaderboard_models.dart';
import 'package:the_game/features/leaderboards/data/leaderboards_repository.dart';
import 'package:the_game/features/predictions/data/prediction_models.dart';
import 'package:the_game/features/predictions/data/predictions_repository.dart';
import 'package:the_game/features/social/data/blocks_repository.dart';
import 'package:the_game/features/social/data/friends_repository.dart';
import 'package:the_game/features/social/data/social_models.dart';
import 'package:the_game/features/social/data/user_directory_repository.dart';

import 'live_backend.dart';

void main() {
  setUpAll(stopUnlessLiveBackendIsReachable);

  test('profile: read it, rename, read the new name back', () async {
    final player = await signInFreshLivePlayer('rest-profile');
    final profiles = player.read(profileRepositoryProvider);

    final profile = await profiles.fetchPlayerAccountProfile();
    expect(profile.userId, player.userId);
    expect(
      profile.locale,
      'en',
      reason: 'a new account takes the app language',
    );

    final newName = '${player.displayName} renamed';
    final saved = await profiles.updatePlayerAccountProfile(
      displayName: newName,
    );
    expect(saved.displayName, newName);
    expect((await profiles.fetchPlayerAccountProfile()).displayName, newName);
  });

  test('sessions: the list shows this device', () async {
    final player = await signInFreshLivePlayer('rest-sessions');

    final sessions = await player
        .read(sessionsRepositoryProvider)
        .fetchSignedInSessions();

    expect(sessions.where((session) => session.isThisDevice), hasLength(1));
  });

  test(
    'football and predictions: a match with squads, then submit and read back a prediction',
    () async {
      final player = await signInFreshLivePlayer('rest-predictions');
      final football = player.read(footballRepositoryProvider);
      final predictions = player.read(predictionsRepositoryProvider);

      expect(await football.fetchActiveCompetitions(), isNotEmpty);
      final upcoming = await football.fetchMatches(
        status: MatchStatus.scheduled,
        limit: 20,
      );
      final match = upcoming.matches
          .where((match) => match.isPredictable)
          .firstOrNull;
      if (match == null) {
        fail(
          'no predictable match in the mock data; '
          'play time forward with `npm run cli -- mock:run-day`',
        );
      }
      final detail = await football.fetchMatchDetail(match.id);
      expect(detail.match.id, match.id);
      final squads = await football.fetchMatchSquads(match.id);
      for (final squadPlayer in squads) {
        expect([
          match.homeTeam.id,
          match.awayTeam.id,
        ], contains(squadPlayer.teamId));
      }

      expect(await predictions.fetchOwnPrediction(match.id), isNull);
      final submitted = await predictions.submitPrediction(
        matchId: match.id,
        picks: const [ExactScorePick(home: 2, away: 1)],
      );
      expect(submitted.matchId, match.id);
      expect(submitted.isLocked, isFalse);

      final readBack = (await predictions.fetchOwnPrediction(match.id))!;
      expect(readBack.revision, submitted.revision);
      final exactScore = readBack.picks.whereType<ExactScorePick>().single;
      expect((exactScore.home, exactScore.away), (2, 1));
      // The server adds the result it implies (API §5, DEC-03).
      expect(
        readBack.picks.whereType<ResultPick>().single.outcome,
        MatchOutcome.home,
      );
      // Friends' predictions stay hidden before kickoff (DEC-21).
      expect(
        (await predictions.fetchFriendsPredictions(match.id)).items,
        isEmpty,
      );
    },
  );

  test(
    'social: search, friend request round trip, unfriend, then block and unblock',
    () async {
      final alice = await signInFreshLivePlayer('rest-social-a');
      final bob = await signInFreshLivePlayer('rest-social-b');
      final aliceFriends = alice.read(friendsRepositoryProvider);
      final bobFriends = bob.read(friendsRepositoryProvider);
      final aliceDirectory = alice.read(userDirectoryRepositoryProvider);
      final aliceBlocks = alice.read(blocksRepositoryProvider);

      final found = await aliceDirectory.searchUsers(bob.displayName);
      expect(found.items.map((user) => user.id), [bob.userId]);
      expect(
        (await aliceDirectory.fetchUserProfile(bob.userId)).relationship,
        UserRelationship.none,
      );

      final request = await aliceFriends.sendFriendRequest(bob.userId);
      expect(request.status, FriendRequestStatus.pending);
      expect((request.from.id, request.to.id), (alice.userId, bob.userId));
      expect(
        (await aliceFriends.listFriendRequests(
          FriendRequestDirection.outgoing,
        )).items.map((request) => request.id),
        contains(request.id),
      );
      final incoming = await bobFriends.listFriendRequests(
        FriendRequestDirection.incoming,
      );
      expect(incoming.items.map((request) => request.id), contains(request.id));
      expect(
        (await aliceDirectory.fetchUserProfile(bob.userId)).relationship,
        UserRelationship.requestSent,
      );

      final accepted = await bobFriends.acceptFriendRequest(request.id);
      expect(accepted.status, FriendRequestStatus.accepted);
      expect(
        (await aliceFriends.listFriends()).items.map(
          (friend) => friend.user.id,
        ),
        [bob.userId],
      );
      expect(
        (await bobFriends.listFriends()).items.map((friend) => friend.user.id),
        [alice.userId],
      );
      expect(
        (await aliceDirectory.fetchUserProfile(bob.userId)).relationship,
        UserRelationship.friends,
      );
      // A friend's visible predictions: Bob has none yet.
      expect(
        (await alice
                .read(predictionsRepositoryProvider)
                .fetchPredictionsOfUser(bob.userId))
            .items,
        isEmpty,
      );

      await aliceFriends.removeFriend(bob.userId);
      expect((await aliceFriends.listFriends()).items, isEmpty);

      await aliceBlocks.blockUser(bob.userId);
      expect(
        (await aliceBlocks.listBlockedUsers()).items.map(
          (blocked) => blocked.user.id,
        ),
        [bob.userId],
      );
      expect(
        (await aliceDirectory.searchUsers(bob.displayName)).items,
        isEmpty,
      );
      await expectLater(
        aliceDirectory.fetchUserProfile(bob.userId),
        throwsA(
          isA<KnownProblemError<SocialFailureReason>>().having(
            (error) => error.reason,
            'reason',
            SocialFailureReason.userNotFound,
          ),
        ),
      );

      await aliceBlocks.unblockUser(bob.userId);
      expect((await aliceBlocks.listBlockedUsers()).items, isEmpty);
      expect(
        (await aliceDirectory.fetchUserProfile(bob.userId)).relationship,
        UserRelationship.none,
      );
    },
  );

  test(
    'friend requests: the addressee declines, a resent one is cancelled',
    () async {
      final alice = await signInFreshLivePlayer('rest-requests-a');
      final bob = await signInFreshLivePlayer('rest-requests-b');
      final aliceFriends = alice.read(friendsRepositoryProvider);
      final bobFriends = bob.read(friendsRepositoryProvider);

      final first = await aliceFriends.sendFriendRequest(bob.userId);
      final declined = await bobFriends.declineFriendRequest(first.id);
      expect(declined.status, FriendRequestStatus.declined);
      expect(
        (await bobFriends.listFriendRequests(
          FriendRequestDirection.incoming,
        )).items,
        isEmpty,
      );

      final second = await aliceFriends.sendFriendRequest(bob.userId);
      expect(second.id, isNot(first.id));
      await aliceFriends.cancelFriendRequest(second.id);
      expect(
        (await bobFriends.listFriendRequests(
          FriendRequestDirection.incoming,
        )).items,
        isEmpty,
      );
      expect(
        (await alice
                .read(userDirectoryRepositoryProvider)
                .fetchUserProfile(bob.userId))
            .relationship,
        UserRelationship.none,
      );
      expect((await aliceFriends.listFriends()).items, isEmpty);
    },
  );

  test(
    'leaderboards: periods, a BATTLES page and my rank for every kind',
    () async {
      final player = await signInFreshLivePlayer('rest-leaderboards');
      final leaderboards = player.read(leaderboardsRepositoryProvider);

      for (final kind in LeaderboardKind.values) {
        final periods = await leaderboards.fetchPeriods(kind);
        expect(periods, isNotEmpty, reason: '${kind.wireName} periods');
        expect(periods.first.status, LeaderboardPeriodStatus.open);

        final page = await leaderboards.fetchPage(
          kind: kind,
          category: LeaderboardCategory.battles,
        );
        expect(page.category, LeaderboardCategory.battles);
        expect(page.period.key, periods.first.key);

        final myRank = await leaderboards.fetchMyRank(
          kind: kind,
          category: LeaderboardCategory.battles,
        );
        expect(myRank.points, 0, reason: 'a new player has no points');
      }
    },
  );

  test(
    'play-state: idle, queued after a REST join, idle again after leaving',
    () async {
      final player = await signInFreshLivePlayer('rest-play-state');
      final playStates = player.read(playStateRepositoryProvider);

      expect((await playStates.fetchPlayState()).isIdle, isTrue);

      final ticket = await playStates.joinMatchmaking(GameType.buzzer);
      addTearDown(playStates.leaveMatchmaking);
      expect(ticket.gameType, GameType.buzzer);
      final queued = await playStates.fetchPlayState();
      await playStates.leaveMatchmaking();

      expect(queued.queuedTicket?.ticketId, ticket.ticketId);
      expect(queued.battleId, isNull);
      expect((await playStates.fetchPlayState()).isIdle, isTrue);
    },
  );
}
