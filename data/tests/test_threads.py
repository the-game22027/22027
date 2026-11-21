from datetime import date

from kb.links import LinkMatch
from kb.threads import (
    ASSIST,
    CAPTAIN,
    FINAL_OPPONENT,
    FINAL_WINNER,
    FIRST_SCORER,
    LAST_SCORER,
    NATIONALITY,
    SCORED_IN_FINAL_AGAINST,
    FinalGoal,
    Room,
    collect_thread_facts,
    difficulty_from_least_known,
    next_rooms,
    thread_rounds,
)

UCL = {"en": "UEFA Champions League", "ar": "دوري أبطال أوروبا"}
REAL, ATLETICO = "wikidata:Q8682", "wikidata:Q8701"
SPAIN, URUGUAY, CROATIA = "wikidata:Q29", "wikidata:Q77", "wikidata:Q224"
RAMOS, MODRIC, GODIN, KOKE, CASILLAS, GABI, BALE, RONALDO, CARRASCO = (
    f"wikidata:Q{n}" for n in range(10, 19)
)
KINDS = {REAL: "CLUB", ATLETICO: "CLUB", SPAIN: "COUNTRY", URUGUAY: "COUNTRY", CROATIA: "COUNTRY"}
KINDS |= {
    player: "PLAYER" for player in (RAMOS, MODRIC, GODIN, KOKE, CASILLAS, GABI, BALE, RONALDO, CARRASCO)
}
POPULARITY = {RAMOS: 90, MODRIC: 85, GODIN: 60, KOKE: 55, CASILLAS: 88, GABI: 40, BALE: 80, RONALDO: 99}
POPULARITY[CARRASCO] = 20


def final(match_id, season, home_goals, away_goals, shootout=(None, None), leg=None, stage="FINAL"):
    return LinkMatch(
        match_id,
        "champions-league",
        UCL,
        1,
        season,
        stage,
        leg,
        date(2014, 5, 24),
        REAL,
        ATLETICO,
        home_goals,
        away_goals,
        *shootout,
    )


LISBON = final(1, "2013-14", 4, 1)
MILAN = final(2, "2015-16", 1, 1, shootout=(5, 3))
GOALS = [
    FinalGoal(1, ATLETICO, GODIN, 36, KOKE),
    FinalGoal(1, REAL, RAMOS, 93, MODRIC),
    FinalGoal(1, REAL, BALE, 110, None),
    FinalGoal(1, REAL, RONALDO, 120, None),
    FinalGoal(2, REAL, RAMOS, 15, None),
    FinalGoal(2, ATLETICO, CARRASCO, 79, None),
]
CAPTAINS = [(1, REAL, CASILLAS), (1, ATLETICO, GABI), (2, REAL, RAMOS), (2, ATLETICO, GABI)]
CITIZENSHIPS = [
    (RAMOS, SPAIN),
    (MODRIC, CROATIA),
    (GODIN, URUGUAY),
    (KOKE, SPAIN),
    (CASILLAS, SPAIN),
    (GABI, SPAIN),
]


def facts(matches=(LISBON, MILAN), goals=GOALS, captains=CAPTAINS, citizenships=CITIZENSHIPS):
    return collect_thread_facts(matches, goals, captains, citizenships)


def rounds(thread_facts=None, **options):
    return thread_rounds(
        thread_facts or facts(), KINDS.get, lambda ref: POPULARITY.get(ref, 0), "kb-test", **options
    )


def test_finals_need_one_match_and_a_winner_a_shootout_decides():
    legged = final(3, "2016-17", 2, 0, leg=1)
    drawn = final(4, "2017-18", 1, 1)
    semi = final(5, "2018-19", 2, 0, stage="SEMI_FINAL")
    found = facts(matches=(LISBON, MILAN, legged, drawn, semi))

    assert set(found.finals) == {1, 2}
    assert found.winners == {1: REAL, 2: REAL}


def test_an_own_goal_or_a_goal_without_a_minute_or_scorer_stops_scorer_hops_in_that_final():
    found = facts(goals=[*GOALS, FinalGoal(2, ATLETICO, "", 50, None, own_goal=True)])
    assert found.scorer_safe == {1}
    assert facts(goals=[*GOALS, FinalGoal(2, REAL, RAMOS, None, None)]).scorer_safe == {1}
    assert facts(goals=[*GOALS, FinalGoal(2, REAL, "", 60, None)]).scorer_safe == {1}


def test_a_player_with_two_countries_has_no_nationality_hop():
    found = facts(citizenships=[*CITIZENSHIPS, (BALE, "wikidata:Q25"), (BALE, "wikidata:Q21")])
    assert BALE not in found.citizenship
    assert found.citizenship[RAMOS] == SPAIN


def test_a_team_leads_to_its_opponent_first_and_last_scorer_and_captain():
    hops = {(room.hop, room.answer) for room in next_rooms(facts(), KINDS.get, Room(FINAL_WINNER, REAL, 1))}
    assert hops == {
        (FINAL_OPPONENT, ATLETICO),
        (FIRST_SCORER, RAMOS),
        (LAST_SCORER, RONALDO),
        (CAPTAIN, CASILLAS),
    }


def test_two_goals_in_the_same_minute_have_no_first_scorer():
    goals = [*GOALS[1:], FinalGoal(1, ATLETICO, GODIN, 36, KOKE), FinalGoal(1, ATLETICO, KOKE, 36, None)]
    hops = {room.hop for room in next_rooms(facts(goals=goals), KINDS.get, Room(FINAL_OPPONENT, ATLETICO, 1))}
    assert FIRST_SCORER not in hops and LAST_SCORER not in hops


def test_a_player_leads_to_the_assist_of_his_goal_the_team_he_scored_against_in_another_final_and_his_country():
    goal = GOALS[1]
    rooms = next_rooms(facts(), KINDS.get, Room(FIRST_SCORER, RAMOS, 1, goal))
    assert [(room.hop, room.answer, room.match_id) for room in rooms] == [
        (ASSIST, MODRIC, 1),
        (SCORED_IN_FINAL_AGAINST, ATLETICO, 2),
        (NATIONALITY, SPAIN, None),
    ]


def test_every_thread_has_five_rooms_with_one_different_answer_each_and_a_country_only_at_the_end():
    lines = rounds()

    assert lines
    for line in lines:
        rooms = line["content"]["rooms"]
        answers = [answer["entities"] for answer in line["answers"]]
        assert len(rooms) == 5 and all(len(entities) == 1 for entities in answers)
        assert len({entities[0] for entities in answers}) == 5
        assert rooms[0]["hop"] == FINAL_WINNER
        assert all(first["hop"] != second["hop"] for first, second in zip(rooms, rooms[1:], strict=False))
        assert all(room["hop"] != NATIONALITY for room in rooms[:-1])
        assert rooms[-1]["jumpText"] is None and all(room["jumpText"] for room in rooms[:-1])


def test_a_final_gives_at_most_n_threads_each_with_a_different_second_room():
    lines = rounds(threads_per_final=2)
    by_final: dict[str, list[tuple]] = {}
    for line in lines:
        rooms = line["content"]["rooms"]
        by_final.setdefault(rooms[0]["text"]["en"], []).append(
            (rooms[1]["hop"], line["answers"][1]["entities"][0])
        )
    assert all(len(seconds) <= 2 and len(set(seconds)) == len(seconds) for seconds in by_final.values())


def test_unknown_players_are_never_answers():
    lines = rounds(min_player_sitelinks=50)
    answers = {answer["entities"][0] for line in lines for answer in line["answers"]}
    assert GABI not in answers and CARRASCO not in answers


def test_questions_name_the_final_and_point_at_the_room_before_in_both_languages():
    line = next(
        line
        for line in rounds(threads_per_final=10)
        if [room["hop"] for room in line["content"]["rooms"]][:4]
        == [FINAL_WINNER, FINAL_OPPONENT, FIRST_SCORER, ASSIST]
    )
    first, opponent, scorer, assist = line["content"]["rooms"][:4]
    assert first["text"] == {
        "en": "Who won the 2013-14 UEFA Champions League final?",
        "ar": "من فاز بنهائي دوري أبطال أوروبا 2013-14؟",
    }
    assert first["jumpText"]["en"] == "Who did the winner of the 2013-14 UEFA Champions League final face?"
    assert opponent["jumpText"]["en"] == "Who scored the first goal for the team they faced in that final?"
    assert scorer["text"]["en"] == "Who scored their first goal in that final?"
    assert scorer["jumpText"]["en"] == "Who set up their first goal in that final?"
    assert assist["text"]["ar"] == "من صنع ذلك الهدف؟"
    assert [answer["entities"][0] for answer in line["answers"]][:4] == [REAL, ATLETICO, GODIN, KOKE]
    assert [room["answerKind"] for room in line["content"]["rooms"]] == [
        "CLUB",
        "CLUB",
        "PLAYER",
        "PLAYER",
        "COUNTRY",
    ]


def test_the_same_input_gives_the_same_threads():
    assert rounds() == rounds()


def test_difficulty_comes_from_the_least_known_answer():
    assert difficulty_from_least_known(90) == 1
    assert difficulty_from_least_known(50) == 3
    assert difficulty_from_least_known(30) == 5
