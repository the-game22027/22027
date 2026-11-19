# One record from several sources
> When two sources describe the same thing, pick one by a fixed priority, and refuse both when they disagree.

**Problem:** a World Cup final can have a lineup from Transfermarkt and one from Fjelstul. Storing both doubles every player in the game; mixing them row by row builds an XI that neither source ever published.

**How:**
- Group by the thing itself, not by the source: one group per (match, team).
- A fixed **source priority**: Transfermarkt first (it has the captain and finer positions), Fjelstul second.
- A **disagreement gate** before choosing: if both name different starters, keep neither and write the case to a review file. A wrong XI in a quiz is worse than a missing one.
- Only explainable differences pass: a starter missing on one side is fine when that side has an unlinked starter (the same player, not linked there).

**In our code:** `choose_one_lineup_per_team` and `do_lineups_name_different_starters` in [lineups.py](../../data/kb/lineups.py); the review rows go to `.out/review-lineups.csv`.

**Watch out:**
- The gate only runs when sources overlap. Today they share no World Cup lineup, so "0 disagreements" proves nothing yet: measure the overlap before you trust the number.
- Keep the source and licence on every stored row, so one source can be dropped later with a rebuild (ADR-0022).

**Check yourself:** why not take the starters both sources agree on and fill the rest from the first one?
<details><summary>Answer</summary>That creates an XI no source published. When they disagree you do not know which one is right, so the honest answer is "unknown" plus a review row, not a blend.</details>
