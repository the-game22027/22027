import csv
import os
from pathlib import Path

import pytest
from linking_fixtures import TRANSFERMARKT_FILES, load_raw_source_files, transfermarkt_wikidata

from kb.ingest import Snapshot
from kb.linking import (
    LinkReport,
    drop_new_entities_without_links,
    find_wikidata_items_by_external_id,
    group_external_id_matches_from_rows,
    is_transfermarkt_id,
    load_competition_tiers,
    split_links_by_birth_year_plausibility,
    year_from_date_text,
)


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
    matches = group_external_id_matches_from_rows(
        [
            {"id": "8198", "item": entity + "Q11571", "sitelinks": "180"},
            {"id": "77", "item": entity + "Q1"},
            {"id": "77", "item": entity + "Q2"},
        ]
    )
    assert matches.qid_by_source_id == {"8198": "Q11571"}
    assert matches.sitelinks_by_qid["Q11571"] == 180
    assert matches.ambiguous_source_ids == {"77"}


def test_only_digit_ids_are_transfermarkt_ids_and_others_never_reach_a_query() -> None:
    assert is_transfermarkt_id("8198")
    assert not is_transfermarkt_id('1" } ?x ?y ?z {')
    assert not is_transfermarkt_id("12ab")
    assert not is_transfermarkt_id("²")  # a digit to str.isdigit, but not 0-9
    assert not is_transfermarkt_id("")
    with pytest.raises(ValueError, match="digit ids"):
        find_wikidata_items_by_external_id(transfermarkt_wikidata(), "P2446", ['1" }'])


def test_birth_years_more_than_a_year_apart_reject_a_link_and_missing_years_do_not() -> None:
    links = [
        ("PLAYER", "1", "wikidata:Q1"),  # 1990 vs 1991: kept
        ("PLAYER", "2", "wikidata:Q2"),  # 1999 vs 1988: rejected
        ("PLAYER", "3", "wikidata:Q3"),  # no source year: kept
        ("PLAYER", "4", "wikidata:Q4"),  # no Wikidata year: kept
    ]
    kept, rejected = split_links_by_birth_year_plausibility(
        links,
        {("PLAYER", "1"): 1990, ("PLAYER", "2"): 1999, ("PLAYER", "3"): None, ("PLAYER", "4"): 2000},
        {"wikidata:Q1": 1991, "wikidata:Q2": 1988, "wikidata:Q3": 1970, "wikidata:Q4": None},
    )
    assert kept == [links[0], links[2], links[3]]
    assert rejected == [(links[1], 1999, 1988)]
    assert year_from_date_text("1985-02-05 00:00:00") == 1985
    assert year_from_date_text("not available") is None


def test_new_entities_no_kept_link_points_at_are_dropped_with_their_names_and_countries() -> None:
    snapshot = Snapshot(
        entities={
            "wikidata:Q1": {"kind": "PLAYER", "sitelinks": 1, "birth_year": 1990},
            "wikidata:Q2": {"kind": "PLAYER", "sitelinks": 1, "birth_year": 1988},
            "wikidata:Q79": {"kind": "COUNTRY", "sitelinks": 0, "birth_year": None},
            "wikidata:Q851": {"kind": "COUNTRY", "sitelinks": 0, "birth_year": None},
        },
        names=[("wikidata:Q1", "en", "Kept", "LABEL"), ("wikidata:Q2", "en", "Dropped", "LABEL")],
        player_countries={("wikidata:Q1", "wikidata:Q79"), ("wikidata:Q2", "wikidata:Q851")},
    )
    drop_new_entities_without_links(snapshot, [("PLAYER", "1", "wikidata:Q1")])
    assert set(snapshot.entities) == {"wikidata:Q1", "wikidata:Q79"}
    assert snapshot.names == [("wikidata:Q1", "en", "Kept", "LABEL")]
    assert snapshot.player_countries == {("wikidata:Q1", "wikidata:Q79")}


def test_the_report_lists_link_rates_and_review_reasons() -> None:
    report = LinkReport()
    report.seen[("PLAYER", 1)] = 4
    report.linked[("PLAYER", 1)] = 3
    report.leave_for_review("PLAYER", "9", 1, "BIRTH_YEAR_MISMATCH")
    assert report.lines() == [
        "PLAYER         tier 1:      3 /      4 linked (75.0%)",
        "new entities: 0; left for review: 1 (BIRTH_YEAR_MISMATCH 1)",
    ]


def kb_url() -> str:
    url = os.environ.get("FOOTBALL_KB_TEST_URL")
    if not url:
        pytest.skip("FOOTBALL_KB_TEST_URL not set")
    return url


D1_ENTITIES = {
    "wikidata:Q11571": {"kind": "PLAYER", "sitelinks": 180, "birth_year": 1985},
    "wikidata:Q999": {"kind": "PLAYER", "sitelinks": 20, "birth_year": 1970},
    "wikidata:Q8682": {"kind": "CLUB", "sitelinks": 150, "birth_year": None},
    "wikidata:Q79": {"kind": "COUNTRY", "sitelinks": 0, "birth_year": None},
}


def read_xref(connection, source: str | None = None) -> list[tuple]:
    return connection.execute(
        """SELECT source, source_kind, source_id, entity_ref FROM core.entity_xref
           WHERE %s::text IS NULL OR source = %s ORDER BY 1, 2, 3""",
        (source, source),
    ).fetchall()


@pytest.mark.db
def test_transfermarkt_ids_link_with_kind_and_birth_year_checks_and_rerun_identically(tmp_path: Path) -> None:
    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.linking import link_transfermarkt
    from kb.store import replace_knowledge_base_contents

    with connect_to_knowledge_base(kb_url()) as connection:
        apply_pending_migrations(connection)
        replace_knowledge_base_contents(connection, Snapshot(entities=dict(D1_ENTITIES)))
        load_raw_source_files(connection, "transfermarkt", TRANSFERMARKT_FILES, tmp_path)

        report = link_transfermarkt(
            connection, transfermarkt_wikidata(), log=lambda _: None, review_dir=tmp_path
        )

        links = read_xref(connection, "transfermarkt")
        assert links == [
            ("transfermarkt", "CLUB", "418", "wikidata:Q8682"),
            ("transfermarkt", "NATIONAL_TEAM", "3300", "wikidata:Q267245"),
            ("transfermarkt", "PLAYER", "148455", "wikidata:Q1354960"),
            ("transfermarkt", "PLAYER", "8198", "wikidata:Q11571"),
        ]
        entities = {
            ref: (kind, origin)
            for ref, kind, origin in connection.execute("SELECT external_ref, kind, origin FROM core.entity")
        }
        assert entities["wikidata:Q1354960"] == ("PLAYER", "LINKED")
        assert entities["wikidata:Q267245"] == ("NATIONAL_TEAM", "LINKED")
        assert entities["wikidata:Q11571"] == ("PLAYER", "SCOPE")
        # The wrong item and the country only it needed are not stored.
        assert "wikidata:Q7403887" not in entities and "wikidata:Q851" not in entities
        assert connection.execute(
            "SELECT country_ref FROM core.player_country WHERE player_ref = 'wikidata:Q1354960'"
        ).fetchall() == [("wikidata:Q79",)]

        # Game 3 is in no tier: its club 9 and player 555 are not even looked up.
        assert report.seen[("PLAYER", 1)] == 5 and report.linked[("PLAYER", 1)] == 2
        assert report.seen[("CLUB", 1)] == 2 and report.linked[("CLUB", 1)] == 1
        assert report.new_entities == 2
        with (tmp_path / "link-review-transfermarkt.csv").open(encoding="utf-8", newline="") as file:
            review = {(row["source_kind"], row["source_id"], row["reason"]) for row in csv.DictReader(file)}
        assert review == {
            ("PLAYER", "164590", "BIRTH_YEAR_MISMATCH"),  # a new item born 1988 for a player born 1996
            ("PLAYER", "77777", "BIRTH_YEAR_MISMATCH"),  # an existing entity born 1970 for one born 2001
            ("PLAYER", "12ab", "INVALID_ID"),
            ("CLUB", "31", "KIND_CLASH"),  # a club id on a PLAYER entity
            ("NATIONAL_TEAM", "3299", "NOT_ON_WIKIDATA"),
        }

        entity_count = connection.execute("SELECT count(*) FROM core.entity").fetchone()
        again = link_transfermarkt(
            connection, transfermarkt_wikidata(), log=lambda _: None, review_dir=tmp_path
        )
        assert read_xref(connection, "transfermarkt") == links
        assert again.new_entities == 0
        assert connection.execute("SELECT count(*) FROM core.entity").fetchone() == entity_count
        assert again.count_review_reasons() == report.count_review_reasons()


@pytest.mark.db
def test_each_source_replaces_only_its_own_links(tmp_path: Path) -> None:
    from test_fjelstul_links import RAW_FILES, fjelstul_wikidata

    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.fjelstul_links import link_fjelstul
    from kb.linking import link_transfermarkt
    from kb.store import replace_knowledge_base_contents

    with connect_to_knowledge_base(kb_url()) as connection:
        apply_pending_migrations(connection)
        replace_knowledge_base_contents(connection, Snapshot(entities=dict(D1_ENTITIES)))
        load_raw_source_files(connection, "transfermarkt", TRANSFERMARKT_FILES, tmp_path)
        load_raw_source_files(connection, "fjelstul", RAW_FILES, tmp_path)
        tiers = {"WC-2022": 1}

        link_transfermarkt(connection, transfermarkt_wikidata(), log=lambda _: None, review_dir=tmp_path)
        link_fjelstul(connection, fjelstul_wikidata(), log=lambda _: None, review_dir=tmp_path, tiers=tiers)
        transfermarkt_links = read_xref(connection, "transfermarkt")
        fjelstul_links = read_xref(connection, "fjelstul")
        assert transfermarkt_links and fjelstul_links

        # Rerunning one source keeps the other's links, and the entities only the other links to.
        link_transfermarkt(connection, transfermarkt_wikidata(), log=lambda _: None, review_dir=tmp_path)
        assert read_xref(connection) == sorted(transfermarkt_links + fjelstul_links)
        assert connection.execute(
            "SELECT kind, origin FROM core.entity WHERE external_ref = 'wikidata:Q311042'"
        ).fetchone() == ("COACH", "LINKED")


def count_linked_entities(connection) -> int:
    return connection.execute("SELECT count(*) FROM core.entity WHERE origin = 'LINKED'").fetchone()[0]


@pytest.mark.db
def test_a_linked_entity_no_source_links_to_any_more_is_removed() -> None:
    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.linking import store_links
    from kb.store import replace_knowledge_base_contents

    new = Snapshot(
        entities={
            "wikidata:Q5": {"kind": "PLAYER", "sitelinks": 3, "birth_year": 1990},
            "wikidata:Q851": {"kind": "COUNTRY", "sitelinks": 0, "birth_year": None},
        },
        names=[("wikidata:Q5", "en", "Someone", "LABEL")],
        player_countries={("wikidata:Q5", "wikidata:Q851")},
    )
    with connect_to_knowledge_base(kb_url()) as connection:
        apply_pending_migrations(connection)
        replace_knowledge_base_contents(connection, Snapshot(entities=dict(D1_ENTITIES)))
        store_links(connection, "transfermarkt", [("PLAYER", "5", "wikidata:Q5")], new, "WIKIDATA_ID")
        assert count_linked_entities(connection) == 2

        store_links(connection, "transfermarkt", [], Snapshot(), "WIKIDATA_ID")
        assert count_linked_entities(connection) == 0
        assert connection.execute("SELECT count(*) FROM core.entity").fetchone() == (len(D1_ENTITIES),)
