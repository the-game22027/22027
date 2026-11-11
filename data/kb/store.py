"""Write a snapshot into football_kb. The Wikidata slice is rebuilt as a whole, in one transaction."""

import csv
from pathlib import Path

import psycopg

from kb.ingest import Snapshot

OVERRIDES_FILE = Path(__file__).parent.parent / "kb_overrides" / "names.csv"


def replace_knowledge_base_contents(connection: psycopg.Connection, snapshot: Snapshot) -> None:
    """Swap the old contents for the snapshot atomically, then re-apply the reviewed name overrides.

    Rebuilding instead of diffing keeps the code simple, and readers never see a half-written state.
    """
    with connection.transaction():
        connection.execute("TRUNCATE core.player_country, core.career_spell, core.entity_name, core.entity")
        with connection.cursor() as cursor:
            cursor.executemany(
                "INSERT INTO core.entity (external_ref, kind, sitelinks, birth_year) VALUES (%s, %s, %s, %s)",
                [
                    (ref, entity["kind"], entity["sitelinks"], entity["birth_year"])
                    for ref, entity in snapshot.entities.items()
                ],
            )
            cursor.executemany(
                """INSERT INTO core.entity_name (external_ref, locale, name, name_kind, source)
                   VALUES (%s, %s, %s, %s, 'wikidata') ON CONFLICT DO NOTHING""",
                [name for name in snapshot.names if name[0] in snapshot.entities],
            )
            cursor.executemany(
                """INSERT INTO core.career_spell (statement_id, player_ref, team_ref, from_year, to_year, loan)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                [
                    (s.statement_id, s.player_ref, s.team_ref, s.from_year, s.to_year, s.loan)
                    for s in snapshot.spells
                ],
            )
            cursor.executemany(
                "INSERT INTO core.player_country (player_ref, country_ref) VALUES (%s, %s)",
                sorted(snapshot.player_countries),
            )
        apply_name_overrides(connection)


def apply_name_overrides(connection: psycopg.Connection, overrides_file: Path = OVERRIDES_FILE) -> int:
    """Apply reviewed names on top of Wikidata. A LABEL override replaces the display label."""
    if not overrides_file.exists():
        return 0
    applied = 0
    with overrides_file.open(encoding="utf-8", newline="") as file:
        for row in csv.DictReader(file):
            exists = connection.execute(
                "SELECT 1 FROM core.entity WHERE external_ref = %s", (row["external_ref"],)
            ).fetchone()
            if not exists:
                continue  # out of scope this run; the override waits in the file
            if row["name_kind"] == "LABEL":
                connection.execute(
                    "DELETE FROM core.entity_name WHERE external_ref = %s AND locale = %s AND name_kind = 'LABEL'",
                    (row["external_ref"], row["locale"]),
                )
            connection.execute(
                """INSERT INTO core.entity_name (external_ref, locale, name, name_kind, source)
                   VALUES (%s, %s, %s, %s, 'override')
                   ON CONFLICT (external_ref, locale, name)
                   DO UPDATE SET name_kind = EXCLUDED.name_kind, source = 'override'""",
                (row["external_ref"], row["locale"], row["name"], row["name_kind"]),
            )
            applied += 1
    return applied
