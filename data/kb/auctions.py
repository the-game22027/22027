"""AUCTION (المزاد) lots: 3 lists of names per round (08 §11.4). Pure: no I/O here."""

import re
from collections.abc import Callable, Iterable
from dataclasses import dataclass

from kb.generate import LICENSES, SOURCES, Names

SCORERS = "SCORERS"
ASSISTERS = "ASSISTERS"
LOT_SIZE = 3
KNOWN_PLAYER_MIN_SITELINKS = 40
# Share of known names in a list → difficulty: a list of famous names is easy to bid high on.
DIFFICULTY_BY_KNOWN_SHARE = ((0.9, 1), (0.8, 2), (0.7, 3), (0.0, 4))
LARGE_LIST_SIZE = 20

TITLE_TEMPLATES = {
    SCORERS: {
        "en": "{team} scorers in the {season} {competition}",
        "ar": "هدافو {team} في {competition} {season}",
    },
    ASSISTERS: {
        "en": "{team} assist providers in the {season} {competition}",
        "ar": "صانعو أهداف {team} في {competition} {season}",
    },
}


@dataclass(frozen=True)
class GoalList:
    """Everyone who scored (or assisted) for one team in one competition season. `complete` is False when a
    name is missing because the source's player id is not linked: such a list can never be judged fairly."""

    kind: str
    team_ref: str
    competition_key: str
    competition_names: Names
    season_label: str
    answers: tuple[str, ...]
    complete: bool

    @property
    def key(self) -> str:
        return f"{self.kind.lower()}:{_qid(self.team_ref)}:{self.competition_key}:{self.season_label}"


def build_goal_lists(goals: Iterable[tuple]) -> list[GoalList]:
    """Group goal rows into lists. A row: (competition_key, name_en, name_ar, season_label, team_ref, scorer_ref,
    own_goal, assist_ref, assist_source_id)."""
    groups: dict[tuple[str, str, str, str], dict] = {}

    def add(kind: str, row: tuple, ref: str | None) -> None:
        key = (kind, row[4], row[0], row[3])
        group = groups.setdefault(
            key, {"names": {"en": row[1], "ar": row[2]}, "answers": set(), "complete": True}
        )
        if ref is None:
            group["complete"] = False
        else:
            group["answers"].add(ref)

    for row in goals:
        competition_key, _, _, season, team_ref, scorer_ref, own_goal, assist_ref, assist_source_id = row
        if not own_goal:
            add(SCORERS, row, scorer_ref)
        if assist_source_id:
            add(ASSISTERS, row, assist_ref)
    return [
        GoalList(
            kind,
            team_ref,
            competition_key,
            group["names"],
            season,
            tuple(sorted(group["answers"])),
            group["complete"],
        )
        for (kind, team_ref, competition_key, season), group in sorted(groups.items())
    ]


def auction_rounds(
    goal_lists: Iterable[GoalList],
    player_popularity_of: Callable[[str], int | None],
    team_names_of: Callable[[str], Names | None],
    kb_version: str,
    *,
    count: int,
    min_answers: int = 6,
    max_answers: int = 30,
    known_share: float = 0.6,
) -> list[dict]:
    """Up to `count` lots of 3 lists, spread over difficulties.

    A list is kept only when every name is a catalog player (`player_popularity_of` returns None otherwise), so
    any right name can be judged right (DEC-69 (a)), and when enough of its names are known players.
    The output is deterministic: lists and lots are ordered by key.
    """
    kept: dict[int, list[tuple[GoalList, Names]]] = {}
    for goal_list, team_names, share in eligible_goal_lists(
        goal_lists,
        player_popularity_of,
        team_names_of,
        min_answers=min_answers,
        max_answers=max_answers,
        known_share=known_share,
    ):
        kept.setdefault(difficulty_of_list(share, len(goal_list.answers)), []).append((goal_list, team_names))

    lots_by_difficulty = {
        difficulty: group_into_lots(lists)
        for difficulty, lists in sorted(kept.items())
        if len(lists) >= LOT_SIZE
    }
    picked: list[dict] = []
    queues = [list(lots) for _, lots in sorted(lots_by_difficulty.items())]
    while len(picked) < count and any(queues):
        for difficulty, queue in zip(sorted(lots_by_difficulty), queues, strict=True):
            if queue and len(picked) < count:
                picked.append(_auction_line(queue.pop(0), difficulty, player_popularity_of, kb_version))
    return picked


def eligible_goal_lists(
    goal_lists: Iterable[GoalList],
    player_popularity_of: Callable[[str], int | None],
    team_names_of: Callable[[str], Names | None],
    *,
    min_answers: int,
    max_answers: int,
    known_share: float,
) -> list[tuple[GoalList, Names, float]]:
    """Lists a game can ask, with their team names and share of known players, ordered by key: complete, every
    name a catalog player (DEC-69 (a)), enough known players, and no two with the same names."""
    eligible = []
    seen_answer_sets: set[frozenset[str]] = set()
    for goal_list in sorted(goal_lists, key=lambda item: item.key):
        team_names = team_names_of(goal_list.team_ref)
        if (
            not goal_list.complete
            or team_names is None
            or not min_answers <= len(goal_list.answers) <= max_answers
        ):
            continue
        popularity = [player_popularity_of(ref) for ref in goal_list.answers]
        if any(value is None for value in popularity):
            continue
        known = sum(1 for value in popularity if value is not None and value >= KNOWN_PLAYER_MIN_SITELINKS)
        share = known / len(popularity)
        answer_set = frozenset(goal_list.answers)
        if share < known_share or answer_set in seen_answer_sets:
            continue
        seen_answer_sets.add(answer_set)
        eligible.append((goal_list, team_names, share))
    return eligible


def difficulty_of_list(known_share: float, size: int) -> int:
    difficulty = next(level for minimum, level in DIFFICULTY_BY_KNOWN_SHARE if known_share >= minimum)
    return min(5, difficulty + (1 if size > LARGE_LIST_SIZE else 0))


def group_into_lots(lists: list[tuple[GoalList, Names]]) -> list[list[tuple[GoalList, Names]]]:
    """Lots of 3 lists from 3 different teams; each list is in one lot at most, leftovers are dropped."""
    left = list(lists)
    lots = []
    while len(left) >= LOT_SIZE:
        lot = [left.pop(0)]
        for candidate in list(left):
            if all(candidate[0].team_ref != member[0].team_ref for member in lot):
                lot.append(candidate)
                left.remove(candidate)
                if len(lot) == LOT_SIZE:
                    break
        if len(lot) == LOT_SIZE:
            lots.append(lot)
    return lots


# Wikidata labels are formal ("Croatia men's national football team", "نادي آرسنال"); titles read like a fan
# says them ("Croatia", "آرسنال"). Only the ends of a label are trimmed, never the middle.
ENGLISH_TEAM_LABEL_TRIMS = (
    re.compile(r"\s+(men's\s+)?national\s+(association\s+)?football\s+team$"),
    re.compile(r"\s+(A\.F\.C\.|F\.C\.|FC|CF|Club de Fútbol|Football Club)$"),
)
ARABIC_TEAM_LABEL_TRIMS = (re.compile(r"^نادي\s+"), re.compile(r"\s+لكرة\s+القدم$"))


def shorten_team_names(names: Names) -> Names:
    """The team's name as a title uses it: "Croatia", "Arsenal", "منتخب كرواتيا", "آرسنال"."""
    short = {}
    for locale, trims in (("en", ENGLISH_TEAM_LABEL_TRIMS), ("ar", ARABIC_TEAM_LABEL_TRIMS)):
        name = names[locale]
        for trim in trims:
            name = trim.sub("", name)
        short[locale] = name.strip() or names[locale]
    return short


def title_of(goal_list: GoalList, team_names: Names) -> Names:
    team_names = shorten_team_names(team_names)
    return {
        locale: TITLE_TEMPLATES[goal_list.kind][locale].format(
            team=team_names[locale],
            season=goal_list.season_label,
            competition=goal_list.competition_names[locale],
        )
        for locale in ("en", "ar")
    }


def _auction_line(
    lot: list[tuple[GoalList, Names]],
    difficulty: int,
    player_popularity_of: Callable[[str], int | None],
    kb_version: str,
) -> dict:
    return {
        "externalKey": "auction:" + "+".join(goal_list.key for goal_list, _ in lot),
        "type": "GAME",
        "gameType": "AUCTION",
        "category": "auctions",
        "difficulty": difficulty,
        "content": {
            "lists": [
                {"kind": goal_list.kind, "title": title_of(goal_list, names)} for goal_list, names in lot
            ]
        },
        "answers": [
            {
                "slot": slot,
                "entities": sorted(
                    goal_list.answers, key=lambda ref: (-(player_popularity_of(ref) or 0), _qid_number(ref))
                ),
            }
            for slot, (goal_list, _) in enumerate(lot)
        ],
        "provenance": {
            "facts": [],
            "sources": [*SOURCES, "transfermarkt"],
            "licenses": LICENSES,
            "kbVersion": kb_version,
        },
        "validUntil": None,  # past seasons do not change
        "humanReviewed": {"en": False, "ar": False},
    }


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")


def _qid_number(external_ref: str) -> int:
    qid = external_ref.removeprefix("wikidata:Q")
    return int(qid) if qid.isdigit() else 0
