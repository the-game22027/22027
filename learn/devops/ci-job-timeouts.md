# CI job timeouts
> Give every CI job a time limit a few times its normal run, so a stuck runner fails in minutes instead of hours.

**Problem:** on 2026-11-19 the backend `integration + e2e` job of PR #71 hung for more than an hour inside `test:integration`. The same suite passes locally in 62 s. GitHub's default limit is **6 hours**, so the PR stayed "pending" and blocked the merge with no error to read.

**How:** `timeout-minutes` on each job. When it runs out, GitHub cancels the job and marks it failed, so you see it at once and rerun it (`gh run rerun <id> --failed`).

| Job | Normal run | Limit |
|---|---|---|
| backend lint, types, unit, build | ~2.5 min | 15 |
| backend integration + e2e (Testcontainers) | ~3–4 min | 20 |
| mobile format, analyze, test, apk | ~9 min | 25 |
| data ruff, pytest | ~40 s | 10 |

**In our code:** `.github/workflows/backend-ci.yml`, `mobile-ci.yml`, `data-ci.yml`.

**Watch out:**
- Too tight a limit fails healthy runs on a slow day (a cold Docker image pull). Keep roughly 3–5× the normal time.
- A timeout hides *why* it hung. If one job keeps timing out, rerun it with debug logging (`ACTIONS_STEP_DEBUG`) before raising the limit.

**Check yourself:** the hung job passed locally. Why does that point at the runner and not the code?
<details><summary>Answer</summary>The same command, on the same commit, finished in 62 s and exited cleanly (no open handles keeping Node alive). What differs is the environment: the runner's Docker or Testcontainers setup. A rerun on a fresh runner is the first fix.</details>
