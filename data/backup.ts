import type { FullBackupData } from '@/data/db';

export type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  data: FullBackupData;
};

const CURRENT_BACKUP_SCHEMA_VERSION = 2;
const MAX_BACKUP_TEXT_LENGTH = 2_000_000;
const MAX_APP_STATE_KEYS = 50;
const MAX_CYCLES = 100;
const MAX_PLAN_DAYS = 5_000;
const MAX_WORKOUT_LOGS = 10_000;
const MAX_KEY_LENGTH = 80;
const MAX_ID_LENGTH = 80;
const MAX_LABEL_LENGTH = 160;
const MAX_TEXT_LENGTH = 4_000;
const MAX_FORMAT_LENGTH = 80;
const MAX_EQUIPMENT_ITEMS = 64;
const MAX_MOVEMENT_PATTERNS = 16;
const MAX_JSON_DEPTH = 8;

const PLAN_DAY_STATUSES = ['planned', 'completed', 'skipped'] as const;
const PLAN_DAY_KINDS = ['workout', 'rest'] as const;
const MOVEMENT_PATTERNS = [
  'push',
  'pull',
  'squat',
  'hinge',
  'lunge',
  'core',
  'carry',
  'rotation',
  'cardio',
] as const;
const THEME_PRESETS = ['NEON', 'SLATE', 'FOREST', 'AMBER', 'MONO'] as const;
const VOICE_CUE_STYLES = ['BEEP', 'VOICE_BEEP', 'SILENT'] as const;
const TIMER_DEFAULTS = ['AMRAP', 'EMOM', 'TABATA', 'FOR_TIME'] as const;

export function createBackupPayload(data: FullBackupData): BackupPayload {
  return {
    schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseBackupText(text: string): {
  fullBackupData?: FullBackupData;
  appState?: Record<string, unknown>;
} {
  assert(text.length <= MAX_BACKUP_TEXT_LENGTH, 'Backup payload is too large.');
  const parsed = JSON.parse(text) as {
    schemaVersion?: number;
    exportedAt?: string;
    data?: FullBackupData;
    state?: Record<string, unknown>;
  };

  assert(isRecord(parsed), 'Backup payload must be a JSON object.');

  if ('data' in parsed) {
    assert(
      parsed.schemaVersion === CURRENT_BACKUP_SCHEMA_VERSION,
      `Unsupported backup schema version. Expected ${CURRENT_BACKUP_SCHEMA_VERSION}.`
    );
    assert(isIsoDateTime(parsed.exportedAt), 'Backup payload is missing a valid export timestamp.');
    return { fullBackupData: validateFullBackupData(parsed.data) };
  }

  if ('state' in parsed) {
    return { appState: validateAppState(parsed.state) };
  }

  throw new Error('Invalid backup payload');
}

function validateFullBackupData(value: unknown): FullBackupData {
  assert(isRecord(value), 'Backup data must be an object.');

  const appState = validateAppState(value.appState);
  const cycles = validateCycles(value.cycles);
  const planDays = validatePlanDays(value.planDays);
  const workoutLogs = validateWorkoutLogs(value.workoutLogs);

  const cycleIds = new Set(cycles.map((cycle) => cycle.id));
  const planDayIds = new Set(planDays.map((day) => day.id));

  for (const day of planDays) {
    assert(cycleIds.has(day.cycle_id), `Plan day references unknown cycle "${day.cycle_id}".`);
  }

  for (const log of workoutLogs) {
    assert(cycleIds.has(log.cycle_id), `Workout log references unknown cycle "${log.cycle_id}".`);
    assert(planDayIds.has(log.plan_day_id), `Workout log references unknown plan day "${log.plan_day_id}".`);
  }

  return {
    appState,
    cycles,
    planDays,
    workoutLogs,
  };
}

function validateAppState(value: unknown): Record<string, unknown> {
  assert(isRecord(value), 'App state must be an object.');
  const entries = Object.entries(value);
  assert(entries.length <= MAX_APP_STATE_KEYS, 'App state contains too many keys.');

  for (const [key, entryValue] of entries) {
    assert(key.length > 0 && key.length <= MAX_KEY_LENGTH, `Invalid app state key "${key}".`);
    validateJsonValue(entryValue, `appState.${key}`, 0);
  }

  if ('settings' in value && value.settings !== undefined) {
    validateSettingsState(value.settings);
  }

  return value;
}

function validateSettingsState(value: unknown) {
  assert(isRecord(value), 'Settings state must be an object.');
  const entries = Object.entries(value);
  const allowedKeys = new Set([
    'soundEnabled',
    'hapticsEnabled',
    'vibrationEnabled',
    'themePreset',
    'defaultTimerMode',
    'defaultLeadInEnabled',
    'autoResetOnFinish',
    'weightUnit',
    'keepScreenAwake',
    'lockControlsWhileRunning',
    'voiceCueStyle',
    'voiceLeadInEnabled',
    'voiceEmomEnabled',
    'voiceTabataEnabled',
    'voiceAmrapEnabled',
  ]);

  for (const [key, entryValue] of entries) {
    assert(allowedKeys.has(key), `Settings contains an unknown key "${key}".`);
    switch (key) {
      case 'themePreset':
        assertEnum(entryValue, THEME_PRESETS, `settings.${key}`);
        break;
      case 'defaultTimerMode':
        assertEnum(entryValue, TIMER_DEFAULTS, `settings.${key}`);
        break;
      case 'voiceCueStyle':
        assertEnum(entryValue, VOICE_CUE_STYLES, `settings.${key}`);
        break;
      case 'weightUnit':
        assertEnum(entryValue, ['LB', 'KG'] as const, `settings.${key}`);
        break;
      default:
        assert(typeof entryValue === 'boolean', `settings.${key} must be a boolean.`);
        break;
    }
  }
}

function validateCycles(value: unknown): FullBackupData['cycles'] {
  assert(Array.isArray(value), 'Cycles must be an array.');
  assert(value.length <= MAX_CYCLES, 'Backup contains too many cycles.');

  return value.map((cycle, index) => {
    assert(isRecord(cycle), `cycles[${index}] must be an object.`);
    assertString(cycle.id, `cycles[${index}].id`, MAX_ID_LENGTH);
    assert(isIsoDateTime(cycle.created_at), `cycles[${index}].created_at must be an ISO datetime.`);
    assertString(cycle.label, `cycles[${index}].label`, MAX_LABEL_LENGTH);
    assertIntegerInRange(cycle.weeks, `cycles[${index}].weeks`, 1, 52);
    assert(cycle.is_active === 0 || cycle.is_active === 1, `cycles[${index}].is_active must be 0 or 1.`);
    return {
      id: cycle.id,
      created_at: cycle.created_at,
      label: cycle.label,
      weeks: cycle.weeks,
      is_active: cycle.is_active,
    };
  });
}

function validatePlanDays(value: unknown): FullBackupData['planDays'] {
  assert(Array.isArray(value), 'Plan days must be an array.');
  assert(value.length <= MAX_PLAN_DAYS, 'Backup contains too many plan days.');

  return value.map((day, index) => {
    assert(isRecord(day), `planDays[${index}] must be an object.`);
    assertString(day.id, `planDays[${index}].id`, MAX_ID_LENGTH);
    assertString(day.cycle_id, `planDays[${index}].cycle_id`, MAX_ID_LENGTH);
    assertIntegerInRange(day.week_index, `planDays[${index}].week_index`, 0, 52);
    assertIntegerInRange(day.day_index, `planDays[${index}].day_index`, 0, 6);
    assert(isIsoDate(day.date), `planDays[${index}].date must be an ISO date.`);
    assertEnum(day.kind, PLAN_DAY_KINDS, `planDays[${index}].kind`);
    assertString(day.title, `planDays[${index}].title`, MAX_LABEL_LENGTH);
    assertString(day.summary, `planDays[${index}].summary`, MAX_TEXT_LENGTH);
    assertIntegerInRange(day.duration_min, `planDays[${index}].duration_min`, 0, 360);
    assertString(day.format, `planDays[${index}].format`, MAX_FORMAT_LENGTH);
    assertEnum(day.status, PLAN_DAY_STATUSES, `planDays[${index}].status`);
    const movementPatterns = day.movement_patterns;
    assertString(movementPatterns, `planDays[${index}].movement_patterns`, MAX_TEXT_LENGTH);
    validateMovementPatternsJson(movementPatterns, `planDays[${index}].movement_patterns`);
    assert(day.cardio_flag === 0 || day.cardio_flag === 1, `planDays[${index}].cardio_flag must be 0 or 1.`);
    const requiredEquipment = day.required_equipment;
    assertString(requiredEquipment, `planDays[${index}].required_equipment`, MAX_TEXT_LENGTH);
    validateStringArrayJson(requiredEquipment, `planDays[${index}].required_equipment`, MAX_EQUIPMENT_ITEMS);
    assertFiniteNumber(day.volume_score, `planDays[${index}].volume_score`, 0, 10_000);

    return {
      id: day.id,
      cycle_id: day.cycle_id,
      week_index: day.week_index,
      day_index: day.day_index,
      date: day.date,
      kind: day.kind,
      title: day.title,
      summary: day.summary,
      duration_min: day.duration_min,
      format: day.format,
      status: day.status,
      movement_patterns: movementPatterns,
      cardio_flag: day.cardio_flag,
      required_equipment: requiredEquipment,
      volume_score: day.volume_score,
    };
  });
}

function validateWorkoutLogs(value: unknown): FullBackupData['workoutLogs'] {
  assert(Array.isArray(value), 'Workout logs must be an array.');
  assert(value.length <= MAX_WORKOUT_LOGS, 'Backup contains too many workout logs.');

  return value.map((log, index) => {
    assert(isRecord(log), `workoutLogs[${index}] must be an object.`);
    assertString(log.id, `workoutLogs[${index}].id`, MAX_ID_LENGTH);
    assertString(log.cycle_id, `workoutLogs[${index}].cycle_id`, MAX_ID_LENGTH);
    assertString(log.plan_day_id, `workoutLogs[${index}].plan_day_id`, MAX_ID_LENGTH);
    assert(isIsoDate(log.date), `workoutLogs[${index}].date must be an ISO date.`);
    assertEnum(log.status, PLAN_DAY_STATUSES, `workoutLogs[${index}].status`);
    assert(
      log.notes === null || log.notes === undefined || (typeof log.notes === 'string' && log.notes.length <= MAX_TEXT_LENGTH),
      `workoutLogs[${index}].notes must be null or a short string.`
    );
    assert(isIsoDateTime(log.logged_at), `workoutLogs[${index}].logged_at must be an ISO datetime.`);

    return {
      id: log.id,
      cycle_id: log.cycle_id,
      plan_day_id: log.plan_day_id,
      date: log.date,
      status: log.status,
      notes: log.notes ?? null,
      logged_at: log.logged_at,
    };
  });
}

function validateJsonValue(value: unknown, path: string, depth: number) {
  assert(depth <= MAX_JSON_DEPTH, `${path} is nested too deeply.`);
  if (value === null) {
    return;
  }
  if (typeof value === 'string') {
    assert(value.length <= MAX_TEXT_LENGTH, `${path} is too long.`);
    return;
  }
  if (typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number') {
    assert(Number.isFinite(value), `${path} must be a finite number.`);
    return;
  }
  if (Array.isArray(value)) {
    assert(value.length <= MAX_PLAN_DAYS, `${path} contains too many items.`);
    for (const [index, item] of value.entries()) {
      validateJsonValue(item, `${path}[${index}]`, depth + 1);
    }
    return;
  }
  assert(isRecord(value), `${path} must be a JSON-safe object.`);
  const entries = Object.entries(value);
  assert(entries.length <= MAX_PLAN_DAYS, `${path} contains too many keys.`);
  for (const [key, nested] of entries) {
    assert(key.length > 0 && key.length <= MAX_KEY_LENGTH, `${path} contains an invalid key.`);
    validateJsonValue(nested, `${path}.${key}`, depth + 1);
  }
}

function validateMovementPatternsJson(value: unknown, path: string) {
  const parsed = parseJsonArrayString(value, path);
  assert(parsed.length <= MAX_MOVEMENT_PATTERNS, `${path} contains too many movement patterns.`);
  for (const [index, item] of parsed.entries()) {
    assertEnum(item, MOVEMENT_PATTERNS, `${path}[${index}]`);
  }
}

function validateStringArrayJson(value: unknown, path: string, maxItems: number) {
  const parsed = parseJsonArrayString(value, path);
  assert(parsed.length <= maxItems, `${path} contains too many items.`);
  for (const [index, item] of parsed.entries()) {
    assertString(item, `${path}[${index}]`, MAX_LABEL_LENGTH);
  }
}

function parseJsonArrayString(value: unknown, path: string): string[] {
  assert(typeof value === 'string', `${path} must be a JSON string.`);
  assert(value.length <= MAX_TEXT_LENGTH, `${path} is too long.`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`${path} must contain valid JSON.`);
  }
  assert(Array.isArray(parsed), `${path} must encode an array.`);
  parsed.forEach((item, index) => {
    assert(typeof item === 'string', `${path}[${index}] must be a string.`);
  });
  return parsed;
}

function assertString(value: unknown, path: string, maxLength: number): asserts value is string {
  assert(typeof value === 'string' && value.length > 0 && value.length <= maxLength, `${path} must be a non-empty string.`);
}

function assertIntegerInRange(value: unknown, path: string, min: number, max: number): asserts value is number {
  assert(typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max, `${path} must be an integer between ${min} and ${max}.`);
}

function assertFiniteNumber(value: unknown, path: string, min: number, max: number): asserts value is number {
  assert(typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max, `${path} must be a finite number between ${min} and ${max}.`);
}

function assertEnum<const T extends readonly string[]>(value: unknown, allowed: T, path: string): asserts value is T[number] {
  assert(typeof value === 'string' && (allowed as readonly string[]).includes(value), `${path} must be one of ${allowed.join(', ')}.`);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
