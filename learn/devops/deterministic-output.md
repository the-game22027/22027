# Deterministic output
> The same input always gives the same bytes, so a checksum tells "changed" from "unchanged".

**Problem:** the app identifies a bundle by its checksum, and a version may never be reused with different content. If the generator picked rounds at random, or wrote rows in database order, two runs on the same data would give different checksums: noisy git diffs, and "changed" bundles that changed nothing.

**How:**
- No randomness: pick by popularity with a fixed tie-break (the Wikidata number).
- Sort everything you write: lines by `externalKey`, catalog by kind and number, JSON keys with `sort_keys=True`.
- No timestamps in the output. The `kbVersion` is the ingest date, which is a fact of the input.
- Test it: generate twice and compare the bytes.

**In our code:** `build_bundle` and `pick_spread_over_difficulties` in [bundle.py](../../data/kb/bundle.py) and [generate.py](../../data/kb/generate.py); `write_catalog_file` in [catalog.py](../../data/kb/catalog.py).

**Watch out:**
- A Python `set` has no stable order between runs for strings (hash randomization). Sort before writing.
- Selection by "most popular first" is deterministic, but it repeats the same famous players. Variety comes from more templates, not randomness.

**Check yourself:** where is randomness fine?
<details><summary>Answer</summary>At play time: `ORDER BY random()` when a battle picks its rounds. The bundle is a stored artifact; the battle is a one-off event.</details>
