# Localize per viewer
> One event, sent to several people, each in their own language: build the text per viewer at the last moment.

**Problem:** an Arabic player and an English player share a battle. The rules know only "step 2 was revealed"; a Career step is a club and two years, and the club's name exists in both languages. Text built once would be wrong for one of them.

**How:**
- Content stores facts, not sentences: a Career spell is `{clubEntityId, fromYear, toYear, loan}`.
- At round start the engine loads the names it needs (one query) and renders every step for each locale in the battle: `Sporting CP (2002–2003)` / `سبورتينغ لشبونة (2002–2003)`.
- Each emit takes a function `viewer → data`, so every player gets their own text under the same `seq`.
- Small fixed words ("present", "loan") live in one table per locale next to the renderer.

**In our code:** [reveal-steps.ts](../../apps/backend/src/modules/battles/application/reveal-steps.ts), `emit(type, dataFor)` in [live-battle.ts](../../apps/backend/src/modules/battles/application/live-battle.ts).

**Watch out:**
- Every locale must have the same number of steps, or one player sees more of the question (08 §3.1). The import checks Buzzer steps; Career steps are equal by construction.
- Arabic numbers in text: we keep Latin digits (2002), which every Arabic football app uses and the search normalizes anyway.

**Check yourself:** why not store the rendered Arabic and English text in the bundle?
<details><summary>Answer</summary>A renamed club (a new short name) would need every Career round regenerated. Rendering from the catalog picks up the new name at the next round.</details>
