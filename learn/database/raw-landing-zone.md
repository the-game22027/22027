# Raw landing zone
> Store every outside file exactly as it arrived, with its checksum, before any cleaning.

**Problem:** if we clean while loading, a bug in the cleaning step destroys the original values. We can't tell whether a wrong fact came from the source or from our code, and we can't re-run the fix without downloading again (Transfermarkt data is frozen; the old file may be gone).

**How:**
- One `raw.<source>__<file>` table per file, every column `text`, created from the file's own header. No types, no filters.
- `raw.source_snapshot` records which bytes are loaded: source, URL, sha256, download time, row count, licence.
- Same sha256 as the last load → skip. New bytes → replace the table in one transaction.
- Every later step (linking, claims, typed tables) reads `raw.*`, never the internet.

**In our code:** `load_file_into_raw` in [sources.py](../../data/kb/sources.py); the registry in [sources.toml](../../data/config/sources.toml); [0002_raw_source_snapshot.sql](../../data/kb_migrations/0002_raw_source_snapshot.sql).

**Watch out:** `text` everywhere means `'116'` is a string. Casting happens in the next step, where a bad value becomes a reported error, not a crash halfway through a load.

**Check yourself:** why store the sha256 and not just the download date?
<details><summary>Answer</summary>The date says when we fetched, not what we got. Two downloads on different days can hold the same bytes (skip the reload), and one URL can serve different bytes on the same day (must reload). Only the checksum tells which.</details>
