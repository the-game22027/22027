# Question bundles

Each folder is one bundle: `manifest.json`, `questions.jsonl` and optionally `catalog.jsonl`. The format is the contract between the Python pipeline and the app (`docs/architecture/07-football-data-and-questions.md` §5.4-5.5).

Import one into the app database (from `apps/backend`):

```bash
npm run cli -- questions:import ../../data/bundles/dev-0007
npm run cli -- questions:publish dev-0007 --include-drafts   # development only: the rounds are unreviewed
```

Importing the same bundle twice changes nothing. A bundle version is never reused: a changed bundle gets a new folder and a new `bundleVersion`.

## dev-0007 (use this one)

Like dev-0006, plus **60 `AUCTION` rounds**: each a lot of 3 lists (a club's scorers or assist providers in one competition season, 6-30 names, every name in the catalog; 08 §11.4), built from the goals of `core.goal`. 299 rounds, catalog of 7,946 entities.

```bash
.venv/bin/python -m kb bundle --version dev-0007 --out bundles/dev-0007 --careers 60 --buzzers 60 --who 60 --grids 30 --mines 40 --auctions 60 --catalog-min-player-sitelinks 40
```

## dev-0006

Built from the knowledge base rebuilt on 2026-11-19 (`mul` names, cities out of careers): 60 `CAREER`, 60 `BUZZER`, 60 `WHO_IS_PLAYER`, 19 `GRID` and **40 `MINES`** categories (a club plus a citizenship or a decade, 20-40 players each, from the 100 most popular clubs; 08 §10.4). 239 rounds, catalog of 7,791 entities.

```bash
.venv/bin/python -m kb bundle --version dev-0006 --out bundles/dev-0006 --careers 60 --buzzers 60 --who 60 --grids 30 --mines 40 --catalog-min-player-sitelinks 40
```

## dev-0005

The same 199 rounds as dev-0004; its catalog lines carry `nameWords` (ADR-0021), so a distinctive first or last name alone is accepted when typed (`ليونيل` for Messi). Importing it over dev-0004 keeps every round and moves them to dev-0005.

## dev-0004

Like dev-0003, plus 19 `GRID` boards (3 clubs × 3 nationalities, 07 §5.8), spread over difficulties 1-4: 199 rounds, catalog of 7,247 entities (grid cells list every valid player, so many more players are referenced).

## dev-0003

Like dev-0002, plus 60 `WHO_IS_PLAYER` rounds (07 §5.8): 180 rounds, catalog of 3,838 entities. Importing it over dev-0002 keeps the 120 shared rounds and moves them to dev-0003, so publishing dev-0003 covers all 180.

## dev-0002

Generated from `football_kb` (07 §5.8): 60 `CAREER` and 60 `BUZZER` rounds (first club, joined in year, nationality), spread over difficulties 1-5, with a development catalog of 3,831 players, clubs and countries (popular players and everything they point at). Rebuild it from `data/` after a new ingest, with a new version:

```bash
.venv/bin/python -m kb bundle --version dev-0006 --out bundles/dev-0006 --careers 60 --buzzers 60 --who 60 --grids 30 --catalog-min-player-sitelinks 40
```

The same knowledge base and arguments give the same bytes. Every round is `DRAFT`: no person has reviewed them yet, so publish them with `--include-drafts`, which production refuses.

## dev-0001 (legacy)

50 hand-written multiple-choice questions (World Cup, Euros, Champions League, Ballon d'Or). Battles no longer play multiple choice (ADR-0015), so nothing picks them; they stay as a fixture for the importer. Every question is `DRAFT`.
