"""Download the scope from Wikidata and turn it into a knowledge-base snapshot (07 §4.2).

Network and cache access go through WikidataClient; everything else here is plain data shaping.
"""

from collections import defaultdict
from collections.abc import Callable, Iterable
from dataclasses import dataclass, field

from kb.careers import Spell, TeamFacts, ended_before_senior_age, is_senior_club
from kb.config import Scope
from kb.wikidata import Row, WikidataClient, external_ref_from_qid, qid_from_uri, values_block

FOOTBALL_PLAYER = "Q937857"
FOOTBALL_CLUB = "Q476028"
LOAN = "Q2914547"
BATCH_SIZE = 200


@dataclass
class Snapshot:
    entities: dict[str, dict] = field(default_factory=dict)  # external_ref -> {kind, sitelinks, birth_year}
    names: list[tuple[str, str, str, str]] = field(default_factory=list)  # (ref, locale, name, LABEL|ALIAS)
    spells: list[Spell] = field(default_factory=list)
    player_countries: set[tuple[str, str]] = field(default_factory=set)


def collect_snapshot(client: WikidataClient, scope: Scope, log: Callable[[str], None] = print) -> Snapshot:
    club_qids = sorted(set(scope.club_ids) | set(find_clubs_in_leagues(client, scope.league_ids)))
    log(f"clubs in scope: {len(club_qids)}")

    player_sitelinks: dict[str, int] = {}
    for index, club_qid in enumerate(club_qids, start=1):
        for row in client.select_rows(_players_of_club_query(club_qid)):
            qid = qid_from_uri(row["player"])
            player_sitelinks[qid] = max(player_sitelinks.get(qid, 0), int(row["sitelinks"]))
        if index % 20 == 0:
            log(f"  players read for {index}/{len(club_qids)} clubs")
    kept_players = sorted(
        qid for qid, links in player_sitelinks.items() if links >= scope.min_player_sitelinks
    )
    log(
        f"players: {len(player_sitelinks)} found, {len(kept_players)} kept (sitelinks >= {scope.min_player_sitelinks})"
    )

    raw_spells = list(_fetch_raw_spells(client, kept_players))
    team_facts = _fetch_team_facts(client, sorted({spell.team_ref for spell in raw_spells}))
    senior_clubs = {qid: facts for qid, facts in team_facts.items() if is_senior_club(facts, scope)}
    log(f"teams on careers: {len(team_facts)}, senior clubs kept: {len(senior_clubs)}")

    snapshot = Snapshot()
    for qid in kept_players:
        snapshot.entities[external_ref_from_qid(qid)] = {
            "kind": "PLAYER",
            "sitelinks": player_sitelinks[qid],
            "birth_year": None,
        }
    for qid, facts in senior_clubs.items():
        snapshot.entities[external_ref_from_qid(qid)] = {
            "kind": "CLUB",
            "sitelinks": facts.sitelinks,
            "birth_year": None,
        }
    snapshot.spells = [
        Spell(
            spell.statement_id,
            external_ref_from_qid(spell.player_ref),
            external_ref_from_qid(spell.team_ref),
            spell.from_year,
            spell.to_year,
            spell.loan,
        )
        for spell in raw_spells
        if spell.team_ref in senior_clubs
    ]

    _add_player_facts(client, kept_players, snapshot)
    _drop_childhood_spells_and_unused_clubs(snapshot, scope.min_senior_age)
    named_qids = [ref.removeprefix("wikidata:") for ref in snapshot.entities]
    snapshot.names = list(_fetch_names(client, named_qids))
    log(f"names: {len(snapshot.names)} labels and aliases for {len(named_qids)} entities")
    return snapshot


def _drop_childhood_spells_and_unused_clubs(snapshot: Snapshot, min_senior_age: int) -> None:
    snapshot.spells = [
        spell
        for spell in snapshot.spells
        if not ended_before_senior_age(
            spell, snapshot.entities[spell.player_ref]["birth_year"], min_senior_age
        )
    ]
    clubs_on_careers = {spell.team_ref for spell in snapshot.spells}
    for ref in [ref for ref, entity in snapshot.entities.items() if entity["kind"] == "CLUB"]:
        if ref not in clubs_on_careers:
            del snapshot.entities[ref]


def find_clubs_in_leagues(client: WikidataClient, league_qids: Iterable[str]) -> list[str]:
    league_qids = list(league_qids)
    if not league_qids:
        return []
    query = f"""SELECT DISTINCT ?club WHERE {{
      {values_block("league", league_qids)}
      ?club wdt:P118 ?league ; wdt:P31 wd:{FOOTBALL_CLUB} .
    }}"""
    return [qid_from_uri(row["club"]) for row in client.select_rows(query)]


def _players_of_club_query(club_qid: str) -> str:
    # p:/ps: reads every statement; wdt: would hide former clubs behind a preferred current one (07 §4.1).
    return f"""SELECT DISTINCT ?player ?sitelinks WHERE {{
      ?player p:P54/ps:P54 wd:{club_qid} ; wdt:P106 wd:{FOOTBALL_PLAYER} ; wikibase:sitelinks ?sitelinks .
    }}"""


def _fetch_raw_spells(client: WikidataClient, player_qids: list[str]) -> Iterable[Spell]:
    for batch in _batches(player_qids):
        query = f"""SELECT ?player ?statement ?team ?start ?end ?acquisition WHERE {{
          {values_block("player", batch)}
          ?player p:P54 ?statement . ?statement ps:P54 ?team .
          FILTER NOT EXISTS {{ ?statement wikibase:rank wikibase:DeprecatedRank }}
          OPTIONAL {{ ?statement pq:P580 ?start }}
          OPTIONAL {{ ?statement pq:P582 ?end }}
          OPTIONAL {{ ?statement pq:P1642 ?acquisition }}
        }}"""
        yield from spells_from_rows(client.select_rows(query))


def spells_from_rows(rows: Iterable[Row]) -> list[Spell]:
    """Group raw statement rows (one per qualifier combination) into one Spell per statement."""
    by_statement: dict[str, dict] = {}
    for row in rows:
        statement_id = row["statement"].rsplit("/", 1)[-1]
        entry = by_statement.setdefault(
            statement_id,
            {
                "player": qid_from_uri(row["player"]),
                "team": qid_from_uri(row["team"]),
                "start": None,
                "end": None,
                "loan": False,
            },
        )
        entry["start"] = entry["start"] or year_of_wikidata_date(row.get("start"))
        entry["end"] = entry["end"] or year_of_wikidata_date(row.get("end"))
        if row.get("acquisition") and qid_from_uri(row["acquisition"]) == LOAN:
            entry["loan"] = True
    return [
        Spell(statement_id, entry["player"], entry["team"], entry["start"], entry["end"], entry["loan"])
        for statement_id, entry in by_statement.items()
        if entry["team"].startswith("Q")  # "unknown value" statements point at blank nodes
    ]


def year_of_wikidata_date(value: str | None) -> int | None:
    """'2002-01-01T00:00:00Z' -> 2002. Unknown values (blank node ids) and BCE dates give None."""
    if not value or len(value) < 4 or not value[:4].isdigit():
        return None
    return int(value[:4])


def _fetch_team_facts(client: WikidataClient, team_qids: list[str]) -> dict[str, TeamFacts]:
    labels: dict[str, str] = {}
    classes: dict[str, set[str]] = defaultdict(set)
    sitelinks: dict[str, int] = {}
    for batch in _batches(team_qids):
        query = f"""SELECT ?team ?label ?class ?sitelinks WHERE {{
          {values_block("team", batch)}
          OPTIONAL {{ ?team rdfs:label ?label FILTER(lang(?label) = "en") }}
          OPTIONAL {{ ?team wdt:P31 ?class }}
          OPTIONAL {{ ?team wikibase:sitelinks ?sitelinks }}
        }}"""
        for row in client.select_rows(query):
            qid = qid_from_uri(row["team"])
            classes[qid]  # every team gets an entry, even without types
            if "label" in row:
                labels[qid] = row["label"]
            if "class" in row:
                classes[qid].add(qid_from_uri(row["class"]))
            if "sitelinks" in row:
                sitelinks[qid] = int(row["sitelinks"])
    return {
        qid: TeamFacts(qid, labels.get(qid), frozenset(classes[qid]), sitelinks.get(qid, 0))
        for qid in classes
    }


def _add_player_facts(client: WikidataClient, player_qids: list[str], snapshot: Snapshot) -> None:
    for batch in _batches(player_qids):
        query = f"""SELECT ?player ?birth ?sportCountry ?citizenship WHERE {{
          {values_block("player", batch)}
          OPTIONAL {{ ?player wdt:P569 ?birth }}
          OPTIONAL {{ ?player wdt:P1532 ?sportCountry }}
          OPTIONAL {{ ?player wdt:P27 ?citizenship }}
        }}"""
        sport_countries: dict[str, set[str]] = defaultdict(set)
        citizenships: dict[str, set[str]] = defaultdict(set)
        for row in client.select_rows(query):
            qid = qid_from_uri(row["player"])
            entity = snapshot.entities[external_ref_from_qid(qid)]
            entity["birth_year"] = entity["birth_year"] or year_of_wikidata_date(row.get("birth"))
            if "sportCountry" in row:
                sport_countries[qid].add(qid_from_uri(row["sportCountry"]))
            if "citizenship" in row:
                citizenships[qid].add(qid_from_uri(row["citizenship"]))
        for qid in batch:
            # Country for sport says who a player represents (England, not the United Kingdom).
            for country_qid in sport_countries.get(qid) or citizenships.get(qid) or ():
                country_ref = external_ref_from_qid(country_qid)
                snapshot.entities.setdefault(
                    country_ref, {"kind": "COUNTRY", "sitelinks": 0, "birth_year": None}
                )
                snapshot.player_countries.add((external_ref_from_qid(qid), country_ref))


def _fetch_names(client: WikidataClient, qids: list[str]) -> Iterable[tuple[str, str, str, str]]:
    for batch in _batches(qids):
        query = f"""SELECT ?item ?name ?kind WHERE {{
          {values_block("item", batch)}
          {{ ?item rdfs:label ?name BIND("LABEL" AS ?kind) }}
          UNION {{ ?item skos:altLabel ?name BIND("ALIAS" AS ?kind) }}
          FILTER(lang(?name) IN ("en", "ar"))
        }}"""
        for row in client.select_rows(query):
            yield (
                external_ref_from_qid(qid_from_uri(row["item"])),
                row["name@lang"],
                row["name"],
                row["kind"],
            )


def _batches(items: list[str], size: int = BATCH_SIZE) -> Iterable[list[str]]:
    for start in range(0, len(items), size):
        yield items[start : start + size]
