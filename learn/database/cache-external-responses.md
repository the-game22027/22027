# Cache what an external service answered
> Store every response from a slow or rate-limited source, keyed by the exact request, so re-runs are fast, offline and repeatable.

**Problem:** the Wikidata ingest sends hundreds of queries. Re-running after a code fix would hammer a free public service, take many minutes, and could give different results if Wikidata was edited in between.

**How:**
- Key = a hash of the exact query text; value = the raw response; plus when it was fetched.
- Before calling the service, look in the cache. A hit means no network at all.
- `--refresh` ignores the cache when you really want fresh data.
- Shape the data **after** the cache: changing a filter in Python re-runs instantly on the cached responses.

**In our code:** `raw.sparql_cache` in `football_kb`, read and written by `WikidataClient.select_rows` ([data/kb/wikidata.py](../../data/kb/wikidata.py)).

**Watch out:**
- Changing one character of a query is a new key, so it is fetched again. That is correct, but it means formatting changes cost a full re-download.
- A cache is a snapshot in time. Record when you fetched it, so you know how old your facts are.

**Check yourself:** why store the raw response instead of the cleaned rows?
<details><summary>Answer</summary>So fixing a cleaning bug (like the youth-team filter) never needs a new download: the raw answers are re-processed with the new rules.</details>
