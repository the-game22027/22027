"""D.3b linking: map every source's own ids to one Wikidata entity (07 §5.10, ADR-0022).

Transfermarkt ids link exactly: Wikidata stores them (P2446 players, P7223 clubs and national teams). Linked
items that the D.1 scope did not include become knowledge-base entities (origin LINKED), with their names and
countries. The pieces shared by every source's linker live here too: the report, the review file, the kind
rule, the birth-year plausibility check, new-entity details and storing.
"""

import csv
import tomllib
from collections import Counter, defaultdict
from collections.abc import Callable, Collection, Iterable
from dataclasses import dataclass, field
from pathlib import Path

import psycopg

from kb.ingest import (
    Snapshot,
    add_player_birth_year_and_countries,
    fetch_entity_names,
    split_into_batches,
    year_of_wikidata_date,
)
from kb.wikidata import Row, WikidataClient, external_ref_from_qid, qid_from_uri

TIERS_FILE = Path(__file__).parent.parent / "config" / "tiers.toml"
REVIEW_DIR = Path(__file__).parent.parent / ".out"
TRANSFERMARKT_PLAYER_ID = "P2446"
TRANSFERMARKT_TEAM_ID = "P7223"
# A source and Wikidata may disagree by a year (a date typed as the season, a time zone); more than that means
# the outside id sits on the wrong Wikidata item (found 2026-11-18: Transfermarkt 164590 "Yazeed Al-Bakr" is
# stored on Q7403887 "Saleh Al-Dosari").
MAX_BIRTH_YEAR_DIFFERENCE = 1

REVIEW_COLUMNS = ["source_kind", "source_id", "tier", "name", "lookup_key", "reason", "entity_ref", "detail"]

Link = tuple[str, str, str]  # (source_kind, source_id, entity_ref)


@dataclass(frozen=True)
class IdsToLink:
    """Source ids per kind, each with the best (lowest) tier it appears in."""

    players: dict[str, int]
    clubs: dict[str, int]
    national_teams: dict[str, int]


@dataclass(frozen=True)
class ExternalIdMatches:
    qid_by_source_id: dict[str, str]
    sitelinks_by_qid: dict[str, int]
    ambiguous_source_ids: set[str]


@dataclass
class LinkReport:
    """What one source's link run did. Every id left unlinked has a review row with its reason."""

    seen: Counter = field(default_factory=Counter)  # (kind, tier) -> ids seen
    linked: Counter = field(default_factory=Counter)  # (kind, tier) -> ids linked
    new_entities: int = 0
    review_rows: list[dict[str, str]] = field(default_factory=list)

    def leave_for_review(
        self,
        kind: str,
        source_id: str,
        tier: int,
        reason: str,
        name: str = "",
        lookup_key: str = "",
        entity_ref: str = "",
        detail: str = "",
    ) -> None:
        self.review_rows.append(
            {
                "source_kind": kind,
                "source_id": source_id,
                "tier": str(tier),
                "name": name,
                "lookup_key": lookup_key,
                "reason": reason,
                "entity_ref": entity_ref,
                "detail": detail,
            }
        )

    def count_review_reasons(self) -> Counter:
        return Counter(row["reason"] for row in self.review_rows)

    def lines(self) -> list[str]:
        out = []
        for kind, tier in sorted(self.seen):
            seen, linked = self.seen[(kind, tier)], self.linked[(kind, tier)]
            out.append(f"{kind:<14} tier {tier}: {linked:>6,} / {seen:>6,} linked ({linked / seen:.1%})")
        reasons = self.count_review_reasons()
        listed = ", ".join(f"{reason} {count:,}" for reason, count in sorted(reasons.items())) or "none"
        out.append(
            f"new entities: {self.new_entities:,}; left for review: {sum(reasons.values()):,} ({listed})"
        )
        return out


def can_link_to_entity_of_kind(source_kind: str, entity_kind: str) -> bool:
    """A source id may point at an entity of its own kind, and a coach may be an entity we know as a player.

    Many coaches were players first (Didier Deschamps): one person, one entity, kept as PLAYER because a player
    entity carries more (career, countries). Every other mismatch is a clash.
    """
    return source_kind == entity_kind or (source_kind == "COACH" and entity_kind == "PLAYER")


def year_from_date_text(text: str | None) -> int | None:
    """'1987-06-24 00:00:00' or '1987-06-24' → 1987; anything else ('not available', empty) → None."""
    return year_of_wikidata_date(text)


def split_links_by_birth_year_plausibility(
    links: Iterable[Link],
    source_birth_years: dict[tuple[str, str], int | None],
    entity_birth_years: dict[str, int | None],
) -> tuple[list[Link], list[tuple[Link, int, int]]]:
    """Keep a link unless both birth years are known and differ by more than MAX_BIRTH_YEAR_DIFFERENCE.

    Returns (kept links, rejected links with the source's and the entity's birth year). Missing data is not
    evidence: a link with an unknown birth year on either side is kept.
    """
    kept: list[Link] = []
    rejected: list[tuple[Link, int, int]] = []
    for link in links:
        kind, source_id, ref = link
        source_year = source_birth_years.get((kind, source_id))
        entity_year = entity_birth_years.get(ref)
        if source_year and entity_year and abs(source_year - entity_year) > MAX_BIRTH_YEAR_DIFFERENCE:
            rejected.append((link, source_year, entity_year))
        else:
            kept.append(link)
    return kept, rejected


def reject_implausible_links(
    links: list[Link],
    report: LinkReport,
    source_birth_years: dict[tuple[str, str], int | None],
    entity_birth_years: dict[str, int | None],
    tier_of: dict[tuple[str, str], int],
    name_of: dict[tuple[str, str], str],
) -> list[Link]:
    """The birth-year check, with every rejected link written to the report as BIRTH_YEAR_MISMATCH."""
    kept, rejected = split_links_by_birth_year_plausibility(links, source_birth_years, entity_birth_years)
    for (kind, source_id, ref), source_year, entity_year in rejected:
        report.leave_for_review(
            kind,
            source_id,
            tier_of[(kind, source_id)],
            "BIRTH_YEAR_MISMATCH",
            name=name_of.get((kind, source_id), ""),
            entity_ref=ref,
            detail=f"source {source_year}, wikidata {entity_year}",
        )
    return kept


def count_linked(report: LinkReport, links: Iterable[Link], tier_of: dict[tuple[str, str], int]) -> None:
    for kind, source_id, _ in links:
        report.linked[(kind, tier_of[(kind, source_id)])] += 1


def write_link_review_file(source: str, rows: list[dict[str, str]], out_dir: Path = REVIEW_DIR) -> Path:
    """Write `.out/link-review-<source>.csv`: every id left unlinked, with its reason, for human review."""
    path = out_dir / f"link-review-{source}.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=REVIEW_COLUMNS)
        writer.writeheader()
        writer.writerows(sorted(rows, key=lambda r: (r["reason"], r["source_kind"], r["source_id"])))
    return path


def load_existing_entities(connection: psycopg.Connection) -> tuple[dict[str, str], dict[str, int | None]]:
    """Kind and birth year of every entity the knowledge base already has."""
    kinds: dict[str, str] = {}
    birth_years: dict[str, int | None] = {}
    for ref, kind, birth_year in connection.execute("SELECT external_ref, kind, birth_year FROM core.entity"):
        kinds[ref] = kind
        birth_years[ref] = birth_year
    return kinds, birth_years


def load_competition_tiers(source: str, path: Path = TIERS_FILE) -> dict[str, int]:
    """Competition id → tier for one source. A competition listed in two tiers is a config error."""
    tiers: dict[str, int] = {}
    for tier in tomllib.loads(path.read_text(encoding="utf-8")).get("tiers", []):
        for competition_id in tier.get(source, []):
            if competition_id in tiers:
                raise ValueError(f"{path}: {source} competition {competition_id} is in two tiers")
            tiers[competition_id] = int(tier["level"])
    return tiers


def collect_transfermarkt_ids_to_link(connection: psycopg.Connection, tiers: dict[str, int]) -> IdsToLink:
    """Every player, club and national team that plays in a tiered competition, from raw.transfermarkt__*."""
    games = """WITH tier(competition_id, level) AS (SELECT * FROM unnest(%s::text[], %s::int[])),
               g AS (SELECT g.game_id, t.level, g.home_club_id, g.away_club_id,
                            g.competition_type = 'national_team_competition' AS between_nations
                     FROM raw.transfermarkt__games g JOIN tier t USING (competition_id))"""
    params = (list(tiers), list(tiers.values()))
    rows = connection.execute(
        games
        + """, p AS (SELECT l.player_id, g.level FROM raw.transfermarkt__game_lineups l JOIN g USING (game_id)
                     UNION ALL
                     SELECT unnest(ARRAY[e.player_id, e.player_in_id, e.player_assist_id]), g.level
                     FROM raw.transfermarkt__game_events e JOIN g USING (game_id))
             SELECT player_id, min(level) FROM p WHERE player_id IS NOT NULL GROUP BY player_id""",
        params,
    ).fetchall()
    players = {player_id: level for player_id, level in rows}
    clubs: dict[str, int] = {}
    national_teams: dict[str, int] = {}
    rows = connection.execute(
        games
        + """ SELECT team_id, between_nations, min(level) FROM (
                SELECT home_club_id AS team_id, between_nations, level FROM g
                UNION ALL SELECT away_club_id, between_nations, level FROM g) t
              WHERE team_id IS NOT NULL GROUP BY team_id, between_nations""",
        params,
    ).fetchall()
    for team_id, between_nations, level in rows:
        target = national_teams if between_nations else clubs
        target[team_id] = min(level, target.get(team_id, level))
    return IdsToLink(players, clubs, national_teams)


def load_transfermarkt_player_details(
    connection: psycopg.Connection,
) -> tuple[dict[str, str], dict[str, int | None]]:
    """Name and birth year per Transfermarkt player id, for review rows and the plausibility check."""
    if not _raw_table_exists(connection, "transfermarkt__players"):
        return {}, {}
    names: dict[str, str] = {}
    birth_years: dict[str, int | None] = {}
    for player_id, name, date_of_birth in connection.execute(
        "SELECT player_id, name, date_of_birth FROM raw.transfermarkt__players"
    ):
        names[player_id] = name or ""
        birth_years[player_id] = year_from_date_text(date_of_birth)
    return names, birth_years


def is_transfermarkt_id(source_id: str) -> bool:
    """Transfermarkt ids are digits. Anything else is never put into a SPARQL query."""
    return source_id.isascii() and source_id.isdigit()


def find_wikidata_items_by_external_id(
    client: WikidataClient, property_id: str, source_ids: Iterable[str]
) -> ExternalIdMatches:
    """Look the ids up on Wikidata. An id held by two items is ambiguous and left unlinked.

    Ids must be digits (`is_transfermarkt_id`): they are written into the query as string literals.
    """
    rows: list[Row] = []
    for batch in split_into_batches(sorted(source_ids)):
        if not all(is_transfermarkt_id(source_id) for source_id in batch):
            raise ValueError("only digit ids may be written into a SPARQL query")
        literals = " ".join(f'"{source_id}"' for source_id in batch)
        rows.extend(
            client.select_rows(
                f"""SELECT ?id ?item ?sitelinks WHERE {{
                  VALUES ?id {{ {literals} }}
                  ?item wdt:{property_id} ?id .
                  OPTIONAL {{ ?item wikibase:sitelinks ?sitelinks }}
                }}"""
            )
        )
    return group_external_id_matches_from_rows(rows)


def group_external_id_matches_from_rows(rows: Iterable[Row]) -> ExternalIdMatches:
    items_by_id: dict[str, set[str]] = defaultdict(set)
    sitelinks: dict[str, int] = {}
    for row in rows:
        qid = qid_from_uri(row["item"])
        items_by_id[row["id"]].add(qid)
        sitelinks[qid] = int(row.get("sitelinks", 0))
    unique = {source_id: next(iter(qids)) for source_id, qids in items_by_id.items() if len(qids) == 1}
    ambiguous = {source_id for source_id, qids in items_by_id.items() if len(qids) > 1}
    return ExternalIdMatches(unique, sitelinks, ambiguous)


def link_transfermarkt(
    connection: psycopg.Connection,
    client: WikidataClient,
    log: Callable[[str], None] = print,
    review_dir: Path = REVIEW_DIR,
) -> LinkReport:
    """Replace every Transfermarkt link, adding the linked entities the knowledge base does not have yet."""
    ids = collect_transfermarkt_ids_to_link(connection, load_competition_tiers("transfermarkt"))
    log(
        f"transfermarkt ids: {len(ids.players):,} players, {len(ids.clubs):,} clubs, "
        f"{len(ids.national_teams):,} national teams"
    )
    player_names, player_birth_years = load_transfermarkt_player_details(connection)
    report = LinkReport()
    tier_of: dict[tuple[str, str], int] = {}
    name_of = {("PLAYER", player_id): name for player_id, name in player_names.items()}
    ids_by_kind = (("PLAYER", ids.players), ("CLUB", ids.clubs), ("NATIONAL_TEAM", ids.national_teams))
    for kind, kind_ids in ids_by_kind:
        for source_id, tier in kind_ids.items():
            tier_of[(kind, source_id)] = tier
            report.seen[(kind, tier)] += 1
            if not is_transfermarkt_id(source_id):
                report.leave_for_review(kind, source_id, tier, "INVALID_ID", lookup_key=source_id)

    player_matches = find_wikidata_items_by_external_id(
        client, TRANSFERMARKT_PLAYER_ID, filter(is_transfermarkt_id, ids.players)
    )
    team_matches = find_wikidata_items_by_external_id(
        client, TRANSFERMARKT_TEAM_ID, filter(is_transfermarkt_id, set(ids.clubs) | set(ids.national_teams))
    )
    existing_kinds, existing_birth_years = load_existing_entities(connection)

    links: list[Link] = []
    new_entities = Snapshot()
    for kind, kind_ids, matches in (
        ("PLAYER", ids.players, player_matches),
        ("CLUB", ids.clubs, team_matches),
        ("NATIONAL_TEAM", ids.national_teams, team_matches),
    ):
        for source_id, tier in kind_ids.items():
            if not is_transfermarkt_id(source_id):
                continue
            name = name_of.get((kind, source_id), "")
            if source_id in matches.ambiguous_source_ids:
                report.leave_for_review(kind, source_id, tier, "AMBIGUOUS", name, source_id)
                continue
            qid = matches.qid_by_source_id.get(source_id)
            if qid is None:
                report.leave_for_review(kind, source_id, tier, "NOT_ON_WIKIDATA", name, source_id)
                continue
            ref = external_ref_from_qid(qid)
            known_kind = existing_kinds.get(ref) or new_entities.entities.get(ref, {}).get("kind")
            if known_kind and not can_link_to_entity_of_kind(kind, known_kind):
                report.leave_for_review(
                    kind, source_id, tier, "KIND_CLASH", name, source_id, ref, f"entity is {known_kind}"
                )
                continue
            if not known_kind:
                new_entities.entities[ref] = {
                    "kind": kind,
                    "sitelinks": matches.sitelinks_by_qid.get(qid, 0),
                    "birth_year": None,
                }
            links.append((kind, source_id, ref))

    add_details_of_new_entities(client, new_entities, existing_kinds)
    entity_birth_years = {**existing_birth_years, **_birth_years_of(new_entities)}
    source_birth_years = {("PLAYER", player_id): year for player_id, year in player_birth_years.items()}
    links = reject_implausible_links(links, report, source_birth_years, entity_birth_years, tier_of, name_of)
    drop_new_entities_without_links(new_entities, links)
    count_linked(report, links, tier_of)
    report.new_entities = len(new_entities.entities)
    path = write_link_review_file("transfermarkt", report.review_rows, review_dir)
    log(f"{len(report.review_rows):,} unlinked ids → {path}")
    store_links(connection, "transfermarkt", links, new_entities, method="WIKIDATA_ID")
    return report


def add_details_of_new_entities(
    client: WikidataClient, new_entities: Snapshot, existing_refs: Collection[str]
) -> None:
    """Give entities new to the knowledge base what D.1 entities have: players' birth year and countries
    (countries the knowledge base lacks become entities too), and every new entity's en/ar names."""
    new_player_qids = [
        ref.removeprefix("wikidata:") for ref, e in new_entities.entities.items() if e["kind"] == "PLAYER"
    ]
    add_player_birth_year_and_countries(client, new_player_qids, new_entities)
    for ref in list(new_entities.entities):
        if ref in existing_refs:  # a country the knowledge base already has
            del new_entities.entities[ref]
    new_entities.names = list(
        fetch_entity_names(client, [r.removeprefix("wikidata:") for r in new_entities.entities])
    )


def drop_new_entities_without_links(new_entities: Snapshot, links: Iterable[Link]) -> None:
    """After the plausibility check: forget new entities no kept link points at, with their names and
    countries. (Details are fetched for every candidate first, so the SPARQL batches, and the cache, stay the
    same from run to run.)"""
    linked_refs = {ref for _, _, ref in links}
    for ref, entity in list(new_entities.entities.items()):
        if entity["kind"] != "COUNTRY" and ref not in linked_refs:
            del new_entities.entities[ref]
    new_entities.player_countries = {
        (player, country)
        for player, country in new_entities.player_countries
        if player in new_entities.entities
    }
    used_countries = {country for _, country in new_entities.player_countries}
    for ref, entity in list(new_entities.entities.items()):
        if entity["kind"] == "COUNTRY" and ref not in used_countries:
            del new_entities.entities[ref]
    new_entities.names = [name for name in new_entities.names if name[0] in new_entities.entities]


def store_links(
    connection: psycopg.Connection,
    source: str,
    links: list[Link],
    new_entities: Snapshot,
    method: str,
) -> None:
    """Add the new entities (origin LINKED) and swap the source's links, in one transaction.

    Afterwards, LINKED entities that no source links to any more (and LINKED countries no player uses) are
    removed: they exist only because of a link. SCOPE entities (D.1) are never touched here.
    """
    with connection.transaction(), connection.cursor() as cursor:
        cursor.executemany(
            """INSERT INTO core.entity (external_ref, kind, sitelinks, birth_year, origin)
               VALUES (%s, %s, %s, %s, 'LINKED') ON CONFLICT (external_ref) DO NOTHING""",
            [(ref, e["kind"], e["sitelinks"], e["birth_year"]) for ref, e in new_entities.entities.items()],
        )
        cursor.executemany(
            """INSERT INTO core.entity_name (external_ref, locale, name, name_kind, source)
               VALUES (%s, %s, %s, %s, 'wikidata') ON CONFLICT DO NOTHING""",
            new_entities.names,
        )
        cursor.executemany(
            "INSERT INTO core.player_country (player_ref, country_ref) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            sorted(new_entities.player_countries),
        )
        cursor.execute("DELETE FROM core.entity_xref WHERE source = %s", (source,))
        cursor.executemany(
            """INSERT INTO core.entity_xref (source, source_kind, source_id, entity_ref, method)
               VALUES (%s, %s, %s, %s, %s)""",
            [(source, kind, source_id, ref, method) for kind, source_id, ref in links],
        )
        cursor.execute(
            """DELETE FROM core.entity e WHERE e.origin = 'LINKED' AND e.kind <> 'COUNTRY'
               AND NOT EXISTS (SELECT 1 FROM core.entity_xref x WHERE x.entity_ref = e.external_ref)"""
        )
        cursor.execute(
            """DELETE FROM core.entity e WHERE e.origin = 'LINKED' AND e.kind = 'COUNTRY'
               AND NOT EXISTS (SELECT 1 FROM core.player_country p WHERE p.country_ref = e.external_ref)"""
        )


def _birth_years_of(snapshot: Snapshot) -> dict[str, int | None]:
    return {ref: entity["birth_year"] for ref, entity in snapshot.entities.items()}


def _raw_table_exists(connection: psycopg.Connection, table: str) -> bool:
    return connection.execute("SELECT to_regclass(%s) IS NOT NULL", (f"raw.{table}",)).fetchone()[0]
