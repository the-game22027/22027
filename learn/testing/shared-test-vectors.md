# Shared test vectors
> When two implementations must agree, give both the same table of inputs and expected outputs, and run it in both test suites.

**Problem:** Python normalizes catalog names (`الأهلي` → `اهلي`) and TypeScript normalizes what the player types. If one side drops `ال` and the other does not, a correct answer never matches, and no test on either side alone notices.

**How:**
- Write the rules once in the docs with a table of vectors (`07` §5.7).
- Copy the same vectors into each suite: [test_normalize.py](../../data/tests/test_normalize.py) and [name-normalizer.spec.ts](../../apps/backend/src/modules/question-bank/domain/name-normalizer.spec.ts).
- A change to the rules changes the docs table and both suites in the same PR.

**In our code:** [kb/normalize.py](../../data/kb/normalize.py) and [name-normalizer.ts](../../apps/backend/src/modules/question-bank/domain/name-normalizer.ts).

**Watch out:**
- Languages differ in details: Python's `str.lower()` and JavaScript's `toLowerCase()`, Unicode mark classes, regex ranges. Put the tricky cases in the vectors (accents, tashkeel, tatweel, Arabic digits).
- An editor or tool can turn `\u0640` into an invisible character. Keep escapes in source so a reviewer can see them.

**Check yourself:** why not have the server call the Python normalizer instead of keeping two?
<details><summary>Answer</summary>It runs on every typed answer, inside a timed battle. Calling another process or service adds latency and a failure point on the gameplay path. Two small pure functions held together by shared vectors are cheaper.</details>
