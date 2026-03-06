# BOMR Product Vision

## One-Line Vision
BOMR is a streamlined training planner for people who currently use notebooks or spreadsheets at the gym or at home: capture equipment, set goals and constraints, generate a six week mesocycle training plan, put it on a calendar, and surface clear training gaps for the next mesocycle.

## Product Intent
- The app is for doing, not browsing.
- The calendar is the primary working surface.
- Setup should be quick: define equipment, goals, and constraints once, then train.
- Every feature must reduce friction between opening the app and logging or adjusting today’s workout.

## Core User Promise
- I can tell the app what equipment I have.
- I can tell it what I want and what constraints I have.
- It gives me a usable six week plan on a calendar.
- I can execute and adjust that plan quickly in real training conditions.
- It flags important gaps without overwhelming me with analytics.

## Target User
- Home gym enthusiasts.
- Lifters and functional fitness users who currently track in notes, paper, or spreadsheets.
- People training in real-world environments with time pressure and imperfect consistency.

## Primary Workflow (Golden Path)
1. Enter/update available equipment (BOM).
2. Set goals and constraints (Build).
3. Generate plan (six week calendar-based cycle).
4. Open app at gym and interact with today on Calendar:
   - complete
   - skip/bump
   - move/reassign
   - jot quick workout details
5. Review concise gaps and next actions.

## Product Principles
- Fast: core actions should take seconds.
- Familiar: interaction model should feel intuitive.
- Deterministic: behavior should be predictable and trustworthy.
- Local-first: core flows must work reliably without network dependency.
- Minimal: no decorative dashboards, no feature sprawl.
- Actionable: insights must resolve into clear next steps.
- Privacy-first: no user data is collected ever. Use data will be for internal analytics.

## UX Rules
- Calendar is the home and operational center.
- Use plain language and direct labels.
- Limit taps and decisions per task.
- Avoid dense charts and exploratory analysis surfaces.
- Keep state and status visible where action happens (Calendar).

## Scope (Now)
- Equipment inventory input.
- Goal + constraint capture.
- Plan generation into calendar days.
- Daily execution actions on calendar.
- Progress/gaps in concise, rule-based form.
- Backup/restore/reset that users can trust.

## Out of Scope (Now)
- Dashboard-heavy analytics experiences.
- Social/community features.
- Complex coaching narratives.
- Gamification layers that distract from training execution.

## Success Criteria
### User Success
- Can start training from plan within minutes of setup.
- Can log/adjust today’s session with minimal friction.
- Can understand what to fix next from gaps without extra interpretation.

### Product Success
- High setup completion rate (BOM -> Plan generated).
- Strong weekly execution (planned vs completed workout days).
- Repeat use across training weeks.

## Quality Bar
- No misleading data behaviors (especially reset/export/import).
- No hidden logic that surprises users during schedule changes.
- No UI complexity that slows in-gym usage.
- If a feature does not improve speed, clarity, or execution quality, it should be cut.

## Decision Filter
Before adding or changing anything, ask:
1. Does this make same-day workout execution faster?
2. Does this feel familiar to notebook/spreadsheet users?
3. Does this improve trust and predictability?
4. Does this avoid creating a dashboard-like browsing experience?

If the answer is no to any of the above, do not ship it in current scope.

## Current Strategic Priorities
1. Calendar-first execution polish (today-focused, minimal taps).
2. Plan generation quality (equipment-aware, goal-weighted, constraint-respecting).
3. Lightweight, actionable gap detection and guidance.
4. Data trust and integrity (backup/restore/reset, deterministic state transitions).
