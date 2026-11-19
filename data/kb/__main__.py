"""Command line: python -m kb <command>. Run from the data/ folder (07 §4.2)."""

import argparse
import sys
from pathlib import Path

from kb.bundle import build_bundle
from kb.catalog import load_catalog_entries, write_catalog_file, write_entities_missing_a_name
from kb.config import load_scope
from kb.db import apply_pending_migrations, connect_to_knowledge_base
from kb.fjelstul_links import link_fjelstul
from kb.ingest import collect_snapshot
from kb.linking import link_transfermarkt
from kb.sources import download_source_file, load_file_into_raw, load_source_registry
from kb.store import replace_knowledge_base_contents
from kb.wikidata import WikidataClient

# Source id → its linker, in the order a plain `kb link` runs them.
LINKERS = {"transfermarkt": link_transfermarkt, "fjelstul": link_fjelstul}


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
    bundle = commands.add_parser(
        "bundle", help="generate a bundle of game content with its catalog (07 §5.8)"
    )
    bundle.add_argument("--version", required=True, help="bundleVersion, never reused (e.g. dev-0002)")
    bundle.add_argument("--out", type=Path, required=True)
    bundle.add_argument("--careers", type=int, default=60)
    bundle.add_argument("--buzzers", type=int, default=60)
    bundle.add_argument("--who", type=int, default=60, help="who-is-the-player rounds")
    bundle.add_argument("--grids", type=int, default=30, help="grid (tic-tac-toe) boards")
    bundle.add_argument("--grid-min-answers", type=int, default=3, help="fewest valid players per grid cell")
    bundle.add_argument("--mines", type=int, default=0, help="MINES (لغم) categories")
    bundle.add_argument(
        "--mines-min-answers", type=int, default=20, help="fewest players in a MINES category"
    )
    bundle.add_argument("--mines-max-answers", type=int, default=40, help="most players in a MINES category")
    bundle.add_argument(
        "--mines-clubs", type=int, default=100, help="MINES uses only the N most popular clubs"
    )
    bundle.add_argument(
        "--catalog-min-player-sitelinks",
        type=int,
        default=None,
        help="development only: a smaller catalog of popular players and what they point at",
    )
    fetch = commands.add_parser(
        "sources:fetch", help="download the files in config/sources.toml and load them into raw.* (07 §5.10)"
    )
    fetch.add_argument("--source", action="append", help="only this source id (repeatable)")
    fetch.add_argument("--refresh", action="store_true", help="download again even if a local copy exists")
    link = commands.add_parser(
        "link", help="map source ids to Wikidata entities in core.entity_xref (07 §5.10, D.3b)"
    )
    link.add_argument(
        "--source",
        action="append",
        choices=list(LINKERS),
        help="only this source (repeatable; default: every source)",
    )
    link.add_argument("--refresh", action="store_true", help="ignore the SPARQL cache and fetch again")
    args = parser.parse_args(argv)

    if args.command == "sources:fetch":
        source_files = load_source_registry()
        unknown = set(args.source or []) - {f.source_id for f in source_files}
        if unknown:
            parser.error(f"unknown source id: {', '.join(sorted(unknown))}")
        selected = [f for f in source_files if not args.source or f.source_id in args.source]

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
            print("links were cleared with the old entities: run `python -m kb link` again")
        elif args.command == "names:missing":
            count = write_entities_missing_a_name(connection, args.locale, args.out)
            print(f"{count} entities without a '{args.locale}' name → {args.out}")
        elif args.command == "catalog":
            entries = load_catalog_entries(connection)
            checksum = write_catalog_file(entries, args.out)
            print(f"{len(entries)} entities → {args.out / 'catalog.jsonl'} ({checksum})")
        elif args.command == "bundle":
            summary = build_bundle(
                connection,
                args.version,
                args.out,
                args.careers,
                args.buzzers,
                args.catalog_min_player_sitelinks,
                who_count=args.who,
                grid_count=args.grids,
                grid_min_answers=args.grid_min_answers,
                mines_count=args.mines,
                mines_min_answers=args.mines_min_answers,
                mines_max_answers=args.mines_max_answers,
                mines_clubs=args.mines_clubs,
            )
            print(
                f"{args.version}: {summary.question_count} rounds {summary.by_game_type}, "
                f"catalog {summary.catalog_size} entities → {args.out}"
            )
        elif args.command == "link":
            client = WikidataClient(connection, refresh=args.refresh)
            # Registry order whatever the command line says: Transfermarkt first, so a person it knows as a
            # player is a PLAYER entity before a Fjelstul coach link reaches them.
            for source in [source for source in LINKERS if not args.source or source in args.source]:
                print(f"== {source}")
                report = LINKERS[source](connection, client)
                print("\n".join(report.lines()))
        elif args.command == "sources:fetch":
            for source_file in selected:
                downloaded = download_source_file(source_file, refresh=args.refresh)
                result = load_file_into_raw(connection, downloaded)
                state = "unchanged" if result.already_loaded else "loaded"
                print(f"{result.raw_table}: {result.row_count:,} rows ({state})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
