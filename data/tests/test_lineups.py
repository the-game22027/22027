from kb.lineups import (
    FJELSTUL,
    ONE_TEAM_MISSING,
    SEVERAL_CAPTAINS,
    TRANSFERMARKT,
    WRONG_STARTER_COUNT,
    LineupRow,
    LineupSlot,
    TeamLineup,
    choose_one_lineup_per_team,
    find_lineup_problem,
    parse_shirt_number,
)

HOME, AWAY = "31", "418"


def team(club: str, starters: int = 11, captains: int = 1, substitutes: int = 7) -> list[LineupRow]:
    rows = [
        LineupRow(f"{club}-{n}", "g1", club, f"{club}{n}", True, "Centre-Back", n + 1, n < captains)
        for n in range(starters)
    ]
    return rows + [
        LineupRow(f"{club}-s{n}", "g1", club, f"{club}s{n}", False, None, 20 + n, False)
        for n in range(substitutes)
    ]


def test_two_full_teams_with_one_captain_each_pass():
    assert find_lineup_problem(team(HOME) + team(AWAY), (HOME, AWAY)) is None


def test_a_team_without_eleven_starters_is_refused():
    assert find_lineup_problem(team(HOME, starters=10) + team(AWAY), (HOME, AWAY)) == WRONG_STARTER_COUNT


def test_a_team_with_two_captains_is_refused():
    assert find_lineup_problem(team(HOME) + team(AWAY, captains=2), (HOME, AWAY)) == SEVERAL_CAPTAINS


def test_a_team_with_no_captain_marked_passes():
    assert find_lineup_problem(team(HOME, captains=0) + team(AWAY), (HOME, AWAY)) is None


def test_a_match_with_only_one_team_listed_is_refused():
    assert find_lineup_problem(team(HOME), (HOME, AWAY)) == ONE_TEAM_MISSING


def test_shirt_numbers_are_numbers_or_unknown():
    assert [parse_shirt_number(text) for text in ("9", "23", "-", "", None)] == [9, 23, None, None, None]


def lineup(source: str, starters: list[str | None], match_id: int = 1, team_ref: str = "wd:Q1") -> TeamLineup:
    """A team lineup whose starters are these player refs (None = a starter not linked in that source)."""
    slots = tuple(
        LineupSlot(ref, f"{source}-{n}", True, None, n + 1, False, f"{source}-row-{n}")
        for n, ref in enumerate(starters)
    )
    bench = (LineupSlot("wd:Q999", f"{source}-bench", False, None, 23, False, f"{source}-row-bench"),)
    return TeamLineup(match_id, team_ref, source, "test", slots + bench)


XI = [f"wd:Q{n}" for n in range(100, 111)]


def test_transfermarkt_is_kept_when_both_sources_agree():
    kept, disagreeing = choose_one_lineup_per_team([lineup(FJELSTUL, XI), lineup(TRANSFERMARKT, XI)])
    assert [item.source for item in kept] == [TRANSFERMARKT]
    assert disagreeing == []


def test_a_lineup_from_only_one_source_is_kept():
    kept, _ = choose_one_lineup_per_team(
        [lineup(FJELSTUL, XI, match_id=1), lineup(TRANSFERMARKT, XI, match_id=2)]
    )
    assert [(item.match_id, item.source) for item in kept] == [(1, FJELSTUL), (2, TRANSFERMARKT)]


def test_an_unlinked_starter_explains_a_missing_linked_one():
    kept, disagreeing = choose_one_lineup_per_team(
        [lineup(TRANSFERMARKT, XI), lineup(FJELSTUL, [*XI[:10], None])]
    )
    assert [item.source for item in kept] == [TRANSFERMARKT]
    assert disagreeing == []


def test_different_linked_starters_keep_neither_lineup():
    other_xi = [*XI[:10], "wd:Q200"]
    kept, disagreeing = choose_one_lineup_per_team([lineup(TRANSFERMARKT, XI), lineup(FJELSTUL, other_xi)])
    assert kept == []
    assert sorted(item.source for item in disagreeing) == [FJELSTUL, TRANSFERMARKT]


def test_each_team_of_a_match_is_chosen_on_its_own():
    kept, disagreeing = choose_one_lineup_per_team(
        [
            lineup(TRANSFERMARKT, XI, team_ref="wd:Q1"),
            lineup(FJELSTUL, [*XI[:10], "wd:Q200"], team_ref="wd:Q1"),
            lineup(FJELSTUL, XI, team_ref="wd:Q2"),
        ]
    )
    assert [(item.team_ref, item.source) for item in kept] == [("wd:Q2", FJELSTUL)]
    assert len(disagreeing) == 2
