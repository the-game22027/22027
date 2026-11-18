# COPY for bulk loads
> Postgres's own streaming loader: one command, millions of rows, no per-row INSERT.

**Problem:** 3.2 million Transfermarkt lineup rows as `INSERT` statements means 3.2 million round trips and parses. Even batched with `executemany`, it takes minutes.

**How:**
- `COPY raw.x (col_a, col_b) FROM STDIN (FORMAT csv)`: the client streams the file's text, the server parses CSV itself.
- psycopg 3: `with cursor.copy(statement) as copy: copy.write(chunk)`, reading the file in 1 MB chunks, so memory stays flat.
- In CSV format an unquoted empty field becomes `NULL`, a quoted `""` stays an empty string.
- Build the statement with `psycopg.sql.Identifier` for table and column names: they come from a file header, so they are never pasted into SQL as plain strings.

**In our code:** `load_file_into_raw` in [sources.py](../../data/kb/sources.py): all 26 source files, 4.9 M rows, load in about 24 seconds.

**Watch out:** one bad row aborts the whole `COPY` (and its transaction). Good for raw data: the table is either complete or untouched.

**Check yourself:** when is `bulk-upsert-with-unnest` the better tool than COPY?
<details><summary>Answer</summary>When rows must be merged into a table that already has data (`ON CONFLICT DO UPDATE`). COPY only appends; it has no conflict handling. We use it on a fresh table.</details>
