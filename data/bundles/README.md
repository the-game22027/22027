# Question bundles

Each folder is one bundle: `manifest.json`, `questions.jsonl` and optionally `catalog.jsonl`, `links.jsonl` and `link-matches.jsonl` (the `ONE_TWO` link graph). The format is the contract between the Python pipeline and the app (`docs/architecture/07-football-data-and-questions.md` §5.4-5.5).

Import one into the app database (from `apps/backend`):

```bash
npm run cli -- questions:import ../../data/bundles/dev-0012
npm run cli -- questions:publish dev-0012 --include-drafts   # development only: the rounds are unreviewed
```

Importing the same bundle twice changes nothing. A bundle version is never reused: a changed bundle gets a new folder and a new `bundleVersion`.

## dev-0012 (use this one)

dev-0011 plus **40 `BRIDGE` boards** (08 §16.4): 4 × 4 boards of the 60 most popular catalog clubs, every neighbouring pair with at least 3 common scorers in the bundle's own link graph. 549 rounds; the catalog and the 22,876-link graph are the same as dev-0011. Because this graph links only players with 60+ sitelinks, the boards come out hard (difficulty 3–5: 6, 15, 19); boards from the full graph spread over 1–5.

```bash
.venv/bin/python -m kb bundle --version dev-0012 --out bundles/dev-0012 --careers 60 --buzzers 60 --who 60 --grids 30 --mines 40 --auctions 60 --vaults 60 --hexes 30 --lineups 60 --one-twos 60 --bridges 40 --links-min-player-sitelinks 60 --catalog-min-player-sitelinks 40
```

## dev-0011

Every game type so far: 60 `CAREER`, 60 `BUZZER`, 60 `WHO_IS_PLAYER`, 19 `GRID`, 40 `MINES`, 60 `AUCTION`, 60 `VAULT`, 30 `HEX`, 60 `LINEUP` and 60 `ONE_TWO` seeds (509 rounds), a catalog of 8,187 entities, and a link graph of 22,876 links between players with 60+ sitelinks and clubs (08 §15.4). Importing it replaces the app's whole link graph. dev-0008 to dev-0010 are the same without the later game types.

```bash
.venv/bin/python -m kb bundle --version dev-0011 --out bundles/dev-0011 --careers 60 --buzzers 60 --who 60 --grids 30 --mines 40 --auctions 60 --vaults 60 --hexes 30 --lineups 60 --one-twos 60 --links-min-player-sitelinks 60 --catalog-min-player-sitelinks 40
```

## dev-0007

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
