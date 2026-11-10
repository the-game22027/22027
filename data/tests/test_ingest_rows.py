from kb.ingest import spells_from_rows, year_of_wikidata_date

E = "http://www.wikidata.org/entity/"


def row(
    statement: str,
    team: str,
    start: str | None = None,
    end: str | None = None,
    acquisition: str | None = None,
):
    values = {"player": E + "Q48770", "statement": E + "statement/" + statement, "team": E + team}
    if start:
        values["start"] = start
    if end:
        values["end"] = end
    if acquisition:
        values["acquisition"] = E + acquisition
    return values


def test_one_spell_per_statement_even_with_several_qualifier_rows() -> None:
    rows = [
        row("Q48770-a", "Q1422", "2014-01-01T00:00:00Z", "2016-01-01T00:00:00Z", "Q1811518"),
        row("Q48770-a", "Q1422", "2014-01-01T00:00:00Z", "2016-01-01T00:00:00Z", "Q2914547"),
    ]
    spells = spells_from_rows(rows)
    assert len(spells) == 1
    assert (spells[0].team_ref, spells[0].from_year, spells[0].to_year) == ("Q1422", 2014, 2016)


def test_loan_acquisition_marks_the_spell_as_a_loan() -> None:
    spells = spells_from_rows([row("Q48770-b", "Q1543", "2021-01-01T00:00:00Z", acquisition="Q2914547")])
    assert spells[0].loan is True


def test_spell_without_dates_is_kept_with_empty_years() -> None:
    spells = spells_from_rows([row("Q48770-c", "Q8682")])
    assert (spells[0].from_year, spells[0].to_year, spells[0].loan) == (None, None, False)


def test_unknown_value_team_is_dropped() -> None:
    rows = [{"player": E + "Q48770", "statement": E + "statement/x", "team": "t123456"}]
    assert spells_from_rows(rows) == []


def test_year_of_wikidata_date() -> None:
    assert year_of_wikidata_date("2002-01-01T00:00:00Z") == 2002
    assert year_of_wikidata_date("t1234") is None
    assert year_of_wikidata_date("-0500-01-01T00:00:00Z") is None
    assert year_of_wikidata_date(None) is None
