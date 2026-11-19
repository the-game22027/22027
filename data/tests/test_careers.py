from pathlib import Path

import pytest

from kb.careers import (
    Spell,
    TeamFacts,
    ended_before_senior_age,
    is_senior_club,
    merge_consecutive_spells_at_same_club,
)
from kb.config import load_scope

SCOPE = load_scope(Path(__file__).parent.parent / "config" / "scope.toml")
CLUB = "Q476028"


def team(label: str, *classes: str) -> TeamFacts:
    return TeamFacts(external_ref="Q1", english_label=label, classes=frozenset(classes or (CLUB,)))


@pytest.mark.parametrize(
    "label",
    [
        "Sporting C.P. Youth and Academy",
        "Real Madrid Castilla",
        "FC Barcelona B",
        "Juventus Next Gen",
        "Bayern Munich II",
        "Manchester United Reserves",
        "Portugal national under-21 football team",
        "Inter Primavera",
        "FC Barcelona C",
        "FC Barcelona Atlètic",
    ],
)
def test_youth_and_reserve_sides_are_not_senior_clubs(label: str) -> None:
    assert not is_senior_club(team(label), SCOPE)


@pytest.mark.parametrize(
    "label",
    [
        "Real Madrid Club de Fútbol",
        "Club Brugge KV",
        "Al-Nassr",
        "Bayer 04 Leverkusen",
        "B.K. Häcken",
        "Atlético Madrid",
    ],
)
def test_first_teams_are_senior_clubs(label: str) -> None:
    assert is_senior_club(team(label), SCOPE)


def test_national_teams_are_not_clubs_even_without_a_youth_label() -> None:
    assert not is_senior_club(team("Portugal men's national football team", "Q135408445"), SCOPE)


def test_excluded_class_wins_over_a_clean_label() -> None:
    assert not is_senior_club(team("Some Club", CLUB, "Q2412834"), SCOPE)


def spell(statement: str, team_ref: str, start: int | None, end: int | None, loan: bool = False) -> Spell:
    return Spell(statement, "Q11571", team_ref, start, end, loan)


def test_career_is_ordered_by_start_year() -> None:
    career = merge_consecutive_spells_at_same_club(
        [
            spell("s3", "Q8682", 2009, 2018),
            spell("s1", "Q75729", 2002, 2003),
            spell("s2", "Q18656", 2003, 2009),
        ]
    )
    assert [s.team_ref for s in career] == ["Q75729", "Q18656", "Q8682"]


def test_back_to_back_spells_at_the_same_club_merge() -> None:
    career = merge_consecutive_spells_at_same_club(
        [spell("a", "Q1422", 2014, 2016), spell("b", "Q1422", 2016, 2017)]
    )
    assert len(career) == 1
    assert (career[0].from_year, career[0].to_year) == (2014, 2017)


def test_a_return_after_another_club_stays_a_separate_spell() -> None:
    career = merge_consecutive_spells_at_same_club(
        [spell("a", "Q18656", 2003, 2009), spell("b", "Q8682", 2009, 2018), spell("c", "Q18656", 2021, 2022)]
    )
    assert [s.team_ref for s in career] == ["Q18656", "Q8682", "Q18656"]


def test_a_loan_does_not_merge_with_the_permanent_spell() -> None:
    career = merge_consecutive_spells_at_same_club(
        [spell("a", "Q1422", 2014, 2016), spell("b", "Q1422", 2016, 2017, loan=True)]
    )
    assert len(career) == 2


def test_open_spell_stays_open_after_merge() -> None:
    career = merge_consecutive_spells_at_same_club(
        [spell("a", "Q482764", 2023, 2024), spell("b", "Q482764", 2024, None)]
    )
    assert career[0].to_year is None


def test_childhood_club_is_detected_by_age_not_by_name() -> None:
    andorinha = spell("a", "Q3434146", 1992, 1995)
    assert ended_before_senior_age(andorinha, birth_year=1985, min_senior_age=17)


def test_first_senior_club_is_kept() -> None:
    sporting = spell("b", "Q75729", 2002, 2003)
    assert not ended_before_senior_age(sporting, birth_year=1985, min_senior_age=17)


def test_unknown_birth_year_or_open_spell_is_kept() -> None:
    assert not ended_before_senior_age(spell("c", "Q1", 1990, 1995), birth_year=None, min_senior_age=17)
    assert not ended_before_senior_age(spell("d", "Q1", 2024, None), birth_year=2010, min_senior_age=17)


def test_spells_without_a_start_year_are_left_out_of_the_order() -> None:
    career = merge_consecutive_spells_at_same_club(
        [spell("a", "Q1", None, 2000), spell("b", "Q2", 2001, 2002)]
    )
    assert [s.team_ref for s in career] == ["Q2"]


# Class sets of cities that sat on players' careers as "clubs" (measured on the dev knowledge base).
CITY_CLASS_SETS = {
    "Q12886 (Q1549591 big city, Q493522 municipality of Belgium)": {"Q1549591", "Q493522"},
    "Q13666 (polis, big city, city, comune of Italy)": {"Q148837", "Q1549591", "Q515", "Q747074"},
    "Q1492 (municipality of Catalonia, city)": {"Q33146843", "Q515"},
    "Q16552 (US city classes)": {"Q1093829", "Q13218391", "Q1549591", "Q62049", "Q902814"},
    "Q18487646 (human settlement)": {"Q486972"},
    "Q34713 (Austrian statutory city)": {"Q13539802", "Q1549591", "Q262882", "Q667509", "Q871419", "Q902814"},
    "Q3579 (capital, port city)": {"Q108178728", "Q1549591", "Q16124843", "Q2264924", "Q515"},
    "Q15095 (municipality of Spain)": {"Q2074737"},
    "Q609246 (city)": {"Q515"},
    "Q72009 (comune of Italy)": {"Q747074"},
}


@pytest.mark.parametrize("classes", list(CITY_CLASS_SETS.values()), ids=list(CITY_CLASS_SETS))
def test_cities_and_settlements_are_not_senior_clubs(classes: set[str]) -> None:
    assert not is_senior_club(TeamFacts("Q1", "Some City", frozenset(classes)), SCOPE)


@pytest.mark.parametrize(
    "classes",
    [
        {CLUB},
        {"Q15944511"},  # association football team
        {"Q17270000"},  # football club
        {"Q103229495"},  # men's association football team
        {"Q2221906", CLUB},  # geographic location + association football club (Q1990243, a real club)
        {"Q13580678"},  # multi-sports club
    ],
)
def test_football_club_classes_are_not_excluded(classes: set[str]) -> None:
    assert is_senior_club(TeamFacts("Q1", "Some Club", frozenset(classes)), SCOPE)


def test_reserve_side_named_only_under_mul_is_excluded_through_the_fallback_label() -> None:
    assert not is_senior_club(team("Ajax II"), SCOPE)


def test_allowlisted_club_skips_the_label_pattern_but_not_the_classes() -> None:
    willem = TeamFacts("Q332664", "Willem II", frozenset({CLUB}))
    assert is_senior_club(willem, SCOPE)
    assert not is_senior_club(TeamFacts("Q999", "Willem II", frozenset({CLUB})), SCOPE)
    assert not is_senior_club(TeamFacts("Q332664", "Willem II", frozenset({"Q2412834"})), SCOPE)


@pytest.mark.parametrize(
    ("team_id", "label"),
    [("Q170703", "Boca Juniors"), ("Q220621", "Argentinos Juniors"), ("Q332524", "Junior de Barranquilla")],
)
def test_clubs_with_juniors_in_their_name_are_allowlisted(team_id: str, label: str) -> None:
    assert is_senior_club(TeamFacts(team_id, label, frozenset({CLUB})), SCOPE)
