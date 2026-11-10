# Question bundles

Each folder is one bundle: `manifest.json` + `questions.jsonl`. The format is the contract between the
Python pipeline and the app (`docs/architecture/07-football-data-and-questions.md` §5.4-5.5).

Import one into the app database (from `apps/backend`):

```bash
npm run cli -- questions:import ../../data/bundles/dev-0001
```

Importing the same bundle twice changes nothing. A bundle version is never reused: a changed bundle gets a new folder and a new `bundleVersion`.

## dev-0001

50 hand-written questions in English and Arabic (World Cup, Euros, Champions League, Ballon d'Or), for development before the generated bank exists. Facts are historical and fixed, so none of them expire. World Cup facts were checked against `openfootball/worldcup` (CC0).

Every question imports as `DRAFT` because no person has reviewed them yet. To record a review, set `HUMAN_REVIEWED` and `BUNDLE_VERSION` in `data/generate/dev_bundle.py`, run `python3 -I data/generate/dev_bundle.py` from the repository root, and import the new folder: reviewed drafts become `APPROVED` without changing their content.
