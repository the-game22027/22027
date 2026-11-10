# Content hash
> A fingerprint of the content that matters, used to tell "same" from "changed" without comparing every field.

**Problem:** the pipeline re-sends every question in each new bundle. The import must know which ones really changed, cheaply, for thousands of rows.

**How:**
- Pick the fields that matter: what the player sees and what decides correctness. Leave out metadata (review flags, provenance).
- Write them as **canonical JSON**: object keys sorted, options sorted by position, dates as ISO strings. Same content → same text → same hash, whatever order the fields came in.
- `sha256` of that text, stored in `questions.content_hash`. Re-import compares one string.
- The app computes it, not the pipeline: one implementation, and the app does not trust the sender.

**In our code:** `computeContentHash` in [question-content.ts](../../apps/backend/src/modules/question-bank/domain/question-content.ts), with tests next to it.

**Watch out:** adding a field to the hashed content changes every hash, so every question looks "changed" once. Do it on purpose, with a note.

**Check yourself:** why are review flags outside the hash?
<details><summary>Answer</summary>A review changes nothing a player sees. If it changed the hash, approving a published question would create a new version for no reason.</details>
