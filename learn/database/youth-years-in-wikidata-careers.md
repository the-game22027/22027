# Youth years hiding in Wikidata careers
> A "played for" fact can be a 4-year-old in the academy. Clip careers to senior age before you build questions from them.

**Problem:** Wikidata often stores a player's youth years on the senior club's item, with no "youth team" marker. Marc-André ter Stegen (born 1992) has Borussia Mönchengladbach "1996–2010", then 2011–2014. The first `dev-0006` build put him in "Gladbach · 1990s", a wrong answer the game would accept.

**How:** a spell counts only from the year the player turned 17 (`SENIOR_FROM_AGE`):
- for a decade, the spell starts at `max(from_year, birth_year + 17)`;
- a spell that ended before that age puts the player in no category at all;
- with no birth year, the spell stays as it is (no data, so no clipping).

**In our code:** `has_spell_ended_before_senior_age` and `decades_of_spell` in [mines.py](../../data/kb/mines.py), tests in `data/tests/test_mines.py`; rule in `docs/architecture/08-battle-games.md` §10.4.

**Watch out:**
- 17 is a heuristic: a 16-year-old debut is lost for that year, and a late youth spell can slip in. It removes the big errors (years of academy football), not every edge case.
- Spot-check generated content by reading samples: unit tests pass on rules you wrote, and real data breaks rules you never thought of.

**Check yourself:** why read 10 generated rounds by eye when all tests pass?
<details><summary>Answer</summary>Tests check the rules as written. Only real data shows a rule is missing: no test knew Wikidata mixes academy years into senior spells until a sample showed ter Stegen in the 1990s.</details>
