# ADR-0022: Multi-source knowledge base: claims, coverage windows and conflict resolution

- **Status:** Accepted (product owner, 2026-11-18; source licences stay Pending in DEC-66)
- **Date:** 2026-11-18
- **Related:** DEC-66, DEC-67, DEC-55; ADR-0005, ADR-0007; `07-football-data-and-questions.md` §4, §5.10

## Context
D.1 loaded one source (Wikidata) and stored its statements directly (07 §4.2). The new game types need match facts: finals, scorers, lineups, shootouts, coaches, venues. No single open source has them all:

| Source | Strong at | Coverage |
|---|---|---|
| Wikidata | entities, careers, Arabic names, other sources' ids | all time |
| Transfermarkt datasets (dcaribou) | club and national matches, events with assists, lineups with captain and shirt number, transfers, coaches | 2012 → 2026-07-06 (frozen) |
| Fjelstul World Cup DB | men's World Cups: stages, lineups, shirt numbers, awards, coaches | 1930 → 2022 |
| martj42 international results | every national-team result, scorers, shootouts | 1872 → 2026-10 |
| openfootball | Champions League fixtures and results | 2011-12 → 2025-26 |
| xgabora club match data | league results only, no players | 2000 → 2026 |

These sources overlap and sometimes disagree. Some disagreements are real (a goal credited to a player in one source and as an own goal in another). Most are coverage gaps: Fjelstul ends at 2022, so its "5 World Cups" for Cristiano Ronaldo is not a vote against a 2026 appearance. A wrong fact in a typed-answer game means an honest player loses a point, so a conflict must never reach a question unnoticed.

## Decision
1. **Every source row becomes a claim.** A claim keeps its source, the source's own row id, the source snapshot (file checksum and download date), its licence, and the fact it asserts. Sources are never edited and claims are never overwritten.
2. **Only atomic facts are stored.** We store "played match M", "scored in match M at minute X", "won edition E". Totals ("6 World Cups", "5 titles") are always computed by us from atomic facts, never imported.
3. **Every source declares coverage windows**: which competitions and which dates it covers, in the source registry. Outside its window a source is silent. **Missing data is not evidence**: a source that does not cover an event can neither confirm nor deny it.
4. **One id per thing.** Every source id is mapped to one Wikidata entity in `core.entity_xref`. Exact id links first (Wikidata stores Transfermarkt ids; Fjelstul stores Wikipedia links); name matching is only a fallback, and every uncertain match goes to a review file. A fact whose entities are not linked never becomes a question (DEC-55).
5. **Resolution per fact:**
   - two or more sources agree → `VERIFIED`;
   - one source, and no other source covers the event → `SINGLE_SOURCE`, usable only when that source is trusted for that fact type (precedence table in 07 §5.10);
   - sources that both cover the event disagree → `CONFLICT`. The precedence table picks a provisional value, but **a `CONFLICT` fact is never used for questions** until a reviewed override settles it.
6. **Reviewed overrides win over every source** (`data/kb_overrides/`, with reviewer and date), as names already do (07 §4.2).
7. **Every pipeline run reports conflicts per source pair.** A sudden jump means the linking step broke, not that football changed.

## Alternatives considered
| Option | Why not |
|---|---|
| Last write wins (load sources in a fixed order, later rows overwrite earlier ones) | Hides conflicts; a stale source loaded last silently corrupts good facts |
| One "master" source, others only fill gaps | No source is strongest everywhere (Fjelstul beats Transfermarkt on World Cup lineups, Transfermarkt beats everyone on club matches) |
| Store totals as given by each source | Totals are where stale sources disagree most; computing them from atomic facts removes the whole class of conflict |
| Majority vote across all sources | Counts silent sources as votes; with coverage windows the honest vote is usually one or two sources |

## Consequences
- **+** Conflicts are visible and countable; stale sources cannot overwrite fresh facts; totals stay consistent with the matches behind them.
- **+** Licences can be filtered later: every fact knows which sources back it, so dropping one source (DEC-66) is a rebuild, not a rewrite.
- **−** More tables and a resolution step: about 2 extra days inside D.3, and the linking step becomes the critical path.
- **−** Single-source facts from untrusted fact types are thrown away, which lowers counts. Counts are reported after resolution and dedupe, per tier (DEC-67).
- **Revisit** if a paid, licensed provider replaces the open sources (it would become one more source with the highest precedence), or if conflict volume stays near zero for every source pair (the resolution step could then be simplified).
