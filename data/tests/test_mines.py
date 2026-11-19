from kb.careers import Spell
from kb.generate import PlayerFacts
from kb.mines import decades_of_spell, mines_rounds

CLUB = "wikidata:Q1"
OTHER_CLUB = "wikidata:Q2"
FRANCE = "wikidata:Q142"


def names_of(ref):
    return {"en": ref, "ar": ref}


def player(number, club=CLUB, country=FRANCE, from_year=None, to_year=None, sitelinks=10):
    ref = f"wikidata:Q{1000 + number}"
    return PlayerFacts(
        external_ref=ref,
        sitelinks=sitelinks,
        names={"en": ref, "ar": ref},
        spells=(Spell(f"s{number}", ref, club, from_year, to_year, False),),
        country_refs=(country,),
    )


def build(players, **options):
    defaults = {"count": 10, "current_year": 2026, "min_answers": 3, "max_answers": 5}
    return mines_rounds(players, names_of, names_of, "kb", **(defaults | options))


def test_a_spell_counts_for_every_decade_it_touches():
    assert decades_of_spell(1998, 2004, 2026) == {1990, 2000}
    assert decades_of_spell(2019, None, 2026) == {2010, 2020}
    assert decades_of_spell(None, 2004, 2026) == set()
    assert decades_of_spell(2010, 2005, 2026) == set()


def test_a_club_and_citizenship_category_lists_its_players_most_popular_first():
    players = [player(i, sitelinks=i) for i in range(4)]
    [line] = build(players)

    assert line["gameType"] == "MINES"
    assert line["externalKey"] == "mines:Q1:nationality:Q142"
    assert line["content"]["criteria"] == [
        {"kind": "CLUB", "entity": CLUB},
        {"kind": "NATIONALITY", "entity": FRANCE},
    ]
    assert line["answers"] == [{"slot": 0, "entities": [f"wikidata:Q{1000 + i}" for i in (3, 2, 1, 0)]}]


def test_a_club_and_decade_category_needs_dated_spells():
    dated = [player(i, country="wikidata:Q55", from_year=2001, to_year=2003) for i in range(3)]
    undated = [player(10 + i, country="wikidata:Q66") for i in range(3)]
    keys = [line["externalKey"] for line in build(dated + undated)]

    assert "mines:Q1:decade:2000" in keys
    assert all(":decade:" not in key or key.endswith("2000") for key in keys)


def test_categories_outside_the_size_range_are_dropped():
    assert build([player(i) for i in range(2)]) == []
    assert build([player(i) for i in range(6)]) == []


def test_decades_before_the_first_decade_are_skipped():
    players = [player(i, country="wikidata:Q55", from_year=1985, to_year=1987) for i in range(3)]
    assert [line["externalKey"] for line in build(players, first_decade=1990)] == ["mines:Q1:nationality:Q55"]


def test_a_club_is_used_a_limited_number_of_times():
    players = [player(i * 10 + n, country=f"wikidata:Q{500 + i}") for i in range(4) for n in range(3)] + [
        player(900 + n, club=OTHER_CLUB) for n in range(3)
    ]
    clubs = [line["content"]["criteria"][0]["entity"] for line in build(players, max_club_uses=2)]

    assert clubs.count(CLUB) == 2
    assert clubs.count(OTHER_CLUB) == 1


def test_the_same_input_gives_the_same_output():
    players = [player(i, from_year=2005, to_year=None, sitelinks=i) for i in range(4)]
    assert build(players) == build(list(reversed(players)))


def test_only_allowed_clubs_make_categories():
    players = [player(i) for i in range(3)] + [player(10 + i, club=OTHER_CLUB) for i in range(3)]
    clubs = {
        line["content"]["criteria"][0]["entity"] for line in build(players, allowed_clubs=frozenset({CLUB}))
    }
    assert clubs == {CLUB}
