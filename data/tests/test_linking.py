import os
from pathlib import Path

import pytest

from kb.linking import external_id_matches_from_rows, load_competition_tiers


def test_tiers_map_each_competition_to_its_level(tmp_path: Path) -> None:
    path = tmp_path / "tiers.toml"
    path.write_text(
        '[[tiers]]\nlevel = 1\ntransfermarkt = ["CL", "GB1"]\n[[tiers]]\nlevel = 2\ntransfermarkt = ["EL"]\n',
        encoding="utf-8",
    )
    assert load_competition_tiers("transfermarkt", path) == {"CL": 1, "GB1": 1, "EL": 2}
    assert load_competition_tiers("martj42", path) == {}


def test_a_competition_in_two_tiers_is_a_config_error(tmp_path: Path) -> None:
    path = tmp_path / "tiers.toml"
    path.write_text(
        '[[tiers]]\nlevel = 1\ntransfermarkt = ["CL"]\n[[tiers]]\nlevel = 2\ntransfermarkt = ["CL"]\n',
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="two tiers"):
        load_competition_tiers("transfermarkt", path)


def test_the_project_tiers_load() -> None:
    tiers = load_competition_tiers("transfermarkt")
    assert tiers["CL"] == 1 and tiers["EL"] == 2


def test_an_id_held_by_two_wikidata_items_is_ambiguous_and_not_linked() -> None:
    entity = "http://www.wikidata.org/entity/"
    matches = external_id_matches_from_rows(
        [
            {"id": "8198", "item": entity + "Q11571", "sitelinks": "180"},
            {"id": "77", "item": entity + "Q1"},
            {"id": "77", "item": entity + "Q2"},
        ]
    )
    assert matches.qid_by_source_id == {"8198": "Q11571"}
    assert matches.sitelinks_by_qid["Q11571"] == 180
    assert matches.ambiguous_source_ids == {"77"}


class FakeWikidata:
    """Answers the linker's queries from fixed rows, chosen by what the query asks for."""

    ENTITY = "http://www.wikidata.org/entity/"

    def select_rows(self, query: str) -> list[dict]:
        if "wdt:P2446" in query:
            return [
                {"id": "8198", "item": self.ENTITY + "Q11571", "sitelinks": "180"},
                {"id": "148455", "item": self.ENTITY + "Q1354960", "sitelinks": "90"},
            ]
        if "wdt:P7223" in query:
            return [
                {"id": "418", "item": self.ENTITY + "Q8682", "sitelinks": "150"},
                {"id": "3300", "item": self.ENTITY + "Q267245", "sitelinks": "60"},
            ]
        if "wdt:P569" in query:
            return [
                {
                    "player": self.ENTITY + "Q1354960",
                    "birth": "1992-06-15T00:00:00Z",
                    "sportCountry": self.ENTITY + "Q79",
                }
            ]
        if "rdfs:label" in query:
            return [
                {
                    "item": self.ENTITY + "Q1354960",
                    "name": "Mohamed Salah",
                    "name@lang": "en",
                    "kind": "LABEL",
                },
                {"item": self.ENTITY + "Q1354960", "name": "محمد صلاح", "name@lang": "ar", "kind": "LABEL"},
                {"item": self.ENTITY + "Q267245", "name": "Portugal", "name@lang": "en", "kind": "LABEL"},
                {"item": self.ENTITY + "Q79", "name": "Egypt", "name@lang": "en", "kind": "LABEL"},
            ]
        raise AssertionError(f"unexpected query: {query[:80]}")


def write_csv(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8")
    return path


@pytest.mark.db
def test_transfermarkt_ids_link_to_existing_and_new_entities(tmp_path: Path) -> None:
    url = os.environ.get("FOOTBALL_KB_TEST_URL")
    if not url:
        pytest.skip("FOOTBALL_KB_TEST_URL not set")
    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.ingest import Snapshot
    from kb.linking import link_transfermarkt
    from kb.sources import SourceFile, download_source_file, load_file_into_raw
    from kb.store import replace_knowledge_base_contents

    files = {
        "games.csv": "game_id,competition_id,home_club_id,away_club_id,competition_type\n"
        "1,CL,418,31,international_cup\n2,EURO,3300,3299,national_team_competition\n3,XX,418,9,other\n",
        "game_lineups.csv": "game_id,player_id\n1,8198\n2,8198\n3,555\n",
        "game_events.csv": "game_id,player_id,player_in_id,player_assist_id\n1,148455,,8198\n",
    }
    with connect_to_knowledge_base(url) as connection:
        apply_pending_migrations(connection)
        replace_knowledge_base_contents(
            connection,
            Snapshot(
                entities={
                    "wikidata:Q11571": {"kind": "PLAYER", "sitelinks": 180, "birth_year": 1985},
                    "wikidata:Q8682": {"kind": "CLUB", "sitelinks": 150, "birth_year": None},
                    "wikidata:Q79": {"kind": "COUNTRY", "sitelinks": 0, "birth_year": None},
                }
            ),
        )
        connection.execute("DELETE FROM raw.source_snapshot WHERE source = 'transfermarkt'")
        connection.commit()
        for name, text in files.items():
            published = write_csv(tmp_path / name, text)
            source_file = SourceFile("transfermarkt", name, published.as_uri(), "CC0-1.0", None)
            load_file_into_raw(connection, download_source_file(source_file, tmp_path / "downloads"))

        report = link_transfermarkt(connection, FakeWikidata(), log=lambda _: None)

        links = connection.execute(
            "SELECT source_kind, source_id, entity_ref FROM core.entity_xref ORDER BY source_kind, source_id"
        ).fetchall()
        assert links == [
            ("CLUB", "418", "wikidata:Q8682"),
            ("NATIONAL_TEAM", "3300", "wikidata:Q267245"),
            ("PLAYER", "148455", "wikidata:Q1354960"),
            ("PLAYER", "8198", "wikidata:Q11571"),
        ]
        kinds = dict(connection.execute("SELECT external_ref, kind FROM core.entity").fetchall())
        assert kinds["wikidata:Q1354960"] == "PLAYER"
        assert kinds["wikidata:Q267245"] == "NATIONAL_TEAM"
        assert connection.execute(
            "SELECT country_ref FROM core.player_country WHERE player_ref = 'wikidata:Q1354960'"
        ).fetchall() == [("wikidata:Q79",)]
        # Game 3 is in no tier: its club 9 and player 555 are not even looked up.
        assert report.counts[("PLAYER", 1)] == [2, 2]
        assert report.counts[("CLUB", 1)] == [2, 1]
        assert report.new_entities == 2
