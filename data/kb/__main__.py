"""Command line: python -m kb <command>. Run from the data/ folder (07 §4.2)."""

import argparse
import sys
from pathlib import Path

from kb.catalog import load_catalog_entries, write_catalog_file, write_entities_missing_a_name
from kb.config import load_scope
from kb.db import apply_pending_migrations, connect_to_knowledge_base
from kb.ingest import collect_snapshot
from kb.store import replace_knowledge_base_contents
from kb.wikidata import WikidataClient


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m kb", description="Football knowledge base pipeline")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("migrate", help="apply pending kb_migrations/*.sql")
    ingest = commands.add_parser("ingest", help="download the scope from Wikidata and rebuild core.*")
    ingest.add_argument("--scope", type=Path, default=Path("config/scope.toml"))
    ingest.add_argument("--refresh", action="store_true", help="ignore the SPARQL cache and fetch again")
    missing = commands.add_parser("names:missing", help="write entities without a name in a language to CSV")
    missing.add_argument("--locale", default="ar")
    missing.add_argument("--out", type=Path, default=Path(".out/names-missing-ar.csv"))
    catalog = commands.add_parser("catalog", help="write catalog.jsonl into a bundle folder")
    catalog.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)

    with connect_to_knowledge_base() as connection:
        if args.command == "migrate":
            applied = apply_pending_migrations(connection)
            print(f"applied: {', '.join(applied) if applied else 'nothing, already up to date'}")
        elif args.command == "ingest":
            scope = load_scope(args.scope)
            snapshot = collect_snapshot(WikidataClient(connection, refresh=args.refresh), scope)
            replace_knowledge_base_contents(connection, snapshot)
            kinds = {}
            for entity in snapshot.entities.values():
                kinds[entity["kind"]] = kinds.get(entity["kind"], 0) + 1
            print(f"stored: {kinds}, {len(snapshot.spells)} career spells")
        elif args.command == "names:missing":
            count = write_entities_missing_a_name(connection, args.locale, args.out)
            print(f"{count} entities without a '{args.locale}' name → {args.out}")
        elif args.command == "catalog":
            entries = load_catalog_entries(connection)
            checksum = write_catalog_file(entries, args.out)
            print(f"{len(entries)} entities → {args.out / 'catalog.jsonl'} ({checksum})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
