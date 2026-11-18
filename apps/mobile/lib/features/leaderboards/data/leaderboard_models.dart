/// Leaderboards (API §6.8): projections of the points ledger, computed by the server.
library;

import 'package:the_game/features/social/data/social_models.dart';

enum LeaderboardKind {
  weekly('WEEKLY'),
  monthly('MONTHLY'),
  seasonal('SEASONAL'),
  allTime('ALL_TIME');

  const LeaderboardKind(this.wireName);

  final String wireName;
}

enum LeaderboardCategory {
  battles('BATTLES'),
  predictions('PREDICTIONS');

  const LeaderboardCategory(this.wireName);

  final String wireName;
}

enum LeaderboardPeriodStatus { open, closed, unknown }

/// The period key meaning "the period running now" in the page and rank requests.
const currentLeaderboardPeriodKey = 'current';

class LeaderboardPeriod {
  const LeaderboardPeriod({
    required this.kind,
    required this.key,
    required this.startsAt,
    required this.endsAt,
    required this.status,
  });

  final LeaderboardKind? kind;
  final String key;
  final DateTime startsAt;

  /// `null` for the all-time board.
  final DateTime? endsAt;
  final LeaderboardPeriodStatus status;
}

class LeaderboardRow {
  const LeaderboardRow({
    required this.rank,
    required this.user,
    required this.points,
    required this.isMe,
  });

  /// Equal points share a rank.
  final int rank;
  final PublicUser user;
  final int points;
  final bool isMe;
}

class LeaderboardPage {
  const LeaderboardPage({
    required this.period,
    required this.category,
    required this.rows,
    required this.nextCursor,
  });

  final LeaderboardPeriod period;
  final LeaderboardCategory? category;
  final List<LeaderboardRow> rows;
  final String? nextCursor;

  bool get hasMorePages => nextCursor != null;
}

class MyRank {
  const MyRank({
    required this.rank,
    required this.points,
    required this.around,
  });

  /// `null`: the player has no points in this period yet.
  final int? rank;
  final int points;

  /// The player's row with two neighbours on each side.
  final List<LeaderboardRow> around;
}

enum LeaderboardFailureReason { periodNotFound }

const leaderboardFailureReasonsByCode = {
  'PERIOD_NOT_FOUND': LeaderboardFailureReason.periodNotFound,
};
