import * as SQLite from 'expo-sqlite';

import { buildSkipBumpAssignments, mapRowAssignment, type PlanDayAssignment } from '@/data/plan-day-ops';
import type {
  CycleRecord,
  MovementPattern,
  PersistedPlan,
  PlanDayKind,
  PlanDayRecord,
  PlanDayStatus,
  WorkoutLogRecord,
} from '@/data/types';

let dbInstance: SQLite.SQLiteDatabase | null = null;

const REST_TEMPLATE = {
  kind: 'rest' as const,
  title: 'Rest Day',
  summary: 'Recovery and mobility.',
  durationMin: 0,
  format: 'REST',
  status: 'planned' as const,
  movementPatterns: [] as MovementPattern[],
  cardio: false,
  requiredEquipment: [] as string[],
  volumeScore: 0,
};

type DbCycleRow = {
  id: string;
  created_at: string;
  label: string;
  weeks: number;
  is_active: number;
};

type DbPlanDayRow = {
  id: string;
  cycle_id: string;
  week_index: number;
  day_index: number;
  date: string;
  kind: PlanDayKind;
  title: string;
  summary: string;
  duration_min: number;
  format: string;
  status: PlanDayStatus;
  movement_patterns: string;
  cardio_flag: number;
  required_equipment: string;
  volume_score: number;
};

type DbWorkoutLogRow = {
  id: string;
  cycle_id: string;
  plan_day_id: string;
  date: string;
  status: PlanDayStatus;
  notes: string | null;
  logged_at: string;
};

export type FullBackupData = {
  appState: Record<string, unknown>;
  cycles: DbCycleRow[];
  planDays: DbPlanDayRow[];
  workoutLogs: DbWorkoutLogRow[];
};

function mapCycle(row: DbCycleRow): CycleRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    label: row.label,
    weeks: row.weeks,
    isActive: row.is_active === 1,
  };
}

function mapPlanDay(row: DbPlanDayRow): PlanDayRecord {
  const parseMovementPatterns = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [] as MovementPattern[];
      }
      return parsed.filter(
        (item): item is MovementPattern =>
          item === 'push' ||
          item === 'pull' ||
          item === 'squat' ||
          item === 'hinge' ||
          item === 'lunge' ||
          item === 'core' ||
          item === 'carry' ||
          item === 'rotation' ||
          item === 'cardio'
      );
    } catch {
      return [] as MovementPattern[];
    }
  };
  const parseStringArray = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [] as string[];
      }
      return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
      return [] as string[];
    }
  };

  return {
    id: row.id,
    cycleId: row.cycle_id,
    weekIndex: row.week_index,
    dayIndex: row.day_index,
    date: row.date,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    durationMin: row.duration_min,
    format: row.format,
    status: row.status,
    movementPatterns: parseMovementPatterns(row.movement_patterns),
    cardio: row.cardio_flag === 1,
    requiredEquipment: parseStringArray(row.required_equipment),
    volumeScore: row.volume_score,
  };
}

function mapWorkoutLog(row: DbWorkoutLogRow): WorkoutLogRecord {
  return {
    id: row.id,
    cycleId: row.cycle_id,
    planDayId: row.plan_day_id,
    date: row.date,
    status: row.status,
    notes: row.notes,
    loggedAt: row.logged_at,
  };
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function withTransaction<T>(fn: (db: SQLite.SQLiteDatabase) => Promise<T>) {
  const db = await getDb();
  await db.execAsync('BEGIN TRANSACTION;');
  try {
    const result = await fn(db);
    await db.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await db.execAsync('ROLLBACK;');
    throw error;
  }
}

async function hasColumn(db: SQLite.SQLiteDatabase, table: string, column: string) {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return rows.some((row) => row.name === column);
}

async function ensureColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string
) {
  if (await hasColumn(db, table, column)) {
    return;
  }
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

async function runMigrations(db: SQLite.SQLiteDatabase) {
  await ensureColumn(db, 'plan_days', 'movement_patterns', `TEXT NOT NULL DEFAULT '[]'`);
  await ensureColumn(db, 'plan_days', 'cardio_flag', 'INTEGER NOT NULL DEFAULT 0');
  await ensureColumn(db, 'plan_days', 'required_equipment', `TEXT NOT NULL DEFAULT '[]'`);
  await ensureColumn(db, 'plan_days', 'volume_score', 'REAL NOT NULL DEFAULT 0');
}

async function getDb() {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('bomr.db');
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cycles (
        id TEXT PRIMARY KEY NOT NULL,
        created_at TEXT NOT NULL,
        label TEXT NOT NULL,
        weeks INTEGER NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS plan_days (
        id TEXT PRIMARY KEY NOT NULL,
        cycle_id TEXT NOT NULL,
        week_index INTEGER NOT NULL,
        day_index INTEGER NOT NULL,
        date TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('workout', 'rest')),
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        duration_min INTEGER NOT NULL,
        format TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'skipped')),
        movement_patterns TEXT NOT NULL DEFAULT '[]',
        cardio_flag INTEGER NOT NULL DEFAULT 0,
        required_equipment TEXT NOT NULL DEFAULT '[]',
        volume_score REAL NOT NULL DEFAULT 0,
        FOREIGN KEY (cycle_id) REFERENCES cycles(id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_days_cycle_date ON plan_days (cycle_id, date);
      CREATE INDEX IF NOT EXISTS idx_plan_days_cycle_week_day ON plan_days (cycle_id, week_index, day_index);

      CREATE TABLE IF NOT EXISTS workout_logs (
        id TEXT PRIMARY KEY NOT NULL,
        cycle_id TEXT NOT NULL,
        plan_day_id TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'skipped')),
        notes TEXT,
        logged_at TEXT NOT NULL,
        FOREIGN KEY (cycle_id) REFERENCES cycles(id),
        FOREIGN KEY (plan_day_id) REFERENCES plan_days(id)
      );
    `);
    await runMigrations(dbInstance);
  }
  return dbInstance;
}

async function logWorkoutEvent(
  db: SQLite.SQLiteDatabase,
  payload: { cycleId: string; planDayId: string; date: string; status: PlanDayStatus; notes?: string | null }
) {
  await db.runAsync(
    `INSERT INTO workout_logs (id, cycle_id, plan_day_id, date, status, notes, logged_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomId('log'),
      payload.cycleId,
      payload.planDayId,
      payload.date,
      payload.status,
      payload.notes ?? null,
      new Date().toISOString(),
    ]
  );
}

async function applyPlanDayAssignment(
  db: SQLite.SQLiteDatabase,
  dayId: string,
  assignment: Omit<PlanDayRecord, 'id' | 'cycleId' | 'weekIndex' | 'dayIndex' | 'date'>
) {
  await db.runAsync(
    `UPDATE plan_days
     SET kind = ?, title = ?, summary = ?, duration_min = ?, format = ?, status = ?, movement_patterns = ?, cardio_flag = ?, required_equipment = ?, volume_score = ?
     WHERE id = ?`,
    [
      assignment.kind,
      assignment.title,
      assignment.summary,
      assignment.durationMin,
      assignment.format,
      assignment.status,
      JSON.stringify(assignment.movementPatterns),
      assignment.cardio ? 1 : 0,
      JSON.stringify(assignment.requiredEquipment),
      assignment.volumeScore,
      dayId,
    ]
  );
}


export async function getState<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ value: string }>(
    'SELECT value FROM app_state WHERE key = ?',
    [key]
  );
  if (!rows.length) {
    return null;
  }
  return JSON.parse(rows[0].value) as T;
}

export async function setState<T>(key: string, value: T) {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', [
    key,
    JSON.stringify(value),
  ]);
}

export async function getAllState(): Promise<Record<string, unknown>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM app_state'
  );
  const output: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      output[row.key] = JSON.parse(row.value);
    } catch {
      output[row.key] = row.value;
    }
  }
  return output;
}

export async function replaceAllState(nextState: Record<string, unknown>) {
  await withTransaction(async (db) => {
    await db.execAsync('DELETE FROM app_state;');
    for (const [key, value] of Object.entries(nextState)) {
      await db.runAsync('INSERT INTO app_state (key, value) VALUES (?, ?)', [
        key,
        JSON.stringify(value),
      ]);
    }
  });
}

async function clearPlanTables(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    DELETE FROM workout_logs;
    DELETE FROM plan_days;
    DELETE FROM cycles;
  `);
}

export async function getFullBackupData(): Promise<FullBackupData> {
  const db = await getDb();
  const [appState, cycles, planDays, workoutLogs] = await Promise.all([
    getAllState(),
    db.getAllAsync<DbCycleRow>(
      'SELECT id, created_at, label, weeks, is_active FROM cycles ORDER BY created_at ASC'
    ),
    db.getAllAsync<DbPlanDayRow>(
      `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
       FROM plan_days
       ORDER BY cycle_id ASC, week_index ASC, day_index ASC`
    ),
    db.getAllAsync<DbWorkoutLogRow>(
      `SELECT id, cycle_id, plan_day_id, date, status, notes, logged_at
       FROM workout_logs
       ORDER BY logged_at ASC`
    ),
  ]);

  return {
    appState,
    cycles,
    planDays,
    workoutLogs,
  };
}

export async function restoreFullBackupData(data: FullBackupData) {
  await withTransaction(async (db) => {
    await db.execAsync('DELETE FROM app_state;');
    await clearPlanTables(db);

    for (const [key, value] of Object.entries(data.appState)) {
      await db.runAsync('INSERT INTO app_state (key, value) VALUES (?, ?)', [
        key,
        JSON.stringify(value),
      ]);
    }

    for (const cycle of data.cycles) {
      await db.runAsync(
        `INSERT INTO cycles (id, created_at, label, weeks, is_active)
         VALUES (?, ?, ?, ?, ?)`,
        [cycle.id, cycle.created_at, cycle.label, cycle.weeks, cycle.is_active]
      );
    }

    for (const day of data.planDays) {
      await db.runAsync(
        `INSERT INTO plan_days
         (id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          day.id,
          day.cycle_id,
          day.week_index,
          day.day_index,
          day.date,
          day.kind,
          day.title,
          day.summary,
          day.duration_min,
          day.format,
          day.status,
          day.movement_patterns,
          day.cardio_flag,
          day.required_equipment,
          day.volume_score,
        ]
      );
    }

    for (const log of data.workoutLogs) {
      await db.runAsync(
        `INSERT INTO workout_logs (id, cycle_id, plan_day_id, date, status, notes, logged_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [log.id, log.cycle_id, log.plan_day_id, log.date, log.status, log.notes, log.logged_at]
      );
    }
  });
}

export async function resetAllData(nextState: Record<string, unknown> = {}) {
  await withTransaction(async (db) => {
    await db.execAsync('DELETE FROM app_state;');
    await clearPlanTables(db);

    for (const [key, value] of Object.entries(nextState)) {
      await db.runAsync('INSERT INTO app_state (key, value) VALUES (?, ?)', [
        key,
        JSON.stringify(value),
      ]);
    }
  });
}

export async function replacePlan(plan: PersistedPlan) {
  await withTransaction(async (db) => {
    await db.runAsync('UPDATE cycles SET is_active = 0');
    await db.runAsync(
      `INSERT OR REPLACE INTO cycles (id, created_at, label, weeks, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [plan.cycle.id, plan.cycle.createdAt, plan.cycle.label, plan.cycle.weeks]
    );

    await db.runAsync('DELETE FROM plan_days WHERE cycle_id = ?', [plan.cycle.id]);
    for (const day of plan.days) {
      await db.runAsync(
        `INSERT INTO plan_days
         (id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomId('day'),
          plan.cycle.id,
          day.weekIndex,
          day.dayIndex,
          day.date,
          day.kind,
          day.title,
          day.summary,
          day.durationMin,
          day.format,
          day.status,
          JSON.stringify(day.movementPatterns),
          day.cardio ? 1 : 0,
          JSON.stringify(day.requiredEquipment),
          day.volumeScore,
        ]
      );
    }
  });
}

export async function getActiveCycle(): Promise<CycleRecord | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<DbCycleRow>(
    'SELECT id, created_at, label, weeks, is_active FROM cycles WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1'
  );
  if (!rows.length) {
    return null;
  }
  return mapCycle(rows[0]);
}

export async function getPlanDaysForWeek(cycleId: string, weekIndex: number): Promise<PlanDayRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DbPlanDayRow>(
    `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
     FROM plan_days
     WHERE cycle_id = ? AND week_index = ?
     ORDER BY day_index ASC`,
    [cycleId, weekIndex]
  );
  return rows.map(mapPlanDay);
}

export async function getPlanDaysForCycle(cycleId: string): Promise<PlanDayRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DbPlanDayRow>(
    `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
     FROM plan_days
     WHERE cycle_id = ?
     ORDER BY week_index ASC, day_index ASC`,
    [cycleId]
  );
  return rows.map(mapPlanDay);
}

export async function getPlanDayById(dayId: string): Promise<PlanDayRecord | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<DbPlanDayRow>(
    `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
     FROM plan_days
     WHERE id = ?
     LIMIT 1`,
    [dayId]
  );
  if (!rows.length) {
    return null;
  }
  return mapPlanDay(rows[0]);
}

export async function getWeekIndexForDate(cycleId: string, isoDate: string): Promise<number | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ week_index: number }>(
    `SELECT week_index
     FROM plan_days
     WHERE cycle_id = ? AND date = ?
     LIMIT 1`,
    [cycleId, isoDate]
  );
  if (!rows.length) {
    return null;
  }
  return rows[0].week_index;
}

export async function setPlanDayStatus(dayId: string, status: PlanDayStatus, notes?: string | null) {
  await withTransaction(async (db) => {
    const rows = await db.getAllAsync<DbPlanDayRow>(
      `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
       FROM plan_days
       WHERE id = ?
       LIMIT 1`,
      [dayId]
    );
    if (!rows.length) {
      return;
    }
    const day = rows[0];
    await db.runAsync('UPDATE plan_days SET status = ? WHERE id = ?', [status, dayId]);
    await logWorkoutEvent(db, {
      cycleId: day.cycle_id,
      planDayId: day.id,
      date: day.date,
      status,
      notes,
    });
  });
}

export async function movePlanDayWithinWeek(sourceDayId: string, targetDayId: string) {
  await withTransaction(async (db) => {
    const rows = await db.getAllAsync<DbPlanDayRow>(
      `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
       FROM plan_days
       WHERE id IN (?, ?)`,
      [sourceDayId, targetDayId]
    );

    if (rows.length !== 2) {
      return;
    }

    const source = rows.find((row) => row.id === sourceDayId);
    const target = rows.find((row) => row.id === targetDayId);

    if (!source || !target || source.cycle_id !== target.cycle_id || source.week_index !== target.week_index) {
      return;
    }

    const sourceAssignment = mapRowAssignment(source);
    const targetAssignment = mapRowAssignment(target);

    await applyPlanDayAssignment(db, source.id, targetAssignment);
    await applyPlanDayAssignment(db, target.id, sourceAssignment);
  });
}

export async function overridePlanDayKind(dayId: string, kind: PlanDayKind) {
  await withTransaction(async (db) => {
    const rows = await db.getAllAsync<DbPlanDayRow>(
      `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
       FROM plan_days
       WHERE id = ?
       LIMIT 1`,
      [dayId]
    );
    if (!rows.length) {
      return;
    }

    const day = rows[0];
    if (kind === day.kind) {
      return;
    }

    if (kind === 'rest') {
      await applyPlanDayAssignment(db, day.id, REST_TEMPLATE);
      return;
    }

    await applyPlanDayAssignment(db, day.id, {
      kind: 'workout',
      title: day.title === 'Rest Day' ? 'Custom Workout' : day.title,
      summary: day.summary === REST_TEMPLATE.summary ? 'Added manually from Calendar.' : day.summary,
      durationMin: day.duration_min > 0 ? day.duration_min : 40,
      format: day.format === 'REST' ? 'CUSTOM' : day.format,
      status: day.status === 'completed' ? 'completed' : 'planned',
      movementPatterns: mapPlanDay(day).movementPatterns,
      cardio: day.cardio_flag === 1,
      requiredEquipment: mapPlanDay(day).requiredEquipment,
      volumeScore: day.volume_score > 0 ? day.volume_score : 3,
    });
  });
}

export async function skipWorkoutWithAutoBump(dayId: string, notes?: string | null) {
  await withTransaction(async (db) => {
    const currentRows = await db.getAllAsync<DbPlanDayRow>(
      `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
       FROM plan_days
       WHERE id = ?
       LIMIT 1`,
      [dayId]
    );

    if (!currentRows.length) {
      return;
    }

    const current = currentRows[0];
    if (current.kind !== 'workout' || current.status === 'completed') {
      return;
    }

    await logWorkoutEvent(db, {
      cycleId: current.cycle_id,
      planDayId: current.id,
      date: current.date,
      status: 'skipped',
      notes,
    });

    const weekRows = await db.getAllAsync<DbPlanDayRow>(
      `SELECT id, cycle_id, week_index, day_index, date, kind, title, summary, duration_min, format, status, movement_patterns, cardio_flag, required_equipment, volume_score
       FROM plan_days
       WHERE cycle_id = ? AND week_index = ?
       ORDER BY day_index ASC`,
      [current.cycle_id, current.week_index]
    );

    const assignments = buildSkipBumpAssignments(weekRows, dayId);
    if (!assignments.length) {
      return;
    }
    for (const assignment of assignments) {
      await applyPlanDayAssignment(db, assignment.dayId, assignment.assignment);
    }
  });
}

export async function getWorkoutLogs(cycleId: string, limit = 100): Promise<WorkoutLogRecord[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<DbWorkoutLogRow>(
    `SELECT id, cycle_id, plan_day_id, date, status, notes, logged_at
     FROM workout_logs
     WHERE cycle_id = ?
     ORDER BY logged_at DESC
     LIMIT ?`,
    [cycleId, limit]
  );

  return rows.map(mapWorkoutLog);
}
