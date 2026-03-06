import type { MovementPattern, PlanDayRecord, PlanDayStatus, WorkoutLogRecord } from '@/data/types';

export type ProgressGap = {
  label: string;
  detail: string;
};

export type EquipmentGap = {
  label: string;
  detail: string;
};

export type CompletionHistoryItem = {
  id: string;
  date: string;
  status: PlanDayStatus;
  title: string;
  notes: string | null;
};

export type ProgressSnapshot = {
  week: {
    completed: number;
    planned: number;
    skipped: number;
    percent: number;
  };
  cycle: {
    completed: number;
    planned: number;
    skipped: number;
    percent: number;
  };
  history: CompletionHistoryItem[];
  gaps: ProgressGap[];
  equipmentGaps: EquipmentGap[];
};

type DayStatusView = {
  day: PlanDayRecord;
  status: PlanDayStatus;
};

const EQUIPMENT_LABELS: Record<string, string> = {
  rack: 'Power rack',
  bench: 'Adjustable bench',
  db: 'Dumbbells',
  kb: 'Kettlebells',
  bb: 'Barbell + plates',
  pullup: 'Pull-up bar',
  bands: 'Resistance bands',
  rower: 'Rower',
  bike: 'Assault bike',
  rings: 'Gymnastic rings',
  box: 'Plyo box',
  sled: 'Sled',
};

const PATTERN_LABELS: Record<MovementPattern, string> = {
  push: 'push',
  pull: 'pull',
  squat: 'squat',
  hinge: 'hinge',
  lunge: 'single-leg',
  core: 'core',
  carry: 'carry',
  rotation: 'rotation',
  cardio: 'cardio',
};

function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function startOfWeekSunday(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function roundPercent(value: number) {
  return Math.round(value * 100);
}

function latestStatusByDay(logs: WorkoutLogRecord[]) {
  const byDay = new Map<string, WorkoutLogRecord>();
  const ordered = [...logs].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
  for (const log of ordered) {
    byDay.set(log.planDayId, log);
  }
  return byDay;
}

function resolveDayStates(days: PlanDayRecord[], logs: WorkoutLogRecord[]) {
  const latestByDay = latestStatusByDay(logs);
  return days.map((day) => ({
    day,
    status: latestByDay.get(day.id)?.status ?? day.status,
  }));
}

function computeCompletion(view: DayStatusView[]) {
  const workoutDays = view.filter((item) => item.day.kind === 'workout');
  const completed = workoutDays.filter((item) => item.status === 'completed').length;
  const skipped = workoutDays.filter((item) => item.status === 'skipped').length;
  const planned = workoutDays.length;
  const percent = planned === 0 ? 0 : roundPercent(completed / planned);
  return { completed, skipped, planned, percent };
}

function computePatternVolume(view: DayStatusView[]) {
  const totals = new Map<MovementPattern, number>();
  for (const { day, status } of view) {
    if (day.kind !== 'workout' || status !== 'completed' || day.movementPatterns.length === 0) {
      continue;
    }
    const perPattern = day.volumeScore / day.movementPatterns.length;
    for (const pattern of day.movementPatterns) {
      totals.set(pattern, (totals.get(pattern) ?? 0) + perPattern);
    }
  }
  return totals;
}

function pushCardioGap(gaps: ProgressGap[], weekView: DayStatusView[]) {
  const cardioCompleted = weekView.filter(
    (item) => item.day.kind === 'workout' && item.status === 'completed' && item.day.cardio
  ).length;
  if (cardioCompleted >= 2) {
    return;
  }
  gaps.push({
    label: 'Missing cardio frequency',
    detail: `${cardioCompleted}/2 cardio workouts completed this Sunday-start week.`,
  });
}

function pushPairImbalanceGap(gaps: ProgressGap[], volumes: Map<MovementPattern, number>) {
  const pairs: Array<[MovementPattern, MovementPattern]> = [
    ['push', 'pull'],
    ['squat', 'hinge'],
  ];

  for (const [a, b] of pairs) {
    const aVolume = volumes.get(a) ?? 0;
    const bVolume = volumes.get(b) ?? 0;
    const total = aVolume + bVolume;
    if (total === 0) {
      continue;
    }
    const diffPct = Math.abs(aVolume - bVolume) / total;
    if (diffPct <= 0.2) {
      continue;
    }
    const leader = aVolume >= bVolume ? a : b;
    gaps.push({
      label: 'Movement pattern imbalance',
      detail: `${PATTERN_LABELS[leader]} volume is ${Math.round(diffPct * 100)}% higher than its pair.`,
    });
    return;
  }
}

function pushVolumeDominanceGap(gaps: ProgressGap[], volumes: Map<MovementPattern, number>) {
  const entries = Array.from(volumes.entries()).filter(([, value]) => value > 0);
  if (entries.length < 2) {
    return;
  }
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  entries.sort((a, b) => b[1] - a[1]);
  const [topPattern, topVolume] = entries[0];
  const topShare = topVolume / total;
  if (topShare <= 0.45) {
    return;
  }
  gaps.push({
    label: 'Volume imbalance by pattern',
    detail: `${PATTERN_LABELS[topPattern]} is ${Math.round(topShare * 100)}% of completed weekly volume.`,
  });
}

function computeEquipmentGaps(days: PlanDayRecord[], ownedEquipment: string[]) {
  const owned = new Set(ownedEquipment);
  const upcoming = days.filter((day) => day.kind === 'workout' && day.status !== 'completed').slice(0, 14);
  const missing = new Map<string, { workouts: number; patterns: Set<MovementPattern> }>();

  for (const day of upcoming) {
    const uniqueMissing = Array.from(new Set(day.requiredEquipment.filter((id) => !owned.has(id))));
    for (const equipmentId of uniqueMissing) {
      const entry = missing.get(equipmentId) ?? { workouts: 0, patterns: new Set<MovementPattern>() };
      entry.workouts += 1;
      for (const pattern of day.movementPatterns) {
        entry.patterns.add(pattern);
      }
      missing.set(equipmentId, entry);
    }
  }

  return Array.from(missing.entries())
    .sort((a, b) => b[1].workouts - a[1].workouts)
    .slice(0, 4)
    .map(([equipmentId, entry]) => {
      const label = EQUIPMENT_LABELS[equipmentId] ?? equipmentId;
      const patterns = Array.from(entry.patterns).slice(0, 2).map((pattern) => PATTERN_LABELS[pattern]);
      const patternText = patterns.length ? ` (${patterns.join(', ')})` : '';
      return {
        label,
        detail: `Missing in ${entry.workouts} upcoming workouts${patternText}.`,
      };
    });
}

function buildHistory(days: PlanDayRecord[], logs: WorkoutLogRecord[]) {
  const dayMap = new Map(days.map((day) => [day.id, day]));
  return [...logs]
    .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, 12)
    .map((log) => ({
      id: log.id,
      date: log.date,
      status: log.status,
      title: dayMap.get(log.planDayId)?.title ?? 'Workout',
      notes: log.notes,
    }));
}

export function computeProgressSnapshot(
  days: PlanDayRecord[],
  logs: WorkoutLogRecord[],
  ownedEquipment: string[]
): ProgressSnapshot {
  const now = new Date();
  const currentWeekStart = startOfWeekSunday(now);
  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  const dayView = resolveDayStates(days, logs);
  const weekView = dayView.filter((item) => {
    const date = parseIsoDate(item.day.date);
    return date >= currentWeekStart && date < nextWeekStart;
  });

  const cycle = computeCompletion(dayView);
  const week = computeCompletion(weekView);
  const gaps: ProgressGap[] = [];
  const patternVolume = computePatternVolume(weekView);

  pushCardioGap(gaps, weekView);
  pushPairImbalanceGap(gaps, patternVolume);
  pushVolumeDominanceGap(gaps, patternVolume);

  return {
    week,
    cycle,
    history: buildHistory(days, logs),
    gaps,
    equipmentGaps: computeEquipmentGaps(days, ownedEquipment),
  };
}
