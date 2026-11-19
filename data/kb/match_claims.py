"""D.3c: one claim per in-scope source row of a match result (07 §5.10, ADR-0022).

Every source's score is normalized to one meaning before anything is compared:
- goals are after extra time and never include a shootout;
- a shootout is kept apart (winner, and the kicks scored when the source has them);
- `shootout_known` says whether the source states if there was a shootout at all. martj42 lists shootouts in
  a separate file, so a missing row there is silence, not "no shootout".

What each source publishes (checked on 2026-11-18 against the 2006 and 2022 World Cup finals and the 2016
Champions League final):
- Transfermarkt `home_club_goals` include extra time AND the shootout kicks scored (2006 final: 6-4 for 1-1,
  5-3 on penalties); the kicks are `Shootout` events. Extra time shows as events after minute 90 (stoppage
  time is filed as minute 90).
- Fjelstul `home_team_score` includes extra time; the shootout and an extra-time flag are separate columns.
- martj42 `home_score` includes extra time; shootouts.csv names the winner only.
"""

import re
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import date

from kb.competitions import Competition, Coverage, MatchConfig

FACT_MATCH_RESULT = "MATCH_RESULT"
HOME, AWAY = "HOME", "AWAY"

# Why a source row is not a claim, or why a claim is not a match.
BEFORE_FIRST_DATE = "BEFORE_FIRST_DATE"
EXCLUDED_ROUND = "EXCLUDED_ROUND"
EXCLUDED_TOURNAMENT = "EXCLUDED_TOURNAMENT"
OUTSIDE_TIERS = "OUTSIDE_TIERS"
OUTSIDE_COVERAGE = "OUTSIDE_COVERAGE"
MISSING_DATE = "MISSING_DATE"
MISSING_SCORE = "MISSING_SCORE"
BAD_SCORE = "BAD_SCORE"
UNLINKED_TEAM = "UNLINKED_TEAM"
UNRESOLVED_NAME = "UNRESOLVED_NAME"
SAME_TEAM = "SAME_TEAM"
# Transfermarkt rows checked against its own events (see check_transfermarkt_score_against_events).
NO_GOAL_EVENTS = "NO_GOAL_EVENTS"
SCORE_DISAGREES_WITH_EVENTS = "SCORE_DISAGREES_WITH_EVENTS"
UNLEVEL_ONE_OFF_SHOOTOUT = "UNLEVEL_ONE_OFF_SHOOTOUT"

GROUP_OR_LEAGUE_STAGES = ("GROUP", "LEAGUE")


@dataclass(frozen=True)
class Shootout:
    winner: str | None  # HOME | AWAY; None when the kicks a source lists end level (incomplete events)
    home: int | None  # kicks scored; None when the source names only the winner
    away: int | None

    def swapped(self) -> "Shootout":
        winner = {HOME: AWAY, AWAY: HOME}.get(self.winner or "")
        return Shootout(winner, self.away, self.home)


@dataclass(frozen=True)
class TeamSide:
    source_id: str  # the source's team id; the team name for martj42
    name: str
    ref: str | None  # core.entity external_ref, None when unlinked


@dataclass(frozen=True)
class Result:
    """A score with one meaning across sources (see the module docstring)."""

    home_goals: int
    away_goals: int
    extra_time: bool | None
    shootout: Shootout | None
    shootout_known: bool

    def swapped(self) -> "Result":
        shootout = self.shootout.swapped() if self.shootout else None
        return Result(self.away_goals, self.home_goals, self.extra_time, shootout, self.shootout_known)


@dataclass(frozen=True)
class MatchClaim:
    source: str
    source_row_id: str
    competition_key: str
    tier: int
    match_date: date
    home: TeamSide
    away: TeamSide
    result: Result
    # Home and away may be swapped against another source only at a neutral venue, or where the home team is
    # the tournament host (martj42 puts the host first; the organizer's home team can be the other side).
    neutral_or_host_venue: bool
    stage: str | None = None
    leg: int | None = None
    season_start_year: int | None = None  # the source's own season, when it has one
    round_name: str | None = None
    stage_inferred: bool = False  # stage FINAL read from "last match of the edition", not from the source

    @property
    def has_both_teams_linked(self) -> bool:
        return self.home.ref is not None and self.away.ref is not None

    def fact_key(self) -> str:
        """competition|date|home|away as this source states it; an unlinked team keeps its source id."""

        def team_key(team: TeamSide) -> str:
            return team.ref or f"?{self.source}:{team.source_id}"

        return f"{self.competition_key}|{self.match_date.isoformat()}|{team_key(self.home)}|{team_key(self.away)}"

    def value(self) -> dict:
        shootout = self.result.shootout
        return {
            "competition": self.competition_key,
            "tier": self.tier,
            "date": self.match_date.isoformat(),
            "stage": self.stage,
            "stage_inferred": self.stage_inferred,
            "leg": self.leg,
            "round": self.round_name,
            "season_start_year": self.season_start_year,
            "home": {"ref": self.home.ref, "source_id": self.home.source_id, "name": self.home.name},
            "away": {"ref": self.away.ref, "source_id": self.away.source_id, "name": self.away.name},
            "home_goals": self.result.home_goals,
            "away_goals": self.result.away_goals,
            "extra_time": self.result.extra_time,
            "shootout": None
            if shootout is None
            else {"winner": shootout.winner, "home": shootout.home, "away": shootout.away},
            "shootout_known": self.result.shootout_known,
            "neutral_or_host_venue": self.neutral_or_host_venue,
        }


def parse_non_negative_int(text: str | None) -> int | None:
    text = (text or "").strip()
    return int(text) if text.isdigit() else None


def parse_day(text: str | None) -> date | None:
    try:
        return date.fromisoformat((text or "").strip()[:10])
    except ValueError:
        return None


def winner_of_kicks(home: int, away: int) -> str | None:
    return HOME if home > away else AWAY if away > home else None


def result_from_transfermarkt(
    home_goals_text: str | None,
    away_goals_text: str | None,
    home_kicks_scored: int,
    away_kicks_scored: int,
    kicks_taken: int,
    extra_time_events_seen: bool,
    game_has_events: bool,
) -> Result | str:
    """Transfermarkt goals minus the shootout kicks scored. Extra time is known only when events show it."""
    home_total, away_total = parse_non_negative_int(home_goals_text), parse_non_negative_int(away_goals_text)
    if home_total is None or away_total is None:
        return MISSING_SCORE
    home_goals, away_goals = home_total - home_kicks_scored, away_total - away_kicks_scored
    if home_goals < 0 or away_goals < 0:
        return BAD_SCORE
    shootout = None
    if kicks_taken:
        shootout = Shootout(
            winner_of_kicks(home_kicks_scored, away_kicks_scored), home_kicks_scored, away_kicks_scored
        )
    # A game with events but no shootout events states "no shootout"; a game without events states nothing.
    return Result(home_goals, away_goals, True if extra_time_events_seen else None, shootout, game_has_events)


def check_transfermarkt_score_against_events(
    result: Result, home_goal_events: int, away_goal_events: int, is_one_off_match: bool
) -> str | None:
    """Why a normalized Transfermarkt score cannot be trusted, or None. Found on 2026-11-18:

    - rows that silently include the shootout with no Shootout events (Europa League final 2014-05-14 stored
      4-2 for 0-0 and 4-2 on penalties);
    - rows that leave the shootout out although its events exist (Arsenal-Porto 2024-03-12 stored 4-2 for
      1-0 after extra time; subtracting the kicks gives 0-0);
    - awarded matches: goals but no goal events (Hellas Verona-Roma 2020-09-19, 3-0), or played goals that
      only add up to the awarded total (Union Berlin-Bochum 2024-12-14 stored 0-2, events 1-1);
    - a shootout after an unlevel one-off match, which cannot happen.

    Goals are compared per club: Transfermarkt files an own goal under the club that benefits from it
    (44,347 of 44,350 usable matches agree per club; the 3 others were awarded results).
    """
    if result.home_goals + result.away_goals > 0 and home_goal_events + away_goal_events == 0:
        return NO_GOAL_EVENTS
    if (result.home_goals, result.away_goals) != (home_goal_events, away_goal_events):
        return SCORE_DISAGREES_WITH_EVENTS
    if result.shootout and is_one_off_match and result.home_goals != result.away_goals:
        return UNLEVEL_ONE_OFF_SHOOTOUT
    return None


def result_from_fjelstul(row: dict) -> Result | str:
    home_goals, away_goals = (
        parse_non_negative_int(row.get("home_team_score")),
        parse_non_negative_int(row.get("away_team_score")),
    )
    if home_goals is None or away_goals is None:
        return MISSING_SCORE
    shootout = None
    if (row.get("penalty_shootout") or "").strip() == "1":
        home_kicks = parse_non_negative_int(row.get("home_team_score_penalties"))
        away_kicks = parse_non_negative_int(row.get("away_team_score_penalties"))
        if home_kicks is None or away_kicks is None:
            return BAD_SCORE
        shootout = Shootout(winner_of_kicks(home_kicks, away_kicks), home_kicks, away_kicks)
    extra_time = (row.get("extra_time") or "").strip() == "1"
    return Result(home_goals, away_goals, extra_time, shootout, True)


def result_from_martj42(
    home_score: str | None,
    away_score: str | None,
    home_name: str,
    away_name: str,
    shootout_winner: str | None,
) -> Result | str:
    home_goals, away_goals = parse_non_negative_int(home_score), parse_non_negative_int(away_score)
    if home_goals is None or away_goals is None:
        return MISSING_SCORE
    side = {home_name: HOME, away_name: AWAY}.get(shootout_winner or "")
    # No shootouts.csv row, or a winner that is neither team: martj42 says nothing about a shootout.
    shootout = Shootout(side, None, None) if side else None
    return Result(home_goals, away_goals, None, shootout, side is not None)


_LEG = re.compile(r"(?i)\b([12])(?:st|nd)\s+leg\b")
_TRANSFERMARKT_STAGES = (
    (re.compile(r"(?i)third place"), "THIRD_PLACE"),
    (re.compile(r"(?i)semi"), "SEMI_FINAL"),
    (re.compile(r"(?i)quarter"), "QUARTER_FINAL"),
    (re.compile(r"(?i)^\s*final\b"), "FINAL"),  # also "final 1st leg" (two-legged super cups)
    (re.compile(r"(?i)round of 16|last 16"), "ROUND_OF_16"),
    (re.compile(r"(?i)round of 32"), "ROUND_OF_32"),
    (re.compile(r"(?i)group|league phase"), "GROUP"),
    (re.compile(r"(?i)intermediate stage"), "KNOCKOUT_PLAYOFF"),
)
_FJELSTUL_STAGES = {
    "group stage": "GROUP",
    "second group stage": "GROUP",
    "final round": "GROUP",
    "round of 16": "ROUND_OF_16",
    "quarter-final": "QUARTER_FINAL",
    "quarter-finals": "QUARTER_FINAL",
    "semi-final": "SEMI_FINAL",
    "semi-finals": "SEMI_FINAL",
    "third-place match": "THIRD_PLACE",
    "final": "FINAL",
}


def stage_and_leg_from_transfermarkt_round(
    round_name: str | None, competition_kind: str
) -> tuple[str, int | None]:
    """'Quarter-Finals 2nd leg' → (QUARTER_FINAL, 2); a league matchday → LEAGUE; cup rounds → EARLY_ROUND."""
    text = round_name or ""
    leg_match = _LEG.search(text)
    leg = int(leg_match.group(1)) if leg_match else None
    if competition_kind == "LEAGUE":
        return "LEAGUE", None
    for pattern, stage in _TRANSFERMARKT_STAGES:
        if pattern.search(text):
            return stage, leg
    return "EARLY_ROUND", leg


def stage_from_fjelstul(stage_name: str | None) -> str | None:
    return _FJELSTUL_STAGES.get((stage_name or "").strip().lower())


def check_row_is_in_scope(
    config: MatchConfig,
    coverage: Coverage,
    source: str,
    source_competition_id: str,
    day: date | None,
    round_name: str | None = None,
) -> Competition | str:
    """The row's competition, or why it is skipped: the DEC-67 filters, the tiers, then the coverage window."""
    if day is None:
        return MISSING_DATE
    if day < config.filters.first_match_date:
        return BEFORE_FIRST_DATE
    if source == "martj42" and config.filters.is_excluded_tournament(source_competition_id):
        return EXCLUDED_TOURNAMENT
    if config.filters.is_excluded_round(round_name):
        return EXCLUDED_ROUND
    competition = config.competition_of_source_id(source, source_competition_id)
    if competition is None or source_competition_id not in config.source_tiers[source]:
        return OUTSIDE_TIERS
    if not coverage.covers(source, competition.key, day):
        return OUTSIDE_COVERAGE
    return competition


@dataclass(frozen=True)
class TransfermarktEvents:
    """What the events file says per game: shootout kicks per club, and whether extra time was played."""

    kicks: dict[str, dict[str, tuple[int, int]]]  # game_id → club_id → (scored, taken)
    games_with_extra_time_events: set[str]
    games_with_events: set[str]
    goal_events: dict[
        str, dict[str, int]
    ]  # game_id → club_id → Goals events (own goals: the benefiting club)


@dataclass(frozen=True)
class RejectedClaim:
    """A source row that is in scope but whose score its own source contradicts: never a claim, kept for the
    report and the review file, and so the matches of other sources know this source had the match."""

    claim: MatchClaim
    reason: str


TeamRefLookup = Callable[[str, str], str | None]  # (source_kind, source_id) → entity ref


def claim_from_transfermarkt_game(
    row: dict, config: MatchConfig, coverage: Coverage, team_ref: TeamRefLookup, events: TransfermarktEvents
) -> MatchClaim | RejectedClaim | str:
    day = parse_day(row.get("date"))
    scope = check_row_is_in_scope(
        config, coverage, "transfermarkt", row["competition_id"], day, row.get("round")
    )
    if isinstance(scope, str):
        return scope
    assert day is not None
    game_id = row["game_id"]
    home_id, away_id = row["home_club_id"] or "", row["away_club_id"] or ""
    if home_id == away_id:
        return SAME_TEAM
    kicks = events.kicks.get(game_id, {})
    home_scored, home_taken = kicks.get(home_id, (0, 0))
    away_scored, away_taken = kicks.get(away_id, (0, 0))
    result = result_from_transfermarkt(
        row.get("home_club_goals"),
        row.get("away_club_goals"),
        home_scored,
        away_scored,
        home_taken + away_taken,
        game_id in events.games_with_extra_time_events,
        game_id in events.games_with_events,
    )
    if isinstance(result, str):
        return result
    stage, leg = stage_and_leg_from_transfermarkt_round(row.get("round"), scope.kind)
    goals_by_club = events.goal_events.get(game_id, {})
    distrust = check_transfermarkt_score_against_events(
        result, goals_by_club.get(home_id, 0), goals_by_club.get(away_id, 0), leg is None
    )
    kind = scope.team_kind
    season = parse_non_negative_int(row.get("season"))
    claim = MatchClaim(
        source="transfermarkt",
        source_row_id=game_id,
        competition_key=scope.key,
        tier=scope.tier,
        match_date=day,
        home=TeamSide(home_id, row.get("home_club_name") or "", team_ref(kind, home_id)),
        away=TeamSide(away_id, row.get("away_club_name") or "", team_ref(kind, away_id)),
        result=result,
        # Tournament venues are the organizer's; a club match is at the home ground except a one-off final.
        neutral_or_host_venue=scope.kind == "INTERNATIONAL" or (stage == "FINAL" and leg is None),
        stage=stage,
        leg=leg,
        season_start_year=season,
        round_name=row.get("round"),
    )
    return RejectedClaim(claim, distrust) if distrust else claim


def claim_from_fjelstul_match(
    row: dict, config: MatchConfig, coverage: Coverage, team_ref: TeamRefLookup
) -> MatchClaim | str:
    day = parse_day(row.get("match_date"))
    scope = check_row_is_in_scope(config, coverage, "fjelstul", row["tournament_id"], day)
    if isinstance(scope, str):
        return scope
    assert day is not None
    result = result_from_fjelstul(row)
    if isinstance(result, str):
        return result
    home_id, away_id = row["home_team_id"] or "", row["away_team_id"] or ""
    if home_id == away_id:
        return SAME_TEAM
    year = parse_non_negative_int((row.get("tournament_id") or "").split("-")[-1])
    return MatchClaim(
        source="fjelstul",
        source_row_id=row["match_id"],
        competition_key=scope.key,
        tier=scope.tier,
        match_date=day,
        home=TeamSide(home_id, row.get("home_team_name") or "", team_ref("NATIONAL_TEAM", home_id)),
        away=TeamSide(away_id, row.get("away_team_name") or "", team_ref("NATIONAL_TEAM", away_id)),
        result=result,
        neutral_or_host_venue=True,  # World Cup venues are FIFA's; its home team is a draw position
        stage=stage_from_fjelstul(row.get("stage_name")),
        season_start_year=year,
        round_name=row.get("stage_name"),
    )


def claim_from_martj42_result(
    row: dict,
    config: MatchConfig,
    coverage: Coverage,
    team_ref_by_name: Callable[[str, date], str | None],
    shootout_winner: str | None,
) -> MatchClaim | str:
    day = parse_day(row.get("date"))
    scope = check_row_is_in_scope(config, coverage, "martj42", row.get("tournament") or "", day)
    if isinstance(scope, str):
        return scope
    assert day is not None
    home_name, away_name = row["home_team"] or "", row["away_team"] or ""
    if home_name == away_name:
        return SAME_TEAM
    result = result_from_martj42(
        row.get("home_score"), row.get("away_score"), home_name, away_name, shootout_winner
    )
    if isinstance(result, str):
        return result
    neutral = (row.get("neutral") or "").strip().upper() == "TRUE"
    host_at_home = (row.get("country") or "").strip() == home_name
    return MatchClaim(
        source="martj42",
        source_row_id=martj42_row_id(row),
        competition_key=scope.key,
        tier=scope.tier,
        match_date=day,
        home=TeamSide(home_name, home_name, team_ref_by_name(home_name, day)),
        away=TeamSide(away_name, away_name, team_ref_by_name(away_name, day)),
        result=result,
        neutral_or_host_venue=neutral or host_at_home,
        round_name=row.get("tournament"),
    )


def martj42_row_id(row: dict) -> str:
    """martj42 rows have no id; date and teams identify a match (one known duplicate, a 1974 friendly)."""
    return f"{row.get('date')}|{row.get('home_team')}|{row.get('away_team')}"


def with_inferred_final(claim: MatchClaim) -> MatchClaim:
    return replace(claim, stage="FINAL", stage_inferred=True)
