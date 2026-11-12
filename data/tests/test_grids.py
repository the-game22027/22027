from kb.careers import Spell
from kb.generate import PlayerFacts
from kb.grids import difficulty_from_emptiest_cell, grid_rounds

CLUBS = ["wikidata:Q1", "wikidata:Q2", "wikidata:Q3"]
COUNTRIES = ["wikidata:Q10", "wikidata:Q20", "wikidata:Q30"]


def names_of(ref):
    return {"en": ref, "ar": ref}


def player(number, club, country, sitelinks=10):
    ref = f"wikidata:Q{1000 + number}"
    return PlayerFacts(
        external_ref=ref,
        sitelinks=sitelinks,
        names={"en": ref, "ar": ref},
        spells=(Spell(f"s{number}", ref, club, None, None, False),),
        country_refs=(country,),
    )


def full_board(per_cell=3):
    players = []
    for club in CLUBS:
        for country in COUNTRIES:
            for _ in range(per_cell):
                players.append(player(len(players), club, country, sitelinks=len(players)))
    return players


def test_a_board_needs_enough_players_in_every_cell():
    assert len(grid_rounds(full_board(3), names_of, names_of, "kb", count=5, min_answers=3)) == 1
    assert grid_rounds(full_board(2), names_of, names_of, "kb", count=5, min_answers=3) == []


def test_cells_list_every_valid_player_most_popular_first():
    [line] = grid_rounds(full_board(3), names_of, names_of, "kb", count=5, min_answers=3)

    assert line["gameType"] == "GRID"
    assert [criterion["entity"] for criterion in line["content"]["rows"]] == CLUBS
    assert [criterion["kind"] for criterion in line["content"]["cols"]] == ["NATIONALITY"] * 3
    first_cell = line["answers"][0]
    assert first_cell["slot"] == 0
    assert first_cell["entities"] == ["wikidata:Q1002", "wikidata:Q1001", "wikidata:Q1000"]
    assert [answer["slot"] for answer in line["answers"]] == list(range(9))
    assert line["externalKey"] == "grid:Q1-Q2-Q3:Q10-Q20-Q30"


def test_the_united_kingdom_is_never_a_column():
    players = full_board(3)
    uk = [player(500 + i, club, "wikidata:Q145") for i, club in enumerate(CLUBS * 3)]
    lines = grid_rounds(players + uk, names_of, names_of, "kb", count=10, min_answers=1)
    assert all("wikidata:Q145" not in [c["entity"] for c in line["content"]["cols"]] for line in lines)


def test_the_emptiest_cell_sets_the_difficulty():
    assert [difficulty_from_emptiest_cell(n) for n in (40, 10, 6, 3, 1)] == [1, 2, 3, 4, 5]


def test_the_same_facts_give_the_same_boards():
    assert grid_rounds(full_board(4), names_of, names_of, "kb", count=5) == grid_rounds(
        full_board(4), names_of, names_of, "kb", count=5
    )
