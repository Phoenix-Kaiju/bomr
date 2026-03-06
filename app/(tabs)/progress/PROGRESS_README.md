# Progress Page README

This document summarizes the current Progress implementation and the agreed PM behaviors.

## Scope Implemented
- Progress now reads from SQLite-backed plan and workout log data (no static placeholder cards).
- Progress computes completion metrics for current week and active cycle.
- Progress renders completion history from `workout_logs` events.
- Progress renders deterministic training gaps from completed workout metadata.
- Progress renders equipment gaps from planned requirements vs BOM-owned equipment.

## PM Decisions Encoded
- Progress source of truth for event history: `workout_logs`.
- Week boundary: Sunday-start week (`Sun -> Sat`).
- Skips count as incomplete for completion percentages.
- Available equipment is sourced from BOM state (`bom.owned`) and used for equipment-gap detection.
- Minimal metadata is required on each plan day for gaps: movement patterns, cardio flag, required equipment, volume score.

## Working Definition of Progress
For MVP, progress means:
- Execution: completed workout days over planned workout days.
- Consistency: current-week and cycle-level completion.
- Coverage: whether training distribution shows rule-based gaps.
- Feasibility: whether upcoming workouts are blocked by missing equipment.

## V1 Deterministic Formulas
- Week completion % = `completed_workout_days_this_week / planned_workout_days_this_week`.
- Cycle completion % = `completed_workout_days_in_cycle / planned_workout_days_in_cycle`.
- Cardio frequency gap = show if completed cardio workouts in current Sunday-start week `< 2`.
- Movement pair imbalance gap = show if `|A-B|/(A+B) > 0.20` for push/pull or squat/hinge weekly completed volume.
- Volume dominance gap = show if one movement pattern is `>45%` of weekly completed volume.
- Equipment gaps = upcoming workout `required_equipment` minus BOM `owned` equipment, ranked by blocker frequency.

## File Map
- Progress UI and data loading:
  - `/Users/jsawyer/Documents/Test App/bomr/app/(tabs)/progress.tsx`
- Progress computation engine (metrics + gaps):
  - `/Users/jsawyer/Documents/Test App/bomr/data/gaps.ts`
- Database schema + read/write APIs:
  - `/Users/jsawyer/Documents/Test App/bomr/data/db.ts`
- Shared data contracts (including metadata enums):
  - `/Users/jsawyer/Documents/Test App/bomr/data/types.ts`
- Plan generator metadata defaults:
  - `/Users/jsawyer/Documents/Test App/bomr/data/planner.ts`
- BOM page ownership state writer (`bom.owned`):
  - `/Users/jsawyer/Documents/Test App/bomr/app/(tabs)/bom.tsx`

## Data Model (Progress-Relevant)
Tables used in SQLite:
- `cycles`
  - Active cycle marker (`is_active`).
- `plan_days`
  - Per-day plan rows and metadata: `status`, `kind`, `movement_patterns`, `cardio_flag`, `required_equipment`, `volume_score`.
- `workout_logs`
  - Event history for completion/skip updates (`logged_at` ordered).

State keys used in app state:
- `bom`
  - `owned` equipment list used for equipment-gap checks.

## Enum / Contract Notes
- `plan_days.status` and logs `status`
  - `planned`
  - `completed`
  - `skipped`
- `plan_days.kind`
  - `workout`
  - `rest`
- `movementPatterns` values
  - `push`, `pull`, `squat`, `hinge`, `lunge`, `core`, `carry`, `rotation`, `cardio`

These values are treated as canonical in planner output, DB persistence, and Progress calculations.

## Core APIs Used by Progress
Defined in `/Users/jsawyer/Documents/Test App/bomr/data/db.ts`:
- `getActiveCycle()`
  - Returns current active cycle.
- `getPlanDaysForCycle(cycleId)`
  - Returns full cycle days ordered by week/day.
- `getWorkoutLogs(cycleId, limit)`
  - Returns event history used for completion history + latest status resolution.
- `getState('bom')`
  - Returns owned equipment list from BOM state.

Defined in `/Users/jsawyer/Documents/Test App/bomr/data/gaps.ts`:
- `computeProgressSnapshot(days, logs, ownedEquipment)`
  - Returns week/cycle completion, history rows, training gaps, and equipment gaps.

## UI Behavior Notes
In `/Users/jsawyer/Documents/Test App/bomr/app/(tabs)/progress.tsx`:
- Screen reloads when tab regains focus.
- Completion card shows:
  - week completion %, completed/planned counts
  - cycle completion %, skipped count
- History section shows recent log events in reverse chronological order.
- Training gaps section shows deterministic rule results or a no-gap fallback.
- Equipment gaps section shows ranked blockers or a no-blocker fallback.

## Empty/Failure State Behavior
- No active cycle:
  - Progress renders empty-state prompt to build a plan.
- No workout events:
  - History renders `No workout events yet.`
- No training gaps triggered:
  - Section renders `No training gaps flagged this week.`
- No equipment blockers:
  - Section renders `No equipment blockers for upcoming workouts.`
- Data read failure:
  - No explicit toast/inline error UI is implemented yet; screen remains on last loaded state.

## Date/Timezone Assumptions
- Day dates are stored as ISO date strings (`YYYY-MM-DD`) in device-local calendar terms.
- Current-week calculations use Sunday-start boundaries in device-local timezone.
- No timezone normalization layer is implemented for cross-timezone travel in MVP.

## Known Constraints / Follow-ups
- Gap logic is intentionally heuristic and rule-based for MVP (not adaptive coaching).
- Equipment gaps depend on consistent `required_equipment` tagging in planner/custom workout flows.
- Progress currently derives latest status from event history; conflict resolution rules for sync are not yet implemented.
- No drill-down detail page for gap explanations yet.

## Quick QA Checklist
1. Build a new plan on Build tab.
2. Confirm Progress shows week and cycle completion cards from live data.
3. Complete one workout in Calendar and confirm completion % and history update.
4. Skip one workout in Calendar and confirm skip increments while completion % treats it as incomplete.
5. Edit BOM owned equipment and confirm equipment-gap cards update.
6. Verify Sunday-start week behavior by checking metrics across a week boundary.
7. Force-close and relaunch app; verify Progress values persist from DB/state.
