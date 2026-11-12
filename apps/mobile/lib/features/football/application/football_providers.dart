import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/features/football/data/football_models.dart';
import 'package:the_game/features/football/data/football_repository.dart';

final activeCompetitionsProvider =
    FutureProvider.autoDispose<List<Competition>>(
      (ref) => ref.watch(footballRepositoryProvider).fetchActiveCompetitions(),
    );

final matchDetailProvider = FutureProvider.autoDispose
    .family<MatchDetail, String>(
      (ref, matchId) =>
          ref.watch(footballRepositoryProvider).fetchMatchDetail(matchId),
    );

final matchSquadsProvider = FutureProvider.autoDispose
    .family<List<SquadPlayer>, String>(
      (ref, matchId) =>
          ref.watch(footballRepositoryProvider).fetchMatchSquads(matchId),
    );

/// The filters of one match list. A value class, so equal filters share one list.
class MatchListFilter {
  const MatchListFilter({
    this.kickoffFrom,
    this.kickoffTo,
    this.competitionId,
    this.status,
    this.pageSize = 20,
  });

  final DateTime? kickoffFrom;
  final DateTime? kickoffTo;
  final String? competitionId;
  final MatchStatus? status;
  final int pageSize;

  @override
  bool operator ==(Object other) =>
      other is MatchListFilter &&
      other.kickoffFrom == kickoffFrom &&
      other.kickoffTo == kickoffTo &&
      other.competitionId == competitionId &&
      other.status == status &&
      other.pageSize == pageSize;

  @override
  int get hashCode =>
      Object.hash(kickoffFrom, kickoffTo, competitionId, status, pageSize);
}

/// The matches loaded so far for one filter.
class MatchList {
  const MatchList({required this.matches, required this.nextCursor});

  final List<MatchSummary> matches;
  final String? nextCursor;

  bool get hasMorePages => nextCursor != null;
}

/// Loads the first page of matches, then more pages on demand (an endless list).
class MatchListController extends AsyncNotifier<MatchList> {
  MatchListController(this.filter);

  final MatchListFilter filter;
  bool _isLoadingNextPage = false;

  @override
  Future<MatchList> build() async {
    final page = await _fetchPage(cursor: null);
    return MatchList(matches: page.matches, nextCursor: page.nextCursor);
  }

  /// Appends the next page. Does nothing while a page is loading or after the last page.
  /// A failure keeps the matches already loaded and is rethrown for the caller to show.
  Future<void> loadNextPage() async {
    final current = state.value;
    if (current == null || !current.hasMorePages || _isLoadingNextPage) return;
    _isLoadingNextPage = true;
    try {
      final page = await _fetchPage(cursor: current.nextCursor);
      if (!ref.mounted) return;
      state = AsyncData(
        MatchList(
          matches: [...current.matches, ...page.matches],
          nextCursor: page.nextCursor,
        ),
      );
    } finally {
      _isLoadingNextPage = false;
    }
  }

  Future<MatchPage> _fetchPage({required String? cursor}) => ref
      .read(footballRepositoryProvider)
      .fetchMatches(
        kickoffFrom: filter.kickoffFrom,
        kickoffTo: filter.kickoffTo,
        competitionId: filter.competitionId,
        status: filter.status,
        limit: filter.pageSize,
        cursor: cursor,
      );
}

final matchListProvider = AsyncNotifierProvider.autoDispose
    .family<MatchListController, MatchList, MatchListFilter>(
      MatchListController.new,
    );
