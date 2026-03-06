import { describe, expect, test } from 'vitest';

import { buildSkipBumpAssignments, type DbPlanDayLike } from '@/data/plan-day-ops';

function workoutRow(overrides: Partial<DbPlanDayLike> = {}): DbPlanDayLike {
  return {
    id: 'day_default',
    cycle_id: 'cycle_1',
    week_index: 0,
    day_index: 1,
    date: '2026-03-02',
    kind: 'workout',
    title: 'Workout',
    summary: 'Session',
    duration_min: 45,
    format: 'STRENGTH',
    status: 'planned',
    movement_patterns: JSON.stringify(['push', 'pull']),
    cardio_flag: 0,
    required_equipment: JSON.stringify(['db']),
    volume_score: 4,
    ...overrides,
  };
}

describe('buildSkipBumpAssignments', () => {
  test('keeps the last workout as skipped instead of turning it into rest', () => {
    const rows = [
      workoutRow({ id: 'day_1', day_index: 1, title: 'Day 1' }),
      workoutRow({ id: 'day_2', day_index: 3, title: 'Day 2' }),
    ];

    const assignments = buildSkipBumpAssignments(rows, 'day_2');

    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({
      dayId: 'day_2',
      assignment: {
        kind: 'workout',
        status: 'skipped',
        title: 'Day 2',
      },
    });
  });

  test('shifts later workouts forward and moves the skipped workout to the tail', () => {
    const rows = [
      workoutRow({ id: 'day_1', day_index: 1, title: 'Lower Strength', format: 'STRENGTH' }),
      workoutRow({ id: 'day_2', day_index: 3, title: 'Mixed Metcon', format: 'EMOM', cardio_flag: 1 }),
      workoutRow({ id: 'day_3', day_index: 5, title: 'Recovery Flow', format: 'RECOVERY', movement_patterns: JSON.stringify(['rotation']) }),
    ];

    const assignments = buildSkipBumpAssignments(rows, 'day_1');

    expect(assignments).toHaveLength(3);
    expect(assignments[0]).toMatchObject({
      dayId: 'day_1',
      assignment: {
        title: 'Mixed Metcon',
        format: 'EMOM',
        status: 'planned',
      },
    });
    expect(assignments[1]).toMatchObject({
      dayId: 'day_2',
      assignment: {
        title: 'Recovery Flow',
        format: 'RECOVERY',
        status: 'planned',
      },
    });
    expect(assignments[2]).toMatchObject({
      dayId: 'day_3',
      assignment: {
        title: 'Lower Strength',
        kind: 'workout',
        status: 'skipped',
      },
    });
  });
});
