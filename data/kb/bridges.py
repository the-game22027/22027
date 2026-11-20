"""BRIDGE (الكوبري) content: boards of clubs whose neighbouring pairs share scorers (08 §16.4). Pure: no I/O.

A board is `size × size` clubs, row by row. A line joins two neighbouring clubs, and its right answers are the
players who scored against both: the `CONCEDED_TO` neighbours the two clubs have in common in the ONE_TWO link
graph. Nothing is stored per board: the app reads the answers from the graph.
"""

import hashlib
import random
from collections import defaultdict
from statistics import median

from kb.generate import LICENSES, SOURCES
from kb.links import SCORED_AGAINST, LinkGraph

DEFAULT_SIZE = 4
DEFAULT_MIN_ANSWERS = 3
# Shuffles tried per board asked for: about 7 in 10 random boards of the 60 most popular clubs pass at once
# (measured 2026-11-20), and the repair search fixes most of the others.
ATTEMPTS_PER_BOARD = 5
# A repair that has not finished after this many swaps is stuck on clubs with few scorers.
MAX_REPAIR_STEPS = 40
# Fewest answers on a line → difficulty: the hardest line decides how hard the board feels.
DIFFICULTY_BY_FEWEST_ANSWERS = ((15, 1), (10, 2), (6, 3), (4, 4), (0, 5))
# A board whose median line has fewer answers than this is one step harder.
NARROW_MEDIAN_ANSWERS = 15


def scorers_by_club(graph: LinkGraph) -> dict[str, frozenset[str]]:
    """Club → the players who scored against it, from the `SCORED_AGAINST` links."""
    scorers: dict[str, set[str]] = defaultdict(set)
    for link in graph.links:
        if link["type"] == SCORED_AGAINST:
            scorers[link["to"]].add(link["from"])
    return {club: frozenset(players) for club, players in scorers.items()}


def board_lines(size: int) -> list[tuple[int, int]]:
    """The cell pairs a line joins, numbered as the app numbers them: horizontal lines row by row, then vertical."""
    horizontal = [(row * size + col, row * size + col + 1) for row in range(size) for col in range(size - 1)]
    vertical = [(row * size + col, (row + 1) * size + col) for row in range(size - 1) for col in range(size)]
    return horizontal + vertical


def bridge_rounds(
    graph: LinkGraph,
    clubs: list[str],
    kb_version: str,
    count: int,
    size: int = DEFAULT_SIZE,
    min_answers: int = DEFAULT_MIN_ANSWERS,
) -> list[dict]:
    """Up to `count` boards from `clubs` (most popular first) where every line has at least `min_answers`
    common scorers. Board `n` is a shuffle seeded with `n`, then repaired by swaps; a board that cannot be
    repaired is dropped, and the same clubs in the same places are written once. Deterministic."""
    if count <= 0 or len(clubs) < size * size:
        return []
    scorers = scorers_by_club(graph)
    common = _common_scorer_counts(clubs, scorers)
    lines = board_lines(size)
    boards: list[dict] = []
    seen: set[tuple[str, ...]] = set()
    for attempt in range(count * ATTEMPTS_PER_BOARD):
        if len(boards) >= count:
            break
        shuffled = list(clubs)
        random.Random(f"bridge:{attempt}").shuffle(shuffled)
        board = _repair(shuffled[: size * size], shuffled[size * size :], lines, common, min_answers)
        if board is None or tuple(board) in seen:
            continue
        seen.add(tuple(board))
        boards.append(
            _board_line(board, size, [common[_pair(board[a], board[b])] for a, b in lines], kb_version)
        )
    return boards


def difficulty_from_answer_counts(answer_counts: list[int]) -> int:
    fewest = min(answer_counts)
    difficulty = next(level for minimum, level in DIFFICULTY_BY_FEWEST_ANSWERS if fewest >= minimum)
    if median(answer_counts) < NARROW_MEDIAN_ANSWERS:
        difficulty = min(5, difficulty + 1)
    return difficulty


def _common_scorer_counts(clubs: list[str], scorers: dict[str, frozenset[str]]) -> dict[tuple[str, str], int]:
    empty: frozenset[str] = frozenset()
    return {
        _pair(first, second): len(scorers.get(first, empty) & scorers.get(second, empty))
        for index, first in enumerate(clubs)
        for second in clubs[index + 1 :]
    }


def _repair(
    board: list[str],
    spare: list[str],
    lines: list[tuple[int, int]],
    common: dict[tuple[str, str], int],
    min_answers: int,
) -> list[str] | None:
    """Swap clubs until no line has fewer than `min_answers` answers, always taking the move that leaves the
    fewest short lines. None when no move helps or the steps run out."""
    board, spare = list(board), list(spare)

    def short_lines(cells: list[str]) -> int:
        return sum(1 for a, b in lines if common[_pair(cells[a], cells[b])] < min_answers)

    current = short_lines(board)
    for _ in range(MAX_REPAIR_STEPS):
        if current == 0:
            return board
        best: tuple[int, list[str], list[str]] | None = None
        for cell in _cells_on_short_lines(board, lines, common, min_answers):
            for index, club in enumerate(spare):
                moved = board[:cell] + [club] + board[cell + 1 :]
                score = short_lines(moved)
                if best is None or score < best[0]:
                    best = (score, moved, spare[:index] + [board[cell]] + spare[index + 1 :])
            for other in range(len(board)):
                if other == cell:
                    continue
                moved = list(board)
                moved[cell], moved[other] = moved[other], moved[cell]
                score = short_lines(moved)
                if best is None or score < best[0]:
                    best = (score, moved, spare)
        if best is None or best[0] >= current:
            return None
        current, board, spare = best
    return board if current == 0 else None


def _cells_on_short_lines(
    board: list[str], lines: list[tuple[int, int]], common: dict[tuple[str, str], int], min_answers: int
) -> list[int]:
    cells = {cell for a, b in lines if common[_pair(board[a], board[b])] < min_answers for cell in (a, b)}
    return sorted(cells)


def _board_line(board: list[str], size: int, answer_counts: list[int], kb_version: str) -> dict:
    signature = "-".join(_qid(club) for club in board)
    return {
        "externalKey": "bridge:" + hashlib.sha1(signature.encode()).hexdigest()[:20],
        "type": "GAME",
        "gameType": "BRIDGE",
        "category": "bridges",
        "difficulty": difficulty_from_answer_counts(answer_counts),
        "content": {"size": size, "clubs": board},
        # Accepted answers come from the link graph (links.jsonl), not from the question (ADR-0024).
        "answers": [],
        "provenance": {
            "facts": [],
            "sources": [*SOURCES, "transfermarkt"],
            "licenses": LICENSES,
            "kbVersion": kb_version,
        },
        "validUntil": None,
        "humanReviewed": {"en": False, "ar": False},
    }


def _pair(first: str, second: str) -> tuple[str, str]:
    return (first, second) if first < second else (second, first)


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")
