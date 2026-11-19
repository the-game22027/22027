"""MINES (لغم) categories: a club plus a citizenship or a decade (08 §10.4). Pure: no I/O here."""

from collections.abc import Callable, Iterable
from statistics import median_low

from kb.generate import LICENSES, SOURCES, Names, PlayerFacts, difficulty_from_sitelinks
from kb.grids import EXCLUDED_GRID_COUNTRIES

# Wikidata often puts youth years on the senior club's item (Marc-André ter Stegen at Gladbach "1996-2010",
# from age 4), so a decade counts a spell only from the year the player turned this age.
SENIOR_FROM_AGE = 17


def has_spell_ended_before_senior_age(to_year: int | None, birth_year: int | None) -> bool:
    """A spell over before the player turned SENIOR_FROM_AGE is youth football: it does not put him in a category."""
    return to_year is not None and birth_year is not None and to_year < birth_year + SENIOR_FROM_AGE


def decades_of_spell(
    from_year: int | None, to_year: int | None, current_year: int, birth_year: int | None = None
) -> set[int]:
    """The first years of the decades a dated spell overlaps as a senior (an open spell runs to `current_year`)."""
    if from_year is None:
        return set()
    if birth_year is not None:
        from_year = max(from_year, birth_year + SENIOR_FROM_AGE)
    last_year = to_year if to_year is not None else current_year
    if last_year < from_year:
        return set()
    return set(range(from_year // 10 * 10, last_year // 10 * 10 + 1, 10))


def mines_rounds(
    players: Iterable[PlayerFacts],
    club_names_of: Callable[[str], Names | None],
    country_names_of: Callable[[str], Names | None],
    kb_version: str,
    *,
    count: int,
    current_year: int,
    min_answers: int = 20,
    max_answers: int = 40,
    first_decade: int = 1990,
    max_club_uses: int = 3,
    allowed_clubs: frozenset[str] | None = None,
) -> list[dict]:
    """Up to `count` categories with `min_answers`..`max_answers` players, spread over difficulties.

    Only `allowed_clubs` (when given) are used: players must know the names, so the bundle passes the most
    popular clubs. A club is used by at most `max_club_uses` categories, so one bundle is not all Real Madrid.
    The output is deterministic: candidates are ordered by size, then by Wikidata id.
    """
    popularity: dict[str, int] = {}
    members: dict[tuple[str, str, int | str], set[str]] = {}
    for player in players:
        popularity[player.external_ref] = player.sitelinks
        countries = [
            country
            for country in player.country_refs
            if country_names_of(country) and country not in EXCLUDED_GRID_COUNTRIES
        ]
        for spell in player.spells:
            if not club_names_of(spell.team_ref) or (
                allowed_clubs is not None and spell.team_ref not in allowed_clubs
            ):
                continue
            if has_spell_ended_before_senior_age(spell.to_year, player.birth_year):
                continue
            for country in countries:
                members.setdefault((spell.team_ref, "NATIONALITY", country), set()).add(player.external_ref)
            for decade in decades_of_spell(spell.from_year, spell.to_year, current_year, player.birth_year):
                if decade >= first_decade:
                    members.setdefault((spell.team_ref, "DECADE", decade), set()).add(player.external_ref)

    candidates = [
        _mines_line(category, players_of_category, popularity, kb_version)
        for category, players_of_category in members.items()
        if min_answers <= len(players_of_category) <= max_answers
    ]
    candidates.sort(key=lambda line: (-len(line["answers"][0]["entities"]), line["externalKey"]))

    by_difficulty: dict[int, list[dict]] = {}
    for line in candidates:
        by_difficulty.setdefault(line["difficulty"], []).append(line)
    queues = [by_difficulty[difficulty] for difficulty in sorted(by_difficulty)]
    club_uses: dict[str, int] = {}
    picked: list[dict] = []
    while len(picked) < count and any(queues):
        for queue in queues:
            while queue and club_uses.get(_club_of(queue[0]), 0) >= max_club_uses:
                queue.pop(0)
            if queue and len(picked) < count:
                line = queue.pop(0)
                club_uses[_club_of(line)] = club_uses.get(_club_of(line), 0) + 1
                picked.append(line)
    return picked


def _mines_line(
    category: tuple[str, str, int | str],
    players_of_category: set[str],
    popularity: dict[str, int],
    kb_version: str,
) -> dict:
    club, kind, value = category
    answers = sorted(players_of_category, key=lambda ref: (-popularity.get(ref, 0), _qid_number(ref)))
    if kind == "NATIONALITY":
        second = {"kind": "NATIONALITY", "entity": value}
        key = f"mines:{_qid(club)}:nationality:{_qid(str(value))}"
    else:
        second = {"kind": "DECADE", "fromYear": value}
        key = f"mines:{_qid(club)}:decade:{value}"
    typical_sitelinks = median_low(popularity.get(ref, 0) for ref in answers)
    return {
        "externalKey": key,
        "type": "GAME",
        "gameType": "MINES",
        "category": "mines",
        "difficulty": difficulty_from_sitelinks(typical_sitelinks),
        "content": {"criteria": [{"kind": "CLUB", "entity": club}, second]},
        "answers": [{"slot": 0, "entities": answers}],
        "provenance": {"facts": [], "sources": SOURCES, "licenses": LICENSES, "kbVersion": kb_version},
        "validUntil": None,  # TODO(DEC-62): a club's current players change with transfers
        "humanReviewed": {"en": False, "ar": False},
    }


def _club_of(line: dict) -> str:
    return line["content"]["criteria"][0]["entity"]


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")


def _qid_number(external_ref: str) -> int:
    qid = external_ref.removeprefix("wikidata:Q")
    return int(qid) if qid.isdigit() else 0
