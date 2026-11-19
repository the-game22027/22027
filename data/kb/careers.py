"""Pure rules that turn raw Wikidata team statements into careers (07 §4.2). No I/O here."""

from collections.abc import Iterable
from dataclasses import dataclass, replace

from kb.config import Scope


@dataclass(frozen=True)
class TeamFacts:
    external_ref: str
    english_label: str | None
    classes: frozenset[str]
    sitelinks: int = 0


@dataclass(frozen=True)
class Spell:
    statement_id: str
    player_ref: str
    team_ref: str
    from_year: int | None
    to_year: int | None
    loan: bool


NATIONAL_TEAM_CLASSES = frozenset(
    {
        "Q6979593",  # national association football team
        "Q135408445",  # men's national association football team
    }
)


def is_senior_club(team: TeamFacts, scope: Scope) -> bool:
    """A team counts in careers only when it is a club and not a youth, reserve or women's side."""
    if team.classes & NATIONAL_TEAM_CLASSES:
        return False
    if team.classes & scope.excluded_team_classes:
        return False
    if team.external_ref in scope.allowed_team_ids:
        return True
    if team.english_label and scope.excluded_team_label_pattern.search(team.english_label):
        return False
    return True


def ended_before_senior_age(spell: Spell, birth_year: int | None, min_senior_age: int) -> bool:
    """True for a childhood club: the spell ended before the player was old enough to play senior football.

    Wikidata lists youth clubs as normal clubs (Ronaldo at CF Andorinha, aged 7 to 10), and their names
    give nothing away, so age is the only reliable signal. Unknown birth year or open spell: keep it.
    """
    if birth_year is None or spell.to_year is None:
        return False
    return spell.to_year - birth_year < min_senior_age


def merge_consecutive_spells_at_same_club(spells: Iterable[Spell]) -> list[Spell]:
    """Order a player's spells by start year and merge back-to-back spells at the same club.

    Spells without a start year cannot be placed in the career order, so they are left out here
    (they still count for grid membership, which uses all spells).
    """
    dated = sorted(
        (spell for spell in spells if spell.from_year is not None),
        key=lambda spell: (spell.from_year, spell.to_year if spell.to_year is not None else 9999),
    )
    merged: list[Spell] = []
    for spell in dated:
        previous = merged[-1] if merged else None
        if previous and previous.team_ref == spell.team_ref and previous.loan == spell.loan:
            merged[-1] = replace(previous, to_year=_later_year(previous.to_year, spell.to_year))
            continue
        merged.append(spell)
    return merged


def _later_year(first: int | None, second: int | None) -> int | None:
    if first is None or second is None:
        return None  # an open spell means "still there"
    return max(first, second)
