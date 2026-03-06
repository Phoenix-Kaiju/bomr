import type { PlanDayKind, PlanDayRecord, PlanDayStatus } from '@/data/types';

export type PlanDayAssignment = Omit<
  PlanDayRecord,
  'id' | 'cycleId' | 'weekIndex' | 'dayIndex' | 'date'
>;

export type DbPlanDayLike = {
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

export type SkipBumpAssignment = {
  dayId: string;
  assignment: PlanDayAssignment;
};

function parseMovementPatterns(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is PlanDayRecord['movementPatterns'][number] => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseStringArray(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function mapRowAssignment(row: DbPlanDayLike): PlanDayAssignment {
  return {
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

export function buildSkipBumpAssignments(weekRows: DbPlanDayLike[], dayId: string): SkipBumpAssignment[] {
  const workouts = weekRows.filter((row) => row.kind === 'workout');
  const workoutIndex = workouts.findIndex((row) => row.id === dayId);

  if (workoutIndex === -1) {
    return [];
  }

  const current = workouts[workoutIndex];
  const skippedWorkout: PlanDayAssignment = {
    ...mapRowAssignment(current),
    status: 'skipped',
  };

  if (workoutIndex === workouts.length - 1) {
    return [{ dayId: current.id, assignment: skippedWorkout }];
  }

  const assignments: SkipBumpAssignment[] = [];
  for (let index = workoutIndex; index < workouts.length - 1; index += 1) {
    assignments.push({
      dayId: workouts[index].id,
      assignment: mapRowAssignment(workouts[index + 1]),
    });
  }

  assignments.push({
    dayId: workouts[workouts.length - 1].id,
    assignment: skippedWorkout,
  });

  return assignments;
}
