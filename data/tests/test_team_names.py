from datetime import date

from kb.competitions import DatedTeamName
from kb.team_names import (
    AMBIGUOUS,
    NOT_FOUND,
    build_team_name_index,
    matching_form_of_team_name,
    resolve_team_name,
    short_name_from_wikidata_label,
)


def test_wikidata_labels_lose_the_national_team_suffix_and_nicknames_are_not_used() -> None:
    assert short_name_from_wikidata_label("Denmark men's national football team") == "Denmark"
    assert short_name_from_wikidata_label("United States national soccer team") == "United States"
    assert short_name_from_wikidata_label("Croatia national association football team") == "Croatia"
    assert short_name_from_wikidata_label("La Celeste") is None
    assert short_name_from_wikidata_label("Danish football team") is None


def test_team_names_match_across_accents_hyphens_and_ampersands() -> None:
    assert matching_form_of_team_name("Curaçao") == matching_form_of_team_name("curacao")
    assert matching_form_of_team_name("Guinea-Bissau") == "guinea bissau"
    assert matching_form_of_team_name("Bosnia & Herzegovina") == "bosnia and herzegovina"


def test_a_name_resolves_only_to_exactly_one_linked_team() -> None:
    index = build_team_name_index(
        [
            ("wikidata:Q163547", "Republic of Ireland"),  # Fjelstul
            ("wikidata:Q163547", "Ireland"),  # Transfermarkt
            ("wikidata:Q130582", "China"),
            ("wikidata:Q999", "China"),  # a second team with the same name
        ]
    )
    day = date(2016, 6, 1)
    assert resolve_team_name("Republic of Ireland", day, index).ref == "wikidata:Q163547"
    unknown = resolve_team_name("Kenya", day, index)
    assert unknown.ref is None and unknown.reason == NOT_FOUND
    ambiguous = resolve_team_name("China", day, index)
    assert ambiguous.ref is None and ambiguous.reason == AMBIGUOUS
    assert ambiguous.candidates == ("wikidata:Q130582", "wikidata:Q999")


def test_a_dated_rule_wins_until_its_date() -> None:
    index = build_team_name_index([("wikidata:Q37192", "Serbia")])
    rules = [DatedTeamName("Serbia", date(2006, 7, 31), "wikidata:Q1131732")]
    assert resolve_team_name("Serbia", date(2006, 6, 11), index, rules).ref == "wikidata:Q1131732"
    assert resolve_team_name("Serbia", date(2010, 6, 13), index, rules).ref == "wikidata:Q37192"
