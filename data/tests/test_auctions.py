from kb.auctions import (
    ASSISTERS,
    SCORERS,
    GoalList,
    auction_rounds,
    build_goal_lists,
    difficulty_of_list,
    shorten_team_names,
    title_of,
)

UCL = {"en": "UEFA Champions League", "ar": "دوري أبطال أوروبا"}
TEAMS = {f"wikidata:Q{n}": {"en": f"Club {n} F.C.", "ar": f"نادي {n}"} for n in (1, 2, 3, 4)}


def goal_row(team, scorer, own_goal=False, assist=None, assist_source=None, season="2018-19"):
    return ("champions-league", UCL["en"], UCL["ar"], season, team, scorer, own_goal, assist, assist_source)


def players(team_number, count, offset=0):
    return [f"wikidata:Q{team_number * 1000 + offset + n}" for n in range(count)]


def known(ref):
    return 100


def build(goal_lists, popularity=known, **options):
    defaults = {"count": 10, "min_answers": 3, "max_answers": 10, "known_share": 0.6}
    return auction_rounds(goal_lists, popularity, TEAMS.get, "kb", **(defaults | options))


def scorer_list(team_number, count, offset=0):
    team = f"wikidata:Q{team_number}"
    return GoalList(
        SCORERS, team, "champions-league", UCL, "2018-19", tuple(players(team_number, count, offset)), True
    )


def test_goal_rows_become_scorer_and_assister_lists():
    rows = [
        goal_row("wikidata:Q1", "wikidata:Q11", assist="wikidata:Q12", assist_source="12"),
        goal_row("wikidata:Q1", "wikidata:Q11"),
        goal_row("wikidata:Q1", "wikidata:Q99", own_goal=True),
        goal_row("wikidata:Q1", None),
    ]
    by_kind = {goal_list.kind: goal_list for goal_list in build_goal_lists(rows)}
    assert by_kind[SCORERS].answers == ("wikidata:Q11",)
    assert by_kind[SCORERS].complete is False  # one scorer is not linked
    assert by_kind[ASSISTERS].answers == ("wikidata:Q12",)
    assert by_kind[SCORERS].key == "scorers:Q1:champions-league:2018-19"


def test_an_unlinked_assist_provider_makes_the_assister_list_incomplete():
    rows = [goal_row("wikidata:Q1", "wikidata:Q11", assist=None, assist_source="777")]
    by_kind = {goal_list.kind: goal_list for goal_list in build_goal_lists(rows)}
    assert by_kind[ASSISTERS].complete is False


def test_a_lot_is_three_lists_of_different_teams_with_one_slot_each():
    [line] = build([scorer_list(1, 4), scorer_list(2, 4), scorer_list(3, 4)])
    assert line["gameType"] == "AUCTION"
    assert [answer["slot"] for answer in line["answers"]] == [0, 1, 2]
    assert line["content"]["lists"][0] == {
        "kind": SCORERS,
        "title": {
            "en": "Club 1 scorers in the 2018-19 UEFA Champions League",
            "ar": "هدافو 1 في دوري أبطال أوروبا 2018-19",
        },
    }
    assert line["externalKey"].startswith("auction:scorers:Q1:")


def test_lists_from_the_same_team_never_share_a_lot():
    lists = [scorer_list(1, 4), scorer_list(1, 5, offset=100), scorer_list(2, 4)]
    assert build(lists) == []


def test_a_list_with_a_name_outside_the_catalog_or_too_few_known_names_is_dropped():
    lists = [scorer_list(1, 4), scorer_list(2, 4), scorer_list(3, 4), scorer_list(4, 4)]
    outside = set(players(4, 1))
    assert len(build(lists, lambda ref: None if ref in outside else 100)) == 1
    assert build(lists, lambda ref: 10) == []


def test_lists_outside_the_size_range_or_with_the_same_names_are_dropped():
    lists = [scorer_list(1, 2), scorer_list(2, 4), scorer_list(3, 4), scorer_list(4, 12)]
    assert build(lists) == []
    same = GoalList(
        ASSISTERS, "wikidata:Q4", "champions-league", UCL, "2018-19", scorer_list(2, 4).answers, True
    )
    assert build([scorer_list(2, 4), same, scorer_list(3, 4)]) == []


def test_famous_short_lists_are_easy():
    assert [difficulty_of_list(share, 10) for share in (1.0, 0.85, 0.75, 0.6)] == [1, 2, 3, 4]
    assert difficulty_of_list(1.0, 25) == 2


def test_team_names_read_like_a_fan_says_them():
    assert shorten_team_names(
        {"en": "Croatia men's national football team", "ar": "منتخب كرواتيا لكرة القدم"}
    ) == {
        "en": "Croatia",
        "ar": "منتخب كرواتيا",
    }
    assert shorten_team_names({"en": "Arsenal F.C.", "ar": "نادي آرسنال"}) == {
        "en": "Arsenal",
        "ar": "آرسنال",
    }
    assert shorten_team_names({"en": "Real Madrid Club de Fútbol", "ar": "ريال مدريد"})["en"] == "Real Madrid"
    assert shorten_team_names({"en": "AFC Ajax", "ar": "أياكس أمستردام"}) == {
        "en": "AFC Ajax",
        "ar": "أياكس أمستردام",
    }
    goal_list = scorer_list(1, 4)
    assert (
        title_of(goal_list, {"en": "Arsenal F.C.", "ar": "نادي آرسنال"})["ar"]
        == "هدافو آرسنال في دوري أبطال أوروبا 2018-19"
    )


def test_the_same_input_gives_the_same_output():
    lists = [scorer_list(n, 4) for n in (1, 2, 3)]
    assert build(lists) == build(list(reversed(lists)))
