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
