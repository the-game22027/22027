from datetime import date

from kb.links import (
    ASSIST_GIVEN,
    ASSIST_RECEIVED,
    CONCEDED_TO,
    LinkMatch,
    build_link_graph,
    one_two_rounds,
)

UCL = {"en": "UEFA Champions League", "ar": "دوري أبطال أوروبا"}
LIGA = {"en": "La Liga", "ar": "الدوري الإسباني"}
REAL, ATLETICO, FRANCE = "wikidata:Q8682", "wikidata:Q8701", "wikidata:Q47774"
TEAMS = {
    REAL: {"en": "Real Madrid CF", "ar": "ريال مدريد"},
    ATLETICO: {"en": "Atlético Madrid", "ar": "أتلتيكو مدريد"},
    FRANCE: {"en": "France national football team", "ar": "منتخب فرنسا"},
}
RAMOS, MODRIC, GODIN, KOKE, BENCH = (f"wikidata:Q{n}" for n in (10, 11, 20, 21, 99))
PLAYERS = {RAMOS, MODRIC, GODIN, KOKE}


def match(match_id, stage, day, home=REAL, away=ATLETICO, competition=UCL, shootout=None, leg=None):
    return LinkMatch(
        match_id,
        "champions-league" if competition is UCL else "la-liga",
        competition,
        1,
        "2013-14",
        stage,
        leg,
        day,
        home,
        away,
        4,
        1,
        *(shootout or (None, None)),
    )


FINAL_2014 = match(1, "FINAL", date(2014, 5, 24))
DERBY = match(2, "LEAGUE", date(2014, 9, 13))
STARTERS = [(1, REAL, RAMOS), (1, REAL, MODRIC), (1, ATLETICO, GODIN), (1, ATLETICO, KOKE), (2, REAL, RAMOS)]
GOALS = [
    (1, ATLETICO, GODIN, KOKE),
    (1, REAL, RAMOS, MODRIC),
    (1, REAL, RAMOS, BENCH),
    (2, ATLETICO, GODIN, None),
]


def graph(matches=(FINAL_2014, DERBY), starters=STARTERS, goals=GOALS):
    return build_link_graph(
        matches,
        starters,
        goals,
        lambda ref: ref in PLAYERS,
        lambda ref: ref in (REAL, ATLETICO),
        TEAMS.get,
    )


def links_of(link_graph, link_type):
    return {(link["from"], link["to"]) for link in link_graph.links if link["type"] == link_type}


def test_opposing_starters_of_a_final_faced_each_other_in_a_final_and_a_knockout():
    built = graph()
    expected = {(RAMOS, GODIN), (RAMOS, KOKE), (MODRIC, GODIN), (MODRIC, KOKE)}
    expected = {tuple(sorted(pair)) for pair in expected}
    assert links_of(built, "FACED_IN_FINAL") == expected
    assert links_of(built, "FACED_IN_KNOCKOUT") == expected


def test_league_matches_and_teammates_never_count_as_facing_each_other():
    built = graph(matches=(DERBY,), starters=[(2, REAL, RAMOS), (2, REAL, MODRIC), (2, ATLETICO, GODIN)])
    assert links_of(built, "FACED_IN_KNOCKOUT") == set()


def test_scorers_of_one_match_are_linked_whatever_their_team():
    assert links_of(graph(), "SCORED_IN_SAME_MATCH") == {tuple(sorted((RAMOS, GODIN)))}


def test_an_assist_goes_from_the_provider_to_the_scorer_and_needs_two_catalog_players():
    assert links_of(graph(), "ASSISTED") == {(KOKE, GODIN), (MODRIC, RAMOS)}


def test_scoring_against_counts_only_catalog_clubs():
    goals = [*GOALS, (3, REAL, RAMOS, None)]
    friendly = match(3, "FINAL", date(2015, 1, 1), home=FRANCE, away=REAL)
    built = graph(matches=(FINAL_2014, DERBY, friendly), goals=goals)
    assert links_of(built, "SCORED_AGAINST") == {(RAMOS, ATLETICO), (GODIN, REAL)}


def test_the_evidence_is_the_most_memorable_match_and_reads_in_both_languages():
    # Godín scored against Real in the final and in a later league match: the final wins.
    built = graph()
    [link] = [link for link in built.links if link["type"] == "SCORED_AGAINST" and link["from"] == GODIN]
    evidence = {item["key"]: item["evidence"] for item in built.matches}[link["match"]]
    assert evidence == {
        "en": "2013-14 UEFA Champions League final: Real Madrid 4–1 Atlético Madrid",
        "ar": "نهائي دوري أبطال أوروبا 2013-14: ريال مدريد 4–1 أتلتيكو مدريد",
    }
    assert link["match"] == "champions-league:2013-14:FINAL:2014-05-24:Q8682-Q8701"


def test_a_tier_one_final_is_more_memorable_than_a_later_super_cup_final():
    super_cup = LinkMatch(
        7,
        "uefa-super-cup",
        UCL,
        2,
        "2018-19",
        "FINAL",
        None,
        date(2018, 8, 15),
        REAL,
        ATLETICO,
        2,
        4,
        None,
        None,
    )
    built = graph(
        matches=(FINAL_2014, super_cup), starters=[*STARTERS, (7, REAL, RAMOS), (7, ATLETICO, GODIN)]
    )
    [link] = [
        link
        for link in built.links
        if link["type"] == "FACED_IN_FINAL" and {link["from"], link["to"]} == {RAMOS, GODIN}
    ]
    assert link["match"].startswith("champions-league:2013-14:FINAL")


def test_a_shootout_and_a_leg_appear_in_the_evidence():
    semi = match(5, "SEMI_FINAL", date(2014, 4, 30), shootout=(4, 3), leg=2)
    built = graph(matches=(semi,), starters=[(5, REAL, RAMOS), (5, ATLETICO, GODIN)], goals=[])
    assert built.matches[0]["evidence"] == {
        "en": "2013-14 UEFA Champions League semi-final, leg 2: Real Madrid 4–1 (4–3 on penalties) Atlético Madrid",
        "ar": "إياب نصف نهائي دوري أبطال أوروبا 2013-14: ريال مدريد 4–1 (4–3 بركلات الترجيح) أتلتيكو مدريد",
    }


def test_a_match_whose_teams_have_no_names_is_never_evidence():
    nameless = match(6, "FINAL", date(2016, 5, 28), home="wikidata:Q1", away=ATLETICO)
    built = graph(matches=(nameless,), starters=[(6, "wikidata:Q1", RAMOS), (6, ATLETICO, GODIN)], goals=[])
    assert built.links == [] and built.matches == []


def test_neighbour_counts_read_each_link_from_both_ends():
    counts = graph().neighbour_counts()
    assert counts[(RAMOS, "FACED_IN_FINAL")] == 2
    assert counts[(MODRIC, ASSIST_GIVEN)] == 1 and counts[(RAMOS, ASSIST_RECEIVED)] == 1
    assert counts[(ATLETICO, CONCEDED_TO)] == 1 and counts[(RAMOS, "SCORED_AGAINST")] == 1


def test_keeping_only_some_entities_drops_their_links_and_unused_matches():
    kept = graph().keeping_only({RAMOS, GODIN, REAL})
    assert {link["type"] for link in kept.links} == {
        "FACED_IN_FINAL",
        "FACED_IN_KNOCKOUT",
        "SCORED_IN_SAME_MATCH",
        "SCORED_AGAINST",
    }
    assert [item["key"] for item in kept.matches] == ["champions-league:2013-14:FINAL:2014-05-24:Q8682-Q8701"]


def test_a_seed_is_a_known_player_with_three_full_pass_types():
    # Ramos: 6 opponents in finals, knockouts and as scorers in the same match, so 3 pass types reach 5.
    opponents = [f"wikidata:Q{n}" for n in range(30, 36)]
    players = PLAYERS | set(opponents)
    starters = [(1, REAL, RAMOS)] + [(1, ATLETICO, ref) for ref in opponents]
    goals = [(1, REAL, RAMOS, None)] + [(1, ATLETICO, ref, None) for ref in opponents]
    built = build_link_graph(
        [FINAL_2014], starters, goals, players.__contains__, lambda ref: False, TEAMS.get
    )
    popularity = {RAMOS: 160, opponents[0]: 30}
    [line] = one_two_rounds(built, popularity.get, "kb")
    assert line["externalKey"] == "one-two:Q10" and line["gameType"] == "ONE_TWO"
    assert line["content"] == {"seed": RAMOS} and line["answers"] == []
    # Well known (160 sitelinks) but only 6 names in its third pass type: one step harder than 1.
    assert line["difficulty"] == 2


def test_no_seed_without_enough_neighbours_or_fame():
    assert one_two_rounds(graph(), {RAMOS: 160, GODIN: 10}.get, "kb") == []


def test_the_same_input_gives_the_same_output():
    assert graph() == graph()
