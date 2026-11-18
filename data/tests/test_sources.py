import gzip
import hashlib
import os
from pathlib import Path

import pytest

from kb.sources import (
    SourceFile,
    column_names_from_header,
    download_source_file,
    load_source_registry,
    raw_table_name_for,
)

REGISTRY = """
[[sources]]
id = "martj42"
name = "International results"
license = "CC0-1.0"
base_url = "https://example.org/data/"
files = ["results.csv", "goalscorers.csv"]
"""


def test_registry_lists_every_file_with_its_url_and_licence(tmp_path: Path) -> None:
    path = tmp_path / "sources.toml"
    path.write_text(REGISTRY, encoding="utf-8")
    files = load_source_registry(path)
    assert [f.url for f in files] == [
        "https://example.org/data/results.csv",
        "https://example.org/data/goalscorers.csv",
    ]
    assert {f.license for f in files} == {"CC0-1.0"}
    assert files[0].license_note is None


def test_registry_rejects_a_source_listed_twice(tmp_path: Path) -> None:
    path = tmp_path / "sources.toml"
    path.write_text(REGISTRY + REGISTRY, encoding="utf-8")
    with pytest.raises(ValueError, match="listed twice"):
        load_source_registry(path)


def test_registry_rejects_a_source_id_that_cannot_name_a_table(tmp_path: Path) -> None:
    path = tmp_path / "sources.toml"
    path.write_text(REGISTRY.replace('id = "martj42"', 'id = "Mart J42"'), encoding="utf-8")
    with pytest.raises(ValueError, match="lowercase"):
        load_source_registry(path)


def test_the_project_registry_loads() -> None:
    files = load_source_registry()
    assert {f.source_id for f in files} >= {"transfermarkt", "fjelstul", "martj42"}


@pytest.mark.parametrize(
    ("source_id", "file_name", "table"),
    [
        ("transfermarkt", "game_events.csv.gz", "transfermarkt__game_events"),
        ("martj42", "results.csv", "martj42__results"),
        ("fjelstul", "player-appearances.csv", "fjelstul__player_appearances"),
    ],
)
def test_raw_table_name_joins_source_and_file_stem(source_id: str, file_name: str, table: str) -> None:
    assert raw_table_name_for(source_id, file_name) == table


def test_header_becomes_safe_unique_column_names_in_the_same_order() -> None:
    assert column_names_from_header(["game_id", "Home Team", "", "2nd leg", "game_id"]) == [
        "game_id",
        "home_team",
        "column_3",
        "c_2nd_leg",
        "game_id_2",
    ]


def test_download_reuses_the_local_copy_unless_refresh(tmp_path: Path) -> None:
    published = tmp_path / "published.csv"
    published.write_text("a,b\n1,2\n", encoding="utf-8")
    source_file = SourceFile("martj42", "results.csv", published.as_uri(), "CC0-1.0", None)
    downloads = tmp_path / "downloads"

    first = download_source_file(source_file, downloads)
    assert first.path == downloads / "martj42" / "results.csv"
    assert first.sha256 == hashlib.sha256(b"a,b\n1,2\n").hexdigest()

    published.write_text("a,b\n3,4\n", encoding="utf-8")
    assert download_source_file(source_file, downloads).sha256 == first.sha256
    assert download_source_file(source_file, downloads, refresh=True).sha256 != first.sha256


@pytest.mark.db
def test_raw_load_copies_rows_as_text_records_the_snapshot_and_skips_the_same_bytes(tmp_path: Path) -> None:
    url = os.environ.get("FOOTBALL_KB_TEST_URL")
    if not url:
        pytest.skip("FOOTBALL_KB_TEST_URL not set")
    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.sources import load_file_into_raw

    published = tmp_path / "goals.csv.gz"
    with gzip.open(published, "wt", encoding="utf-8", newline="") as file:
        file.write('date,scorer,minute\n2010-07-11,"Iniesta, Andrés",116\n2016-07-10,Eder,109\n')
    source_file = SourceFile("testsrc", "goals.csv.gz", published.as_uri(), "CC0-1.0", "test only")
    downloads = tmp_path / "downloads"

    with connect_to_knowledge_base(url) as connection:
        apply_pending_migrations(connection)
        connection.execute("DELETE FROM raw.source_snapshot WHERE source = 'testsrc'")
        connection.commit()

        first = load_file_into_raw(connection, download_source_file(source_file, downloads))
        assert (first.raw_table, first.row_count, first.already_loaded) == ("raw.testsrc__goals", 2, False)
        rows = connection.execute("SELECT scorer, minute FROM raw.testsrc__goals ORDER BY date").fetchall()
        assert rows == [("Iniesta, Andrés", "116"), ("Eder", "109")]

        again = load_file_into_raw(connection, download_source_file(source_file, downloads))
        assert again.already_loaded

        with gzip.open(published, "wt", encoding="utf-8", newline="") as file:
            file.write("date,scorer,minute\n2014-07-13,Götze,113\n")
        changed = load_file_into_raw(connection, download_source_file(source_file, downloads, refresh=True))
        assert (changed.row_count, changed.already_loaded) == (1, False)
        snapshots = connection.execute(
            "SELECT row_count, license_note FROM raw.source_snapshot WHERE source = 'testsrc' ORDER BY id"
        ).fetchall()
        assert snapshots == [(2, "test only"), (1, "test only")]
