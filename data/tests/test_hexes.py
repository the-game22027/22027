from kb.auctions import SCORERS, GoalList
from kb.hexes import first_letters_of, hex_rounds, letter_lists

UCL = {"en": "UEFA Champions League", "ar": "دوري أبطال أوروبا"}
NAMES = {
    "wikidata:Q10": ({"en": "Mohamed Salah", "ar": "محمد صلاح"}, {"en": ["Mo Salah"], "ar": ["صلاح"]}),
    "wikidata:Q11": ({"en": "Sadio Mané", "ar": "ساديو ماني"}, {"en": ["Mane"], "ar": ["ماني"]}),
    "wikidata:Q12": ({"en": "Roberto Firmino", "ar": "روبرتو فيرمينو"}, {"en": [], "ar": []}),
    "wikidata:Q13": ({"en": "Ahmed Hassan", "ar": "أحمد حسن"}, {"en": [], "ar": ["Ahmed"]}),
}


def forms_of(ref, locale):
    if ref not in NAMES:  # a filler player that makes each test list different
        return [{"en": f"Zed {ref[-3:]}", "ar": f"زيد {ref[-3:]}"}[locale]]
    names, aliases = NAMES[ref]
    return [names[locale], *aliases[locale]]


def goal_list(team_number, answers):
    return GoalList(
        SCORERS, f"wikidata:Q{team_number}", "champions-league", UCL, "2018-19", tuple(answers), True
    )


def teams(ref):
    return {"en": f"Club {ref[-1]} F.C.", "ar": f"نادي {ref[-1]}"}


def lists(*goal_lists):
    return letter_lists(
        goal_lists, lambda ref: 100, teams, forms_of, min_answers=1, max_answers=30, known_share=0.6
    )


def test_first_letters_come_from_every_name_form_in_the_language_alphabet_only():
    assert first_letters_of(["Mohamed Salah", "Mo Salah"], "en") == {"m"}
    assert first_letters_of(["Sadio Mané", "Mane"], "en") == {"s", "m"}
    # Hamza forms count as their base letter; a Latin alias says nothing about Arabic letters.
    assert first_letters_of(["أحمد حسن", "Ahmed"], "ar") == {"ا"}


def test_a_list_files_each_name_under_the_first_letters_of_its_forms():
    [item] = lists(goal_list(1, ["wikidata:Q10", "wikidata:Q11", "wikidata:Q12"]))
    assert item.names_by_letter["en"]["m"] == {"wikidata:Q10", "wikidata:Q11"}
    assert item.names_by_letter["ar"]["م"] == {"wikidata:Q10", "wikidata:Q11"}
    assert item.names_by_letter["ar"]["ص"] == {"wikidata:Q10"}


def board_lists():
    everyone = ["wikidata:Q10", "wikidata:Q11", "wikidata:Q12"]
    return lists(*[goal_list(team, [*everyone, f"wikidata:Q{100 + team}"]) for team in range(1, 9)])


def boards(**options):
    defaults = {"count": 3, "size": 2, "questions_per_cell": 2, "min_lists_per_letter": 1}
    return hex_rounds(board_lists(), lambda ref: 100, "kb", **(defaults | options))


def test_a_board_has_a_letter_pair_per_cell_and_a_slot_per_question():
    [line, *_] = boards()
    cells = line["content"]["cells"]
    assert line["gameType"] == "HEX" and line["content"]["size"] == 2
    assert len(cells) == 4
    assert all(set(cell["letter"]) == {"ar", "en"} and len(cell["questions"]) == 2 for cell in cells)
    assert [answer["slot"] for answer in line["answers"]] == list(range(8))
    assert cells[0]["questions"][0]["title"]["en"].endswith("scorers in the 2018-19 UEFA Champions League")


def test_every_question_has_a_right_name_for_both_letters_of_its_cell():
    for line in boards():
        for cell, entry in enumerate(line["content"]["cells"]):
            for question in range(2):
                names = line["answers"][cell * 2 + question]["entities"]
                for locale in ("en", "ar"):
                    letters = {
                        letter for ref in names for letter in first_letters_of(forms_of(ref, locale), locale)
                    }
                    assert entry["letter"][locale] in letters


def test_a_list_appears_once_per_board_and_boards_differ():
    lines = boards()
    for line in lines:
        titles = [q["title"]["en"] for cell in line["content"]["cells"] for q in cell["questions"]]
        assert len(titles) == len(set(titles))
    assert len({line["externalKey"] for line in lines}) == len(lines)


def test_no_board_when_the_letters_cannot_fill_it():
    assert boards(size=5) == []


def test_the_same_input_gives_the_same_output():
    assert boards() == boards()
