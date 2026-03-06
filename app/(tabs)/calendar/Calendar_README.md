# Calendar Page README

This document summarizes the current Calendar execution layer implementation and the agreed PM behaviors.

## Scope Implemented
- Calendar now reads from SQLite-backed plan data (no static mock week).
- Calendar renders day states: `planned`, `completed`, `skipped`.
- Day tap opens lightweight details + status actions.
- Same-week move behavior is implemented.
- Skip auto-bump behavior is implemented for workout days only.

## PM Decisions Encoded
- Week boundary: Sunday-start week (`Sun -> Sat`).
- Skip on the last workout day of a week: dropped (no carry-over).
- Multiple skips: bumping chains in order.
- Rest days: can be manually moved or overridden.
- Day detail modal: lightweight summary + status actions only.
- Calendar displays only the active cycle.

## File Map
- Calendar UI and interactions:
  - `/Users/jsawyer/Documents/Test App/bomr/app/(tabs)/calendar.tsx`
- Database schema + calendar mutation logic:
  - `/Users/jsawyer/Documents/Test App/bomr/data/db.ts`
- Plan generator used by Build:
  - `/Users/jsawyer/Documents/Test App/bomr/data/planner.ts`
- Shared plan/calendar data types:
  - `/Users/jsawyer/Documents/Test App/bomr/data/types.ts`
- Build page writes active cycle and plan days:
  - `/Users/jsawyer/Documents/Test App/bomr/app/(tabs)/build.tsx`

## Data Model (Calendar-Relevant)
Tables added/used in SQLite:
- `cycles`
  - active cycle marker (`is_active`)
- `plan_days`
  - per-day schedule rows (`week_index`, `day_index`, `date`, `kind`, `status`, etc.)
- `workout_logs`
  - audit-style event log for completion/skip updates

## Enum Contracts
- `plan_days.status`
  - `planned`
  - `completed`
  - `skipped`
- `plan_days.kind`
  - `workout`
  - `rest`

These values are treated as canonical across Calendar UI, DB mutations, and logs.

## Core DB APIs
Defined in `/Users/jsawyer/Documents/Test App/bomr/data/db.ts`:
- `replacePlan(plan)`
  - Deactivates prior cycles, writes new cycle as active, inserts `plan_days`.
- `getActiveCycle()`
  - Returns the single active cycle.
- `getPlanDaysForWeek(cycleId, weekIndex)`
  - Returns the week rows ordered by day.
- `getWeekIndexForDate(cycleId, isoDate)`
  - Used to open calendar at current week if present.
- `setPlanDayStatus(dayId, status)`
  - Updates day status and writes a workout log event.
- `movePlanDayWithinWeek(sourceDayId, targetDayId)`
  - Same-week swap/move behavior.
- `overridePlanDayKind(dayId, kind)`
  - Converts rest/workout shape for manual override.
- `skipWorkoutWithAutoBump(dayId)`
  - Workout-only bump chain for same week.
  - If skipped day is last workout in week, it is dropped to rest.

## UI Behavior Notes
In `/Users/jsawyer/Documents/Test App/bomr/app/(tabs)/calendar.tsx`:
- Week card shows current active cycle + week number.
- Week ordering is always `Sun -> Sat`, driven by `day_index` (`0 = Sun ... 6 = Sat`).
- Day row status icons:
  - `completed` -> check
  - `skipped` -> cancel
  - `planned` -> empty circle
  - rest day -> moon
- Day modal actions:
  - `Complete`
  - `Skip + Bump`
  - `Move Earlier` / `Move Later`
  - `Override To Workout` / `Set As Rest`

## Empty/Failure State Behavior
- No active cycle:
  - Calendar renders an empty-state message with a prompt to generate a plan from Build.
  - No day actions are shown.
- Active cycle exists but requested week has no rows:
  - Calendar renders week shell with empty-state text (no crash).
  - Navigation remains available.
- DB mutation failure:
  - Action is rejected and UI remains on last known persisted state.
  - No explicit error toast/inline message is implemented yet.

## Date/Timezone Assumptions
- Dates are stored as ISO date strings (`YYYY-MM-DD`) in local calendar terms for day assignment.
- Week index calculations and "today" resolution are based on device-local timezone.
- Cross-timezone travel may shift what qualifies as "today" during use; no timezone normalization layer is implemented in MVP.

## Known Constraints / Follow-ups
- Move UX currently supports adjacent earlier/later movement, not direct day-target drag-drop.
- Logging currently records status events; richer payload normalization can be layered in Priority 4.
- Calendar assumes active cycle exists after Build PLAN runs.

## Quick QA Checklist
1. Build a new plan on Build tab.
2. Open Calendar and confirm week populates immediately.
3. Complete a workout and verify persisted status after app restart.
4. Skip a workout and verify same-week workout chaining.
5. Skip the last workout day in week and verify it drops (no carry).
6. Override a rest day to workout and verify row updates.
7. Re-run PLAN and confirm only the new cycle appears in Calendar.
8. Force-close and relaunch app after status changes; verify persisted state is unchanged.
9. Navigate to cycle boundary weeks (first and last week); verify week/day ordering remains `Sun -> Sat`.
