# Continuous integration (CI)
> Every PR runs lint, types, boundaries, tests and the build on a clean machine.

**Problem:** "works on my machine" (different Node version, forgot to run tests, unformatted code) reaches `main` and breaks everyone.

**How:**
- GitHub Actions runs [backend-ci.yml](../.github/workflows/backend-ci.yml) on every PR and on pushes to `main`.
- **Path filters:** the backend job runs only when `apps/backend/**` changes; the mobile app gets its own job later.
- Two jobs in parallel: fast checks (lint, types, boundaries, unit, build) and integration + e2e with Docker.
- Node version comes from `.node-version`, the same file you use locally.
- Dependabot opens PRs for dependency updates.

**In our code:** [.github/workflows/backend-ci.yml](../.github/workflows/backend-ci.yml), [.github/dependabot.yml](../.github/dependabot.yml).

**Watch out:** if CI is red, fix it before anything else. A red build that everyone ignores is worse than no CI.

**Check yourself:** CI vs CD?
<details><summary>Answer</summary>CI checks every change automatically. CD also ships it automatically: delivery means a release is always ready to deploy; deployment means it actually goes live. We do CI now and CD at release.</details>
