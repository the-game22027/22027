# ADR-0021: Typed text answers with typo tolerance, no suggestions

- **Status:** Accepted (product decision by the owner, 2026-11-12)
- **Date:** 2026-11-12
- **Related:** supersedes point 5 of ADR-0015; DEC-55 (changed), DEC-60; `08-battle-games.md` §5; `07` §5.7; `WEBSOCKET.md` §2-3; ROADMAP P6.6

## Context
DEC-55 (2026-11-10) chose suggestions: the app downloads an answer catalog, searches it while the player types, the player taps a suggestion and the client sends the entity id. The server and the catalog export were built that way (P5.2); the phone part was not built yet.

The product owner wants no suggestions on screen. The player types the answer and sends it. Small spelling mistakes must still count (`ميسب`, `مبسي`, `ميسيي` are Messi), and the first name alone must count when it is distinctive (`ليونيل` is Messi). Good typing UX is meant to be the product's edge, so the rule must stay simple for the player.

ADR-0015 rejected fuzzy free text because matching against the whole catalog is either too strict or too loose: two different players can be one typo apart. That objection holds for "which player did they mean?". It mostly disappears for "is this the right answer?": the server only has to compare the text with the few accepted answers of the current round.

## Decision
1. **The client sends the typed text** (`{ text }`, at most `answers.maxLength` characters). Numbers stay `{ number }`. Bots keep answering with entity ids inside the server.
2. **The server judges the text against the round's accepted answers only**, in this order:
   1. Normalize it with the rules of `07` §5.7. Empty after normalizing: rejected (`EMPTY_ANSWER`), no attempt used.
   2. **Exact match** with a form of an accepted answer: **correct**.
   3. **Exact match** with a full name or alias of **another** entity of the round's `answerKind`: **wrong**, and that entity is the shown wrong answer. This stops `تشابي` (Xabi Alonso) from passing as a typo of `تشافي` (Xavi).
   4. **Within the typo tolerance** of a form of an accepted answer: **correct**.
   5. Otherwise: **wrong**, and nothing is shown as the wrong answer.
3. **Forms of an entity:** its full names (`ar`, `en`), its aliases, and each single word of its names that is **distinctive**: at least 3 letters and shared by at most `answers.singleWordMaxSharedBy` entities of the same kind. `ليونيل` and `ميسي` count alone for Messi; `محمد` does not count alone for Mohamed Salah.
4. **Typo tolerance** is an edit distance in letters (one letter added, missing, changed, or two neighbours swapped counts as one edit), measured on the form's letter count without spaces. Defaults (owner, 2026-11-12): up to 4 letters exact, 5 to 8 letters 1 edit, 9 or more letters 2 edits. The numbers are configuration (`answers.typoTolerance`).
5. **`GRID`:** the cell's valid players are the accepted answers. If the text fits several, the server takes the closest, then one not used on this board, then the most popular. Fitting only used players gives `PLAYER_ALREADY_USED`.
6. **The raw text is never shown to other players.** A wrong answer is shown (DEC-60) only when it was an exact match of another entity (step 2.3). Free text from strangers would otherwise be an abuse channel.
7. **No catalog on the phone.** `GET /v1/answer-catalog` is removed. The catalog stays on the server for judging and for names in events.

## Alternatives considered
| Option | Why not |
|---|---|
| Keep suggestions (DEC-55 as decided) | Rejected by the product owner: no suggestions on screen |
| Resolve the text to one catalog entity first, then compare ids | Ambiguous names (`ليونيل` is Messi and Scaloni) would need a "be more specific" step, which is the friction the owner wants to avoid |
| Accept any single name word | Common names would win cheaply: `محمد` would be right for many Arab players |
| Fixed typo budget for every length | One edit on a 4-letter name often makes another real name |
| Phonetic matching (Soundex-like) for Arabic and Latin | More rules to maintain in two scripts; edit distance plus aliases covers the reported cases |

## Consequences
- \+ The app is simpler: a text field and a send button. No 2 MB download, no search code in Dart, one normalizer outside Python (TypeScript, on the server).
- \+ The accepted answers still never reach the phone.
- \+ Small typos no longer cost a round.
- − Spelling can decide a round again when the mistake is larger than the tolerance or the name is short. Aliases matter more: the pipeline must carry common Arabic spellings of foreign names (`ليفاندوفسكي` / `ليفاندوسكي`).
- − Typing a full name takes longer than tapping a suggestion. `answerWindowMs` and `turnMs` must be playtested with real typing.
- − Some lenient passes are possible: a typo of the right answer that is also close to a less known player. Accepted; the exact-match guard catches the clear cases.
- − The catalog import gets distinctive name words; the server needs an index to find exact matches of other entities.
- Revisit the tolerance numbers with the logged `match` kinds (exact, typo, other entity, none) after playtesting.
