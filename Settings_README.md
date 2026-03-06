# Settings Page Documentation

## Document Metadata
- Document: `Settings_README.md`
- Created: `2026-02-13` (EST)
- Current Version: `v1.0`
- App Area: `Settings` tab (`/app/(tabs)/settings.tsx`)

## Purpose
The Settings page controls app-wide user preferences for cues, appearance, timer defaults, behavior, and local data management.

## Functional Areas

### 1) Cues
- `Sound`: Enables/disables sound playback cues.
- `Haptics`: Enables/disables haptic feedback.
- `Vibration`: Enables/disables vibration cues.
- `Voice Cue Style`:
  - `BEEP`
  - `VOICE_BEEP`
  - `SILENT`

### 2) Voice Cues
- `Lead-in countdown`: Toggles spoken lead-in cues.
- `EMOM minute cues`: Toggles spoken EMOM interval cues.
- `TABATA work/rest`: Toggles spoken Tabata phase cues.
- `AMRAP finish countdown`: Toggles spoken AMRAP ending cues.

### 3) Appearance
- `Theme`: Selects app theme preset.
  - `NEON`
  - `SLATE`
  - `FOREST`
  - `AMBER`
  - `MONO`

### 4) Timer Defaults
- `Default Mode`: Selects default timer mode.
  - `AMRAP`
  - `EMOM`
  - `TABATA`
  - `FOR_TIME`
- `3-2-1 Lead-in`: Toggles default pre-start countdown.
- `Auto-reset on finish`: Automatically resets timer after completion.

### 5) Preferences
- `Weight Unit`: `LB` or `KG`.
- `Prevent Screen Timeout`:
  - Default (`off`): uses system screen-timeout behavior.
  - Enabled (`on`): keeps the screen awake app-wide while app is foregrounded.
- `Lock Controls While Running`: Restricts accidental control changes during active runs.

### 6) Data
- `Export Data`: Serializes local app state into JSON shown in the text box.
- `Import Data`: Restores local app state from valid JSON in the text box.
- `Reset App Data`: Clears local BOM, plan, progress, and settings data.

## Persistence Model
- Settings are persisted under key `settings` in local storage (`/data/app-settings.ts` and `/data/db.ts`).
- Settings updates are merged with defaults to maintain backward compatibility.

## Version History

### v1.0 - 2026-02-13
- Document created.
- Captured complete Settings page behavior.
- Recorded app-wide `Prevent Screen Timeout` behavior:
  - Uses system timeout by default.
  - Overrides timeout to keep display awake when enabled.
