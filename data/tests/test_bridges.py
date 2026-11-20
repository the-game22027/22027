from kb.bridges import board_lines, bridge_rounds, difficulty_from_answer_counts, scorers_by_club
from kb.links import ASSISTED, SCORED_AGAINST, LinkGraph

CLUBS = [f"wikidata:Q{n}" for n in range(100, 110)]
LONELY = "wikidata:Q999"
SCORERS = [f"wikidata:Q{n}" for n in range(1, 6)]


def scored(player, club):
    return {"from": player, "type": SCORED_AGAINST, "to": club, "match": "m"}


def graph_where_every_club_concedes_to(scorers, clubs, extra=()):
    return LinkGraph([scored(player, club) for player in scorers for club in clubs] + list(extra), [])


def common_scorers(graph, first, second):
    scorers = scorers_by_club(graph)
    return len(scorers.get(first, frozenset()) & scorers.get(second, frozenset()))


def test_lines_are_numbered_horizontal_row_by_row_then_vertical():
    lines = board_lines(4)

    assert len(lines) == 24
    assert lines[0] == (0, 1)
    assert lines[11] == (14, 15)
    assert lines[12] == (0, 4)
    assert lines[23] == (11, 15)


def test_scorers_by_club_reads_only_scored_against_links():
    graph = LinkGraph(
        [
            scored(SCORERS[0], CLUBS[0]),
            {"from": SCORERS[1], "type": ASSISTED, "to": SCORERS[0], "match": "m"},
        ],
        [],
    )

    assert scorers_by_club(graph) == {CLUBS[0]: frozenset({SCORERS[0]})}


def test_every_line_of_every_board_has_enough_common_scorers():
    graph = graph_where_every_club_concedes_to(SCORERS, CLUBS)

    boards = bridge_rounds(graph, CLUBS, "kb-test", count=5, size=3, min_answers=3)

    assert len(boards) == 5
    for board in boards:
        clubs = board["content"]["clubs"]
        assert board["content"]["size"] == 3 and len(clubs) == 9 and len(set(clubs)) == 9
        assert all(common_scorers(graph, clubs[a], clubs[b]) >= 3 for a, b in board_lines(3))


def test_the_repair_search_leaves_out_a_club_nobody_scored_against():
    graph = graph_where_every_club_concedes_to(SCORERS, CLUBS[:4])

    boards = bridge_rounds(graph, [LONELY, *CLUBS[:4]], "kb-test", count=3, size=2, min_answers=3)

    assert boards
    assert all(LONELY not in board["content"]["clubs"] for board in boards)


def test_a_board_that_cannot_be_repaired_is_dropped():
    graph = graph_where_every_club_concedes_to(SCORERS[:2], CLUBS)

    assert bridge_rounds(graph, CLUBS, "kb-test", count=3, size=3, min_answers=3) == []


def test_boards_are_unique_and_the_same_input_gives_the_same_boards():
    graph = graph_where_every_club_concedes_to(SCORERS, CLUBS[:4])

    first = bridge_rounds(graph, CLUBS[:4], "kb-test", count=50, size=2)
    second = bridge_rounds(graph, CLUBS[:4], "kb-test", count=50, size=2)

    assert first == second
    keys = [tuple(board["content"]["clubs"]) for board in first]
    assert len(keys) == len(set(keys))


def test_a_board_line_stores_no_answers_and_points_at_the_graph():
    graph = graph_where_every_club_concedes_to(SCORERS, CLUBS)

    [board] = bridge_rounds(graph, CLUBS, "kb-test", count=1, size=3)

    assert board["externalKey"].startswith("bridge:")
    assert board["gameType"] == "BRIDGE" and board["category"] == "bridges"
    assert board["answers"] == []
    assert board["provenance"]["kbVersion"] == "kb-test"


def test_too_few_clubs_for_the_board_gives_nothing():
    graph = graph_where_every_club_concedes_to(SCORERS, CLUBS)

    assert bridge_rounds(graph, CLUBS[:8], "kb-test", count=1, size=3) == []


def test_difficulty_comes_from_the_hardest_line_and_a_narrow_median():
    assert difficulty_from_answer_counts([20, 30, 40]) == 1
    assert difficulty_from_answer_counts([7, 31, 31]) == 3
    assert difficulty_from_answer_counts([3, 30, 30]) == 5
    assert difficulty_from_answer_counts([10, 12, 14]) == 3
