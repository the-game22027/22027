import pytest

from kb.careers import Spell
from kb.generate import (
    PlayerFacts,
    career_round,
    difficulty_from_sitelinks,
    first_club_round,
    gives_away_an_answer,
    joined_in_year_rounds,
    nationality_round,
    pick_spread_over_difficulties,
    senior_career_in_order,
    who_is_player_round,
)

NAMES = {
    "wikidata:Q11571": {"en": "Cristiano Ronaldo", "ar": "كريستيانو رونالدو"},
    "wikidata:SCP": {"en": "Sporting CP", "ar": "سبورتينغ لشبونة"},
    "wikidata:MU": {"en": "Manchester United", "ar": "مانشستر يونايتد"},
    "wikidata:RM": {"en": "Real Madrid", "ar": "ريال مدريد"},
    "wikidata:PT": {"en": "Portugal", "ar": "البرتغال"},
}


def names_of(ref):
    return NAMES.get(ref)


def spell(statement, team, start, end, loan=False):
    return Spell(statement, "wikidata:Q11571", team, start, end, loan)


def ronaldo(*spells, sitelinks=150, countries=("wikidata:PT",)):
    return PlayerFacts(
        external_ref="wikidata:Q11571",
        sitelinks=sitelinks,
        names=NAMES["wikidata:Q11571"],
        spells=tuple(spells),
        country_refs=countries,
    )


CAREER = (
    spell("s1", "wikidata:SCP", 2002, 2003),
    spell("s2", "wikidata:MU", 2003, 2009),
    spell("s3", "wikidata:RM", 2009, 2018),
)


@pytest.mark.parametrize(
    ("sitelinks", "difficulty"), [(150, 1), (100, 1), (99, 2), (60, 2), (45, 3), (20, 4), (8, 5)]
)
def test_more_famous_players_make_easier_rounds(sitelinks, difficulty):
    assert difficulty_from_sitelinks(sitelinks) == difficulty


def test_a_career_round_lists_the_spells_in_order_and_accepts_the_player():
    line = career_round(ronaldo(*reversed(CAREER)), lambda ref: ref in NAMES, "wikidata-2026-11-10")

    assert line["externalKey"] == "career:Q11571"
    assert line["gameType"] == "CAREER"
    assert [s["club"] for s in line["content"]["spells"]] == ["wikidata:SCP", "wikidata:MU", "wikidata:RM"]
    assert line["answers"] == [{"slot": 0, "entities": ["wikidata:Q11571"]}]
    assert line["provenance"]["facts"] == ["s1", "s2", "s3"]
    assert line["humanReviewed"] == {"en": False, "ar": False}


@pytest.mark.parametrize(
    "spells",
    [
        CAREER[:2],  # too short
        (*CAREER, spell("s4", "wikidata:XX", 2018, 2021)),  # a club outside the catalog
        (*CAREER[:2], spell("s3", "wikidata:RM", None, None)),  # an undated spell would drop a club
    ],
)
def test_no_career_round_when_the_career_cannot_be_told_truthfully(spells):
    assert career_round(ronaldo(*spells), lambda ref: ref in NAMES, "kb") is None


def test_two_open_spells_mean_a_missing_end_date():
    assert (
        senior_career_in_order(
            ronaldo(spell("a", "wikidata:MU", 2013, None), spell("b", "wikidata:RM", 2021, None))
        )
        is None
    )


def test_a_loan_comes_after_the_permanent_move_of_the_same_year():
    career = senior_career_in_order(
        ronaldo(
            spell("loan", "wikidata:SCP", 2006, 2007, loan=True), spell("move", "wikidata:MU", 2006, 2009)
        )
    )
    assert [s.statement_id for s in career] == ["move", "loan"]


def test_first_club_round_asks_for_the_first_senior_club_in_both_languages():
    line = first_club_round(ronaldo(*CAREER), names_of, "kb")

    assert line["content"]["answerKind"] == "CLUB"
    assert line["content"]["steps"]["en"] == [
        "At which club",
        "did Cristiano Ronaldo",
        "start",
        "his senior career?",
    ]
    assert len(line["content"]["steps"]["ar"]) == len(line["content"]["steps"]["en"])
    assert line["answers"] == [{"slot": 0, "entities": ["wikidata:SCP"]}]


def test_first_club_is_skipped_when_two_spells_start_the_same_year():
    same_year = (spell("a", "wikidata:SCP", 2002, 2003), spell("b", "wikidata:MU", 2002, 2009))
    assert first_club_round(ronaldo(*same_year), names_of, "kb") is None


def test_joined_in_year_names_the_previous_club_and_the_year():
    rounds = joined_in_year_rounds(ronaldo(*CAREER), names_of, "kb")

    assert [r["externalKey"] for r in rounds] == [
        "buzzer:joined-in-year:Q11571:2003",
        "buzzer:joined-in-year:Q11571:2009",
    ]
    assert rounds[1]["content"]["steps"]["en"] == [
        "Which club",
        "did Cristiano Ronaldo join",
        "from Manchester United",
        "in 2009?",
    ]
    assert rounds[1]["answers"] == [{"slot": 0, "entities": ["wikidata:RM"]}]


def test_joined_in_year_skips_loans_on_either_side():
    with_loan = (spell("s1", "wikidata:SCP", 2002, 2003), spell("s2", "wikidata:MU", 2003, 2004, loan=True))
    assert joined_in_year_rounds(ronaldo(*with_loan), names_of, "kb") == []


def test_nationality_accepts_every_known_citizenship():
    line = nationality_round(ronaldo(*CAREER, countries=("wikidata:PT", "wikidata:UNKNOWN")), names_of, "kb")
    assert line["answers"] == [{"slot": 0, "entities": ["wikidata:PT"]}]
    assert line["content"]["answerKind"] == "COUNTRY"


@pytest.mark.parametrize(
    ("steps", "expected"),
    [
        ({"en": ["Which club", "did he join from Real Madrid?"]}, True),
        ({"ar": ["أي نادٍ", "انضم إليه من ريال مدريد؟"]}, True),
        ({"en": ["Which club", "did he join from Sporting CP?"]}, False),
    ],
)
def test_a_round_that_names_its_answer_gives_it_away(steps, expected):
    assert gives_away_an_answer(steps, [NAMES["wikidata:RM"]]) is expected


def test_picks_take_turns_over_difficulties_so_a_short_bundle_is_not_all_hard():
    lines = [{"difficulty": 5, "id": i} for i in range(5)] + [{"difficulty": 1, "id": 9}]
    picked = pick_spread_over_difficulties(lines, 3)
    assert [line["difficulty"] for line in picked] == [1, 5, 5]


def countries_of(ref):
    return NAMES.get(ref) if ref == "wikidata:PT" else None


def clubs_of(ref):
    return None if ref in ("wikidata:PT", "wikidata:Q11571") else NAMES.get(ref)


def test_who_is_the_player_gives_clues_from_hardest_to_easiest_in_both_languages():
    player = PlayerFacts(
        external_ref="wikidata:Q11571",
        sitelinks=150,
        names=NAMES["wikidata:Q11571"],
        spells=(*CAREER, spell("s4", "wikidata:SCP", 2005, 2006, loan=True)),
        country_refs=("wikidata:PT",),
        birth_year=1985,
    )
    line = who_is_player_round(player, clubs_of, countries_of, "kb")

    assert line["externalKey"] == "who:Q11571"
    assert line["answers"] == [{"slot": 0, "entities": ["wikidata:Q11571"]}]
    assert [(clue["kind"], clue["text"]["en"]) for clue in line["content"]["clues"]] == [
        ("BIRTH_YEAR", "Born in 1985"),
        ("CLUB_COUNT", "Senior clubs: 3"),
        ("FIRST_CLUB", "Started his senior career at Sporting CP"),
        ("LOAN", "Was loaned to Sporting CP in 2005"),
        ("NATIONALITY", "Nationality: Portugal"),
        ("LONGEST_SPELL", "At Real Madrid from 2009 to 2018"),
        ("LAST_CLUB", "Last club: Real Madrid"),
    ]
    assert line["content"]["clues"][-1]["text"]["ar"] == "آخر أنديته: ريال مدريد"


def test_who_is_the_player_needs_enough_clues():
    sparse = PlayerFacts(
        external_ref="wikidata:Q11571",
        sitelinks=150,
        names=NAMES["wikidata:Q11571"],
        spells=(spell("s1", "wikidata:XX", 2002, None),),
        country_refs=(),
    )
    assert who_is_player_round(sparse, clubs_of, countries_of, "kb") is None


def test_an_open_last_spell_is_the_current_club():
    player = ronaldo(*CAREER[:2], spell("s3", "wikidata:RM", 2009, None))
    line = who_is_player_round(player, clubs_of, countries_of, "kb")
    assert line["content"]["clues"][-1]["text"] == {
        "en": "Current club: Real Madrid",
        "ar": "ناديه الحالي: ريال مدريد",
    }
