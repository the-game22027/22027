import 'package:api_client/api_client.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/errors/known_problem_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/time/parse_server_timestamp.dart';
import 'package:the_game/features/leaderboards/data/leaderboard_models.dart';
import 'package:the_game/features/social/data/social_mappers.dart';

/// Leaderboards (API §6.8). A malformed or unknown period key is
/// `KnownProblemError<LeaderboardFailureReason>` (`PERIOD_NOT_FOUND`).
class LeaderboardsRepository {
  LeaderboardsRepository(this._leaderboardsApi);

  final LeaderboardsApi _leaderboardsApi;

  /// `GET /v1/leaderboards/periods`: the current period and up to 11 before it, newest first.
  Future<List<LeaderboardPeriod>> fetchPeriods(LeaderboardKind kind) async {
    final list = await _sendRequestAndConvertLeaderboardProblems(
      () =>
          _leaderboardsApi.leaderboardsControllerPeriodsV1(kind: kind.wireName),
    );
    return [for (final period in list.items) _convertPeriod(period)];
  }

  /// `GET /v1/leaderboards/{kind}/{periodKey}`. Pass the previous page's `nextCursor` as
  /// [cursor] for the next page.
  Future<LeaderboardPage> fetchPage({
    required LeaderboardKind kind,
    required LeaderboardCategory category,
    String periodKey = currentLeaderboardPeriodKey,
    int? limit,
    String? cursor,
  }) async {
    final page = await _sendRequestAndConvertLeaderboardProblems(
      () => _leaderboardsApi.leaderboardsControllerPageV1(
        kind: kind.wireName,
        periodKey: periodKey,
        category: category.wireName,
        limit: limit,
        cursor: cursor,
      ),
    );
    return LeaderboardPage(
      period: _convertPeriod(page.period),
      category: switch (page.category) {
        LeaderboardPageDtoCategoryEnum.BATTLES => LeaderboardCategory.battles,
        LeaderboardPageDtoCategoryEnum.PREDICTIONS =>
          LeaderboardCategory.predictions,
        LeaderboardPageDtoCategoryEnum.unknownDefaultOpenApi => null,
      },
      rows: [for (final row in page.items) _convertRow(row)],
      nextCursor: page.nextCursor,
    );
  }

  /// `GET /v1/leaderboards/{kind}/{periodKey}/me`.
  Future<MyRank> fetchMyRank({
    required LeaderboardKind kind,
    required LeaderboardCategory category,
    String periodKey = currentLeaderboardPeriodKey,
  }) async {
    final myRank = await _sendRequestAndConvertLeaderboardProblems(
      () => _leaderboardsApi.leaderboardsControllerMyRankV1(
        kind: kind.wireName,
        periodKey: periodKey,
        category: category.wireName,
      ),
    );
    return MyRank(
      rank: myRank.rank?.toInt(),
      points: myRank.points.toInt(),
      around: [for (final row in myRank.around) _convertRow(row)],
    );
  }

  Future<T> _sendRequestAndConvertLeaderboardProblems<T>(
    Future<Response<T>> Function() sendRequest,
  ) => convertKnownProblems(
    () => sendRequestAndReadData(sendRequest),
    (problem) => findReasonByCode(problem, leaderboardFailureReasonsByCode),
  );
}

LeaderboardPeriod _convertPeriod(LeaderboardPeriodDto period) =>
    LeaderboardPeriod(
      kind: switch (period.kind) {
        LeaderboardPeriodDtoKindEnum.WEEKLY => LeaderboardKind.weekly,
        LeaderboardPeriodDtoKindEnum.MONTHLY => LeaderboardKind.monthly,
        LeaderboardPeriodDtoKindEnum.SEASONAL => LeaderboardKind.seasonal,
        LeaderboardPeriodDtoKindEnum.ALL_TIME => LeaderboardKind.allTime,
        LeaderboardPeriodDtoKindEnum.unknownDefaultOpenApi => null,
      },
      key: period.key,
      startsAt: parseServerTimestamp(period.startsAt),
      endsAt: parseOptionalServerTimestamp(period.endsAt),
      status: switch (period.status) {
        LeaderboardPeriodDtoStatusEnum.OPEN => LeaderboardPeriodStatus.open,
        LeaderboardPeriodDtoStatusEnum.CLOSED => LeaderboardPeriodStatus.closed,
        LeaderboardPeriodDtoStatusEnum.unknownDefaultOpenApi =>
          LeaderboardPeriodStatus.unknown,
      },
    );

LeaderboardRow _convertRow(LeaderboardRowDto row) => LeaderboardRow(
  rank: row.rank.toInt(),
  user: convertPublicUser(row.user),
  points: row.points.toInt(),
  isMe: row.isMe,
);

final leaderboardsRepositoryProvider = Provider<LeaderboardsRepository>(
  (ref) =>
      LeaderboardsRepository(ref.watch(apiClientProvider).getLeaderboardsApi()),
);
