"""Match-data configuration (07 §5.10 D.3c/D.3d): competitions, tiers, coverage windows and precedence.

- config/competitions.toml: each source's competition ids → one competition (a Wikidata item), plus the
  DEC-67 load filters.
- config/tiers.toml: the tier of every source competition id (also read by the linkers).
- config/sources.toml: coverage windows, the precedence table and dated martj42 team names.
"""

import re
import tomllib
from dataclasses import dataclass
from datetime import date
from pathlib import Path

CONFIG_DIR = Path(__file__).parent.parent / "config"
MATCH_SOURCES = ("transfermarkt", "fjelstul", "martj42")
COMPETITION_KINDS = ("LEAGUE", "CUP", "INTERNATIONAL")
LATEST = "latest"


@dataclass(frozen=True)
class Competition:
    key: str
    ref: str
    name_en: str
    name_ar: str
    kind: str
    tier: int
    source_ids: dict[str, tuple[str, ...]]
    edition_labels: dict[int, str]  # final year → official edition name

    @property
    def team_kind(self) -> str:
        return "NATIONAL_TEAM" if self.kind == "INTERNATIONAL" else "CLUB"


@dataclass(frozen=True)
class MatchFilters:
    """DEC-67: what never becomes a question, whatever its tier."""

    first_match_date: date
    excluded_round: re.Pattern[str]
    kept_round: re.Pattern[str]
    excluded_tournament: re.Pattern[str]

    def is_excluded_round(self, round_name: str | None) -> bool:
        """True for a qualifier or play-off round (Transfermarkt), but not for a third-place match."""
        if not round_name:
            return False
        return bool(self.excluded_round.search(round_name)) and not self.kept_round.search(round_name)

    def is_excluded_tournament(self, tournament_name: str) -> bool:
        """True for a martj42 qualification tournament or a friendly."""
        return bool(self.excluded_tournament.search(tournament_name))


@dataclass(frozen=True)
class CoverageWindow:
    source: str
    competition_key: str
    first_date: date
    last_date: date | None  # None ("latest"): up to the source's last match date in that competition


@dataclass(frozen=True)
class PrecedenceRule:
    fact: str
    competitions: tuple[str, ...]
    team_kind: str | None
    sources: tuple[str, ...]


@dataclass(frozen=True)
class DatedTeamName:
    name: str
    until: date
    entity_ref: str


@dataclass(frozen=True)
class MatchConfig:
    competitions: dict[str, Competition]  # by key
    filters: MatchFilters
    coverage: tuple[CoverageWindow, ...]
    precedence: tuple[PrecedenceRule, ...]
    martj42_dated_names: tuple[DatedTeamName, ...]
    source_tiers: dict[str, dict[str, int]]  # source → its competition id → tier

    def competition_of_source_id(self, source: str, source_competition_id: str) -> Competition | None:
        """The competition a source's id belongs to; Fjelstul ids are tournaments (WC-2006 → series WC)."""
        lookup = source_competition_id.split("-")[0] if source == "fjelstul" else source_competition_id
        for competition in self.competitions.values():
            if lookup in competition.source_ids.get(source, ()):
                return competition
        return None

    def precedence_for(self, fact: str, competition: Competition) -> tuple[str, ...]:
        """Sources in precedence order for one fact type in one competition (07 §5.10)."""
        for rule in self.precedence:
            if rule.fact == fact and competition.key in rule.competitions:
                return rule.sources
        for rule in self.precedence:
            if rule.fact == fact and not rule.competitions and rule.team_kind == competition.team_kind:
                return rule.sources
        return ()


def load_match_config(config_dir: Path = CONFIG_DIR) -> MatchConfig:
    competitions_data = tomllib.loads((config_dir / "competitions.toml").read_text(encoding="utf-8"))
    sources_data = tomllib.loads((config_dir / "sources.toml").read_text(encoding="utf-8"))
    tiers_data = tomllib.loads((config_dir / "tiers.toml").read_text(encoding="utf-8"))
    source_tiers = read_source_tiers(tiers_data)
    competitions = read_competitions(competitions_data, source_tiers)
    filters = MatchFilters(
        first_match_date=date.fromisoformat(competitions_data["first_match_date"]),
        excluded_round=re.compile(competitions_data["excluded_round_pattern"]),
        kept_round=re.compile(competitions_data["kept_round_pattern"]),
        excluded_tournament=re.compile(competitions_data["excluded_tournament_pattern"]),
    )
    return MatchConfig(
        competitions=competitions,
        filters=filters,
        coverage=read_coverage_windows(sources_data, competitions),
        precedence=read_precedence_rules(sources_data, competitions),
        martj42_dated_names=tuple(
            DatedTeamName(row["name"], date.fromisoformat(row["until"]), row["entity_ref"])
            for row in sources_data.get("martj42_team_names", [])
        ),
        source_tiers=source_tiers,
    )


def read_source_tiers(tiers_data: dict) -> dict[str, dict[str, int]]:
    tiers: dict[str, dict[str, int]] = {source: {} for source in MATCH_SOURCES}
    for tier in tiers_data.get("tiers", []):
        for source in MATCH_SOURCES:
            for competition_id in tier.get(source, []):
                if competition_id in tiers[source]:
                    raise ValueError(f"tiers.toml: {source} competition {competition_id} is in two tiers")
                tiers[source][competition_id] = int(tier["level"])
    return tiers


def read_competitions(data: dict, source_tiers: dict[str, dict[str, int]]) -> dict[str, Competition]:
    """Competitions with their tier from tiers.toml. Both files must name exactly the same source ids."""
    competitions: dict[str, Competition] = {}
    owner_of_id: dict[tuple[str, str], str] = {}
    refs: set[str] = set()
    for entry in data.get("competitions", []):
        key = entry["key"]
        if key in competitions:
            raise ValueError(f"competitions.toml: competition '{key}' is listed twice")
        if entry["kind"] not in COMPETITION_KINDS:
            raise ValueError(f"competitions.toml: {key} has unknown kind {entry['kind']}")
        if not re.fullmatch(r"wikidata:Q\d+", entry["ref"]) or entry["ref"] in refs:
            raise ValueError(f"competitions.toml: {key} needs its own wikidata:Q… ref")
        refs.add(entry["ref"])
        source_ids = {source: tuple(entry.get(source, [])) for source in MATCH_SOURCES if entry.get(source)}
        tiers_found: set[int] = set()
        for source, ids in source_ids.items():
            for source_id in ids:
                if (source, source_id) in owner_of_id:
                    raise ValueError(f"competitions.toml: {source} id {source_id} is in two competitions")
                owner_of_id[(source, source_id)] = key
                tiers_found |= tiers_of_source_id(source, source_id, source_tiers)
        if len(tiers_found) != 1:
            raise ValueError(
                f"competitions.toml: {key} must have ids in exactly one tier of tiers.toml, found {sorted(tiers_found)}"
            )
        competitions[key] = Competition(
            key=key,
            ref=entry["ref"],
            name_en=entry["name_en"],
            name_ar=entry["name_ar"],
            kind=entry["kind"],
            tier=tiers_found.pop(),
            source_ids=source_ids,
            edition_labels={int(year): label for year, label in entry.get("edition_labels", {}).items()},
        )
    for source, ids in source_tiers.items():
        for source_id in ids:
            lookup = source_id.split("-")[0] if source == "fjelstul" else source_id
            if (source, lookup) not in owner_of_id:
                raise ValueError(
                    f"tiers.toml: {source} id {source_id} has no competition in competitions.toml"
                )
    return competitions


def tiers_of_source_id(source: str, source_id: str, source_tiers: dict[str, dict[str, int]]) -> set[int]:
    """Tiers a competition id has in tiers.toml; a Fjelstul series has the tiers of its tournaments."""
    if source == "fjelstul":
        return {tier for tid, tier in source_tiers[source].items() if tid.split("-")[0] == source_id}
    tier = source_tiers[source].get(source_id)
    if tier is None:
        raise ValueError(f"competitions.toml: {source} id {source_id} is not in tiers.toml")
    return {tier}


def read_coverage_windows(data: dict, competitions: dict[str, Competition]) -> tuple[CoverageWindow, ...]:
    windows = []
    for entry in data.get("coverage", []):
        last = None if entry["to"] == LATEST else date.fromisoformat(entry["to"])
        for key in entry["competitions"]:
            if key not in competitions:
                raise ValueError(
                    f"sources.toml: coverage of {entry['source']} names unknown competition {key}"
                )
            windows.append(CoverageWindow(entry["source"], key, date.fromisoformat(entry["from"]), last))
    return tuple(windows)


def read_precedence_rules(data: dict, competitions: dict[str, Competition]) -> tuple[PrecedenceRule, ...]:
    rules = []
    for entry in data.get("precedence", []):
        unknown = set(entry.get("competitions", [])) - set(competitions)
        if unknown:
            raise ValueError(f"sources.toml: precedence names unknown competitions {sorted(unknown)}")
        rules.append(
            PrecedenceRule(
                entry["fact"],
                tuple(entry.get("competitions", [])),
                entry.get("team_kind"),
                tuple(entry["sources"]),
            )
        )
    return tuple(rules)


class Coverage:
    """Which source covers which competition on which day. Outside its window a source is silent."""

    def __init__(
        self, windows: tuple[CoverageWindow, ...], last_date_per_competition: dict[tuple[str, str], date]
    ) -> None:
        """`last_date_per_competition`: (source, competition key) → that source's last match date in it,
        the end of a window written as "latest"."""
        self._windows: dict[tuple[str, str], list[tuple[date, date]]] = {}
        for window in windows:
            last = window.last_date or last_date_per_competition.get((window.source, window.competition_key))
            if last is None:  # the source has no rows in that competition: it covers nothing there
                continue
            self._windows.setdefault((window.source, window.competition_key), []).append(
                (window.first_date, last)
            )

    def covers(self, source: str, competition_key: str, day: date) -> bool:
        return any(first <= day <= last for first, last in self._windows.get((source, competition_key), []))

    def sources_covering(self, competition_key: str, day: date) -> set[str]:
        return {source for source in MATCH_SOURCES if self.covers(source, competition_key, day)}
