from kb.vaults import (
    FINAL_TOTAL_GOALS,
    PLAYER_GOALS,
    SHIRT_NUMBER,
    SHOOTOUT_SCORED,
    TEAM_GOALS,
    TITLES_SINCE_2000,
    VaultMatch,
    vault_facts,
    vault_rounds,
)

UCL = {"en": "UEFA Champions League", "ar": "دوري أبطال أوروبا"}
WORLD_CUP = {"en": "FIFA World Cup", "ar": "كأس العالم"}
TEAMS = {
    "wikidata:Q1": {"en": "Liverpool F.C.", "ar": "نادي ليفربول"},
    "wikidata:Q2": {"en": "Tottenham Hotspur F.C.", "ar": "توتنهام هوتسبير"},
    "wikidata:Q3": {"en": "Spain men's national football team", "ar": "منتخب إسبانيا لكرة القدم"},
    "wikidata:Q4": {"en": "Netherlands national football team", "ar": "منتخب هولندا لكرة القدم"},
}
PLAYERS = {
    "wikidata:Q10": {"en": "Mohamed Salah", "ar": "محمد صلاح"},
    "wikidata:Q11": {"en": "Divock Origi", "ar": "ديفوك أوريغي"},
}
POPULARITY = {"wikidata:Q10": 150, "wikidata:Q11": 50, "wikidata:Q12": 10}


def match(match_id=1, stage="FINAL", home=2, away=1, tier=1, leg=None, shootout=None, complete=True, **extra):
    fields = {
        "match_id": match_id,
        "competition_key": "champions-league",
        "competition_names": UCL,
        "competition_kind": "CUP",
        "tier": tier,
        "season_label": "2018-19",
        "final_year": 2019,
        "stage": stage,
        "leg": leg,
        "home_ref": "wikidata:Q1",
        "away_ref": "wikidata:Q2",
        "home_goals": home,
        "away_goals": away,
        "shootout_home": shootout[0] if shootout else None,
        "shootout_away": shootout[1] if shootout else None,
        "shootout_winner_ref": None,
        "goals_complete": complete,
    }
    return VaultMatch(**(fields | extra))


def facts(matches, player_goals=(), shirts=(), editions=()):
    return vault_facts(matches, player_goals, shirts, editions, TEAMS.get, PLAYERS.get, POPULARITY.get)


def by_template(found, template):
    return [fact for fact in found if fact.template == template]


def test_a_final_gives_team_goals_and_the_total_in_both_languages():
    found = facts([match()])
    assert [fact.answer for fact in by_template(found, TEAM_GOALS)] == [2, 1]
    [total] = by_template(found, FINAL_TOTAL_GOALS)
    assert total.answer == 3
    assert total.text == {
        "en": "How many goals were scored in the 2018-19 UEFA Champions League final, not counting the shootout?",
        "ar": "كم هدفًا سُجل في نهائي دوري أبطال أوروبا 2018-19 دون احتساب ركلات الترجيح؟",
    }
    assert by_template(found, TEAM_GOALS)[0].text["en"] == (
        "How many goals did Liverpool score against Tottenham Hotspur in the final of the 2018-19 UEFA Champions League?"
    )


def test_a_two_legged_tie_names_the_leg_and_a_group_match_gives_nothing():
    [first, _] = by_template(facts([match(stage="SEMI_FINAL", leg=1)]), TEAM_GOALS)
    assert "in the first leg of the semi-final" in first.text["en"]
    assert "ذهاب نصف نهائي" in first.text["ar"]
    assert facts([match(stage="GROUP")]) == []
    assert facts([match(stage="SEMI_FINAL", tier=2)]) == []


def test_numbers_above_nine_are_never_answers():
    found = facts([match(home=10, away=0)])
    assert [fact.answer for fact in found] == [0]


def test_shootout_kicks_count_only_when_the_shootout_is_known():
    found = facts([match(home=1, away=1, shootout=(3, 4))])
    assert sorted(fact.answer for fact in by_template(found, SHOOTOUT_SCORED)) == [3, 4]
    assert by_template(facts([match()]), SHOOTOUT_SCORED) == []


def test_player_goals_need_a_brace_a_known_player_and_complete_goal_rows():
    rows = [
        (1, "wikidata:Q1", "wikidata:Q10", 2),
        (1, "wikidata:Q1", "wikidata:Q11", 1),
        (1, "wikidata:Q1", "wikidata:Q12", 2),
    ]
    [salah] = by_template(facts([match(home=5)], player_goals=rows), PLAYER_GOALS)
    assert (salah.answer, salah.key) == (2, "vault:PLAYER_GOALS:1:Q10")
    assert by_template(facts([match(home=5, complete=False)], player_goals=rows), PLAYER_GOALS) == []


def test_one_shirt_fact_per_player_team_and_number_from_the_best_known_match():
    shirts = [
        (2, "wikidata:Q1", "wikidata:Q10", 11),
        (1, "wikidata:Q1", "wikidata:Q11", 9),
        (2, "wikidata:Q1", "wikidata:Q11", 9),
    ]
    found = facts([match(match_id=1), match(match_id=2, stage="QUARTER_FINAL")], shirts=shirts)
    [origi] = by_template(found, SHIRT_NUMBER)
    assert (origi.answer, origi.group) == (9, "match:1")
    assert (
        origi.text["en"]
        == "Which shirt number did Divock Origi wear for Liverpool in the final of the 2018-19 UEFA Champions League?"
    )


def test_title_counts_only_for_tournaments_with_every_final_since_2000():
    def final(match_id, year, winner_goals):
        return match(
            match_id,
            competition_key="world-cup",
            competition_names=WORLD_CUP,
            competition_kind="INTERNATIONAL",
            season_label=str(year),
            final_year=year,
            home_ref="wikidata:Q3",
            away_ref="wikidata:Q4",
            home=winner_goals,
            away=0,
        )

    finals = [final(1, 2010, 1), final(2, 2014, 0)]
    complete = [("world-cup", 2002, True), ("world-cup", 2010, True), ("world-cup", 2014, True)]
    titles = {
        fact.text["en"]: fact.answer
        for fact in by_template(facts(finals, editions=complete), TITLES_SINCE_2000)
    }
    assert titles == {
        "How many FIFA World Cup titles have Spain won since 2000?": 1,
        "How many FIFA World Cup titles have Netherlands won since 2000?": 0,
    }
    missing_a_final = [*complete, ("world-cup", 2018, False)]
    assert by_template(facts(finals, editions=missing_a_final), TITLES_SINCE_2000) == []


def test_a_vault_has_four_facts_from_four_matches_with_at_most_two_of_a_template():
    matches = [match(match_id=n) for n in range(1, 9)]
    rows = [(n, "wikidata:Q1", "wikidata:Q10", 2) for n in range(1, 9)]
    found = facts(matches, player_goals=rows)
    rounds = vault_rounds(found, "kb", count=100)
    assert rounds
    for line in rounds:
        questions = line["content"]["questions"]
        assert len(questions) == 4
        assert line["gameType"] == "VAULT" and line["answers"] == []
        assert all(0 <= question["answerNumber"] <= 9 for question in questions)
        templates = [question["template"] for question in questions]
        assert max(templates.count(template) for template in templates) <= 2
        matches_used = [key.split(":")[1] for key in line["externalKey"].removeprefix("vault:").split("+")]
        assert len(set(matches_used)) == 4


def test_the_same_input_gives_the_same_output():
    matches = [match(match_id=n) for n in range(1, 9)]
    assert vault_rounds(facts(matches), "kb", count=10) == vault_rounds(
        facts(list(reversed(matches))), "kb", count=10
    )
