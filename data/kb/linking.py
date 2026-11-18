"""D.3b linking: map every source's own ids to one Wikidata entity (07 §5.10, ADR-0022).

Transfermarkt ids link exactly: Wikidata stores them (P2446 players, P7223 clubs and national teams). Linked
items that the D.1 scope did not include become knowledge-base entities, with their names and countries.
"""

import tomllib
from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field
from pathlib import Path

import psycopg

from kb.ingest import Snapshot, add_player_birth_year_and_countries, fetch_entity_names, in_batches
from kb.wikidata import Row, WikidataClient, external_ref_from_qid, qid_from_uri

TIERS_FILE = Path(__file__).parent.parent / "config" / "tiers.toml"
TRANSFERMARKT_PLAYER_ID = "P2446"
TRANSFERMARKT_TEAM_ID = "P7223"


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
    # (kind, tier) -> [ids seen, ids linked]
    counts: dict[tuple[str, int], list[int]] = field(default_factory=lambda: defaultdict(lambda: [0, 0]))
    ambiguous: int = 0
    kind_clashes: int = 0
    new_entities: int = 0

    def lines(self) -> list[str]:
        out = []
        for (kind, tier), (seen, linked) in sorted(self.counts.items()):
            out.append(f"{kind:<14} tier {tier}: {linked:>6,} / {seen:>6,} linked ({linked / seen:.1%})")
        out.append(
            f"new entities: {self.new_entities:,}; ambiguous ids: {self.ambiguous}; "
            f"kind clashes: {self.kind_clashes}"
        )
        return out


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


def find_wikidata_items_by_external_id(
    client: WikidataClient, property_id: str, source_ids: Iterable[str]
) -> ExternalIdMatches:
    """Look the ids up on Wikidata. An id held by two items is ambiguous and left unlinked."""
    rows: list[Row] = []
    for batch in in_batches(sorted(source_ids)):
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
    return external_id_matches_from_rows(rows)


def external_id_matches_from_rows(rows: Iterable[Row]) -> ExternalIdMatches:
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
    connection: psycopg.Connection, client: WikidataClient, log: Callable[[str], None] = print
) -> LinkReport:
    """Replace every Transfermarkt link, adding the linked entities the knowledge base does not have yet."""
    ids = collect_transfermarkt_ids_to_link(connection, load_competition_tiers("transfermarkt"))
    log(
        f"transfermarkt ids: {len(ids.players):,} players, {len(ids.clubs):,} clubs, "
        f"{len(ids.national_teams):,} national teams"
    )
    player_matches = find_wikidata_items_by_external_id(client, TRANSFERMARKT_PLAYER_ID, ids.players)
    team_matches = find_wikidata_items_by_external_id(
        client, TRANSFERMARKT_TEAM_ID, set(ids.clubs) | set(ids.national_teams)
    )
    existing_kinds = dict(connection.execute("SELECT external_ref, kind FROM core.entity").fetchall())

    report = LinkReport()
    report.ambiguous = len(player_matches.ambiguous_source_ids) + len(team_matches.ambiguous_source_ids)
    links: list[tuple[str, str, str]] = []  # (source_kind, source_id, entity_ref)
    new_entities = Snapshot()
    for kind, kind_ids, matches in (
        ("PLAYER", ids.players, player_matches),
        ("CLUB", ids.clubs, team_matches),
        ("NATIONAL_TEAM", ids.national_teams, team_matches),
    ):
        for source_id, tier in kind_ids.items():
            report.counts[(kind, tier)][0] += 1
            qid = matches.qid_by_source_id.get(source_id)
            if qid is None:
                continue
            ref = external_ref_from_qid(qid)
            known_kind = existing_kinds.get(ref) or new_entities.entities.get(ref, {}).get("kind")
            if known_kind and known_kind != kind:
                report.kind_clashes += 1
                continue
            if not known_kind:
                new_entities.entities[ref] = {
                    "kind": kind,
                    "sitelinks": matches.sitelinks_by_qid.get(qid, 0),
                    "birth_year": None,
                }
            links.append((kind, source_id, ref))
            report.counts[(kind, tier)][1] += 1

    new_player_qids = [
        ref.removeprefix("wikidata:") for ref, e in new_entities.entities.items() if e["kind"] == "PLAYER"
    ]
    add_player_birth_year_and_countries(client, new_player_qids, new_entities)
    for ref in list(new_entities.entities):
        if ref in existing_kinds:  # a country the knowledge base already has
            del new_entities.entities[ref]
    new_entities.names = list(
        fetch_entity_names(client, [r.removeprefix("wikidata:") for r in new_entities.entities])
    )
    report.new_entities = len(new_entities.entities)
    store_links(connection, "transfermarkt", links, new_entities)
    return report


def store_links(
    connection: psycopg.Connection, source: str, links: list[tuple[str, str, str]], new_entities: Snapshot
) -> None:
    """Add the new entities and swap the source's links in one transaction."""
    with connection.transaction(), connection.cursor() as cursor:
        cursor.executemany(
            """INSERT INTO core.entity (external_ref, kind, sitelinks, birth_year) VALUES (%s, %s, %s, %s)
               ON CONFLICT (external_ref) DO NOTHING""",
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
               VALUES (%s, %s, %s, %s, 'WIKIDATA_ID')""",
            [(source, kind, source_id, ref) for kind, source_id, ref in links],
        )
