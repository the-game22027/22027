import json
import os
from pathlib import Path

import pytest

from kb.careers import Spell
from kb.catalog import add_name_words, load_catalog_entries, search_forms_of_entry, write_catalog_file
from kb.ingest import Snapshot


def entry(**overrides) -> dict:
    base = {
        "externalRef": "wikidata:Q11571",
        "kind": "PLAYER",
        "names": {"en": "Cristiano Ronaldo", "ar": "كريستيانو رونالدو"},
        "aliases": {"en": ["CR7", "Ronaldo"], "ar": ["رونالدو"]},
        "popularity": 400,
    }
    return {**base, **overrides}


def test_search_forms_cover_names_and_aliases_without_duplicates() -> None:
    forms = search_forms_of_entry(entry(aliases={"en": ["CR7", "cr7"], "ar": ["رونالدو"]}))
    assert forms == ["cristiano ronaldo", "كريستيانو رونالدو", "cr7", "رونالدو"]


def test_name_words_count_entities_of_the_same_kind_that_share_a_word() -> None:
    entries = [
        entry(),
        entry(externalRef="wikidata:Q1", names={"en": "Ronaldo Nazario", "ar": "رونالدو نازاريو"}),
        entry(externalRef="wikidata:Q2", kind="CLUB", names={"en": "Ronaldo FC", "ar": "نادي رونالدو"}),
    ]
    add_name_words(entries)
    assert entries[0]["nameWords"] == [
        {"form": "cristiano", "sharedBy": 1},
        {"form": "ronaldo", "sharedBy": 2},
        {"form": "كريستيانو", "sharedBy": 1},
        {"form": "رونالدو", "sharedBy": 2},
    ]
    assert {"form": "ronaldo", "sharedBy": 1} in entries[2]["nameWords"]


def test_parenthesized_disambiguation_is_not_part_of_any_form() -> None:
    footballer = entry(names={"en": "Mohamed Salah (footballer)", "ar": "محمد صلاح (لاعب كرة قدم)"})
    add_name_words([footballer])
    assert search_forms_of_entry(footballer)[:2] == ["mohamed salah", "محمد صلاح"]
    assert [word["form"] for word in footballer["nameWords"]] == ["mohamed", "salah", "محمد", "صلاح"]


def test_name_words_skip_short_words_and_the_arabic_article() -> None:
    entries = [
        entry(names={"en": "Ben Yedder", "ar": "وسام بن يدر"}),
        entry(names={"en": "Al Ahly", "ar": "الأهلي"}),
    ]
    add_name_words(entries)
    assert [word["form"] for word in entries[0]["nameWords"]] == ["ben", "yedder", "وسام", "يدر"]
    assert [word["form"] for word in entries[1]["nameWords"]] == ["ahly", "اهلي"]


def test_catalog_file_is_byte_identical_for_the_same_entries(tmp_path: Path) -> None:
    entries = [
        entry(),
        entry(externalRef="wikidata:Q8682", kind="CLUB", names={"en": "Real Madrid", "ar": "ريال مدريد"}),
    ]
    first = write_catalog_file(entries, tmp_path / "a")
    second = write_catalog_file(list(reversed(entries)), tmp_path / "b")
    assert first == second
    lines = (tmp_path / "a" / "catalog.jsonl").read_text(encoding="utf-8").splitlines()
    assert json.loads(lines[0])["kind"] == "CLUB"


@pytest.mark.db
def test_only_entities_with_both_names_reach_the_catalog() -> None:
    url = os.environ.get("FOOTBALL_KB_TEST_URL")
    if not url:
        pytest.skip("FOOTBALL_KB_TEST_URL not set")
    from kb.db import apply_pending_migrations, connect_to_knowledge_base
    from kb.store import replace_knowledge_base_contents

    snapshot = Snapshot(
        entities={
            "wikidata:Q11571": {"kind": "PLAYER", "sitelinks": 400, "birth_year": 1985},
            "wikidata:Q8682": {"kind": "CLUB", "sitelinks": 200, "birth_year": None},
            "wikidata:Q999": {"kind": "PLAYER", "sitelinks": 9, "birth_year": None},
        },
        names=[
            ("wikidata:Q11571", "en", "Cristiano Ronaldo", "LABEL"),
            ("wikidata:Q11571", "ar", "كريستيانو رونالدو", "LABEL"),
            ("wikidata:Q11571", "en", "CR7", "ALIAS"),
            ("wikidata:Q8682", "en", "Real Madrid", "LABEL"),
            ("wikidata:Q8682", "ar", "ريال مدريد", "LABEL"),
            ("wikidata:Q999", "en", "Unknown Player", "LABEL"),
        ],
        spells=[Spell("s1", "wikidata:Q11571", "wikidata:Q8682", 2009, 2018, False)],
    )
    with connect_to_knowledge_base(url) as connection:
        apply_pending_migrations(connection)
        replace_knowledge_base_contents(connection, snapshot)
        refs = {item["externalRef"] for item in load_catalog_entries(connection)}
    assert refs == {"wikidata:Q11571", "wikidata:Q8682"}
