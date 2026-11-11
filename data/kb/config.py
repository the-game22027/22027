"""Scope configuration: which leagues/clubs and players the knowledge base covers (07 §4.2)."""

import re
import tomllib
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Scope:
    league_ids: tuple[str, ...]
    club_ids: tuple[str, ...]
    min_player_sitelinks: int
    min_senior_age: int
    excluded_team_classes: frozenset[str]
    excluded_team_label_pattern: re.Pattern[str]


def load_scope(path: Path) -> Scope:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    league_ids = tuple(league["id"] for league in data.get("leagues", []))
    club_ids = tuple(data.get("clubs", []))
    if not league_ids and not club_ids:
        raise ValueError(f"{path}: scope needs at least one league or club")
    return Scope(
        league_ids=league_ids,
        club_ids=club_ids,
        min_player_sitelinks=int(data["min_player_sitelinks"]),
        min_senior_age=int(data["min_senior_age"]),
        excluded_team_classes=frozenset(data.get("excluded_team_classes", [])),
        excluded_team_label_pattern=re.compile(data["excluded_team_label_pattern"], re.IGNORECASE),
    )
