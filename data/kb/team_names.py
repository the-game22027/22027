"""martj42 team names → NATIONAL_TEAM entities (07 §5.10 D.3b/D.3c). martj42 has names only, no ids.

A name resolves when exactly one linked national team is known by it: its Fjelstul or Transfermarkt team
name, or its Wikidata English label or alias with the "national football team" suffix removed. No name
or two candidates: the name goes to `.out/link-review-martj42.csv` and its matches are skipped. Dated rules
in config/sources.toml cover a team that martj42 files under a later name (Serbia before August 2006).
"""

import re
from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date

from kb.competitions import DatedTeamName
from kb.normalize import normalize_name

NOT_FOUND = "NO_LINKED_TEAM"
AMBIGUOUS = "AMBIGUOUS"

_NATIONAL_TEAM_SUFFIX = re.compile(
    r"\s+(?:men's\s+)?national\s+(?:association\s+)?(?:football|soccer)\s+(?:selection\s+)?team$",
    re.IGNORECASE,
)
_SPACES = re.compile(r"\s+")


def matching_form_of_team_name(name: str) -> str:
    """'Bosnia & Herzegovina' and 'bosnia and herzegovina' match; so do 'Guinea-Bissau' and 'Guinea Bissau'."""
    text = normalize_name(name).replace("&", " and ").replace("-", " ")
    return _SPACES.sub(" ", text).strip()


def short_name_from_wikidata_label(label: str) -> str | None:
    """'Denmark men's national football team' → 'Denmark'. Nicknames ('La Celeste') are not used."""
    if not _NATIONAL_TEAM_SUFFIX.search(label):
        return None
    short = _NATIONAL_TEAM_SUFFIX.sub("", label).strip()
    return short or None


def build_team_name_index(names_of_entity: Iterable[tuple[str, str]]) -> dict[str, set[str]]:
    """(entity ref, name) pairs → matching form of each name → the entities known by it."""
    index: dict[str, set[str]] = defaultdict(set)
    for ref, name in names_of_entity:
        key = matching_form_of_team_name(name)
        if key:
            index[key].add(ref)
    return dict(index)


@dataclass(frozen=True)
class TeamNameResolution:
    ref: str | None
    reason: str | None  # NOT_FOUND or AMBIGUOUS when ref is None
    candidates: tuple[str, ...] = ()


def resolve_team_name(
    name: str, day: date, index: dict[str, set[str]], dated_names: Iterable[DatedTeamName] = ()
) -> TeamNameResolution:
    key = matching_form_of_team_name(name)
    dated = sorted(
        (rule for rule in dated_names if matching_form_of_team_name(rule.name) == key and day <= rule.until),
        key=lambda rule: rule.until,
    )
    if dated:
        return TeamNameResolution(dated[0].entity_ref, None)
    candidates = index.get(key, set())
    if len(candidates) == 1:
        return TeamNameResolution(next(iter(candidates)), None)
    if not candidates:
        return TeamNameResolution(None, NOT_FOUND)
    return TeamNameResolution(None, AMBIGUOUS, tuple(sorted(candidates)))
