# Phase 02 Findings Execution Plan

## Purpose
- This phase starts immediately.
- It addresses the findings in the exact order previously presented.
- The sequence is intentional.
- The first items fix product truth and data integrity.
- Later items clean up UX, discoverability, and quality coverage.

## Revised Phase Order
1. Replace fake personalization with real planning logic.
2. Fix skip and bump reporting integrity.
3. Resolve product-spec contradictions.
4. Ship real workout notes.
4.5. Plan offline notes dictation, but do not execute it yet.
5. Add core regression coverage for planner, skip/bump, progress, and notes.
6. Improve Calendar empty-state onboarding.
7. Simplify the BOM screen and interaction model as a reversible UI-only change.
8. Make settings discoverable as a reversible UI-only change.
9. Expand test coverage after UI stabilization.

## Current Execution Order
1. Phase 5: core regression coverage.
2. Phase 6: Calendar empty-state onboarding.
3. Phase 7: BOM simplification.
4. Phase 8: Settings discoverability.
5. Phase 9: broader test coverage.

## Reversibility Rule
- Phases 7 and 8 must be reversible if the UI is not accepted.
- Treat both phases as presentation-layer changes, not product-model changes.
- Reverting those phases must require changes only in the directly affected UI files.
- Do not couple those phases to schema changes, planner changes, or settings persistence changes.

## Reversibility Acceptance Criteria
- No database schema changes.
- No changes to planner inputs or outputs.
- No changes to settings storage behavior.
- Existing functionality remains intact beneath the new UI.
- BOM simplification can be reverted by reverting only the BOM screen and closely related presentation files.
- Settings discoverability can be reverted by reverting only the layout/navigation presentation files and any additive header/menu trigger files.

## Phase 1: Real Planner

### Problem
- The planner does not currently do what the product claims.
- BOM data is not used in plan generation. Equipment is key dependency for plan generation.
- Goals and styles have limited real impact.

### Objectives
- Make plan generation equipment-aware.
- Make plan generation meaningfully responsive to targets, styles, and constraints. These together create the constraints for plan generation.
- Preserve deterministic behavior.

### Deliverables
- Introduce a structured local exercise and workout library.
- Add equipment tags, movement tags, substitutions, format tags, and progression metadata.
- Pass BOM state and goals into planner inputs.
- Score candidate sessions against:
- available equipment
- target priorities
- selected styles
- weekly movement balance
- cardio frequency needs
- duration constraints
- preferred day constraints
- Replace fixed template rotation with rule-based assembly.
- Add clear explanation text to generated days so the user can tell why a workout exists.

### Acceptance Criteria
- Changing owned equipment changes the generated plan.
- Changing target weights changes the workout mix.
- Changing selected styles changes the workout mix.
- Users do not see impossible workouts requiring missing equipment.
- Planner output remains deterministic for the same inputs.

### Suggested Files
- [data/planner.ts](/Users/jsawyer/Documents/testing/bomr/data/planner.ts)
- [data/types.ts](/Users/jsawyer/Documents/testing/bomr/data/types.ts)
- New: `/Users/jsawyer/Documents/testing/bomr/data/exercise-library.ts`
- [app/(tabs)/build.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/build.tsx)
- [app/(tabs)/bom.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/bom.tsx)

## Phase 2: Skip And Bump Integrity

### Problem
- The last skipped workout in a week is converted into rest.
- That distorts reporting and weakens trust in the product.

### Objectives
- Preserve the factual history of planned workouts.
- Keep auto-bump behavior without corrupting progress metrics.

### Deliverables
- Redesign skip state transitions so skipped workouts remain workouts.
- Add explicit schedule outcome fields if needed:
- `planned`
- `completed`
- `skipped`
- `rescheduled`
- `dropped`
- Update progress calculations to treat skipped workouts consistently.
- Add tests for first, middle, and last workout skip cases.

### Acceptance Criteria
- Skipping the last workout of the week still shows as a skipped workout.
- Weekly and cycle completion numbers remain truthful.
- Auto-bump never silently improves compliance percentages.

### Suggested Files
- [data/db.ts](/Users/jsawyer/Documents/testing/bomr/data/db.ts)
- [data/gaps.ts](/Users/jsawyer/Documents/testing/bomr/data/gaps.ts)
- [app/(tabs)/calendar.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/calendar.tsx)

## Phase 3: Resolve Product Contradictions

### Problem
- Product docs and app behavior disagree on core facts.
- The app says one thing and does another.

### Objectives
- Align product behavior with the intended strategy.
- Eliminate obvious contradictions before launch.

### Deliverables
- BOMR is a 6-week product.
- Calendar is the home screen.
- Make those decisions consistent in product docs, UI copy, planner output, and routing.
- Audit remaining product copy for mismatches.

### Acceptance Criteria
- Cycle length is consistent everywhere.
- Home screen matches the stated product strategy.
- Product docs no longer contradict the app.

### Suggested Files
- [PRODUCTVISION.md](/Users/jsawyer/Documents/testing/bomr/PRODUCTVISION.md)
- [app/index.tsx](/Users/jsawyer/Documents/testing/bomr/app/index.tsx)
- [data/planner.ts](/Users/jsawyer/Documents/testing/bomr/data/planner.ts)
- [README_EXECUTION_PLAN.md](/Users/jsawyer/Documents/testing/bomr/README_EXECUTION_PLAN.md)

## Phase 4: Workout Notes

### Problem
- The product promises quick workout details and notes.
- The schema supports notes.
- The UI does not.

### Objectives
- Make same-day execution logging actually useful.
- Support notebook-replacement behavior.

### Deliverables
- Add notes input to Calendar workout details.
- Save notes through the centralized log write path.
- Show latest notes in history or workout detail.
- Add optional quick-entry presets:
- "felt heavy"
- "cut short"
- "swap movement"
- "increase next time"

### Acceptance Criteria
- Users can complete a workout with notes in one flow.
- Notes persist and appear after app restart.
- Notes are included in backup and restore.

### Suggested Files
- [app/(tabs)/calendar.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/calendar.tsx)
- [data/db.ts](/Users/jsawyer/Documents/testing/bomr/data/db.ts)
- [data/types.ts](/Users/jsawyer/Documents/testing/bomr/data/types.ts)

## Phase 4.5: Offline Notes Dictation Plan

### Purpose
- Add offline notes dictation after typed notes have shipped and priorities are rebalanced.
- Do not execute this in the current phase.

### Constraints
- Must preserve local-first behavior.
- Must not auto-write note content without user review.
- Must fit the Expo/native strategy we choose for shipping builds.

### Recommendation
- Evaluate `sherpa-ncnn` first as the primary offline candidate.
- Treat this as a native integration spike, not a UI-only task.

### Deliverables
- Define a speech-capture abstraction for notes.
- Build a push-to-talk note flow in Calendar.
- Transcribe short utterances on-device.
- Insert transcript into the notes field for user review before save.
- Add microphone permission handling and failure states.
- Document Expo custom dev build or native integration requirements.

### Acceptance Criteria
- User can dictate a short workout note into Calendar.
- Transcript is editable before save.
- Notes still save through the same local workout log path.
- Feature does not block typed notes or degrade the base notes flow.

## Phase 5: Core Regression Coverage

### Problem
- The most important product logic now spans planner generation, skip/bump behavior, cycle math, and workout notes.
- There is still no automated protection around those flows.

### Objectives
- Add regression coverage before more UI churn lands.
- Protect the product truth fixes already shipped.

### Deliverables
- Add unit tests for planner rules.
- Add tests for skip and bump transitions.
- Add tests for progress calculations.
- Add tests for workout note persistence and note history mapping.
- Add tests for week/date calculations where practical.

### Acceptance Criteria
- The current planner logic is covered by automated tests.
- The current skip/bump truthfulness is covered by automated tests.
- Workout notes are covered by automated tests.

### Suggested Files
- New: `/Users/jsawyer/Documents/testing/bomr/data/__tests__/planner.test.ts`
- New: `/Users/jsawyer/Documents/testing/bomr/data/__tests__/db.test.ts`
- New: `/Users/jsawyer/Documents/testing/bomr/data/__tests__/gaps.test.ts`

## Phase 6: Calendar Empty-State Onboarding

### Problem
- Calendar is now the home screen.
- A first-time user can land on an empty Calendar with too little guidance.

### Objectives
- Make the first-run path obvious from the actual home screen.
- Reduce onboarding confusion without adding dashboard clutter.

### Deliverables
- Add explicit empty-state actions from Calendar to BOM and Build.
- Make the required setup order visible in plain language.
- Keep the empty state minimal and fast to scan.

### Acceptance Criteria
- A first-time user can reach BOM and Build from Calendar without guessing.
- The empty state supports the calendar-first strategy.

### Suggested Files
- [app/(tabs)/calendar.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/calendar.tsx)
- [PRODUCTVISION.md](/Users/jsawyer/Documents/testing/bomr/PRODUCTVISION.md)

## Phase 7: BOM UX Simplification

### Problem
- The BOM screen is overloaded.
- It is trying to be inventory input, timer control, hidden gesture surface, and home screen at the same time.

### Objectives
- Make BOM interactions obvious.
- Reduce hidden behavior.
- Separate setup from workout execution where needed.

### Reversibility Requirement
- This phase must be reversible if the UI is not accepted.
- Keep it UI-only.
- Do not change BOM storage shape or planner dependencies.

### Deliverables
- Replace single-tap, double-tap, and long-press BOM mode switching with explicit controls.
- Decide whether the timer belongs in BOM, Calendar, or a separate utility surface.
- Make equipment add/review/edit states visible with labeled actions.
- Keep weight entry, but simplify selection and ownership workflows.

### Acceptance Criteria
- Users can understand BOM interactions without instruction.
- The timer does not obscure the core equipment workflow.
- The screen feels intentionally scoped instead of overloaded.
- The implementation remains UI-only and reversible.

### Suggested Files
- [app/(tabs)/bom.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/bom.tsx)
- [PRODUCTVISION.md](/Users/jsawyer/Documents/testing/bomr/PRODUCTVISION.md)

## Phase 8: Settings Discoverability

### Problem
- Settings are hidden behind swipe navigation.
- That is not acceptable for production discoverability.

### Objectives
- Make settings reachable without hidden gestures.
- Keep the main UX focused.

### Reversibility Requirement
- This phase must be reversible if the UI is not accepted.
- Keep it additive and UI-only.
- Do not change settings persistence behavior.

### Deliverables
- Add visible settings entry point.
- Either restore the tab or add a clear header action.
- Keep swipe navigation optional, not required.

### Acceptance Criteria
- A new user can find settings without being told how.
- Settings access does not rely on gesture discovery.

### Suggested Files
- [app/(tabs)/_layout.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/_layout.tsx)
- [app/(tabs)/settings.tsx](/Users/jsawyer/Documents/testing/bomr/app/(tabs)/settings.tsx)

## Phase 9: Expanded Test Coverage

### Problem
- There are no tests around the most failure-prone behaviors.

### Objectives
- Add confidence around business logic and state transitions.
- Expand coverage after the core regression set and UI changes stabilize.

### Deliverables
- Add tests for backup and restore behavior.
- Add smoke coverage for routing and critical screen states if practical.

### Acceptance Criteria
- Broader flows beyond the core regression set are covered.
- Navigation and backup/restore regressions are more likely to be caught automatically.

### Suggested Files
- New: `/Users/jsawyer/Documents/testing/bomr/app/__tests__/routing.test.ts`
- New: `/Users/jsawyer/Documents/testing/bomr/data/__tests__/backup.test.ts`

## Technical Additions To Consider During Phase 02
- Voice dictation for workout notes using on-device or platform speech input.
- A local exercise library with substitutions and movement tagging.
- Optional on-device or local model support later for note summarization, substitutions, and plan explanations.
- Do not start with frontier-model dependency for core planning.
- Get the deterministic engine right first.

## Operating Rule
- No new marketing push until Phases 1 through 4 are complete.
- Those phases determine whether the product is telling the truth.
