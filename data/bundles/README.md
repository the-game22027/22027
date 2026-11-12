# Question bundles

Each folder is one bundle: `manifest.json`, `questions.jsonl` and optionally `catalog.jsonl`. The format is the contract between the Python pipeline and the app (`docs/architecture/07-football-data-and-questions.md` §5.4-5.5).

Import one into the app database (from `apps/backend`):

```bash
npm run cli -- questions:import ../../data/bundles/dev-0004
npm run cli -- questions:publish dev-0004 --include-drafts   # development only: the rounds are unreviewed
```

Importing the same bundle twice changes nothing. A bundle version is never reused: a changed bundle gets a new folder and a new `bundleVersion`.

## dev-0004 (use this one)

Like dev-0003, plus 19 `GRID` boards (3 clubs × 3 nationalities, 07 §5.8), spread over difficulties 1-4: 199 rounds, catalog of 7,247 entities (grid cells list every valid player, so many more players are referenced).

## dev-0003

Like dev-0002, plus 60 `WHO_IS_PLAYER` rounds (07 §5.8): 180 rounds, catalog of 3,838 entities. Importing it over dev-0002 keeps the 120 shared rounds and moves them to dev-0003, so publishing dev-0003 covers all 180.

## dev-0002

Generated from `football_kb` (07 §5.8): 60 `CAREER` and 60 `BUZZER` rounds (first club, joined in year, nationality), spread over difficulties 1-5, with a development catalog of 3,831 players, clubs and countries (popular players and everything they point at). Rebuild it from `data/` after a new ingest, with a new version:

```bash
.venv/bin/python -m kb bundle --version dev-0005 --out bundles/dev-0005 --careers 60 --buzzers 60 --who 60 --grids 30 --catalog-min-player-sitelinks 40
```

The same knowledge base and arguments give the same bytes. Every round is `DRAFT`: no person has reviewed them yet, so publish them with `--include-drafts`, which production refuses.

## dev-0001 (legacy)

50 hand-written multiple-choice questions (World Cup, Euros, Champions League, Ballon d'Or). Battles no longer play multiple choice (ADR-0015), so nothing picks them; they stay as a fixture for the importer. Every question is `DRAFT`.
