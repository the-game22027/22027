import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/time/parse_server_timestamp.dart';
import 'package:the_game/features/football/data/football_models.dart';

/// Read-only football data (API §6.3).
class FootballRepository {
  FootballRepository(this._footballApi);

  final FootballApi _footballApi;

  /// `GET /v1/competitions`: the active competitions, a small fixed list.
  Future<List<Competition>> fetchActiveCompetitions() async {
    final page = await sendRequestAndReadData(
      _footballApi.footballControllerCompetitionsV1,
    );
    return [
      for (final competition in page.items)
        Competition(
          id: competition.id,
          code: competition.code,
          name: competition.name,
          type: competition.type,
          countryCode: competition.countryCode,
          isNationalTeams: competition.isNationalTeams,
        ),
    ];
  }

  /// `GET /v1/matches`: matches ordered by kickoff. Pass the previous page's `nextCursor` as
  /// [cursor] for the next page, with the same filters.
  Future<MatchPage> fetchMatches({
    DateTime? kickoffFrom,
    DateTime? kickoffTo,
    String? competitionId,
    MatchStatus? status,
    int? limit,
    String? cursor,
  }) async {
    final page = await sendRequestAndReadData(
      () => _footballApi.footballControllerMatchesV1(
        from: kickoffFrom?.toUtc().toIso8601String(),
        to: kickoffTo?.toUtc().toIso8601String(),
        competitionId: competitionId,
        status: status == null || status == MatchStatus.unknown
            ? null
            : status.name.toUpperCase(),
        limit: limit,
        cursor: cursor,
      ),
    );
    return MatchPage(
      matches: [for (final match in page.items) _convertMatchSummary(match)],
      nextCursor: page.nextCursor,
    );
  }

  /// `GET /v1/matches/{matchId}`, with the server time for countdowns.
  Future<MatchDetail> fetchMatchDetail(String matchId) async {
    final match = await sendRequestAndReadData(
      () => _footballApi.footballControllerMatchV1(matchId: matchId),
    );
    return MatchDetail(
      match: MatchSummary(
        id: match.id,
        competition: _convertCompetition(match.competition),
        roundLabel: match.roundLabel,
        homeTeam: _convertTeam(match.homeTeam),
        awayTeam: _convertTeam(match.awayTeam),
        kickoffAt: parseServerTimestamp(match.kickoffAt),
        status: findMatchStatusByCode(match.status.value),
        score: _convertScore(match.score),
        isPredictable: match.predictable,
      ),
      endedAt: parseOptionalServerTimestamp(match.endedAt),
      serverTime: parseServerTimestamp(match.serverTime),
    );
  }

  /// `GET /v1/matches/{matchId}/squads`: both teams' players (the MOTM candidates later).
  Future<List<SquadPlayer>> fetchMatchSquads(String matchId) async {
    final squads = await sendRequestAndReadData(
      () => _footballApi.footballControllerSquadsV1(matchId: matchId),
    );
    return [
      for (final player in squads.items)
        SquadPlayer(
          playerId: player.playerId,
          name: player.name,
          teamId: player.teamId,
          role: switch (player.role) {
            'STARTER' => SquadRole.starter,
            'SUBSTITUTE' => SquadRole.substitute,
            _ => SquadRole.unknown,
          },
          shirtNumber: player.shirtNumber?.toInt(),
        ),
    ];
  }
}

MatchStatus findMatchStatusByCode(String code) => MatchStatus.values.firstWhere(
  (status) =>
      status != MatchStatus.unknown && status.name.toUpperCase() == code,
  orElse: () => MatchStatus.unknown,
);

MatchSummary _convertMatchSummary(MatchSummaryDto match) => MatchSummary(
  id: match.id,
  competition: _convertCompetition(match.competition),
  roundLabel: match.roundLabel,
  homeTeam: _convertTeam(match.homeTeam),
  awayTeam: _convertTeam(match.awayTeam),
  kickoffAt: parseServerTimestamp(match.kickoffAt),
  status: findMatchStatusByCode(match.status.value),
  score: _convertScore(match.score),
  isPredictable: match.predictable,
);

MatchCompetition _convertCompetition(MatchCompetitionDto competition) =>
    MatchCompetition(
      id: competition.id,
      name: competition.name,
      code: competition.code,
    );

FootballTeam _convertTeam(TeamDto team) => FootballTeam(
  id: team.id,
  name: team.name,
  shortName: team.shortName,
  crestUrl: team.crestUrl,
  type: switch (team.type) {
    'CLUB' => TeamType.club,
    'NATIONAL' => TeamType.national,
    _ => TeamType.unknown,
  },
);

MatchScore? _convertScore(ScoreDto? score) {
  if (score == null) return null;
  final penalties = score.penalties;
  return MatchScore(
    home: score.home.toInt(),
    away: score.away.toInt(),
    decidedBy: score.decidedBy,
    penalties: penalties == null
        ? null
        : PenaltyShootoutScore(
            home: penalties.home.toInt(),
            away: penalties.away.toInt(),
          ),
  );
}

final footballRepositoryProvider = Provider<FootballRepository>(
  (ref) => FootballRepository(ref.watch(apiClientProvider).getFootballApi()),
);
