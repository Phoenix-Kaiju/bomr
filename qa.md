# Phase 1 QA

## Goal
Validate the Phase 1 user loop end to end:

1. Configure equipment in `BOM`
2. Generate a plan in `Build`
3. Execute and mutate the plan in `Calendar`
4. Confirm derived metrics in `Progress`
5. Verify recovery and data controls in `Settings`

## QA Priorities

### P0 Release Blockers
- User can complete the full `BOM -> Build -> Calendar -> Progress` flow without data loss.
- Plan, logs, and settings persist across app restart.
- Calendar status changes are reflected correctly in Progress.
- Replanning replaces the active cycle cleanly.
- Backup export/import/reset do not corrupt local data.
- Timer cues do not crash the app on real devices.

### P1 High Value
- Empty states and first-run flows are coherent.
- Week navigation, move, skip, and note flows behave consistently.
- Progress calculations remain correct with skipped workouts and notes.
- Settings toggles affect the user experience as expected.

### P2 Nice to Have
- Layout polish across small and large screens.
- Accessibility labels, readable copy, and contrast checks.
- Performance with larger history/log volumes.

## Test Environment

### Devices
- iPhone, current iOS version available to the team
- Android phone, current Android version available to the team

### Build Modes
- Expo local/dev client build
- At least one install path that simulates a fresh install
- At least one upgrade path using an existing local database if available

### Baseline Checks
- `npm test`
- `npm run lint`
- `npx tsc --noEmit`

Pass criteria:
- All commands exit cleanly before manual QA starts.

## Test Data Setup

Use these baseline profiles during QA:

### Profile A: Default Strength Setup
- Owned equipment: `rack`, `bench`, `db`, `bands`, `pullup`
- Build inputs: 4 days/week, 45 minutes, default target mix

### Profile B: Limited Equipment
- Owned equipment: `bands` only, or one custom equipment entry plus bands
- Build inputs: 3 to 4 days/week, 30 to 45 minutes

### Profile C: Conditioning-Heavy
- Owned equipment includes at least one cardio item if available
- Build inputs favor conditioning heavily

Pass criteria:
- Each profile can generate a plan without errors.

## Phase 1 Execution Matrix

Use the tables below during active QA. Suggested status values: `Not Started`, `In Progress`, `Passed`, `Failed`, `Blocked`.

### Core Flow Matrix
| Area | Test | Owner | Platform | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| First Run | Fresh install launches and tabs render |  | iPhone | Not Started |  |
| First Run | Fresh install launches and tabs render |  | Android | Not Started |  |
| BOM | Base equipment toggle and persistence |  | iPhone | Not Started |  |
| BOM | Base equipment toggle and persistence |  | Android | Not Started |  |
| Build | Default profile plan generation |  | iPhone | Not Started |  |
| Build | Default profile plan generation |  | Android | Not Started |  |
| Calendar | Complete workout and persist after restart |  | iPhone | Not Started |  |
| Calendar | Complete workout and persist after restart |  | Android | Not Started |  |
| Calendar | Skip workout and validate same-week outcome |  | iPhone | Not Started |  |
| Calendar | Skip workout and validate same-week outcome |  | Android | Not Started |  |
| Progress | Completion metrics reflect Calendar mutations |  | iPhone | Not Started |  |
| Progress | Completion metrics reflect Calendar mutations |  | Android | Not Started |  |
| Settings | Export, reset, and import recovery flow |  | iPhone | Not Started |  |
| Settings | Export, reset, and import recovery flow |  | Android | Not Started |  |

### Device Behavior Matrix
| Area | Test | Owner | Platform | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Timer | AMRAP start, pause, resume, finish |  | iPhone | Not Started |  |
| Timer | AMRAP start, pause, resume, finish |  | Android | Not Started |  |
| Timer | EMOM cues with sound/haptics enabled |  | iPhone | Not Started |  |
| Timer | EMOM cues with sound/haptics enabled |  | Android | Not Started |  |
| Timer | TABATA work/rest cues |  | iPhone | Not Started |  |
| Timer | TABATA work/rest cues |  | Android | Not Started |  |
| Lifecycle | Background and resume during timer |  | iPhone | Not Started |  |
| Lifecycle | Background and resume during timer |  | Android | Not Started |  |
| Lifecycle | Lock/unlock during timer |  | iPhone | Not Started |  |
| Lifecycle | Lock/unlock during timer |  | Android | Not Started |  |
| Settings | Sound/haptics/vibration toggles applied to timer behavior |  | iPhone | Not Started |  |
| Settings | Sound/haptics/vibration toggles applied to timer behavior |  | Android | Not Started |  |

### Data Integrity Matrix
| Area | Test | Owner | Platform | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| Replan | New plan replaces prior active cycle |  | iPhone | Not Started |  |
| Replan | New plan replaces prior active cycle |  | Android | Not Started |  |
| Calendar | Skip last workout in week |  | iPhone | Not Started |  |
| Calendar | Skip last workout in week |  | Android | Not Started |  |
| Progress | Notes appear in history after restart |  | iPhone | Not Started |  |
| Progress | Notes appear in history after restart |  | Android | Not Started |  |
| Backup | Invalid JSON import rejected cleanly |  | iPhone | Not Started |  |
| Backup | Invalid JSON import rejected cleanly |  | Android | Not Started |  |
| Reset | Reset immediately after plan generation |  | iPhone | Not Started |  |
| Reset | Reset immediately after plan generation |  | Android | Not Started |  |

## Smoke Suite

Run this before every shareable build.

### 1. First Run
- Launch app with no existing local data.
- Confirm app opens successfully and tabs render.
- Confirm no screen crashes with empty state.

Pass criteria:
- App is stable on launch.
- `Calendar` and `Progress` show sensible empty-state guidance.

### 2. BOM Setup
- Add and remove owned equipment.
- Add one custom equipment item.
- Change weight unit in Settings and return to BOM.
- Close and relaunch the app.

Pass criteria:
- Equipment selections persist.
- Custom equipment persists.
- Weight display behavior remains coherent after settings changes.

### 3. Build Plan
- Create a plan using Profile A.
- Change targets and constraints, then create another plan.

Pass criteria:
- Plan generation completes without errors.
- Generated plan summary updates.
- New plan becomes the active cycle.

### 4. Calendar Execution
- Open current week in Calendar.
- Mark one workout complete.
- Mark one workout skipped.
- Add or edit a note.
- Move one workout within the same week if the UI allows it.
- Force close and relaunch the app.

Pass criteria:
- Status changes persist.
- Notes persist.
- Calendar week remains coherent after restart.

### 5. Progress Validation
- Open Progress after the Calendar mutations above.

Pass criteria:
- Completion percentages update.
- History includes the logged events.
- Skipped workouts remain counted as planned work, not removed.

### 6. Settings Data Controls
- Export backup JSON.
- Reset app data.
- Import the backup JSON.

Pass criteria:
- Reset clears local plan and progress data.
- Import restores settings, plan, and logs without crash.

## Detailed QA Checklist

### BOM
- Verify first-run defaults render without saved BOM state.
- Verify base equipment can be toggled on and off.
- Verify custom equipment can be added without duplicate or malformed entries.
- Verify autosave occurs after BOM changes.
- Verify timer presets switch correctly between `AMRAP`, `EMOM`, `TABATA`, and `FOR_TIME`.
- Verify timer start, pause, resume, and finish behavior.
- Verify sound, haptics, vibration, and voice settings do not cause runtime errors when toggled.
- Verify backgrounding the app during an active timer does not produce a broken state on resume.
- Verify silent-mode behavior on iPhone if supported by device settings.

Pass criteria:
- No crashes, frozen timers, or lost equipment state.
- Timer controls remain usable and visually correct.

### Build
- Verify saved build inputs reload when reopening the screen.
- Verify target sliders always normalize to a 100% total.
- Verify changing days per week and duration updates plan generation successfully.
- Verify preferred day toggles persist in the saved build state.
- Verify a plan can be generated with no saved BOM state.
- Verify a plan generated with limited equipment differs from a plan generated with fuller equipment.

Pass criteria:
- No invalid target totals.
- Plan generation is deterministic for unchanged inputs.
- Rebuilds update the active plan cleanly.

### Calendar
- Verify no-active-cycle state routes user clearly to BOM and Build.
- Verify current week selection defaults correctly after a plan exists.
- Verify complete action marks the selected workout as completed.
- Verify skip action marks the selected workout as skipped.
- Verify skip auto-bump behavior only shifts workout days, not rest days.
- Verify rest override behavior if available in the UI.
- Verify moving a workout within the same week preserves data integrity.
- Verify note presets append correctly.
- Verify rapid repeated taps do not create visibly broken state.

Pass criteria:
- The week schedule remains internally consistent after every mutation.
- The same day does not show contradictory state after refresh or restart.

### Progress
- Verify no-active-cycle state is clear.
- Verify week completion and cycle completion percentages after 0, 1, and multiple logs.
- Verify skipped workouts count as planned but incomplete.
- Verify notes appear in history.
- Verify training gaps update when completed workout mix changes.
- Verify equipment gaps reflect upcoming workouts relative to owned equipment.
- Verify Progress refreshes after returning from Calendar.

Pass criteria:
- Metrics match the executed data set.
- History ordering is correct and no duplicate events appear unexpectedly.

### Settings
- Verify every toggle persists after leaving and reopening the screen.
- Verify theme changes apply without visual breakage.
- Verify export produces valid JSON.
- Verify invalid JSON import is rejected cleanly.
- Verify valid import restores data.
- Verify reset clears BOM, plan, progress, and settings-derived local state.

Pass criteria:
- No settings action causes partial restore or half-reset behavior.

## Edge Cases

### Data Integrity
- Replan with an existing active cycle.
- Skip the last remaining workout in a week.
- Mark a workout complete, then reopen the app and verify Progress.
- Import backup data created before the latest schema additions if such data exists.
- Reset immediately after generating a plan.

Pass criteria:
- No orphaned active cycles.
- No corrupted calendar week layouts.
- No app crash during migration or restore.

### Device and Lifecycle
- Put app in background during timer countdown.
- Lock and unlock the device during an active timer.
- Toggle sound/haptics/voice settings while timer is idle, then run timer again.
- Rotate device if rotation is supported by current app settings.

Pass criteria:
- App resumes safely and cues remain consistent with settings.

### UX and Accessibility
- Verify text remains readable on smaller devices.
- Verify tap targets are usable in Calendar and Settings.
- Verify color changes do not make status unreadable.
- Verify screen-reader basics if accessibility tooling is available.

Pass criteria:
- No blocked core flow due to layout, contrast, or hit-area issues.

## Defect Severity

### P0
- Crash, data loss, corrupted plan/log state, broken timer, failed restore/reset, or impossible core flow

### P1
- Incorrect progress math, broken skip/move behavior, settings not persisting, misleading empty state

### P2
- Layout defects, minor copy problems, non-blocking visual inconsistencies

## Exit Criteria For Phase 1
- All P0 cases pass on iPhone and Android.
- No open P0 defects.
- P1 defects are either fixed or explicitly accepted.
- Smoke suite passes on the release candidate.
- Backup/reset/import have been exercised at least once on a real device.
- One full end-to-end run has been completed from fresh install through progress verification.

## Recommended Automation Follow-Up
- Add a mobile E2E smoke suite for `BOM -> Build -> Calendar -> Progress -> Settings backup/reset/import`.
- Add integration tests for `Calendar`, `Progress`, and `Settings`.
- Add a formal `typecheck` script to `package.json` and run it in CI.
