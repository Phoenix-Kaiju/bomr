# Ownership And Routing

This repo has one deployable surface: the root Expo app.

## Primary Boundary

- Primary app: `bomr` Expo client at repo root

## Boundary Map

| Boundary | Files | Purpose |
| --- | --- | --- |
| App flow | `app/` | screens, navigation, screen state orchestration |
| UI system | `components/`, `constants/` | shared UI primitives, theme, icons, styling helpers |
| Data flow | `data/`, `hooks/` | SQLite, planner logic, backup, derived metrics, state hooks |
| Harness | root config, `docs/`, `.github/`, `scripts/` | repo contract, CI, automation, docs |

## Agent Routing Rules

- Route one task to one primary boundary whenever possible.
- Use subagents only when write scopes are disjoint.
- Keep the main agent responsible for integration, verification, and root contract updates.
- Treat `data/db.ts` as a high-friction shared file; avoid parallel writers there.
- If a task spans app flow and data flow, split it into a data subtask plus an app subtask only when interfaces are already clear. Otherwise keep it on the main agent.
