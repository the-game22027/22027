from kb.goals import (
    FOULED_PLAYER,
    NO_LINEUP,
    NOT_IN_LINEUP,
    OWN_GOAL,
    GoalEvent,
    parse_minute,
    read_goal_facts,
)

LIVERPOOL, LEICESTER = "31", "1003"
SALAH, ALEXANDER_ARNOLD, SOYUNCU = "148455", "314353", "352965"
LINEUP = {(LIVERPOOL, SALAH), (LIVERPOOL, ALEXANDER_ARNOLD), (LEICESTER, SOYUNCU)}


def goal(description: str, assist: str | None = ALEXANDER_ARNOLD, club: str = LIVERPOOL) -> GoalEvent:
    return GoalEvent("e1", "g1", club, SALAH, assist, "23", description)


def test_a_real_assist_by_a_teammate_in_the_lineup_is_kept():
    facts = read_goal_facts(
        goal(", Left-footed shot, 1. Goal of the Season Assist: , Pass, 1. Assist of the Season"), LINEUP
    )
    assert (facts.own_goal, facts.penalty, facts.assist_player_id, facts.assist_dropped) == (
        False,
        False,
        ALEXANDER_ARNOLD,
        None,
    )


def test_the_fouled_player_on_a_penalty_is_not_an_assist():
    facts = read_goal_facts(goal(", Penalty, 1. Goal of the Season Assist: , Penalty: Fouled player"), LINEUP)
    assert facts.penalty is True
    assert (facts.assist_player_id, facts.assist_dropped) == (None, FOULED_PLAYER)


def test_an_assist_by_a_player_of_the_other_team_is_dropped():
    # Found 2026-11-17: a Liverpool goal with the assist credited to Leicester's Söyüncü.
    facts = read_goal_facts(goal(", Header, 3. Goal of the Season Assist: , Cross", assist=SOYUNCU), LINEUP)
    assert (facts.assist_player_id, facts.assist_dropped) == (None, NOT_IN_LINEUP)


def test_an_own_goal_is_flagged_and_has_no_assist():
    facts = read_goal_facts(goal(", Own-goal", club=LIVERPOOL), LINEUP)
    assert facts.own_goal is True
    assert facts.assist_dropped == OWN_GOAL
    assert read_goal_facts(goal(", Own-goal", assist=None), LINEUP).assist_dropped is None


def test_without_a_lineup_the_assist_cannot_be_checked_and_is_dropped():
    assert read_goal_facts(goal(", Right-footed shot Assist: , Pass"), None).assist_dropped == NO_LINEUP


def test_a_goal_without_an_assist_keeps_nothing_to_drop():
    facts = read_goal_facts(goal(", 1. Tournament Goal", assist=None), LINEUP)
    assert (facts.assist_player_id, facts.assist_dropped) == (None, None)


def test_minutes_are_numbers_or_unknown():
    assert [parse_minute(text) for text in ("23", "-1", "", None)] == [23, None, None, None]
