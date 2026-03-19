# BOMR

BOMR is a local-first Expo fitness planner. The current product loop is:

1. Capture equipment in `BOM`
2. Generate a plan in `Build`
3. Execute and mutate it in `Calendar`
4. Review outcomes in `Progress`
5. Recover or reset data in `Settings`

## Canonical Entry Point

Use this file as the root contract for humans and agents.

- Install: `npm install`
- Start native dev server: `npm start`
- Start web dev server: `npm run web`
- Run on iOS: `npm run ios`
- Run on Android: `npm run android`
- Verify changes: `npm run check`
- Run build sanity: `npm run smoke`
- Run browser smoke: `npm run smoke:web`

## Supported Surfaces

- Native iOS, Android, and web are supported development targets.
- `npm run web` is the interactive browser runtime.
- `npm run build` and `npm run smoke` validate the static web export path used for CI smoke coverage.

## Verification Contract

Run these from the repo root:

- `npm run lint`: non-interactive static checks
- `npm run test`: deterministic unit tests
- `npm run typecheck`: TypeScript compile safety
- `npm run check`: canonical pre-merge verify path
- `npm run smoke`: static export sanity build
- `npm run smoke:web`: interactive browser sanity using Playwright

GitHub protection for `main` should require pull requests, one approval, and these three CI checks before merge:

- `check`
- `smoke`
- `smoke-web`

## Environment Contract

No environment variables are required for the local-safe development and verify path today.

- See `docs/environment.md` for the current env and secrets policy.
- See `docs/github-rulesets.md` for the matching GitHub protection baseline.
- See `.env.example` for the placeholder env contract.
- EAS build commands are credential-gated and are not part of the local-safe verify path.

## Repo Map

- `app/`: Expo Router screens and navigation shell
- `components/`: shared UI pieces
- `constants/`: theme, navigation, and style constants
- `data/`: SQLite persistence, planner, backup, and derived metrics
- `hooks/`: app-specific hooks
- `docs/`: harness and environment contract docs

## Agent Routing

The routing and stop conditions for agents live in `AGENTS.md`.

For deeper product context and QA detail:

- `README_EXECUTION_PLAN.md`
- `qa.md`
