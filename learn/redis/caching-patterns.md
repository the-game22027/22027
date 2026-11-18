# Caching patterns
> Keep a copy of an expensive answer close to the reader, and decide up front how it gets stale and refreshed.

**Problem:** the top of a busy leaderboard is read thousands of times a minute and changes a few times a minute. Every read hits Postgres.

**How:**
- **Cache-aside:** read cache → on miss, read the database, store with a TTL. Simple; the most common.
- **Write-through:** write the database and the cache together. Fresher, more code on every write.
- **Invalidation:** delete the key when the source changes, or accept staleness up to the TTL.
- **Stampede:** when a hot key expires, many requests miss at once and all hit the database. Fixes: a short lock so one request refreshes, or refresh a little before expiry.

**In our code:** not used yet, on purpose: "cache the first page of each board for ~30-60 s only when traffic justifies it" (`03` §5.4). The Python pipeline caches Wikidata responses on disk: [cache-external-responses](../database/cache-external-responses.md).

**Watch out:** a cache is a second copy. Never answer correctness questions from it (prediction lock, battle state); only display data.

**Check yourself:** which is safer to cache for 60 s: a leaderboard page, or "is this match still open for predictions"?
<details><summary>Answer</summary>The leaderboard page: being 60 s stale is harmless. The lock decides money-like outcomes and must come from the database clock at write time.</details>
