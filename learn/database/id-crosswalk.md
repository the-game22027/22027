# Id crosswalk
> A table that maps each outside system's id for a thing to our one id for it.

**Problem:** Transfermarkt calls Cristiano Ronaldo `8198`, Fjelstul `P-70442`, martj42 just "Cristiano Ronaldo", and we call him `wikidata:Q11571`. Without one shared id, the same goal arrives three times as three different players, and an answer judged by entity id (DEC-55) can't be checked.

**How:**
- `core.entity_xref (source, source_kind, source_id) → entity_ref`, one row per outside id.
- The kind is part of the key: Transfermarkt player 418 and club 418 are different things.
- Exact links first. Wikidata stores other sites' ids (`P2446` Transfermarkt player, `P7223` team), so a lookup `?item wdt:P2446 "8198"` gives the item with no guessing.
- Name matching only as a fallback, and uncertain names go to a human review file.
- One outside id held by two Wikidata items is ambiguous: left unlinked and counted, never guessed.

**In our code:** `link_transfermarkt` and `find_wikidata_items_by_external_id` in [linking.py](../../data/kb/linking.py); [0003_entity_xref.sql](../../data/kb_migrations/0003_entity_xref.sql).

**Watch out:** links point at entities, so rebuilding `core.entity` (`kb ingest`) clears them. Run `kb link` after every ingest; it reads from the SPARQL cache, so it is quick.

**Check yourself:** why not link Transfermarkt players by name and birth date, which Transfermarkt also has?
<details><summary>Answer</summary>Names are spelled differently across sites and languages, and two players can share a name and a birthday. An id that Wikidata editors already matched by hand is exact; names are a fallback for sources that have no ids.</details>
