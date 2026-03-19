# Repo Hygiene Checklist

Use this checklist to keep branch, PR, and merge flow clean and predictable.

## Start A Task

Always start from an updated `main`:

```bash
git switch main
git pull --ff-only
git switch -c codex/<task-name>
```

Rules:

- One task, one branch.
- Keep branch names short and descriptive.
- Do not start new work on an old feature branch.

## While Working

Keep the branch disciplined:

- Do not mix unrelated edits into the same branch.
- Commit coherent changesets, not arbitrary file piles.
- Update docs and repo contract files when behavior, CI, or workflow changes.
- Check `git status` often so surprises do not accumulate.

## Verify Before Push

Run the authoritative local checks from the repo root:

```bash
npm run check
npm run smoke
npm run smoke:web
git status
```

Before pushing, confirm:

- The worktree contains only intentional changes.
- The branch still matches the task.
- The commits tell one story.
- CI and docs still match the actual command contract.

## Open A PR

```bash
git push -u origin codex/<task-name>
gh pr create
```

Before merge:

- Wait for required checks to pass.
- Do not bypass branch protection unless there is a real operational reason.
- Ensure required approvals are in place.

## After Merge

Return to the mainline immediately:

```bash
git switch main
git pull --ff-only
git branch -d codex/<task-name>
```

If the remote branch still exists:

```bash
git push origin --delete codex/<task-name>
```

## Red Flags

Stop and clean up before pushing if:

- `git status` shows files you did not expect.
- `package-lock.json` changed and you cannot explain why.
- CI check names do not match branch protection names.
- You are still on a feature branch after the PR is merged.
- You are about to include “just one more” unrelated edit.

## Good Resting State

The repo is in good shape when:

- You are on `main`.
- `git status` is clean.
- `git pull --ff-only` works on `main`.
- No stale local feature branches are hanging around without purpose.
