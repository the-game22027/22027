"""Game content generators (07 §5.8). Pure functions over facts loaded from core.*; no I/O here.

Each generator returns bundle lines (07 §5.4) or None when the facts do not make a fair round.
"""

from collections.abc import Callable, Iterable
from dataclasses import dataclass

from kb.careers import Spell, merge_consecutive_spells_at_same_club
from kb.normalize import matching_form_of_name

MIN_CAREER_SPELLS = 3
# Popularity (Wikipedia sitelinks) → first-guess difficulty; answer statistics recalibrate it later.
DIFFICULTY_BY_MIN_SITELINKS = ((100, 1), (60, 2), (40, 3), (20, 4), (0, 5))
LICENSES = ["CC0-1.0"]
SOURCES = ["wikidata"]

Names = dict[str, str]  # {"en": ..., "ar": ...}


@dataclass(frozen=True)
class PlayerFacts:
    external_ref: str
    sitelinks: int
    names: Names
    # Every spell of the player, dated or not, as stored in core.career_spell.
    spells: tuple[Spell, ...]
    country_refs: tuple[str, ...]


@dataclass(frozen=True)
class BuzzerTemplate:
    name: str
    category: str
    steps: dict[str, tuple[str, ...]]


FIRST_CLUB = BuzzerTemplate(
    name="first-club",
    category="careers",
    steps={
        "en": ("At which club", "did {player}", "start", "his senior career?"),
        "ar": ("في أي نادٍ", "بدأ {player}", "مسيرته", "مع الفريق الأول؟"),
    },
)
JOINED_IN_YEAR = BuzzerTemplate(
    name="joined-in-year",
    category="transfers",
    steps={
        "en": ("Which club", "did {player} join", "from {previous}", "in {year}?"),
        "ar": ("أي نادٍ", "انضم إليه {player}", "قادمًا من {previous}", "عام {year}؟"),
    },
)
NATIONALITY = BuzzerTemplate(
    name="nationality",
    category="nationalities",
    steps={
        "en": ("Which country's", "citizenship", "does {player}", "hold?"),
        "ar": ("ما الدولة", "التي يحمل", "{player}", "جنسيتها؟"),
    },
)
BUZZER_TEMPLATES = (FIRST_CLUB, JOINED_IN_YEAR, NATIONALITY)


def difficulty_from_sitelinks(sitelinks: int) -> int:
    for min_sitelinks, difficulty in DIFFICULTY_BY_MIN_SITELINKS:
        if sitelinks >= min_sitelinks:
            return difficulty
    return DIFFICULTY_BY_MIN_SITELINKS[-1][1]


def senior_career_in_order(player: PlayerFacts) -> list[Spell] | None:
    """The player's spells in date order, or None when the career cannot be told truthfully.

    - Every spell needs a start year: an undated spell would silently drop a club.
    - No spell ends before it starts.
    - At most one spell is open: two "still there" spells mean Wikidata lacks an end date.
    - Back-to-back spells at the same club (one per Wikidata statement) become one.
    - In the same start year, the permanent move comes before a loan from it.
    """
    if any(spell.from_year is None for spell in player.spells):
        return None
    if any(spell.to_year is not None and spell.to_year < spell.from_year for spell in player.spells):
        return None
    career = merge_consecutive_spells_at_same_club(player.spells)
    if sum(1 for spell in career if spell.to_year is None) > 1:
        return None
    return sorted(career, key=lambda spell: (spell.from_year, spell.loan))


def career_round(player: PlayerFacts, is_in_catalog: Callable[[str], bool], kb_version: str) -> dict | None:
    career = senior_career_in_order(player)
    if career is None or len(career) < MIN_CAREER_SPELLS:
        return None
    if not all(is_in_catalog(spell.team_ref) for spell in career):
        return None
    return _game_line(
        key=f"career:{_qid(player.external_ref)}",
        game_type="CAREER",
        category="careers",
        player=player,
        content={
            "player": player.external_ref,
            "spells": [
                {
                    "club": spell.team_ref,
                    "fromYear": spell.from_year,
                    "toYear": spell.to_year,
                    "loan": spell.loan,
                }
                for spell in career
            ],
        },
        answers=[player.external_ref],
        facts=[spell.statement_id for spell in career],
        kb_version=kb_version,
    )


def first_club_round(
    player: PlayerFacts, names_of: Callable[[str], Names | None], kb_version: str
) -> dict | None:
    career = senior_career_in_order(player)
    if not career:
        return None
    first = career[0]
    if first.loan or (len(career) > 1 and career[1].from_year == first.from_year):
        return None
    return _buzzer_line(
        FIRST_CLUB,
        key=f"buzzer:first-club:{_qid(player.external_ref)}",
        player=player,
        values={},
        answer_kind="CLUB",
        answers=[first.team_ref],
        facts=[first.statement_id],
        names_of=names_of,
        kb_version=kb_version,
    )


def joined_in_year_rounds(
    player: PlayerFacts, names_of: Callable[[str], Names | None], kb_version: str
) -> list[dict]:
    career = senior_career_in_order(player)
    if not career:
        return []
    start_years = [spell.from_year for spell in career]
    rounds = []
    for previous, joined in zip(career, career[1:], strict=False):
        if joined.loan or previous.loan or previous.team_ref == joined.team_ref:
            continue
        if start_years.count(joined.from_year) > 1:
            continue
        previous_names = names_of(previous.team_ref)
        if previous_names is None:
            continue
        line = _buzzer_line(
            JOINED_IN_YEAR,
            key=f"buzzer:joined-in-year:{_qid(player.external_ref)}:{joined.from_year}",
            player=player,
            values={
                "previous": previous_names,
                "year": {"en": str(joined.from_year), "ar": str(joined.from_year)},
            },
            answer_kind="CLUB",
            answers=[joined.team_ref],
            facts=[previous.statement_id, joined.statement_id],
            names_of=names_of,
            kb_version=kb_version,
        )
        if line is not None:
            rounds.append(line)
    return rounds


def nationality_round(
    player: PlayerFacts, names_of: Callable[[str], Names | None], kb_version: str
) -> dict | None:
    countries = sorted(ref for ref in player.country_refs if names_of(ref) is not None)
    if not countries:
        return None
    return _buzzer_line(
        NATIONALITY,
        key=f"buzzer:nationality:{_qid(player.external_ref)}",
        player=player,
        values={},
        answer_kind="COUNTRY",
        answers=countries,
        facts=[],
        names_of=names_of,
        kb_version=kb_version,
    )


def gives_away_an_answer(steps: dict[str, list[str]], answer_names: Iterable[Names]) -> bool:
    """True when a step contains an answer's name, as the app checks on import (07 §5.5), also after normalization."""
    for names in answer_names:
        for locale, locale_steps in steps.items():
            name = names.get(locale)
            if not name:
                continue
            text = " ".join(locale_steps)
            if name.lower() in text.lower() or matching_form_of_name(name) in matching_form_of_name(text):
                return True
    return False


def pick_spread_over_difficulties(lines: list[dict], count: int) -> list[dict]:
    """Up to `count` lines taking turns over difficulties 1..5, the most popular first within each.

    `lines` must already be in a stable order (most popular first); the result is deterministic.
    """
    by_difficulty: dict[int, list[dict]] = {}
    for line in lines:
        by_difficulty.setdefault(line["difficulty"], []).append(line)
    queues = [by_difficulty[difficulty] for difficulty in sorted(by_difficulty)]
    picked: list[dict] = []
    while len(picked) < count and any(queues):
        for queue in queues:
            if queue and len(picked) < count:
                picked.append(queue.pop(0))
    return picked


def _buzzer_line(
    template: BuzzerTemplate,
    *,
    key: str,
    player: PlayerFacts,
    values: dict[str, Names],
    answer_kind: str,
    answers: list[str],
    facts: list[str],
    names_of: Callable[[str], Names | None],
    kb_version: str,
) -> dict | None:
    answer_names = [names_of(ref) for ref in answers]
    if any(names is None for names in answer_names):
        return None
    steps = {
        locale: [
            step.format(
                player=player.names[locale], **{name: value[locale] for name, value in values.items()}
            )
            for step in template.steps[locale]
        ]
        for locale in template.steps
    }
    if gives_away_an_answer(steps, answer_names):
        return None
    return _game_line(
        key=key,
        game_type="BUZZER",
        category=template.category,
        player=player,
        content={"answerKind": answer_kind, "steps": steps},
        answers=answers,
        facts=facts,
        kb_version=kb_version,
    )


def _game_line(
    *,
    key: str,
    game_type: str,
    category: str,
    player: PlayerFacts,
    content: dict,
    answers: list[str],
    facts: list[str],
    kb_version: str,
) -> dict:
    return {
        "externalKey": key,
        "type": "GAME",
        "gameType": game_type,
        "category": category,
        "difficulty": difficulty_from_sitelinks(player.sitelinks),
        "content": content,
        "answers": [{"slot": 0, "entities": answers}],
        "provenance": {"facts": facts, "sources": SOURCES, "licenses": LICENSES, "kbVersion": kb_version},
        "validUntil": None,  # TODO(DEC-62): expiry for careers of active players
        "humanReviewed": {"en": False, "ar": False},
    }


def _qid(external_ref: str) -> str:
    return external_ref.removeprefix("wikidata:")
