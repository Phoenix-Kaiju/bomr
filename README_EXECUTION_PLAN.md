# BOMR MVP Execution Plan

## Objective
Ship a functional MVP loop:
- Build plan from user inputs
- Execute it in Calendar
- Log outcomes
- Reflect outcomes in Progress

## Priority Order
1. Calendar execution layer
2. Progress page from real data
3. Build-to-plan pipeline hardening
4. Workout logging schema consistency
5. Offline/sync contract

## 1) Calendar Execution Layer (Highest Priority)
Implementation notes: [`app/(tabs)/calendar/Calendar_README.md`](app/(tabs)/calendar/Calendar_README.md)

### Goals
- Replace static calendar content with DB-backed plan data.
- Render `planned`, `completed`, and `skipped` states.
- Implement same-week drag/move and skip auto-bump behavior.

### Deliverables
- Calendar reads generated plan rows from SQLite.
- Tapping a day opens workout details for that date.
- Mark complete / skip updates workout status.
- Skip auto-bumps only workout days; planned rest days do not bump.

### Suggested Files
- `app/(tabs)/calendar.tsx`
- `data/db.ts`
- `data/types.ts` (new, for shared DB models)

### Acceptance Criteria
- Generated plan appears in Calendar immediately after planning.
- Status changes persist across app restarts.
- Skipping a workout shifts remaining same-week workouts correctly.

## 2) Progress Page from Real Data
Working definition of progress for MVP:
- Execution: completed workout days / planned workout days (skip counts as incomplete).
- Consistency: current Sunday-start week and full active cycle percentages.
- Coverage: deterministic gaps from completed workout metadata (cardio + movement/volume balance).
- Feasibility: equipment blockers from planned requirements minus BOM-owned equipment.

V1 deterministic formulas:
- Week completion % = `completed_workout_days_this_week / planned_workout_days_this_week`.
- Cycle completion % = `completed_workout_days_in_cycle / planned_workout_days_in_cycle`.
- Cardio frequency gap = show if completed cardio workouts in current Sunday-start week `< 2`.
- Movement pair imbalance gap = show if `|A-B|/(A+B) > 0.20` for push/pull or squat/hinge weekly completed volume.
- Volume dominance gap = show if a single movement pattern is `>45%` of weekly completed volume.

### Goals
- Remove static placeholders.
- Show completion metrics and training/equipment gaps based on logs + plan.

### Deliverables
- Completion history list from workout logs.
- Week and cycle completion percentages.
- Initial gap rules:
  - Missing cardio frequency
  - Movement pattern imbalance
  - Volume imbalance by pattern
- Equipment gap suggestions map missing movements to missing equipment.

### Suggested Files
- `app/(tabs)/progress.tsx`
- `data/db.ts`
- `data/gaps.ts` (new)

### Acceptance Criteria
- Progress updates after every completed/skipped workout.
- Gap cards are deterministic from stored data.

## 3) Build -> Plan Pipeline Hardening
### Goals
- Ensure targets/constraints/style produce a stable 6-week plan schema.
- Save complete plan structure to DB (not summary-only).

### Deliverables
- Plan schema persisted as:
  - `cycles`
  - `weeks`
  - `days`
  - `workout_blocks` (format, duration, movements)
- Build `PLAN` action writes full plan object.
- Plan Review reads from persisted plan payload.

### Suggested Files
- `app/(tabs)/build.tsx`
- `data/db.ts`
- `data/planner.ts` (new)
- `data/types.ts` (new)

### Acceptance Criteria
- Calendar and Progress can run only from persisted plan + logs.
- Replanning creates a new cycle and deactivates prior cycle.

## 4) Workout Logging Schema Consistency
### Goals
- Normalize logging payload so analytics and gaps are reliable.

### Deliverables
- Standard event schema:
  - `workout_id`
  - `date`
  - `status` (`planned|completed|skipped`)
  - `notes`
  - `movement_checks`
  - `load_entries`
  - `duration_actual`
- Centralized write path for completion/skips/notes.

### Suggested Files
- `data/db.ts`
- `data/types.ts` (new)
- `app/(tabs)/bom.tsx` (timer completion hooks, if needed)
- `app/(tabs)/calendar.tsx`

### Acceptance Criteria
- No page writes ad-hoc payload shapes.
- Existing logs migrated or safely defaulted.

## 5) Offline + Sync Contract
### Goals
- Guarantee local-first behavior and predictable reconnect handling.

### Deliverables
- Queue local mutations with timestamps + operation IDs.
- Sync worker flushes queue on reconnect.
- Last-write-wins policy for MVP documented and applied.
- Subtle offline indicator for network-required actions.

### Suggested Files
- `data/sync.ts` (new)
- `data/db.ts`
- `hooks/use-network-status.ts` (new)
- `app/(tabs)/settings.tsx` (optional diagnostics toggle)

### Acceptance Criteria
- Core actions work offline: complete workout, skip, notes, timer.
- Queue drains when online with no crashes or duplicate writes.

## Data Model Baseline (Recommended)
Create shared types first to avoid drift:
- `Cycle`
- `PlanWeek`
- `PlanDay`
- `WorkoutBlock`
- `WorkoutLog`
- `GapResult`

File: `data/types.ts`

## Suggested Implementation Sequence (Developer Checklist)
1. Define DB schema/types (`data/types.ts`, migrations in `data/db.ts`).
2. Implement full plan persistence in Build.
3. Replace Calendar mock with plan-backed rendering + status actions.
4. Normalize log writes across Calendar/BOM.
5. Replace Progress mock with computed metrics/gaps.
6. Add offline mutation queue.
7. Add QA pass and regression checks on BOM timer + settings toggles.

## QA Smoke Tests
- Build a plan and confirm Calendar populates immediately.
- Complete and skip workouts; confirm Progress updates.
- Kill/reopen app; verify persistence.
- Airplane mode: complete workout + add note; reconnect and verify sync.
- Replan cycle; verify old cycle is not active in Calendar.

## Notes
- Keep current UI direction; prioritize behavior and data integrity first.
- Delay backend API until local data model stabilizes.
