"""Build a generated bundle (07 §5.8): load facts from core.*, run the generators, write the files of §5.4."""

import hashlib
import json
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

import psycopg

from kb.careers import Spell
from kb.catalog import load_catalog_entries, write_catalog_file
from kb.generate import (
    PlayerFacts,
    career_round,
    first_club_round,
    joined_in_year_rounds,
    nationality_round,
    pick_spread_over_difficulties,
    who_is_player_round,
)
from kb.grids import grid_rounds

GENERATOR_VERSION = "kb-generate-2"  # 2: catalog lines carry nameWords (ADR-0021)
CATEGORIES = [
    {"slug": "careers", "names": {"en": "Careers", "ar": "المسيرة"}},
    {"slug": "transfers", "names": {"en": "Transfers", "ar": "الانتقالات"}},
    {"slug": "nationalities", "names": {"en": "Nationalities", "ar": "الجنسيات"}},
    {"slug": "players", "names": {"en": "Players", "ar": "اللاعبون"}},
    {"slug": "grids", "names": {"en": "Grids", "ar": "الشبكات"}},
]


@dataclass(frozen=True)
class BundleSummary:
    question_count: int
    by_game_type: dict[str, int]
    catalog_size: int
    checksum: str
    catalog_checksum: str


def build_bundle(
    connection: psycopg.Connection,
    bundle_version: str,
    out_dir: Path,
    career_count: int,
    buzzer_count: int,
    catalog_min_player_sitelinks: int | None,
    who_count: int = 0,
    grid_count: int = 0,
    grid_min_answers: int = 3,
) -> BundleSummary:
    catalog = {entry["externalRef"]: entry for entry in load_catalog_entries(connection)}
    kb_version = _kb_version(connection)
    players = [
        player
        for player in load_player_facts(connection)
        if catalog.get(player.external_ref, {}).get("kind") == "PLAYER"
    ]
    club_names_of = _names_lookup(catalog, "CLUB")
    careers = [
        line
        for player in players
        if (line := career_round(player, lambda ref: club_names_of(ref) is not None, kb_version)) is not None
    ]
    buzzers = pick_buzzer_rounds(players, catalog, kb_version, buzzer_count)
    country_names_of = _names_lookup(catalog, "COUNTRY")
    whos = [
        line
        for player in players
        if (line := who_is_player_round(player, club_names_of, country_names_of, kb_version)) is not None
    ]
    lines = sorted(
        pick_spread_over_difficulties(careers, career_count)
        + buzzers
        + pick_spread_over_difficulties(whos, who_count)
        + grid_rounds(
            players,
            club_names_of,
            country_names_of,
            kb_version,
            count=grid_count,
            min_answers=grid_min_answers,
        ),
        key=lambda line: line["externalKey"],
    )

    entries = list(catalog.values())
    if catalog_min_player_sitelinks is not None:
        entries = _catalog_for_development(entries, players, lines, catalog_min_player_sitelinks)
    return _write_bundle(out_dir, bundle_version, kb_version, lines, entries)


def pick_buzzer_rounds(
    players: list[PlayerFacts], catalog: dict[str, dict], kb_version: str, count: int
) -> list[dict]:
    """About a third of `count` per template, each spread over difficulties; one round per player and template."""
    clubs, countries = _names_lookup(catalog, "CLUB"), _names_lookup(catalog, "COUNTRY")
    first_clubs = [line for p in players if (line := first_club_round(p, clubs, kb_version)) is not None]
    # The most recent move of each player: the one fans remember best.
    transfers = [rounds[-1] for p in players if (rounds := joined_in_year_rounds(p, clubs, kb_version))]
    nationalities = [
        line for p in players if (line := nationality_round(p, countries, kb_version)) is not None
    ]
    share, extra = divmod(count, 3)
    picked = []
    for index, candidates in enumerate((first_clubs, transfers, nationalities)):
        picked += pick_spread_over_difficulties(candidates, share + (1 if index < extra else 0))
    return picked


def load_player_facts(connection: psycopg.Connection) -> list[PlayerFacts]:
    """Every player with spells, most popular first (ties by Wikidata number, so the order is stable)."""
    players = connection.execute(
        "SELECT external_ref, sitelinks, birth_year FROM core.entity WHERE kind = 'PLAYER'"
    ).fetchall()
    labels: dict[str, dict[str, str]] = {}
    for external_ref, locale, name in connection.execute(
        """SELECT n.external_ref, n.locale, n.name FROM core.entity_name n
           JOIN core.entity e USING (external_ref) WHERE e.kind = 'PLAYER' AND n.name_kind = 'LABEL'"""
    ):
        labels.setdefault(external_ref, {})[locale] = name
    spells: dict[str, list[Spell]] = {}
    for row in connection.execute(
        "SELECT statement_id, player_ref, team_ref, from_year, to_year, loan FROM core.career_spell"
    ):
        spells.setdefault(row[1], []).append(Spell(*row))
    countries: dict[str, list[str]] = {}
    for player_ref, country_ref in connection.execute(
        "SELECT player_ref, country_ref FROM core.player_country"
    ):
        countries.setdefault(player_ref, []).append(country_ref)
    facts = [
        PlayerFacts(
            external_ref=external_ref,
            sitelinks=sitelinks,
            names=labels.get(external_ref, {}),
            spells=tuple(sorted(spells[external_ref], key=lambda spell: spell.statement_id)),
            country_refs=tuple(sorted(countries.get(external_ref, []))),
            birth_year=birth_year,
        )
        for external_ref, sitelinks, birth_year in players
        if external_ref in spells
    ]
    return sorted(facts, key=lambda player: (-player.sitelinks, _qid_number(player.external_ref)))


def _names_lookup(catalog: dict[str, dict], kind: str) -> Callable[[str], dict[str, str] | None]:
    """Names of a catalog entity of this kind only: a club where a country is expected would fail the import."""

    def names_of(external_ref: str) -> dict[str, str] | None:
        entry = catalog.get(external_ref)
        return entry["names"] if entry and entry["kind"] == kind else None

    return names_of


def _catalog_for_development(
    entries: list[dict], players: list[PlayerFacts], lines: list[dict], min_player_sitelinks: int
) -> list[dict]:
    """A smaller catalog that is small enough to commit (07 §5.8): popular players and what they point at."""
    kept = {player.external_ref for player in players if player.sitelinks >= min_player_sitelinks}
    for player in players:
        if player.external_ref in kept:
            kept.update(spell.team_ref for spell in player.spells)
            kept.update(player.country_refs)
    for line in lines:
        kept.update(_references_of_line(line))
    return [entry for entry in entries if entry["externalRef"] in kept]


def _references_of_line(line: dict) -> set[str]:
    refs = {entity for answer in line["answers"] for entity in answer["entities"]}
    content = line["content"]
    if line["gameType"] == "CAREER":
        refs.add(content["player"])
        refs.update(spell["club"] for spell in content["spells"])
    if line["gameType"] == "WHO_IS_PLAYER":
        refs.add(content["player"])
    if line["gameType"] == "GRID":
        refs.update(criterion["entity"] for criterion in [*content["rows"], *content["cols"]])
    return refs


def _write_bundle(
    out_dir: Path, bundle_version: str, kb_version: str, lines: list[dict], entries: list[dict]
) -> BundleSummary:
    out_dir.mkdir(parents=True, exist_ok=True)
    body = "".join(json.dumps(line, ensure_ascii=False, sort_keys=True) + "\n" for line in lines).encode(
        "utf-8"
    )
    (out_dir / "questions.jsonl").write_bytes(body)
    catalog_checksum = write_catalog_file(entries, out_dir)
    checksum = "sha256:" + hashlib.sha256(body).hexdigest()
    manifest = {
        "bundleVersion": bundle_version,
        "kbVersion": kb_version,
        "generatorVersion": GENERATOR_VERSION,
        "questionCount": len(lines),
        "checksum": checksum,
        "catalogChecksum": catalog_checksum,
        "categories": CATEGORIES,
    }
    (out_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    by_game_type: dict[str, int] = {}
    for line in lines:
        by_game_type[line["gameType"]] = by_game_type.get(line["gameType"], 0) + 1
    return BundleSummary(len(lines), by_game_type, len(entries), checksum, catalog_checksum)


def _kb_version(connection: psycopg.Connection) -> str:
    last_ingest = connection.execute("SELECT max(updated_at)::date FROM core.entity").fetchone()[0]
    return f"wikidata-{last_ingest.isoformat() if last_ingest else 'empty'}"


def _qid_number(external_ref: str) -> int:
    qid = external_ref.removeprefix("wikidata:Q")
    return int(qid) if qid.isdigit() else 0
