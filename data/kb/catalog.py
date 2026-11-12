"""Export the answer catalog (07 §5.4, 08 §5) and list entities that still miss a name."""

import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

import psycopg

from kb.normalize import matching_form_of_name

CATALOG_KINDS = ("PLAYER", "CLUB", "COUNTRY")
# Shorter words never count alone as an answer (ADR-0021).
NAME_WORD_MIN_LETTERS = 3


def load_catalog_entries(connection: psycopg.Connection) -> list[dict]:
    """Every entity with both an English and an Arabic label, ready to write as catalog lines."""
    rows = connection.execute(
        """SELECT e.external_ref, e.kind, e.sitelinks, n.locale, n.name, n.name_kind
           FROM core.entity e JOIN core.entity_name n USING (external_ref)
           WHERE e.kind = ANY(%s)
           ORDER BY e.external_ref, n.locale, n.name_kind DESC, n.name""",
        (list(CATALOG_KINDS),),
    ).fetchall()
    entries: dict[str, dict] = {}
    for external_ref, kind, sitelinks, locale, name, name_kind in rows:
        entry = entries.setdefault(
            external_ref,
            {
                "externalRef": external_ref,
                "kind": kind,
                "names": {},
                "aliases": {"en": [], "ar": []},
                "popularity": sitelinks,
            },
        )
        if name_kind == "LABEL":
            entry["names"][locale] = name
        else:
            entry["aliases"][locale].append(name)
    complete = [entry for entry in entries.values() if {"en", "ar"} <= entry["names"].keys()]
    for entry in complete:
        entry["search"] = search_forms_of_entry(entry)
    add_name_words(complete)
    return complete


def search_forms_of_entry(entry: dict) -> list[str]:
    """Distinct matching forms of every name and alias; what the app searches against (07 §5.7)."""
    names = [*entry["names"].values(), *entry["aliases"]["en"], *entry["aliases"]["ar"]]
    forms = []
    for name in names:
        form = matching_form_of_name(name)
        if form and form not in forms:
            forms.append(form)
    return forms


def name_words_of_entry(entry: dict) -> list[str]:
    """Distinct single words of the entity's names (not aliases), in matching form, long enough to count."""
    words = []
    for name in entry["names"].values():
        for word in matching_form_of_name(name).split(" "):
            if len(word) >= NAME_WORD_MIN_LETTERS and word not in words:
                words.append(word)
    return words


def add_name_words(entries: list[dict]) -> None:
    """Set `nameWords` on every entry: each word with how many entities of the same kind have it (ADR-0021).

    Counted over the whole catalog before a development bundle trims it, so `محمد` stays common.
    """
    words_by_entry = [name_words_of_entry(entry) for entry in entries]
    shared_by = Counter(
        (entry["kind"], word) for entry, words in zip(entries, words_by_entry, strict=True) for word in words
    )
    for entry, words in zip(entries, words_by_entry, strict=True):
        entry["nameWords"] = [{"form": word, "sharedBy": shared_by[(entry["kind"], word)]} for word in words]


def write_catalog_file(entries: list[dict], out_dir: Path) -> str:
    """Write catalog.jsonl (stable order, so the same data gives the same checksum). Returns the checksum."""
    out_dir.mkdir(parents=True, exist_ok=True)
    lines = [
        json.dumps(entry, ensure_ascii=False, sort_keys=True)
        for entry in sorted(entries, key=_entry_sort_key)
    ]
    content = ("\n".join(lines) + "\n").encode("utf-8")
    (out_dir / "catalog.jsonl").write_bytes(content)
    return "sha256:" + hashlib.sha256(content).hexdigest()


def write_entities_missing_a_name(connection: psycopg.Connection, locale: str, out_file: Path) -> int:
    """List catalog-kind entities without a label in `locale`, most popular first, for human review."""
    rows = connection.execute(
        """SELECT e.external_ref, e.kind, e.sitelinks,
                  (SELECT name FROM core.entity_name en
                   WHERE en.external_ref = e.external_ref AND en.locale = 'en' AND en.name_kind = 'LABEL') AS english
           FROM core.entity e
           WHERE e.kind = ANY(%s)
             AND NOT EXISTS (SELECT 1 FROM core.entity_name n
                             WHERE n.external_ref = e.external_ref AND n.locale = %s AND n.name_kind = 'LABEL')
           ORDER BY e.sitelinks DESC, e.external_ref""",
        (list(CATALOG_KINDS), locale),
    ).fetchall()
    out_file.parent.mkdir(parents=True, exist_ok=True)
    with out_file.open("w", encoding="utf-8", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(["external_ref", "kind", "sitelinks", "english_name", f"{locale}_name"])
        for external_ref, kind, sitelinks, english in rows:
            writer.writerow([external_ref, kind, sitelinks, english or "", ""])
    return len(rows)


def _entry_sort_key(entry: dict) -> tuple[str, int]:
    qid = entry["externalRef"].removeprefix("wikidata:Q")
    return (entry["kind"], int(qid) if qid.isdigit() else 0)
