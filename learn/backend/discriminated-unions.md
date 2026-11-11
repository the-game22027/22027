# Discriminated unions (one shape per kind)
> A type that is "one of these shapes", where a shared field (the discriminant) says which one.

**Problem:** a round of content can be a Buzzer (question steps), a Career (clubs and years) or a Grid (rows and columns). One big object with every field optional would let a Career row have steps, or a Grid have no rows, and nothing would complain.

**How:**
- One type per shape, each with a literal tag: `{ gameType: 'CAREER'; player; spells }`, `{ gameType: 'GRID'; rows; cols }`...
- `type GameBody = BuzzerBody | CareerBody | ...`.
- `switch (body.gameType)` narrows the type in each branch: inside `case 'CAREER'` TypeScript knows `body.spells` exists.
- With every case handled and a return type declared, adding a fifth game makes the compiler point at every switch that forgot it.

**In our code:** `GameBody` and `QuestionContent` in [question-content.ts](../../apps/backend/src/modules/question-bank/domain/question-content.ts); the parser picks one zod schema per `gameType` in [bundle-parser.ts](../../apps/backend/src/modules/question-bank/application/bundle-parser.ts).

**Watch out:**
- Changing the union broke old code that read `content.options` directly. That is the point: it now has to check `content.type === 'SINGLE_CHOICE'` first.
- Validate untrusted JSON per shape (zod) before trusting the tag.

**Check yourself:** what happens when someone adds `IMPOSTER` to `GameBody` but forgets `localesOfQuestion`?
<details><summary>Answer</summary>The switch no longer returns on every path, so `tsc` fails with "function lacks ending return statement" and names the function.</details>
