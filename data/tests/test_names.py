from kb.ingest import names_from_rows

E = "http://www.wikidata.org/entity/"


def name_row(item: str, language: str, name: str, kind: str = "LABEL"):
    return {"item": E + item, "name@lang": language, "name": name, "kind": kind}


def test_english_label_wins_over_mul() -> None:
    names = names_from_rows(
        [
            name_row("Q1", "en", "Harry Maguire"),
            name_row("Q1", "mul", "Harry Maguire (mul)"),
            name_row("Q1", "mul", "H. Maguire", "ALIAS"),
        ]
    )
    assert names == [("wikidata:Q1", "en", "Harry Maguire", "LABEL")]


def test_mul_label_and_aliases_become_english_when_there_is_no_english_label() -> None:
    names = names_from_rows(
        [
            name_row("Q2", "mul", "Jakub Błaszczykowski"),
            name_row("Q2", "mul", "Kuba", "ALIAS"),
            name_row("Q2", "ar", "كوبا"),
        ]
    )
    assert ("wikidata:Q2", "en", "Jakub Błaszczykowski", "LABEL") in names
    assert ("wikidata:Q2", "en", "Kuba", "ALIAS") in names
    assert ("wikidata:Q2", "ar", "كوبا", "LABEL") in names
    assert not any(locale == "mul" for _, locale, _, _ in names)


def test_precedence_is_decided_per_entity() -> None:
    names = names_from_rows([name_row("Q1", "en", "A"), name_row("Q2", "mul", "B")])
    assert sorted(names) == [("wikidata:Q1", "en", "A", "LABEL"), ("wikidata:Q2", "en", "B", "LABEL")]


def test_promoted_mul_label_wins_over_an_english_alias_with_the_same_text() -> None:
    names = names_from_rows(
        [
            name_row("Q3", "en", "Kuba", "ALIAS"),
            name_row("Q3", "mul", "Kuba"),
            name_row("Q3", "en", "Jakub", "ALIAS"),
        ]
    )
    assert ("wikidata:Q3", "en", "Kuba", "LABEL") in names
    assert ("wikidata:Q3", "en", "Kuba", "ALIAS") not in names
    assert ("wikidata:Q3", "en", "Jakub", "ALIAS") in names


def test_english_aliases_without_an_english_label_are_kept_next_to_the_mul_label() -> None:
    names = names_from_rows([name_row("Q4", "en", "Leo", "ALIAS"), name_row("Q4", "mul", "Lionel Messi")])
    assert sorted(names) == [
        ("wikidata:Q4", "en", "Leo", "ALIAS"),
        ("wikidata:Q4", "en", "Lionel Messi", "LABEL"),
    ]


def test_mul_aliases_are_dropped_when_an_english_label_exists_next_to_english_aliases() -> None:
    names = names_from_rows(
        [
            name_row("Q5", "en", "Harry Maguire"),
            name_row("Q5", "en", "Slabhead", "ALIAS"),
            name_row("Q5", "mul", "H. Maguire", "ALIAS"),
        ]
    )
    assert sorted(names) == [
        ("wikidata:Q5", "en", "Harry Maguire", "LABEL"),
        ("wikidata:Q5", "en", "Slabhead", "ALIAS"),
    ]


class FakeClient:
    def __init__(self, rows):
        self._rows = rows

    def select_rows(self, query: str):
        return self._rows


def team_row(team: str, label: str | None, language: str = "en", cls: str = "Q476028"):
    row = {"team": E + team, "class": E + cls}
    if label:
        row["label"] = label
        row["label@lang"] = language
    return row


def test_team_label_falls_back_to_mul_and_english_wins() -> None:
    from kb.ingest import fetch_team_facts

    facts = fetch_team_facts(
        FakeClient(
            [
                team_row("Q1", "Ajax II", "mul"),
                team_row("Q2", "Real Madrid", "mul"),
                team_row("Q2", "Real Madrid CF", "en"),
                team_row("Q3", None),
            ]
        ),
        ["Q1", "Q2", "Q3"],
    )
    assert facts["Q1"].english_label == "Ajax II"
    assert facts["Q2"].english_label == "Real Madrid CF"
    assert facts["Q3"].english_label is None
