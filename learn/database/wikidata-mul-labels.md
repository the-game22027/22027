# Wikidata "mul" labels
> `mul` is Wikidata's "same name in every language" label; an item can have it and no `en` label at all.

**Problem:** our queries kept only `en` and `ar` labels. Items whose name is stored once under `mul` came back with no English name: the player was missing from the catalog, and a reserve side like "Ajax II" had no label, so the youth/reserve pattern could not drop it.

**How:**
- Ask for `FILTER(lang(?name) IN ("en", "ar", "mul"))`.
- Decide per item: an `en` label wins; without one, the `mul` label and aliases are stored as English.
- Never store `mul` as a locale: the game only knows `en` and `ar`.
- The same fallback feeds the team label that the senior-club filter checks.

**In our code:** `names_from_rows` and `fetch_team_facts` in [data/kb/ingest.py](../../data/kb/ingest.py); tests in [data/tests/test_names.py](../../data/tests/test_names.py).

**Watch out:**
- An `en` alias can have the same text as the promoted `mul` label. `(entity, locale, name)` is unique and inserts use `ON CONFLICT DO NOTHING`, so whichever row comes first wins: drop the alias, keep the label.
- A label pattern needs exceptions: "Willem II" and "Boca Juniors" are real clubs, so they sit in `allowed_team_ids` in `config/scope.toml`.

**Check yourself:** an item has `mul` label "Lionel Messi" and `en` alias "Leo", no `en` label. What do we store?
<details><summary>Answer</summary>English label "Lionel Messi" (promoted from `mul`) and English alias "Leo".</details>
