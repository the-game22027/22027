# Immutable served content
> Once something may have reached users, never edit it in place: retire it and add a new version.

**Problem:** a battle stores "round 3 = question X, you picked option Y, correct". If question X's text or correct option is edited later, that history now says something that never happened.

**How:**
- Never published → nobody saw it → replace its content in place (same id).
- Published at least once → mark the old row `DISABLED` (reason `SUPERSEDED`) and insert a new row with `key_version + 1`.
- Same `external_key` + `key_version` is unique, so "the latest version" is the highest number.
- Old rows stay forever, so old battles still point at what was really shown.

**In our code:** `decideImportAction` in [import-decision.ts](../../apps/backend/src/modules/question-bank/domain/import-decision.ts); rules in `docs/architecture/07-football-data-and-questions.md` §5.5.

**Watch out:** "could have been served" is judged by `published_at`, not by answer statistics: stats arrive only after a battle ends, so a battle running right now would be missed.

**Check yourself:** a published question has a typo in its Arabic text. What happens on the next import?
<details><summary>Answer</summary>The text is content, so the hash changes: the old version is disabled and version 2 is inserted (APPROVED only if the bundle marks every locale of the new text as reviewed, else DRAFT).</details>
