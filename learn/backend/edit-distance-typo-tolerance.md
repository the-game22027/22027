# Edit distance for typo tolerance
> Count the smallest number of one-letter edits that turn the typed text into the answer; accept it when that number is small for the name's length.

**Problem:** a player types `ميسب` for `ميسي`. Exact comparison calls a player who knows the answer wrong. Accepting "anything close" calls `تشابي` (Xabi Alonso) correct for `تشافي` (Xavi).

**How:**
- One edit = a letter added, missing, changed, or two neighbours swapped (optimal string alignment, a Levenshtein variant). `ميسب`, `مبسي`, `ميسيي` and `مسيي` are each 1 edit from `ميسي`.
- The budget grows with length (`answers.typoTolerance`): up to 3 letters exact, 4-7 letters 1 edit, 8+ letters 2 edits. One edit on a 3-letter name often makes another real name.
- Compare only with the round's accepted answers, never with the whole catalog: "is this the right answer?" is easy, "which player did they mean?" is not.
- Guard first: text that is exactly another entity's name is wrong, even if it is one edit from the answer.
- Stop counting early: once every cell of a row is over the budget, the answer is "too far".

**In our code:** `countEditsUpTo`, `findClosestAcceptedAnswer` in [typed-text-judgement.ts](../../apps/backend/src/modules/question-bank/domain/typed-text-judgement.ts); the order of checks in `judgeTypedText` in [answer-checker.ts](../../apps/backend/src/modules/question-bank/application/answer-checker.ts).

**Watch out:**
- Count letters as code points (`[...text]`), not UTF-16 units, or some characters count twice.
- Defaults must be checked against the real examples. The first default (4 letters exact) refused `ميسي` with one typo, the very case it was meant to accept.

**Check yourself:** why is the exact-match guard checked before the typo step, not after it?
<details><summary>Answer</summary>If the typo step ran first, `تشابي` would already be accepted as one edit from `تشافي`. An exact name of someone else is stronger evidence than closeness to the answer.</details>
