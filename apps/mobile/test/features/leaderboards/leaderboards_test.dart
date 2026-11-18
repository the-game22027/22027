import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/features/leaderboards/data/leaderboard_models.dart';
import 'package:the_game/features/leaderboards/data/leaderboards_repository.dart';

import '../../helpers/fake_http_adapter.dart';
import '../../helpers/test_overrides.dart';

Map<String, Object?> periodJson({String key = '2026-W46'}) => {
  'kind': 'WEEKLY',
  'key': key,
  'startsAt': '2026-11-16T00:00:00Z',
  'endsAt': '2026-11-23T00:00:00Z',
  'status': 'OPEN',
};

Map<String, Object?> rowJson(int rank, {bool isMe = false}) => {
  'rank': rank,
  'points': 100 - rank,
  'isMe': isMe,
  'user': {
    'id': 'u-$rank',
    'displayName': 'User $rank',
    'username': null,
    'avatarUrl': null,
  },
};

void main() {
  test('periods are mapped, newest first as sent', () async {
    final adapter = FakeHttpAdapter(
      (_) => jsonResponse({
        'items': [
          periodJson(),
          {...periodJson(key: 'all'), 'kind': 'ALL_TIME', 'endsAt': null},
        ],
      }),
    );
    final container = await createSignedInTestContainer(adapter);

    final periods = await container
        .read(leaderboardsRepositoryProvider)
        .fetchPeriods(LeaderboardKind.weekly);

    expect(periods.first.status, LeaderboardPeriodStatus.open);
    expect(periods.first.endsAt, DateTime.utc(2026, 11, 23));
    expect(periods.last.kind, LeaderboardKind.allTime);
    expect(periods.last.endsAt, isNull);
    expect(adapter.sentRequests.single.queryParameters['kind'], 'WEEKLY');
  });

  test('a page uses the current period by default and maps rows', () async {
    final adapter = FakeHttpAdapter(
      (_) => jsonResponse({
        'period': periodJson(),
        'category': 'BATTLES',
        'items': [rowJson(1), rowJson(2, isMe: true)],
        'nextCursor': 'c2',
      }),
    );
    final container = await createSignedInTestContainer(adapter);

    final page = await container
        .read(leaderboardsRepositoryProvider)
        .fetchPage(
          kind: LeaderboardKind.weekly,
          category: LeaderboardCategory.battles,
          limit: 2,
        );

    expect(page.rows[1].isMe, isTrue);
    expect(page.rows[0].points, 99);
    expect(page.category, LeaderboardCategory.battles);
    expect(page.hasMorePages, isTrue);
    final sent = adapter.sentRequests.single;
    expect(sent.path, '/v1/leaderboards/WEEKLY/current');
    expect(sent.queryParameters['category'], 'BATTLES');
    expect(sent.queryParameters['limit'], 2);
  });

  test('my rank is null when the player has no points yet', () async {
    final adapter = FakeHttpAdapter(
      (_) => jsonResponse({'rank': null, 'points': 0, 'around': <Object?>[]}),
    );
    final container = await createSignedInTestContainer(adapter);

    final myRank = await container
        .read(leaderboardsRepositoryProvider)
        .fetchMyRank(
          kind: LeaderboardKind.monthly,
          category: LeaderboardCategory.predictions,
          periodKey: '2026-11',
        );

    expect(myRank.rank, isNull);
    expect(myRank.around, isEmpty);
    expect(
      adapter.sentRequests.single.path,
      '/v1/leaderboards/MONTHLY/2026-11/me',
    );
  });

  test('an unknown period is a typed failure', () async {
    final adapter = FakeHttpAdapter(
      (_) => problemResponse(404, 'PERIOD_NOT_FOUND'),
    );
    final container = await createSignedInTestContainer(adapter);

    await expectLater(
      container
          .read(leaderboardsRepositoryProvider)
          .fetchMyRank(
            kind: LeaderboardKind.seasonal,
            category: LeaderboardCategory.battles,
            periodKey: 'bad',
          ),
      throwsA(
        isA<KnownProblemError<LeaderboardFailureReason>>().having(
          (error) => error.reason,
          'reason',
          LeaderboardFailureReason.periodNotFound,
        ),
      ),
    );
  });

  test('other failures stay ApiProblemError', () async {
    final adapter = FakeHttpAdapter((_) => problemResponse(500, 'INTERNAL'));
    final container = await createSignedInTestContainer(adapter);

    await expectLater(
      container
          .read(leaderboardsRepositoryProvider)
          .fetchPeriods(LeaderboardKind.weekly),
      throwsA(isA<ApiProblemError>()),
    );
  });
}
