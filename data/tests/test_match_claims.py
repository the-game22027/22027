from datetime import date
from pathlib import Path

import pytest

from kb.competitions import MATCH_SOURCES, Coverage, load_match_config
from kb.match_claims import (
    AWAY,
    BAD_SCORE,
    BEFORE_FIRST_DATE,
    EXCLUDED_ROUND,
    EXCLUDED_TOURNAMENT,
    HOME,
    MISSING_SCORE,
    NO_GOAL_EVENTS,
    OUTSIDE_COVERAGE,
    OUTSIDE_TIERS,
    SCORE_DISAGREES_WITH_EVENTS,
    UNLEVEL_ONE_OFF_SHOOTOUT,
    RejectedClaim,
    Shootout,
    TransfermarktEvents,
    check_row_is_in_scope,
    check_transfermarkt_score_against_events,
    claim_from_martj42_result,
    claim_from_transfermarkt_game,
    result_from_fjelstul,
    result_from_martj42,
    result_from_transfermarkt,
    stage_and_leg_from_transfermarkt_round,
    stage_from_fjelstul,
)

CONFIG = load_match_config()
LAST_DATES = {(source, key): date(2026, 7, 6) for source in MATCH_SOURCES for key in CONFIG.competitions}
COVERAGE = Coverage(CONFIG.coverage, LAST_DATES)


# ---- score normalization: goals after extra time, never the shootout ----


def test_transfermarkt_goals_lose_the_shootout_kicks_they_include() -> None:
    # 2006 World Cup final as Transfermarkt stores it: 6-4 = 1-1 after extra time + 5-3 on penalties.
    result = result_from_transfermarkt("6", "4", 5, 3, 9, extra_time_events_seen=True, game_has_events=True)
    assert (result.home_goals, result.away_goals) == (1, 1)
    assert result.extra_time is True
    assert result.shootout == Shootout(HOME, 5, 3)


def test_transfermarkt_without_extra_time_events_says_nothing_about_extra_time() -> None:
    # 2014 final, 1-0 after extra time but scored in minute 113: one event after 90 is enough...
    assert result_from_transfermarkt("1", "0", 0, 0, 0, True, True).extra_time is True
    # ...and a game without such events does not state "no extra time".
    result = result_from_transfermarkt("2", "1", 0, 0, 0, False, True)
    assert result.extra_time is None and result.shootout is None and result.shootout_known is True


def test_transfermarkt_game_without_any_events_is_silent_about_a_shootout() -> None:
    assert result_from_transfermarkt("1", "1", 0, 0, 0, False, game_has_events=False).shootout_known is False


def test_transfermarkt_second_leg_shootout_after_an_unlevel_match_keeps_the_match_score() -> None:
    # Second legs go to penalties on aggregate: Liverpool 0-1 PSG (2025), 1-4 on penalties.
    result = result_from_transfermarkt("1", "5", 1, 4, 7, True, True)
    assert (result.home_goals, result.away_goals, result.shootout) == (0, 1, Shootout(AWAY, 1, 4))


def test_transfermarkt_scores_that_cannot_hold_the_shootout_are_refused() -> None:
    assert result_from_transfermarkt("2", "3", 5, 4, 10, False, True) == BAD_SCORE
    assert result_from_transfermarkt("", "1", 0, 0, 0, False, True) == MISSING_SCORE


def test_fjelstul_score_includes_extra_time_and_keeps_the_shootout_apart() -> None:
    row = {
        "home_team_score": "3",
        "away_team_score": "3",
        "extra_time": "1",
        "penalty_shootout": "1",
        "home_team_score_penalties": "4",
        "away_team_score_penalties": "2",
    }
    result = result_from_fjelstul(row)  # 2022 final
    assert (result.home_goals, result.away_goals, result.extra_time) == (3, 3, True)
    assert result.shootout == Shootout(HOME, 4, 2) and result.shootout_known
    no_shootout = result_from_fjelstul({**row, "extra_time": "0", "penalty_shootout": "0"})
    assert no_shootout.shootout is None and no_shootout.extra_time is False


def test_martj42_shootout_names_only_the_winner_and_a_missing_row_is_silence() -> None:
    # Copa América 2016 final: 0-0, Chile won on penalties.
    result = result_from_martj42("0", "0", "Argentina", "Chile", "Chile")
    assert result.shootout == Shootout(AWAY, None, None) and result.shootout_known
    silent = result_from_martj42("1", "0", "Germany", "Argentina", None)
    assert silent.shootout is None and silent.shootout_known is False and silent.extra_time is None


def test_swapping_a_result_swaps_goals_and_shootout() -> None:
    swapped = result_from_transfermarkt("6", "4", 5, 3, 9, True, True).swapped()
    assert (swapped.home_goals, swapped.away_goals, swapped.shootout) == (1, 1, Shootout(AWAY, 3, 5))


# ---- Transfermarkt scores against its own events ----


def test_a_row_that_silently_includes_the_shootout_has_no_goal_events_to_match() -> None:
    # Europa League final 2014-05-14: stored 4-2, really 0-0 and 4-2 on penalties, no Shootout events.
    result = result_from_transfermarkt("4", "2", 0, 0, 0, True, True)
    assert check_transfermarkt_score_against_events(result, 0, 0, is_one_off_match=True) == NO_GOAL_EVENTS
    # UEFA Super Cup 2013-08-30: stored 7-6, really 2-2 and 5-4 on penalties; the 4 goals are events.
    result = result_from_transfermarkt("7", "6", 0, 0, 0, True, True)
    assert check_transfermarkt_score_against_events(result, 2, 2, True) == SCORE_DISAGREES_WITH_EVENTS


def test_a_row_that_leaves_out_the_shootout_disagrees_with_its_goal_events() -> None:
    # Arsenal-Porto 2024-03-12: stored 4-2 although the shootout (4-2) is in the events; really 1-0 aet.
    result = result_from_transfermarkt("4", "2", 4, 2, 6, True, True)
    assert (result.home_goals, result.away_goals) == (0, 0)
    assert (
        check_transfermarkt_score_against_events(result, 1, 0, is_one_off_match=False)
        == SCORE_DISAGREES_WITH_EVENTS
    )


def test_an_awarded_match_without_goal_events_and_an_unlevel_one_off_shootout_are_refused() -> None:
    awarded = result_from_transfermarkt("3", "0", 0, 0, 0, False, False)  # Hellas Verona-Roma 2020-09-19
    assert check_transfermarkt_score_against_events(awarded, 0, 0, True) == NO_GOAL_EVENTS
    unlevel = result_from_transfermarkt("6", "4", 4, 3, 9, True, True)  # 2-1, then a shootout
    assert (
        check_transfermarkt_score_against_events(unlevel, 2, 1, is_one_off_match=True)
        == UNLEVEL_ONE_OFF_SHOOTOUT
    )
    # A second leg can go to penalties after an unlevel match (level on aggregate).
    assert check_transfermarkt_score_against_events(unlevel, 2, 1, is_one_off_match=False) is None


def test_goals_are_compared_per_club_so_an_awarded_result_with_the_same_total_is_refused() -> None:
    # Union Berlin-Bochum 2024-12-14: stored 0-2 (awarded), the played goals in the events were 1-1.
    awarded = result_from_transfermarkt("0", "2", 0, 0, 0, False, True)
    assert check_transfermarkt_score_against_events(awarded, 1, 1, True) == SCORE_DISAGREES_WITH_EVENTS
    # An own goal is filed under the club that benefits, so a real 2-1 has 2 and 1 goal events.
    assert (
        check_transfermarkt_score_against_events(
            result_from_transfermarkt("2", "1", 0, 0, 0, False, True), 2, 1, True
        )
        is None
    )


def test_a_score_that_matches_its_events_is_kept_and_goalless_needs_no_events() -> None:
    final_2006 = result_from_transfermarkt("6", "4", 5, 3, 9, True, True)
    assert check_transfermarkt_score_against_events(final_2006, 1, 1, True) is None
    goalless = result_from_transfermarkt("0", "0", 0, 0, 0, False, False)
    assert check_transfermarkt_score_against_events(goalless, 0, 0, True) is None


def test_a_transfermarkt_row_that_disagrees_with_its_events_never_becomes_a_claim() -> None:
    row = {
        "game_id": "1",
        "competition_id": "EL",
        "season": "2013",
        "round": "Final",
        "date": "2014-05-14",
        "home_club_id": "368",
        "away_club_id": "294",
        "home_club_goals": "4",
        "away_club_goals": "2",
    }
    events = TransfermarktEvents({}, {"1"}, {"1"}, {})
    refused = claim_from_transfermarkt_game(row, CONFIG, COVERAGE, lambda k, i: None, events)
    assert isinstance(refused, RejectedClaim) and refused.reason == NO_GOAL_EVENTS
    assert refused.claim.competition_key == "europa-league"  # kept so other sources know it had the match


# ---- stages ----


@pytest.mark.parametrize(
    ("round_name", "kind", "expected"),
    [
        ("Final", "CUP", ("FINAL", None)),
        ("final 2nd leg", "CUP", ("FINAL", 2)),  # Supercopa de España until 2018
        ("Semi-Finals 2nd Leg", "CUP", ("SEMI_FINAL", 2)),
        ("Quarter-Finals 1st leg", "CUP", ("QUARTER_FINAL", 1)),
        ("last 16 1st leg", "CUP", ("ROUND_OF_16", 1)),
        ("Group H", "INTERNATIONAL", ("GROUP", None)),
        ("Third Place Play-Off", "INTERNATIONAL", ("THIRD_PLACE", None)),
        ("intermediate stage 2nd leg", "CUP", ("KNOCKOUT_PLAYOFF", 2)),
        ("Third Round Replay", "CUP", ("EARLY_ROUND", None)),
        ("12. Matchday", "LEAGUE", ("LEAGUE", None)),
    ],
)
def test_transfermarkt_rounds_map_to_stages_and_legs(round_name: str, kind: str, expected: tuple) -> None:
    assert stage_and_leg_from_transfermarkt_round(round_name, kind) == expected


def test_fjelstul_stages() -> None:
    assert stage_from_fjelstul("final") == "FINAL"
    assert stage_from_fjelstul("third-place match") == "THIRD_PLACE"
    assert stage_from_fjelstul("group stage") == "GROUP"


# ---- DEC-67 filters, tiers and coverage ----


def test_dec67_filters_tiers_and_coverage_decide_which_rows_become_claims() -> None:
    def scope(source: str, competition: str, day: date, round_name: str | None = None):
        outcome = check_row_is_in_scope(CONFIG, COVERAGE, source, competition, day, round_name)
        return outcome if isinstance(outcome, str) else outcome.key

    assert scope("transfermarkt", "CL", date(2016, 5, 28), "Final") == "champions-league"
    assert scope("martj42", "FIFA World Cup", date(1998, 7, 12)) == BEFORE_FIRST_DATE
    assert scope("martj42", "FIFA World Cup qualification", date(2021, 3, 24)) == EXCLUDED_TOURNAMENT
    assert scope("martj42", "Friendly", date(2021, 3, 24)) == EXCLUDED_TOURNAMENT
    assert scope("transfermarkt", "CDR", date(2019, 9, 1), "Qualifying Round 1st leg") == EXCLUDED_ROUND
    assert scope("transfermarkt", "BPO4", date(2019, 9, 1), "relegation play-off") == EXCLUDED_ROUND
    assert scope("transfermarkt", "CDR", date(2024, 10, 30), "First Preliminary Round") == EXCLUDED_ROUND
    assert scope("transfermarkt", "NLP", date(2022, 9, 21), "2.Vorrunde") == EXCLUDED_ROUND
    assert (
        scope("transfermarkt", "FAC", date(2022, 11, 5), "First Round") == "fa-cup"
    )  # the first round proper
    # A tournament's third-place match is not a play-off in DEC-67's sense.
    assert scope("transfermarkt", "FIWC", date(2022, 12, 17), "Third Place Play-Off") == "world-cup"
    assert scope("transfermarkt", "TR1", date(2019, 9, 1), "1. Matchday") == OUTSIDE_TIERS
    assert scope("fjelstul", "WC-2019", date(2019, 7, 7)) == OUTSIDE_TIERS  # women's World Cup
    # Outside its window a source is silent: Transfermarkt clubs start in 2012, Fjelstul ends in 2022.
    assert scope("transfermarkt", "GB1", date(2011, 8, 13), "1. Matchday") == OUTSIDE_COVERAGE
    assert scope("fjelstul", "WC-2022", date(2023, 1, 1)) == OUTSIDE_COVERAGE
    assert scope("martj42", "Arab Cup", date(2021, 12, 18)) == "arab-cup"


def test_a_transfermarkt_row_becomes_a_claim_with_linked_teams() -> None:
    row = {
        "game_id": "2690027",
        "competition_id": "CL",
        "season": "2015",
        "round": "Final",
        "date": "2016-05-28",
        "home_club_id": "418",
        "away_club_id": "13",
        "home_club_goals": "6",
        "away_club_goals": "4",
        "home_club_name": "Real Madrid",
        "away_club_name": "Atlético de Madrid",
    }
    events = TransfermarktEvents(
        {"2690027": {"418": (5, 5), "13": (3, 4)}}, {"2690027"}, {"2690027"}, {"2690027": {"418": 1, "13": 1}}
    )
    refs = {("CLUB", "418"): "wikidata:Q8682"}
    claim = claim_from_transfermarkt_game(row, CONFIG, COVERAGE, lambda k, i: refs.get((k, i)), events)
    assert claim.competition_key == "champions-league" and claim.tier == 1 and claim.stage == "FINAL"
    assert (claim.result.home_goals, claim.result.away_goals) == (1, 1)
    assert claim.result.shootout == Shootout(HOME, 5, 3)
    assert claim.home.ref == "wikidata:Q8682" and claim.away.ref is None and not claim.has_both_teams_linked
    assert claim.neutral_or_host_venue  # a one-off final
    assert claim.fact_key() == "champions-league|2016-05-28|wikidata:Q8682|?transfermarkt:13"
    assert claim.value()["shootout"] == {"winner": "HOME", "home": 5, "away": 3}


def test_martj42_host_at_home_may_be_swapped_but_an_ordinary_home_match_may_not() -> None:
    row = {
        "date": "2016-07-10",
        "home_team": "France",
        "away_team": "Portugal",
        "home_score": "0",
        "away_score": "1",
        "tournament": "UEFA Euro",
        "country": "France",
        "neutral": "FALSE",
    }
    claim = claim_from_martj42_result(row, CONFIG, COVERAGE, lambda name, day: f"ref:{name}", None)
    assert claim.neutral_or_host_venue and claim.source_row_id == "2016-07-10|France|Portugal"
    elsewhere = claim_from_martj42_result(
        {**row, "country": "Germany"}, CONFIG, COVERAGE, lambda n, d: n, None
    )
    assert not elsewhere.neutral_or_host_venue


# ---- config consistency ----


def test_the_project_competitions_cover_every_tiered_id_with_one_tier_each() -> None:
    assert CONFIG.competitions["world-cup"].tier == 1
    assert CONFIG.competitions["arab-cup"].tier == 2
    assert CONFIG.competition_of_source_id("fjelstul", "WC-2014").key == "world-cup"
    assert CONFIG.competition_of_source_id("martj42", "African Cup of Nations").key == "africa-cup-of-nations"
    assert CONFIG.precedence_for("MATCH_RESULT", CONFIG.competitions["world-cup"])[0] == "fjelstul"
    assert CONFIG.precedence_for("MATCH_RESULT", CONFIG.competitions["euro"])[0] == "martj42"
    assert CONFIG.precedence_for("MATCH_RESULT", CONFIG.competitions["la-liga"])[0] == "transfermarkt"


def write_config(folder: Path, tiers: str, competitions: str) -> Path:
    real = Path(__file__).parent.parent / "config"
    (folder / "tiers.toml").write_text(tiers, encoding="utf-8")
    header = (real / "competitions.toml").read_text(encoding="utf-8").split("[[competitions]]")[0]
    (folder / "competitions.toml").write_text(header + competitions, encoding="utf-8")
    (folder / "sources.toml").write_text("", encoding="utf-8")
    return folder


ENTRY = '[[competitions]]\nkey = "{key}"\nref = "{ref}"\nname_en = "x"\nname_ar = "x"\nkind = "CUP"\n{ids}\n'


def test_a_tiered_id_without_a_competition_is_a_config_error(tmp_path: Path) -> None:
    tiers = '[[tiers]]\nlevel = 1\ntransfermarkt = ["CL", "EL"]\n'
    competitions = ENTRY.format(key="cl", ref="wikidata:Q1", ids='transfermarkt = ["CL"]')
    with pytest.raises(ValueError, match="EL has no competition"):
        load_match_config(write_config(tmp_path, tiers, competitions))


def test_one_competition_with_ids_in_two_tiers_is_a_config_error(tmp_path: Path) -> None:
    tiers = '[[tiers]]\nlevel = 1\ntransfermarkt = ["CL"]\n[[tiers]]\nlevel = 2\nmartj42 = ["Champions"]\n'
    competitions = ENTRY.format(
        key="cl", ref="wikidata:Q1", ids='transfermarkt = ["CL"]\nmartj42 = ["Champions"]'
    )
    with pytest.raises(ValueError, match="exactly one tier"):
        load_match_config(write_config(tmp_path, tiers, competitions))
