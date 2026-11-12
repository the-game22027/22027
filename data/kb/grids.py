"""GRID (football tic-tac-toe) boards: 3 clubs × 3 nationalities (07 §5.8). Pure: no I/O here."""

from collections.abc import Callable, Iterable
from itertools import combinations

from kb.generate import LICENSES, SOURCES, Names, PlayerFacts

# Fewest valid players in the emptiest cell → difficulty: a cell with few answers is hard to fill.
DIFFICULTY_BY_MIN_CELL_ANSWERS = ((15, 1), (8, 2), (5, 3), (3, 4), (0, 5))
# Never a grid column: some players are listed under the United Kingdom (citizenship) and others under
# England or Scotland (the country they play for), so a board could show the same players twice.
EXCLUDED_GRID_COUNTRIES = frozenset({"wikidata:Q145"})


def difficulty_from_emptiest_cell(fewest_answers: int) -> int:
    for min_answers, difficulty in DIFFICULTY_BY_MIN_CELL_ANSWERS:
        if fewest_answers >= min_answers:
            return difficulty
    return DIFFICULTY_BY_MIN_CELL_ANSWERS[-1][1]


def grid_rounds(
    players: Iterable[PlayerFacts],
    club_names_of: Callable[[str], Names | None],
    country_names_of: Callable[[str], Names | None],
    kb_version: str,
    *,
    count: int,
    min_answers: int = 3,
    candidate_clubs: int = 20,
    candidate_countries: int = 12,
    max_club_uses: int = 3,
    max_country_uses: int = 10,
) -> list[dict]:
    """Up to `count` boards whose every cell has `min_answers` valid players, spread over difficulties.

    A club is used by at most `max_club_uses` boards, so one bundle is not all Real Madrid. Countries with
    many players are few, so they may repeat more (`max_country_uses`).
    The output is deterministic: candidates and boards are ordered by size, then by Wikidata id.
    """
    popularity: dict[str, int] = {}
    members_of_club: dict[str, set[str]] = {}
    members_of_country: dict[str, set[str]] = {}
    for player in players:
        popularity[player.external_ref] = player.sitelinks
        for spell in player.spells:
            if club_names_of(spell.team_ref):
                members_of_club.setdefault(spell.team_ref, set()).add(player.external_ref)
        for country in player.country_refs:
            if country_names_of(country) and country not in EXCLUDED_GRID_COUNTRIES:
                members_of_country.setdefault(country, set()).add(player.external_ref)

    def biggest(members: dict[str, set[str]], limit: int) -> list[str]:
        return sorted(members, key=lambda ref: (-len(members[ref]), _qid_number(ref)))[:limit]

    clubs = biggest(members_of_club, candidate_clubs)
    countries = biggest(members_of_country, candidate_countries)
    # Every (club, country) cell once; a board is then 9 lookups, not 9 set intersections.
    cell_players = {
        (club, country): members_of_club[club] & members_of_country[country]
        for club in clubs
        for country in countries
    }

    boards: list[tuple[int, int, tuple[str, ...], tuple[str, ...]]] = []
    for row in combinations(clubs, 3):
        for col in combinations(countries, 3):
            sizes = [len(cell_players[(club, country)]) for club in row for country in col]
            fewest = min(sizes)
            if fewest >= min_answers:
                boards.append((difficulty_from_emptiest_cell(fewest), -sum(sizes), row, col))
    boards.sort(key=lambda board: (board[0], board[1], board[2], board[3]))

    by_difficulty: dict[int, list[tuple[tuple[str, ...], tuple[str, ...]]]] = {}
    for difficulty, _, row, col in boards:
        by_difficulty.setdefault(difficulty, []).append((row, col))
    uses: dict[str, int] = {}
    picked: list[dict] = []
    queues = [iter(by_difficulty[difficulty]) for difficulty in sorted(by_difficulty)]
    while len(picked) < count and queues:
        for queue in list(queues):
            if len(picked) >= count:
                break
            board = next(
                (
                    b
                    for b in queue
                    if all(uses.get(ref, 0) < max_club_uses for ref in b[0])
                    and all(uses.get(ref, 0) < max_country_uses for ref in b[1])
                ),
                None,
            )
            if board is None:
                queues.remove(queue)
                continue
            row, col = board
            for ref in (*row, *col):
                uses[ref] = uses.get(ref, 0) + 1
            picked.append(_grid_line(row, col, cell_players, popularity, kb_version))
    return picked


def _grid_line(
    row: tuple[str, ...],
    col: tuple[str, ...],
    cell_players: dict[tuple[str, str], set[str]],
    popularity: dict[str, int],
    kb_version: str,
) -> dict:
    answers = []
    for r, club in enumerate(row):
        for c, country in enumerate(col):
            valid = sorted(
                cell_players[(club, country)], key=lambda ref: (-popularity.get(ref, 0), _qid_number(ref))
            )
            answers.append({"slot": r * 3 + c, "entities": valid})
    fewest = min(len(answer["entities"]) for answer in answers)
    key = "grid:" + "-".join(_qid(ref) for ref in row) + ":" + "-".join(_qid(ref) for ref in col)
    return {
        "externalKey": key,
        "type": "GAME",
        "gameType": "GRID",
        "category": "grids",
        "difficulty": difficulty_from_emptiest_cell(fewest),
        "content": {
            "rows": [{"kind": "CLUB", "entity": club} for club in row],
            "cols": [{"kind": "NATIONALITY", "entity": country} for country in col],
        },
        "answers": answers,
        "provenance": {"facts": [], "sources": SOURCES, "licenses": LICENSES, "kbVersion": kb_version},
        "validUntil": None,  # TODO(DEC-62): a club's current players change with transfers
        "humanReviewed": {"en": False, "ar": False},
    }


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")


def _qid_number(external_ref: str) -> int:
    qid = external_ref.removeprefix("wikidata:Q")
    return int(qid) if qid.isdigit() else 0
