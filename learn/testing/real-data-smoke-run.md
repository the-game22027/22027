# Real-data smoke run
> Run the whole pipeline once on real data and let the strictest step judge it; fixtures only test the cases you thought of.

**Problem:** every unit test of the generators passed. The first real bundle was still refused: Wikidata lists a few players as members of the *country* Brazil instead of the national team, so Brazil was stored as a club, and a "which country" round had a club as its answer.

**How:**
- Generate from the real knowledge base, then import into a throwaway database with the real importer.
- The importer re-checks everything (kinds, giveaways, step counts) and refuses the whole bundle, with line numbers.
- Turn each finding into a fix at the source (scope config) and a guard at the producer (kind-aware lookups), plus a test.
- Keep the run cheap: cached Wikidata responses, about 8 s to generate, 5 s to import.

**In our code:** the fix in [scope.toml](../../data/config/scope.toml) (`Q6256`, `Q3624078`); the guard `_names_lookup` in [bundle.py](../../data/kb/bundle.py); the checks it hit in `findCatalogReferenceProblems` ([question-rules.ts](../../apps/backend/src/modules/question-bank/domain/question-rules.ts)).

**Watch out:**
- Do not loosen the importer to let the data through. It refused correctly; the data was wrong.
- Two checks at two ends is not waste: the producer drops bad rounds quietly, the consumer refuses loudly if one slips through.

**Check yourself:** why not fix Brazil by hand in the database?
<details><summary>Answer</summary>The next ingest rebuilds the database from Wikidata and the mistake comes back. A fix in the scope config survives every rebuild.</details>
