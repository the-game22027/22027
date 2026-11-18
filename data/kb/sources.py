"""D.3a raw landing: download the registered source files and load them, exactly as published, into raw.* (07 §5.10)."""

import csv
import gzip
import hashlib
import io
import re
import shutil
import tomllib
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import psycopg
from psycopg import sql

from kb.wikidata import USER_AGENT

REGISTRY_FILE = Path(__file__).parent.parent / "config" / "sources.toml"
DOWNLOADS_DIR = Path(__file__).parent.parent / "raw_downloads"
COPY_CHUNK_CHARS = 1 << 20


@dataclass(frozen=True)
class SourceFile:
    source_id: str
    file_name: str
    url: str
    license: str
    license_note: str | None


@dataclass(frozen=True)
class DownloadedFile:
    source_file: SourceFile
    path: Path
    sha256: str
    downloaded_at: datetime


@dataclass(frozen=True)
class RawLoadResult:
    raw_table: str
    row_count: int
    already_loaded: bool


def load_source_registry(path: Path = REGISTRY_FILE) -> list[SourceFile]:
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    files: list[SourceFile] = []
    seen_ids: set[str] = set()
    for source in data.get("sources", []):
        source_id = source["id"]
        if source_id in seen_ids:
            raise ValueError(f"{path}: source '{source_id}' is listed twice")
        seen_ids.add(source_id)
        if not re.fullmatch(r"[a-z][a-z0-9_]*", source_id):
            raise ValueError(f"{path}: source id '{source_id}' must be lowercase letters, digits and _")
        for file_name in source["files"]:
            files.append(
                SourceFile(
                    source_id=source_id,
                    file_name=file_name,
                    url=source["base_url"] + file_name,
                    license=source["license"],
                    license_note=source.get("license_note"),
                )
            )
    if not files:
        raise ValueError(f"{path}: no source files")
    return files


def raw_table_name_for(source_id: str, file_name: str) -> str:
    """transfermarkt + game_events.csv.gz → transfermarkt__game_events (the table lives in schema raw)."""
    stem = re.sub(r"\.csv(\.gz)?$", "", file_name)
    return f"{source_id}__{_snake_case(stem)}"


def column_names_from_header(header: list[str]) -> list[str]:
    """Turn a CSV header into safe, unique column names. Order is kept, so COPY maps columns by position."""
    names: list[str] = []
    for position, title in enumerate(header, start=1):
        name = _snake_case(title) or f"column_{position}"
        if name[0].isdigit():
            name = f"c_{name}"
        candidate, suffix = name, 2
        while candidate in names:
            candidate, suffix = f"{name}_{suffix}", suffix + 1
        names.append(candidate)
    return names


def download_source_file(
    source_file: SourceFile, downloads_dir: Path = DOWNLOADS_DIR, refresh: bool = False
) -> DownloadedFile:
    """Keep a local copy of the file. An existing copy is reused unless `refresh`, so reruns work offline."""
    path = downloads_dir / source_file.source_id / source_file.file_name
    if refresh or not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        partial = path.with_name(path.name + ".partial")
        request = urllib.request.Request(source_file.url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(request, timeout=120) as reply, partial.open("wb") as out:
            shutil.copyfileobj(reply, out)
        partial.replace(path)
    downloaded_at = datetime.fromtimestamp(path.stat().st_mtime, tz=UTC)
    return DownloadedFile(source_file, path, _sha256_of_file(path), downloaded_at)


def load_file_into_raw(connection: psycopg.Connection, downloaded: DownloadedFile) -> RawLoadResult:
    """Replace raw.<source>__<file> with the file's rows, all columns as text, and record the snapshot.

    Loading the same bytes twice is a no-op. Everything happens in one transaction, so readers see either
    the old rows or the new ones.
    """
    source_file = downloaded.source_file
    table = raw_table_name_for(source_file.source_id, source_file.file_name)
    with connection.transaction():
        latest = connection.execute(
            """SELECT sha256, row_count FROM raw.source_snapshot
               WHERE source = %s AND file = %s ORDER BY loaded_at DESC, id DESC LIMIT 1""",
            (source_file.source_id, source_file.file_name),
        ).fetchone()
        (table_exists,) = connection.execute(
            "SELECT to_regclass(%s) IS NOT NULL", (f"raw.{table}",)
        ).fetchone()
        if latest and latest[0] == downloaded.sha256 and table_exists:
            return RawLoadResult(f"raw.{table}", latest[1], already_loaded=True)

        with _open_text(downloaded.path) as text:
            columns = column_names_from_header(next(csv.reader([text.readline()])))
            identifier = sql.Identifier("raw", table)
            connection.execute(sql.SQL("DROP TABLE IF EXISTS {}").format(identifier))
            connection.execute(
                sql.SQL("CREATE TABLE {} ({})").format(
                    identifier,
                    sql.SQL(", ").join(sql.SQL("{} text").format(sql.Identifier(c)) for c in columns),
                )
            )
            copy_statement = sql.SQL("COPY {} ({}) FROM STDIN (FORMAT csv)").format(
                identifier, sql.SQL(", ").join(map(sql.Identifier, columns))
            )
            with connection.cursor() as cursor, cursor.copy(copy_statement) as copy:
                while chunk := text.read(COPY_CHUNK_CHARS):
                    copy.write(chunk)
        row_count = connection.execute(sql.SQL("SELECT count(*) FROM {}").format(identifier)).fetchone()[0]
        connection.execute(
            """INSERT INTO raw.source_snapshot
                 (source, file, raw_table, url, sha256, downloaded_at, row_count, license, license_note)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                source_file.source_id,
                source_file.file_name,
                f"raw.{table}",
                source_file.url,
                downloaded.sha256,
                downloaded.downloaded_at,
                row_count,
                source_file.license,
                source_file.license_note,
            ),
        )
    return RawLoadResult(f"raw.{table}", row_count, already_loaded=False)


def _snake_case(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.strip().lower()).strip("_")


def _open_text(path: Path) -> io.TextIOBase:
    # utf-8-sig drops a byte order mark if a source writes one.
    if path.name.endswith(".gz"):
        return gzip.open(path, "rt", encoding="utf-8-sig", newline="")
    return path.open("r", encoding="utf-8-sig", newline="")


def _sha256_of_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        while block := file.read(1 << 20):
            digest.update(block)
    return digest.hexdigest()
