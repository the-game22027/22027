"""D.3c resolution: which claims are the same match, and what the match's result is (07 §5.10, ADR-0022).

- Identity: same competition, the same two linked teams, dates at most one day apart (time zones), at most
  one claim per source. Home and away may be swapped only when both claims are at a neutral or host venue.
- Two or more sources agree on the result → VERIFIED. They disagree → CONFLICT, with the precedence table's
  provisional values. One source → SINGLE_SOURCE; it is usable only from a source the precedence table lists
  for that competition, and only when no other source covering that day lacks the match.
- Editions: club seasons from the source's season (or the date, July to June); national-team tournaments
  from the match dates (a gap of more than EDITION_GAP_DAYS starts a new edition).
"""

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from datetime import date
from itertools import combinations

from kb.competitions import Competition
from kb.match_claims import AWAY, GROUP_OR_LEAGUE_STAGES, HOME, MatchClaim, Result, with_inferred_final

MAX_DATE_DIFFERENCE_DAYS = 1
# A tournament lasts at most about six weeks and the next edition is at least a year later.
EDITION_GAP_DAYS = 120
CLUB_SEASON_FIRST_MONTH = 7

VERIFIED, SINGLE_SOURCE, CONFLICT = "VERIFIED", "SINGLE_SOURCE", "CONFLICT"


def can_swap_home_and_away(first: MatchClaim, second: MatchClaim) -> bool:
    return first.neutral_or_host_venue and second.neutral_or_host_venue


def precedence_rank_of_source(source: str, precedence: tuple[str, ...]) -> int:
    return precedence.index(source) if source in precedence else len(precedence)


def group_claims_into_matches(
    claims: Iterable[MatchClaim], precedence_of: Callable[[str], tuple[str, ...]]
) -> list[list[MatchClaim]]:
    """Clusters of claims that are one match. Claims without both teams linked never join a match."""
    by_pairing: dict[tuple[str, frozenset[str]], list[MatchClaim]] = defaultdict(list)
    for claim in claims:
        if claim.has_both_teams_linked:
            by_pairing[(claim.competition_key, frozenset((claim.home.ref, claim.away.ref)))].append(claim)
    matches: list[list[MatchClaim]] = []
    for (competition_key, _), pairing_claims in by_pairing.items():
        precedence = precedence_of(competition_key)
        clusters: list[list[MatchClaim]] = []
        for claim in sorted(
            pairing_claims, key=lambda c: (c.match_date, precedence_rank_of_source(c.source, precedence))
        ):
            best: tuple[int, bool, int] | None = None
            for index, cluster in enumerate(clusters):
                anchor = cluster[0]
                gap = abs((claim.match_date - anchor.match_date).days)
                swapped = claim.home.ref != anchor.home.ref
                if gap > MAX_DATE_DIFFERENCE_DAYS or any(c.source == claim.source for c in cluster):
                    continue
                if swapped and not can_swap_home_and_away(claim, anchor):
                    continue
                candidate = (gap, swapped, index)
                if best is None or candidate < best:
                    best = candidate
            if best is None:
                clusters.append([claim])
            else:
                clusters[best[2]].append(claim)
        matches.extend(clusters)
    return matches


def index_claims_with_one_unlinked_team(
    claims: Iterable[MatchClaim],
) -> dict[tuple[str, str], list[MatchClaim]]:
    """(competition key, linked team ref) → claims whose other team is unlinked."""
    index: dict[tuple[str, str], list[MatchClaim]] = defaultdict(list)
    for claim in claims:
        linked = [team.ref for team in (claim.home, claim.away) if team.ref]
        if len(linked) == 1:
            index[(claim.competition_key, linked[0])].append(claim)
    return dict(index)


def find_unlinked_claims_of_match(
    members: list[MatchClaim], index: dict[tuple[str, str], list[MatchClaim]]
) -> list[MatchClaim]:
    """Claims of other sources on the same day (±1) for one of the match's teams whose other team is
    unlinked: those sources have the match, we only cannot link it. A claim with both teams unlinked could be
    any match, so it is never used."""
    first = members[0]
    member_sources = {member.source for member in members}
    found: list[MatchClaim] = []
    for ref in (first.home.ref, first.away.ref):
        for claim in index.get((first.competition_key, ref or ""), []):
            near = abs((claim.match_date - first.match_date).days) <= MAX_DATE_DIFFERENCE_DAYS
            if near and claim.source not in member_sources and claim not in found:
                found.append(claim)
    return found


def result_of_partly_linked_claim_from_home_side_of(claim: MatchClaim, primary: MatchClaim) -> Result | None:
    """A claim with one linked team, turned so the primary claim's home team is home; None if its linked team
    is not in the match."""
    # The primary claim's refs are never None, so an unlinked side never matches them.
    if claim.home.ref == primary.home.ref or claim.away.ref == primary.away.ref:
        return claim.result
    if claim.home.ref == primary.away.ref or claim.away.ref == primary.home.ref:
        return claim.result.swapped()
    return None


def index_claims_by_team_pair(claims: Iterable[MatchClaim]) -> dict[tuple[str, frozenset], list[MatchClaim]]:
    """(competition key, the two team refs) → claims with both teams linked."""
    index: dict[tuple[str, frozenset], list[MatchClaim]] = defaultdict(list)
    for claim in claims:
        if claim.has_both_teams_linked:
            index[(claim.competition_key, frozenset((claim.home.ref, claim.away.ref)))].append(claim)
    return dict(index)


def find_rejected_claims_of_match(
    members: list[MatchClaim], rejected_index: dict[tuple[str, frozenset], list[MatchClaim]]
) -> list[MatchClaim]:
    """Rows of other sources for the same two teams on the same day (±1) that were refused because their own
    source contradicts their score."""
    first = members[0]
    member_sources = {member.source for member in members}
    return [
        claim
        for claim in rejected_index.get(
            (first.competition_key, frozenset((first.home.ref, first.away.ref))), []
        )
        if abs((claim.match_date - first.match_date).days) <= MAX_DATE_DIFFERENCE_DAYS
        and claim.source not in member_sources
    ]


def result_from_home_side_of(claim: MatchClaim, primary: MatchClaim) -> Result:
    """The claim's result with the primary claim's home team as home."""
    return claim.result if claim.home.ref == primary.home.ref else claim.result.swapped()


def results_agree(first: Result, second: Result) -> bool:
    """Same goals; same extra time and shootout wherever both sources state them."""
    if (first.home_goals, first.away_goals) != (second.home_goals, second.away_goals):
        return False
    if (
        first.extra_time is not None
        and second.extra_time is not None
        and first.extra_time != second.extra_time
    ):
        return False
    if (
        first.shootout_known
        and second.shootout_known
        and (first.shootout is None) != (second.shootout is None)
    ):
        return False
    if first.shootout and second.shootout:
        a, b = first.shootout, second.shootout
        if a.winner and b.winner and a.winner != b.winner:
            return False
        if None not in (a.home, b.home) and (a.home, a.away) != (b.home, b.away):
            return False
    return True


@dataclass
class ResolvedMatch:
    competition_key: str
    tier: int
    match_date: date
    stage: str | None
    leg: int | None
    season_start_year: int | None
    home_ref: str
    away_ref: str
    home_name: str
    away_name: str
    home_goals: int
    away_goals: int
    extra_time: bool | None
    shootout_home: int | None
    shootout_away: int | None
    shootout_winner_ref: str | None
    status: str
    usable: bool
    sources: list[str]  # precedence order
    missing_from: list[str]
    claims: list[MatchClaim]
    conflict: dict | None = None
    swapped_sources: list[str] = field(default_factory=list)
    shootout_known: bool = False  # some source states whether there was a shootout
    unlinked_in: list[str] = field(
        default_factory=list
    )  # covering sources that have it with an unlinked team
    rejected_in: list[str] = field(default_factory=list)  # covering sources whose row was refused


def describe_result(result: Result) -> dict:
    shootout = result.shootout
    return {
        "home_goals": result.home_goals,
        "away_goals": result.away_goals,
        "extra_time": result.extra_time,
        "shootout": None
        if shootout is None
        else {"winner": shootout.winner, "home": shootout.home, "away": shootout.away},
    }


def resolve_match(
    members: list[MatchClaim],
    precedence: tuple[str, ...],
    covering_sources: set[str],
    unlinked_claims: Iterable[MatchClaim] = (),
    rejected_sources: Iterable[str] = (),
) -> ResolvedMatch:
    """`unlinked_claims`: other sources' claims of this match with a team we cannot link. Those sources do not
    lack the match (they go to unlinked_in, not missing_from), and their score is still compared: if it
    disagrees, the match is a CONFLICT.

    `rejected_sources`: covering sources whose row for this match was refused because their own data
    contradicts it (an awarded result, a broken score). They go to rejected_in, not missing_from, and the
    match is not usable until that row is reviewed.
    """
    ranked = sorted(members, key=lambda c: precedence_rank_of_source(c.source, precedence))
    primary = ranked[0]
    results = [result_from_home_side_of(claim, primary) for claim in ranked]
    sources = [claim.source for claim in ranked]
    partly_linked = [
        (claim, result)
        for claim in unlinked_claims
        if claim.source in covering_sources
        and claim.source not in sources
        and (result := result_of_partly_linked_claim_from_home_side_of(claim, primary)) is not None
    ]
    all_results = results + [result for _, result in partly_linked]
    agree = all(results_agree(a, b) for a, b in combinations(all_results, 2))
    if not agree:
        status = CONFLICT
    else:
        status = SINGLE_SOURCE if len(ranked) == 1 else VERIFIED
    unlinked_in = sorted({claim.source for claim, _ in partly_linked})
    rejected_in = sorted((covering_sources & set(rejected_sources)) - set(sources) - set(unlinked_in))
    missing_from = sorted(covering_sources - set(sources) - set(unlinked_in) - set(rejected_in))
    trusted = primary.source in precedence
    usable = status == VERIFIED or (
        status == SINGLE_SOURCE and trusted and not missing_from and not rejected_in
    )

    stage = next((c.stage for c in ranked if c.stage and not c.stage_inferred), None)
    stage = stage or next((c.stage for c in ranked if c.stage), None)
    extra_time = next((r.extra_time for r in results if r.extra_time is not None), None)
    if extra_time is None and stage in GROUP_OR_LEAGUE_STAGES:
        extra_time = False  # group and league matches have no extra time
    stating = [r for r in results if r.shootout_known or r.shootout is not None]
    shootout_home = shootout_away = shootout_winner_ref = None
    if stating and stating[0].shootout is not None:
        shootouts = [r.shootout for r in stating if r.shootout is not None]
        winner = next((s.winner for s in shootouts if s.winner), None)
        with_kicks = next((s for s in shootouts if s.home is not None), None)
        if with_kicks:
            shootout_home, shootout_away = with_kicks.home, with_kicks.away
        if winner:
            shootout_winner_ref = primary.home.ref if winner == HOME else primary.away.ref
    return ResolvedMatch(
        competition_key=primary.competition_key,
        tier=primary.tier,
        match_date=primary.match_date,
        stage=stage,
        leg=next((c.leg for c in ranked if c.leg), None),
        season_start_year=next((c.season_start_year for c in ranked if c.season_start_year), None),
        home_ref=primary.home.ref or "",
        away_ref=primary.away.ref or "",
        home_name=primary.home.name,
        away_name=primary.away.name,
        home_goals=results[0].home_goals,
        away_goals=results[0].away_goals,
        extra_time=extra_time,
        shootout_home=shootout_home,
        shootout_away=shootout_away,
        shootout_winner_ref=shootout_winner_ref,
        status=status,
        usable=usable,
        sources=sources,
        missing_from=missing_from,
        claims=ranked,
        conflict={
            **{c.source: describe_result(r) for c, r in zip(ranked, results, strict=True)},
            **{f"{c.source} (unlinked team)": describe_result(r) for c, r in partly_linked},
        }
        if status == CONFLICT
        else None,
        swapped_sources=[c.source for c in ranked if c.home.ref != primary.home.ref],
        shootout_known=bool(stating),
        unlinked_in=unlinked_in,
        rejected_in=rejected_in,
    )


def split_dates_into_editions(days: Iterable[date], gap_days: int = EDITION_GAP_DAYS) -> list[list[date]]:
    """Group sorted match days of one tournament into editions: a long gap starts the next edition."""
    editions: list[list[date]] = []
    for day in sorted(set(days)):
        if editions and (day - editions[-1][-1]).days <= gap_days:
            editions[-1].append(day)
        else:
            editions.append([day])
    return editions


def club_season_start_year(day: date) -> int:
    return day.year if day.month >= CLUB_SEASON_FIRST_MONTH else day.year - 1


@dataclass(frozen=True)
class Edition:
    competition_key: str
    season_label: str
    final_year: int


def assign_editions(
    matches: list[ResolvedMatch], competitions: dict[str, Competition]
) -> tuple[list[Edition], list[tuple[str, str]]]:
    """Every edition, and each match's (competition key, season label), in the order of `matches`."""
    keys: list[tuple[str, str]] = [("", "")] * len(matches)
    last_day: dict[tuple[str, str], date] = {}
    by_competition: dict[str, list[int]] = defaultdict(list)
    for index, match in enumerate(matches):
        by_competition[match.competition_key].append(index)
    for competition_key, indexes in by_competition.items():
        competition = competitions[competition_key]
        if competition.kind == "INTERNATIONAL":
            edition_of_day: dict[date, str] = {}
            for days in split_dates_into_editions(matches[i].match_date for i in indexes):
                label = competition.edition_labels.get(days[-1].year, str(days[-1].year))
                for day in days:
                    edition_of_day[day] = label
            for i in indexes:
                keys[i] = (competition_key, edition_of_day[matches[i].match_date])
        else:
            for i in indexes:
                start = matches[i].season_start_year or club_season_start_year(matches[i].match_date)
                keys[i] = (competition_key, f"{start}-{(start + 1) % 100:02d}")
        for i in indexes:
            key = keys[i]
            last_day[key] = max(last_day.get(key, matches[i].match_date), matches[i].match_date)
    editions = [Edition(key[0], key[1], day.year) for key, day in sorted(last_day.items())]
    return editions, keys


def did_team_win_match(claim: MatchClaim, team_source_id: str) -> bool:
    """True when the team won on goals, or on a shootout whose winner the source names."""
    result = claim.result
    if claim.home.source_id == team_source_id:
        goals_for, goals_against, side = result.home_goals, result.away_goals, HOME
    elif claim.away.source_id == team_source_id:
        goals_for, goals_against, side = result.away_goals, result.home_goals, AWAY
    else:
        return False
    if goals_for != goals_against:
        return goals_for > goals_against
    return result.shootout is not None and result.shootout.winner == side


def did_team_win_its_previous_match(claims: list[MatchClaim], before: date, team_source_id: str) -> bool:
    previous = [
        c for c in claims if c.match_date < before and team_source_id in (c.home.source_id, c.away.source_id)
    ]
    return bool(previous) and did_team_win_match(max(previous, key=lambda c: c.match_date), team_source_id)


def infer_finals_from_last_match(
    claims: list[MatchClaim], unscored_days: dict[str, list[date]] | None = None
) -> list[MatchClaim]:
    """For claims without stages (martj42): an edition's final is the one match on its last day, when both
    of its teams won their previous match in that edition (so a third-place match never qualifies).

    Run it on every in-scope row of a tournament, linked or not. No final is inferred for an edition with
    two matches on its last day, or with in-scope rows that have no score yet (`unscored_days`, per
    competition key): it may not be over.
    """
    unscored_days = unscored_days or {}
    by_competition: dict[str, list[int]] = defaultdict(list)
    for index, claim in enumerate(claims):
        by_competition[claim.competition_key].append(index)
    result = list(claims)
    for competition_key, indexes in by_competition.items():
        unscored = set(unscored_days.get(competition_key, []))
        all_days = [claims[i].match_date for i in indexes] + list(unscored)
        for days in split_dates_into_editions(all_days):
            if unscored & set(days):
                continue
            edition = [claims[i] for i in indexes if days[0] <= claims[i].match_date <= days[-1]]
            on_last_day = [i for i in indexes if claims[i].match_date == days[-1]]
            if len(on_last_day) != 1 or claims[on_last_day[0]].stage is not None:
                continue
            last = claims[on_last_day[0]]
            if all(
                did_team_win_its_previous_match(edition, last.match_date, team.source_id)
                for team in (last.home, last.away)
            ):
                result[on_last_day[0]] = with_inferred_final(last)
    return result
