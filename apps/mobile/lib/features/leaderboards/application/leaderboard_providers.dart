import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/leaderboards/data/leaderboard_models.dart';
import 'package:the_game/features/leaderboards/data/leaderboards_repository.dart';

final leaderboardPeriodsProvider = FutureProvider.autoDispose
    .family<List<LeaderboardPeriod>, LeaderboardKind>(
      (ref, kind) =>
          ref.watch(leaderboardsRepositoryProvider).fetchPeriods(kind),
    );

/// Which board to read. A value class, so equal selections share one provider.
class LeaderboardSelection {
  const LeaderboardSelection({
    required this.kind,
    required this.category,
    this.periodKey = currentLeaderboardPeriodKey,
  });

  final LeaderboardKind kind;
  final LeaderboardCategory category;
  final String periodKey;

  @override
  bool operator ==(Object other) =>
      other is LeaderboardSelection &&
      other.kind == kind &&
      other.category == category &&
      other.periodKey == periodKey;

  @override
  int get hashCode => Object.hash(kind, category, periodKey);
}

/// The first page of a board; later pages come from `fetchPage` with the `nextCursor`.
final leaderboardFirstPageProvider = FutureProvider.autoDispose
    .family<LeaderboardPage, LeaderboardSelection>(
      (ref, selection) => ref
          .watch(leaderboardsRepositoryProvider)
          .fetchPage(
            kind: selection.kind,
            category: selection.category,
            periodKey: selection.periodKey,
          ),
    );

final myRankProvider = FutureProvider.autoDispose
    .family<MyRank, LeaderboardSelection>(
      (ref, selection) => ref
          .watch(leaderboardsRepositoryProvider)
          .fetchMyRank(
            kind: selection.kind,
            category: selection.category,
            periodKey: selection.periodKey,
          ),
    );
