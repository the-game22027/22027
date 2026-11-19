from kb.lineups import (
    ONE_TEAM_MISSING,
    SEVERAL_CAPTAINS,
    WRONG_STARTER_COUNT,
    LineupRow,
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
