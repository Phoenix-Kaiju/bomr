export type PlanDayStatus = 'planned' | 'completed' | 'skipped';
export type PlanDayKind = 'workout' | 'rest';
export type MovementPattern = 'push' | 'pull' | 'squat' | 'hinge' | 'lunge' | 'core' | 'carry' | 'rotation' | 'cardio';

export type CycleRecord = {
  id: string;
  createdAt: string;
  label: string;
  weeks: number;
  isActive: boolean;
};

export type PlanDayRecord = {
  id: string;
  cycleId: string;
  weekIndex: number;
  dayIndex: number;
  date: string;
  kind: PlanDayKind;
  title: string;
  summary: string;
  durationMin: number;
  format: string;
  status: PlanDayStatus;
  movementPatterns: MovementPattern[];
  cardio: boolean;
  requiredEquipment: string[];
  volumeScore: number;
};

export type PlanSeedDay = Omit<PlanDayRecord, 'id' | 'cycleId'>;

export type PersistedPlan = {
  cycle: Omit<CycleRecord, 'isActive'>;
  days: PlanSeedDay[];
};

export type WorkoutLogRecord = {
  id: string;
  cycleId: string;
  planDayId: string;
  date: string;
  status: PlanDayStatus;
  notes: string | null;
  loggedAt: string;
};
