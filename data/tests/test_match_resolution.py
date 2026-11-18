from dataclasses import replace
from datetime import date

from kb.competitions import load_match_config
from kb.match_claims import AWAY, HOME, MatchClaim, Result, Shootout, TeamSide
from kb.match_resolution import (
    CONFLICT,
    SINGLE_SOURCE,
    VERIFIED,
    assign_editions,
    find_rejected_claims_of_match,
    find_unlinked_claims_of_match,
    group_claims_into_matches,
    index_claims_by_team_pair,
    index_claims_with_one_unlinked_team,
    infer_finals_from_last_match,
    resolve_match,
    results_agree,
    split_dates_into_editions,
)

CONFIG = load_match_config()
WORLD_CUP = ("fjelstul", "transfermarkt", "martj42")
NATIONAL = ("martj42", "transfermarkt")


def claim(
    source: str,
    day: date,
    home: str,
    away: str,
    goals: tuple[int, int],
    *,
    competition: str = "world-cup",
    neutral: bool = True,
    extra_time: bool | None = None,
    shootout: Shootout | None = None,
    shootout_known: bool = True,
    stage: str | None = None,
    season: int | None = None,
) -> MatchClaim:
    return MatchClaim(
        source=source,
        source_row_id=f"{source}-{day}-{home}-{away}",
        competition_key=competition,
        tier=CONFIG.competitions[competition].tier,
        match_date=day,
        home=TeamSide(home, home, None if home.startswith("?") else f"wikidata:{home}"),
        away=TeamSide(away, away, f"wikidata:{away}"),
        result=Result(goals[0], goals[1], extra_time, shootout, shootout_known),
        neutral_or_host_venue=neutral,
        stage=stage,
        season_start_year=season,
    )


def precedence_of(competition_key: str) -> tuple[str, ...]:
    return CONFIG.precedence_for("MATCH_RESULT", CONFIG.competitions[competition_key])


FINAL_2006 = date(2006, 7, 9)


# ---- identity ----


def test_claims_one_day_apart_are_one_match_and_two_days_apart_are_two() -> None:
    claims = [
        claim("fjelstul", FINAL_2006, "ITA", "FRA", (1, 1)),
        claim("martj42", date(2006, 7, 10), "ITA", "FRA", (1, 1)),
        claim("transfermarkt", date(2006, 7, 11), "ITA", "FRA", (1, 1)),
    ]
    groups = group_claims_into_matches(claims, precedence_of)
    assert sorted(len(g) for g in groups) == [1, 2]


def test_home_and_away_swap_only_when_both_claims_are_at_a_neutral_or_host_venue() -> None:
    tm = claim("transfermarkt", date(2016, 7, 10), "POR", "FRA", (1, 0), competition="euro")
    host = claim("martj42", date(2016, 7, 10), "FRA", "POR", (0, 1), competition="euro", neutral=True)
    assert len(group_claims_into_matches([tm, host], precedence_of)) == 1
    home_ground = replace(host, neutral_or_host_venue=False)
    assert len(group_claims_into_matches([tm, home_ground], precedence_of)) == 2


def test_a_source_never_has_two_claims_in_one_match_and_unlinked_claims_never_join() -> None:
    first = claim("transfermarkt", date(2020, 1, 1), "A", "B", (1, 0), competition="champions-league")
    second = replace(first, source_row_id="other", match_date=date(2020, 1, 2))
    unlinked = claim("martj42", date(2020, 1, 1), "?A", "B", (1, 0), competition="champions-league")
    groups = group_claims_into_matches([first, second, unlinked], precedence_of)
    assert sorted(len(g) for g in groups) == [1, 1]


# ---- agreement ----


def test_results_agree_on_what_both_sources_state() -> None:
    fjelstul = Result(1, 1, True, Shootout(HOME, 5, 3), True)
    martj42 = Result(1, 1, None, Shootout(HOME, None, None), True)
    silent = Result(1, 1, None, None, False)
    assert results_agree(fjelstul, martj42) and results_agree(fjelstul, silent)
    assert not results_agree(fjelstul, Result(1, 1, True, Shootout(AWAY, None, None), True))
    assert not results_agree(fjelstul, Result(1, 1, True, Shootout(HOME, 4, 3), True))
    assert not results_agree(fjelstul, Result(1, 1, True, None, True))  # one says no shootout
    assert not results_agree(fjelstul, Result(1, 1, False, Shootout(HOME, 5, 3), True))
    assert not results_agree(fjelstul, Result(2, 1, True, None, False))


# ---- resolution ----


def test_three_agreeing_sources_are_verified_and_fill_each_others_gaps() -> None:
    members = [
        claim("martj42", FINAL_2006, "ITA", "FRA", (1, 1), shootout=Shootout(HOME, None, None)),
        claim(
            "transfermarkt", FINAL_2006, "ITA", "FRA", (1, 1), extra_time=True, shootout=Shootout(HOME, 5, 3)
        ),
        claim(
            "fjelstul",
            FINAL_2006,
            "ITA",
            "FRA",
            (1, 1),
            extra_time=True,
            shootout=Shootout(HOME, 5, 3),
            stage="FINAL",
        ),
    ]
    match = resolve_match(members, WORLD_CUP, {"fjelstul", "transfermarkt", "martj42"})
    assert match.status == VERIFIED and match.usable
    assert match.sources == ["fjelstul", "transfermarkt", "martj42"]
    assert (match.home_goals, match.away_goals, match.extra_time) == (1, 1, True)
    assert (match.shootout_home, match.shootout_away, match.shootout_winner_ref) == (5, 3, "wikidata:ITA")
    assert match.stage == "FINAL" and match.conflict is None


def test_a_swapped_claim_is_compared_after_turning_it_around() -> None:
    members = [
        claim("transfermarkt", date(2016, 7, 10), "POR", "FRA", (1, 0), competition="euro", extra_time=True),
        claim("martj42", date(2016, 7, 10), "FRA", "POR", (0, 1), competition="euro"),
    ]
    match = resolve_match(members, NATIONAL, {"martj42", "transfermarkt"})
    assert match.status == VERIFIED and match.swapped_sources == ["transfermarkt"]
    assert (match.home_ref, match.home_goals, match.away_goals) == (
        "wikidata:FRA",
        0,
        1,
    )  # martj42 orientation


def test_sources_that_disagree_are_a_conflict_with_the_precedence_value_and_never_usable() -> None:
    members = [
        claim("transfermarkt", date(2024, 6, 14), "GER", "SCO", (5, 1), competition="euro"),
        claim("martj42", date(2024, 6, 14), "GER", "SCO", (5, 0), competition="euro"),
    ]
    match = resolve_match(members, NATIONAL, {"martj42", "transfermarkt"})
    assert match.status == CONFLICT and not match.usable
    assert (match.home_goals, match.away_goals) == (5, 0)  # martj42 first for national-team results
    assert match.conflict["transfermarkt"]["away_goals"] == 1


def test_two_agreeing_sources_against_a_third_are_still_a_conflict() -> None:
    members = [
        claim("fjelstul", FINAL_2006, "ITA", "FRA", (1, 1)),
        claim("transfermarkt", FINAL_2006, "ITA", "FRA", (1, 1)),
        claim("martj42", FINAL_2006, "ITA", "FRA", (2, 1)),
    ]
    assert resolve_match(members, WORLD_CUP, set(WORLD_CUP)).status == CONFLICT


def test_one_source_is_single_source_and_usable_only_when_no_covering_source_lacks_it() -> None:
    only = [claim("martj42", date(2017, 2, 5), "EGY", "CMR", (1, 2), competition="africa-cup-of-nations")]
    alone = resolve_match(only, NATIONAL, {"martj42"})
    assert alone.status == SINGLE_SOURCE and alone.usable and alone.missing_from == []
    lacking = resolve_match(only, NATIONAL, {"martj42", "transfermarkt"})
    assert (
        lacking.status == SINGLE_SOURCE and not lacking.usable and lacking.missing_from == ["transfermarkt"]
    )
    untrusted = resolve_match(only, ("transfermarkt",), {"martj42"})
    assert untrusted.status == SINGLE_SOURCE and not untrusted.usable


def test_group_and_league_matches_have_no_extra_time() -> None:
    members = [claim("martj42", date(2016, 6, 10), "FRA", "ROU", (2, 1), competition="euro", stage="GROUP")]
    assert resolve_match(members, NATIONAL, {"martj42"}).extra_time is False


# ---- editions and inferred finals ----


def test_tournament_editions_come_from_match_dates_and_take_their_official_name() -> None:
    days = [date(2021, 6, 11), date(2021, 7, 11), date(2024, 6, 14), date(2024, 7, 14)]
    assert len(split_dates_into_editions(days)) == 2
    members = [
        resolve_match([claim("martj42", day, "A", "B", (1, 0), competition="euro")], NATIONAL, {"martj42"})
        for day in days
    ]
    editions, keys = assign_editions(members, CONFIG.competitions)
    assert [(e.season_label, e.final_year) for e in editions] == [("2020", 2021), ("2024", 2024)]
    assert keys[0] == ("euro", "2020")


def test_afcon_across_new_year_is_one_edition() -> None:
    days = [date(2025, 12, 21), date(2026, 1, 18)]
    members = [
        resolve_match(
            [claim("martj42", d, "A", "B", (1, 0), competition="africa-cup-of-nations")],
            NATIONAL,
            {"martj42"},
        )
        for d in days
    ]
    editions, _ = assign_editions(members, CONFIG.competitions)
    assert [(e.season_label, e.final_year) for e in editions] == [("2025", 2026)]


def test_club_seasons_use_the_source_season_so_the_august_2020_final_stays_in_2019_20() -> None:
    final = claim(
        "transfermarkt", date(2020, 8, 23), "PSG", "FCB", (0, 1), competition="champions-league", season=2019
    )
    no_season = replace(final, season_start_year=None, match_date=date(2021, 1, 10))
    members = [resolve_match([c], ("transfermarkt",), {"transfermarkt"}) for c in (final, no_season)]
    _, keys = assign_editions(members, CONFIG.competitions)
    assert keys == [("champions-league", "2019-20"), ("champions-league", "2020-21")]


def copa(
    day: date, home: str, away: str, goals: tuple[int, int], shootout: Shootout | None = None
) -> MatchClaim:
    return claim("martj42", day, home, away, goals, competition="copa-america", shootout=shootout)


COPA_2016 = [
    copa(date(2016, 6, 21), "USA", "ARG", (0, 4)),  # semi-finals
    copa(date(2016, 6, 22), "COL", "CHI", (0, 2)),
    copa(date(2016, 6, 25), "USA", "COL", (0, 1)),  # third place, the day before the final
    copa(date(2016, 6, 26), "ARG", "CHI", (0, 0), Shootout(AWAY, None, None)),  # final
]


def stages_after_inference(claims: list[MatchClaim], unscored: dict | None = None) -> list[str | None]:
    return [c.stage for c in infer_finals_from_last_match(claims, unscored)]


def test_the_last_match_is_the_final_when_both_teams_won_their_previous_match() -> None:
    assert stages_after_inference(COPA_2016) == [None, None, None, "FINAL"]


def test_a_third_place_match_on_the_last_day_is_never_a_final() -> None:
    # Arab Cup 2012 in martj42: the final is missing, so the third-place match is the edition's last row.
    assert stages_after_inference(COPA_2016[:3]) == [None, None, None]


def test_a_semi_final_won_on_a_named_shootout_counts_as_a_win() -> None:
    semi_on_penalties = replace(COPA_2016[1], result=Result(1, 1, None, Shootout(AWAY, None, None), True))
    claims = [COPA_2016[0], semi_on_penalties, COPA_2016[3]]
    assert stages_after_inference(claims)[-1] == "FINAL"
    unknown_shootout = replace(COPA_2016[1], result=Result(1, 1, None, None, False))
    assert stages_after_inference([COPA_2016[0], unknown_shootout, COPA_2016[3]])[-1] is None


def test_no_final_for_a_shared_last_day_or_an_edition_with_unplayed_rows() -> None:
    shared = [copa(date(2001, 7, 26), "COL", "HON", (2, 0)), copa(date(2001, 7, 26), "MEX", "URU", (2, 1))]
    shared += [copa(date(2001, 7, 29), "COL", "MEX", (1, 0)), copa(date(2001, 7, 29), "URU", "HON", (2, 2))]
    assert stages_after_inference(shared) == [None, None, None, None]
    assert stages_after_inference(COPA_2016, {"copa-america": [date(2016, 6, 27)]})[-1] is None


# ---- covered sources that cannot link the match, and shootout knowledge ----


ENGLAND_SWEDEN = [claim("martj42", date(2002, 6, 2), "ENG", "SWE", (1, 1))]


def fjelstul_with_unlinked_sweden(goals: tuple[int, int], sweden_at_home: bool = False) -> MatchClaim:
    sweden = TeamSide("T-73", "Sweden", None)
    if sweden_at_home:
        base = claim("fjelstul", date(2002, 6, 2), "ENG", "ENG2", goals)
        return replace(base, home=sweden, away=TeamSide("T-27", "England", "wikidata:ENG"))
    return replace(claim("fjelstul", date(2002, 6, 2), "ENG", "SWE", goals), away=sweden)


def test_a_source_with_the_match_but_an_unlinked_team_is_not_missing_from_it() -> None:
    unlinked = fjelstul_with_unlinked_sweden((1, 1))
    index = index_claims_with_one_unlinked_team([unlinked, *ENGLAND_SWEDEN])
    assert find_unlinked_claims_of_match(ENGLAND_SWEDEN, index) == [unlinked]
    match = resolve_match(ENGLAND_SWEDEN, WORLD_CUP, {"fjelstul", "martj42"}, [unlinked])
    assert match.status == SINGLE_SOURCE and match.usable
    assert match.missing_from == [] and match.unlinked_in == ["fjelstul"]
    elsewhere = replace(unlinked, match_date=date(2002, 6, 7))
    assert (
        find_unlinked_claims_of_match(ENGLAND_SWEDEN, index_claims_with_one_unlinked_team([elsewhere])) == []
    )


def test_an_unlinked_claim_is_still_compared_and_a_disagreement_is_a_conflict() -> None:
    disagreeing = fjelstul_with_unlinked_sweden((2, 1))
    match = resolve_match(ENGLAND_SWEDEN, WORLD_CUP, {"fjelstul", "martj42"}, [disagreeing])
    assert match.status == CONFLICT and not match.usable
    assert match.conflict["fjelstul (unlinked team)"]["home_goals"] == 2
    # Turned around first: Sweden (unlinked) 0-1 England is England 1-0 Sweden.
    swapped = fjelstul_with_unlinked_sweden((0, 1), sweden_at_home=True)
    one_nil = [claim("martj42", date(2002, 6, 2), "ENG", "SWE", (1, 0))]
    assert resolve_match(one_nil, WORLD_CUP, {"fjelstul", "martj42"}, [swapped]).status == SINGLE_SOURCE
    assert resolve_match(ENGLAND_SWEDEN, WORLD_CUP, {"fjelstul", "martj42"}, [swapped]).status == CONFLICT


def test_a_covering_source_whose_row_was_refused_is_not_missing_but_blocks_the_match() -> None:
    afcon_final = [
        claim("martj42", date(2026, 1, 18), "MAR", "SEN", (3, 0), competition="africa-cup-of-nations")
    ]
    refused = claim(
        "transfermarkt", date(2026, 1, 18), "SEN", "MAR", (0, 3), competition="africa-cup-of-nations"
    )
    index = index_claims_by_team_pair([refused])
    assert find_rejected_claims_of_match(afcon_final, index) == [refused]
    match = resolve_match(afcon_final, NATIONAL, {"martj42", "transfermarkt"}, (), {"transfermarkt"})
    assert match.missing_from == [] and match.rejected_in == ["transfermarkt"] and not match.usable


def test_shootout_known_separates_no_shootout_from_no_source_says() -> None:
    silent = [
        claim(
            "martj42", date(2024, 2, 10), "RSA", "COD", (0, 0), competition="asian-cup", shootout_known=False
        )
    ]
    assert resolve_match(silent, NATIONAL, {"martj42"}).shootout_known is False
    stated = [claim("transfermarkt", date(2024, 2, 10), "RSA", "COD", (2, 1), competition="asian-cup")]
    assert resolve_match(stated, NATIONAL, {"transfermarkt"}).shootout_known is True
