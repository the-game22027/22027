/// Football reference data as the app uses it (API §5, "Football"). Screens use these, never
/// the generated DTOs.
library;

enum MatchStatus {
  scheduled,
  live,
  finished,
  postponed,
  cancelled,
  abandoned,

  /// A status this app version does not know yet (API §1: tolerate new enum values).
  unknown,
}

enum TeamType { club, national, unknown }

class Competition {
  const Competition({
    required this.id,
    required this.code,
    required this.name,
    required this.type,
    required this.countryCode,
    required this.isNationalTeams,
  });

  final String id;
  final String code;
  final String name;

  /// For example `LEAGUE` or `CUP`; kept as text because the API leaves it open.
  final String type;
  final String? countryCode;
  final bool isNationalTeams;
}

class FootballTeam {
  const FootballTeam({
    required this.id,
    required this.name,
    required this.type,
    this.shortName,
    this.crestUrl,
  });

  final String id;
  final String name;
  final String? shortName;
  final String? crestUrl;
  final TeamType type;
}

class MatchCompetition {
  const MatchCompetition({
    required this.id,
    required this.name,
    required this.code,
  });

  final String id;
  final String name;
  final String code;
}

class MatchScore {
  const MatchScore({
    required this.home,
    required this.away,
    this.decidedBy,
    this.penalties,
  });

  final int home;
  final int away;

  /// How a knockout match was decided, for example `PENALTIES`; `null` for regular time.
  final String? decidedBy;
  final PenaltyShootoutScore? penalties;
}

class PenaltyShootoutScore {
  const PenaltyShootoutScore({required this.home, required this.away});

  final int home;
  final int away;
}

class MatchSummary {
  const MatchSummary({
    required this.id,
    required this.competition,
    required this.homeTeam,
    required this.awayTeam,
    required this.kickoffAt,
    required this.status,
    required this.isPredictable,
    this.roundLabel,
    this.score,
  });

  final String id;
  final MatchCompetition competition;
  final String? roundLabel;
  final FootballTeam homeTeam;
  final FootballTeam awayTeam;
  final DateTime kickoffAt;
  final MatchStatus status;
  final MatchScore? score;

  /// Decided by the server (kickoff lock, status). The app never computes it from the clock.
  final bool isPredictable;
}

class MatchDetail {
  const MatchDetail({
    required this.match,
    required this.serverTime,
    this.endedAt,
  });

  final MatchSummary match;
  final DateTime? endedAt;

  /// The server clock when the response was built: countdowns use it, not the device clock.
  final DateTime serverTime;
}

/// One page of `GET /v1/matches`. [nextCursor] is opaque; `null` means the last page.
class MatchPage {
  const MatchPage({required this.matches, required this.nextCursor});

  final List<MatchSummary> matches;
  final String? nextCursor;

  bool get hasMorePages => nextCursor != null;
}

enum SquadRole { starter, substitute, unknown }

class SquadPlayer {
  const SquadPlayer({
    required this.playerId,
    required this.name,
    required this.teamId,
    required this.role,
    this.shirtNumber,
  });

  final String playerId;
  final String name;
  final String teamId;
  final SquadRole role;
  final int? shirtNumber;
}
