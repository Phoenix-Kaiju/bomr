# GitHub Ruleset Baseline

This repo uses GitHub rulesets to enforce the same harness contract documented in `README.md`, `AGENTS.md`, and `docs/environment.md`.

## Target Branch

Apply the baseline ruleset to `main`.

Do not apply the same restrictions to `codex/**` working branches. Those branches should stay cheap to create and cheap to update.

## Required Baseline

- Require pull requests before merge.
- Require 1 approving review.
- Dismiss stale approvals when new commits are pushed.
- Block force pushes.
- Block branch deletion.
- Do not allow bypass for admins unless there is a deliberate operational reason.
- Require these status checks before merge:
  - `check`
  - `smoke`
  - `smoke-web`

These required checks map directly to the authoritative CI workflow in `.github/workflows/verify.yml`:

- `check`: `npm run check`
- `smoke`: `npm run smoke`
- `smoke-web`: `npm run smoke:web`

## Optional Later

Only add these when the repo pressure justifies the extra friction:

- Require branches to be up to date before merge.
- Require linear history.
- Merge queue.
- Required deployments before merge.
- Signed commits.

## CODEOWNERS

Boundary ownership is documented in `AGENTS.md` and `docs/ownership.md` and is enforced by `.github/CODEOWNERS`.

Current owner:

- `@Phoenix-Kaiju`

If the repo later splits ownership by boundary, update `CODEOWNERS` to map those real teams or users directly.
