# AGENTS

This repo is a single-app Expo workspace. Keep the top-level contract small, route work to one primary boundary, and validate changes on the supported surfaces you touch.

## Root Commands

Run all commands from the repo root.

- Install: `npm install`
- Start: `npm start`
- Start web: `npm run web`
- Verify: `npm run check`
- Smoke: `npm run smoke`
- Browser smoke: `npm run smoke:web`

## Workspace Routing

There is one workspace in scope: the root Expo app at `.`.

- Route product work to this workspace unless the user explicitly adds another workspace.
- Route only one primary boundary per task.
- If a task spans multiple boundaries and cannot be cleanly split, keep integration with the main agent.

## App Boundaries

Use these boundaries for ownership and subagent routing.

| Boundary | Scope | Default owner |
| --- | --- | --- |
| `app/` | screens, tab flow, navigation behavior | app-flow agent |
| `components/`, `constants/` | UI primitives, theme, visual system | ui-system agent |
| `data/`, `hooks/` | persistence, planner, derived metrics, app state | data-flow agent |
| root files, `docs/`, `.github/`, `scripts/` | harness contract, CI, tooling, docs | main agent |

## Subagent Contract

Harness-aligned subagents must follow these rules:

- Own one boundary with a disjoint write set.
- Do not edit root contract files unless the task is explicitly tooling or docs.
- Do not mix SQLite/schema work and screen work in the same subagent unless the task is impossible to split safely.
- Report blockers instead of reaching across boundaries opportunistically.
- Leave cross-boundary integration, merge conflict resolution, and final verification to the main agent.

Good delegation shape:

- one subagent updates `app/(tabs)/progress.tsx`
- another subagent updates `data/gaps.ts`
- main agent integrates and verifies

Bad delegation shape:

- two subagents both editing `data/db.ts`
- one subagent editing `app/`, `data/`, and `.github/` in a single pass

## Local-Safe Versus Gated Paths

Local-safe:

- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run check`
- `npm run web`
- `npm run smoke`
- `npm run smoke:web`

Credential-gated:

- `npm run build:ios:dev`
- `npm run build:android:dev`

Do not block normal product work on EAS credentials when the local-safe path is sufficient.

## Stop Conditions

Stop and report instead of guessing when:

- a change requires a new environment variable or external service
- a task needs writes across overlapping boundaries with no clean owner
- the canonical verify path fails for reasons unrelated to your change
- a regression appears on a supported surface you are not validating in this pass

## Notes

- Native and web are supported surfaces.
- Web static export remains the CI smoke/build path for browser support.
- GitHub protection for `main` should require pull requests plus the `check`, `smoke`, and `smoke-web` status checks before merge.
- Update `README.md`, `docs/environment.md`, and this file together when the repo contract changes.
