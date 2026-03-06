import { describe, expect, test } from 'vitest';

import { computeProgressSnapshot } from '@/data/gaps';
import type { PlanDayRecord, WorkoutLogRecord } from '@/data/types';

const cycleId = 'cycle_1';

function planDay(overrides: Partial<PlanDayRecord>): PlanDayRecord {
  return {
    id: 'day_default',
    cycleId,
    weekIndex: 0,
    dayIndex: 1,
    date: '2026-03-02',
    kind: 'workout',
    title: 'Workout',
    summary: 'Summary',
    durationMin: 45,
    format: 'STRENGTH',
    status: 'planned',
    movementPatterns: ['push', 'pull'],
    cardio: false,
    requiredEquipment: ['db'],
    volumeScore: 4,
    ...overrides,
  };
}

function workoutLog(overrides: Partial<WorkoutLogRecord>): WorkoutLogRecord {
  return {
    id: 'log_default',
    cycleId,
    planDayId: 'day_default',
    date: '2026-03-02',
    status: 'completed',
    notes: null,
    loggedAt: '2026-03-02T10:00:00.000Z',
    ...overrides,
  };
}

describe('computeProgressSnapshot', () => {
  test('includes note text in completion history', () => {
    const days = [planDay({ id: 'day_1', title: 'Lower Strength' })];
    const logs = [
      workoutLog({
        id: 'log_1',
        planDayId: 'day_1',
        notes: 'Felt heavy. Increase next time',
      }),
    ];

    const snapshot = computeProgressSnapshot(days, logs, ['db']);

    expect(snapshot.history[0]).toMatchObject({
      title: 'Lower Strength',
      status: 'completed',
      notes: 'Felt heavy. Increase next time',
    });
  });

  test('treats skipped workouts as part of planned work instead of erasing them', () => {
    const days = [
      planDay({ id: 'day_1', date: '2026-03-01', title: 'Workout A' }),
      planDay({ id: 'day_2', date: '2026-03-03', title: 'Workout B' }),
      planDay({ id: 'day_3', date: '2026-03-05', title: 'Workout C' }),
    ];
    const logs = [
      workoutLog({ id: 'log_1', planDayId: 'day_1', date: '2026-03-01', status: 'completed' }),
      workoutLog({ id: 'log_2', planDayId: 'day_2', date: '2026-03-03', status: 'skipped', notes: 'Cut short' }),
    ];

    const snapshot = computeProgressSnapshot(days, logs, ['db']);

    expect(snapshot.cycle.planned).toBe(3);
    expect(snapshot.cycle.completed).toBe(1);
    expect(snapshot.cycle.skipped).toBe(1);
  });
});
