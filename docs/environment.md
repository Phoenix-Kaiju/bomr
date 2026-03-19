# Environment Contract

## Current State

BOMR does not require environment variables for normal local development, test, lint, typecheck, or smoke build execution.

## Local-Safe Commands

These commands should work without credentials:

- `npm install`
- `npm start`
- `npm run web`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run check`
- `npm run smoke`
- `npm run smoke:web`

GitHub branch protection for `main` should require the CI checks that execute these same contract commands:

- `check`
- `smoke`
- `smoke-web`

## Credential-Gated Commands

These commands depend on Expo or EAS credentials and are not part of the local-safe verify contract:

- `npm run build:ios:dev`
- `npm run build:android:dev`

## Degraded Behavior

Without any secrets or external services:

- the app still runs locally
- the supported web runtime still works locally
- local SQLite persistence still works
- tests, lint, typecheck, and static web export still work
- browser smoke works after Playwright Chromium is installed locally
- native cloud build delivery is unavailable

## Change Policy

If a future feature introduces env vars:

1. Add them to `.env.example`
2. Document them here by behavior
3. Mark whether they are required for local dev, build, deploy, or optional
4. Explain what still works when they are missing
