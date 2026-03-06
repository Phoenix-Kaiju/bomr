import { EQUIPMENT_LABELS, WORKOUT_LIBRARY, type WorkoutTarget, type WorkoutTemplate } from '@/data/exercise-library';
import type { MovementPattern, PersistedPlan, PlanDayKind, PlanSeedDay } from '@/data/types';

type Target = { id: string; label: string; value: number };
type Constraints = {
  daysPerWeek: number;
  durationMin: number;
  preferredDays: string[];
};

export type BuildInputs = {
  targets: Target[];
  constraints: Constraints;
  styles: string[];
  ownedEquipment?: string[];
};

type FocusCounts = Record<WorkoutTarget, number>;
type PhaseMeta = {
  label: string;
  volumeMultiplier: number;
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TARGET_IDS: WorkoutTarget[] = ['strength', 'conditioning', 'mobility'];

function startOfWeekSunday(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - day);
  return start;
}

function addDays(date: Date, offset: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeWorkoutDays(constraints: Constraints) {
  const dayOrder = constraints.preferredDays
    .map((name) => DAY_NAMES.indexOf(name))
    .filter((index) => index >= 0);
  const unique = Array.from(new Set(dayOrder)).sort((a, b) => a - b);

  if (unique.length >= constraints.daysPerWeek) {
    return unique.slice(0, constraints.daysPerWeek);
  }

  const fallback = [1, 2, 3, 4, 5, 6, 0];
  const selected = [...unique];
  for (const day of fallback) {
    if (selected.length >= constraints.daysPerWeek) {
      break;
    }
    if (!selected.includes(day)) {
      selected.push(day);
    }
  }
  return selected.sort((a, b) => a - b);
}

function summaryFromInputs(inputs: BuildInputs) {
  const top = [...inputs.targets].sort((a, b) => b.value - a.value).slice(0, 2);
  const topSummary = top.map((target) => target.label).join(' + ');
  const styles = inputs.styles.length ? inputs.styles.join(', ') : 'Balanced';
  const equipmentCount = inputs.ownedEquipment?.length ?? 0;
  return `6-week plan prioritizing ${topSummary}. ${inputs.constraints.daysPerWeek} training days per week, ${inputs.constraints.durationMin} min sessions, styles: ${styles}, built around ${equipmentCount} equipment selections.`;
}

function buildTargetWeights(targets: Target[]) {
  const weights: Record<WorkoutTarget, number> = {
    strength: 0,
    conditioning: 0,
    mobility: 0,
  };

  for (const target of targets) {
    if (target.id === 'strength' || target.id === 'conditioning' || target.id === 'mobility') {
      weights[target.id] = target.value;
    }
  }

  const total = TARGET_IDS.reduce((sum, key) => sum + weights[key], 0);
  if (total <= 0) {
    return { strength: 60, conditioning: 25, mobility: 15 };
  }

  return {
    strength: Math.round((weights.strength / total) * 100),
    conditioning: Math.round((weights.conditioning / total) * 100),
    mobility: Math.round((weights.mobility / total) * 100),
  };
}

function deriveFocusCounts(daysPerWeek: number, weights: Record<WorkoutTarget, number>, styles: Set<string>): FocusCounts {
  let conditioning = 0;
  let mobility = 0;

  if (weights.conditioning >= 45) {
    conditioning = daysPerWeek >= 5 ? 3 : 2;
  } else if (weights.conditioning >= 20) {
    conditioning = daysPerWeek >= 4 ? 2 : 1;
  } else if (styles.has('CrossFit-style') && daysPerWeek >= 3) {
    conditioning = 1;
  }

  if (weights.mobility >= 35) {
    mobility = daysPerWeek >= 5 ? 2 : 1;
  } else if (weights.mobility >= 20 || styles.has('Recovery')) {
    mobility = 1;
  }

  if (conditioning + mobility >= daysPerWeek) {
    if (mobility > 0) {
      mobility -= 1;
    }
    if (conditioning + mobility >= daysPerWeek) {
      conditioning = Math.max(0, daysPerWeek - 1);
    }
  }

  const strength = Math.max(1, daysPerWeek - conditioning - mobility);
  const used = strength + conditioning + mobility;

  return {
    strength: strength + Math.max(0, daysPerWeek - used),
    conditioning,
    mobility,
  };
}

function buildFocusSequence(daysPerWeek: number, counts: FocusCounts): WorkoutTarget[] {
  const remaining: FocusCounts = { ...counts };
  const sequence: WorkoutTarget[] = [];

  while (sequence.length < daysPerWeek) {
    let bestFocus: WorkoutTarget | null = null;
    let bestScore = -Infinity;

    for (const focus of TARGET_IDS) {
      if (remaining[focus] <= 0) {
        continue;
      }

      let score = remaining[focus] * 10;
      if (sequence[sequence.length - 1] === focus) {
        score -= 4;
      }
      if (focus === 'strength') {
        score += 0.3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestFocus = focus;
      }
    }

    const nextFocus = bestFocus ?? 'strength';
    sequence.push(nextFocus);
    remaining[nextFocus] -= 1;
  }

  return sequence;
}

function phaseForWeek(weekIndex: number): PhaseMeta {
  if (weekIndex <= 1) {
    return { label: 'Build', volumeMultiplier: 1 };
  }
  if (weekIndex === 2) {
    return { label: 'Intensify', volumeMultiplier: 1.1 };
  }
  if (weekIndex === 3) {
    return { label: 'Deload', volumeMultiplier: 0.75 };
  }
  if (weekIndex === 4) {
    return { label: 'Intensify', volumeMultiplier: 1.1 };
  }
  return { label: 'Consolidate', volumeMultiplier: 0.9 };
}

function hasEquipment(template: WorkoutTemplate, ownedEquipment: Set<string>) {
  return template.requiredEquipment.every((equipmentId) => ownedEquipment.has(equipmentId));
}

function preferredStyleScore(template: WorkoutTemplate, styles: Set<string>) {
  if (styles.size === 0) {
    return 0;
  }
  const matches = template.preferredStyles.filter((style) => styles.has(style)).length;
  return matches > 0 ? matches * 1.5 : -0.75;
}

function durationScore(template: WorkoutTemplate, durationMin: number) {
  if (durationMin >= template.durationRange.min && durationMin <= template.durationRange.max) {
    return 2;
  }
  const midpoint = (template.durationRange.min + template.durationRange.max) / 2;
  return -Math.abs(midpoint - durationMin) / 12;
}

function patternBalanceScore(template: WorkoutTemplate, patternCounts: Map<MovementPattern, number>) {
  let score = 0;
  for (const pattern of template.movementPatterns) {
    const current = patternCounts.get(pattern) ?? 0;
    score += Math.max(0.2, 1.4 - current * 0.35);
  }
  return score;
}

function equipmentSummary(requiredEquipment: string[]) {
  if (!requiredEquipment.length) {
    return 'bodyweight and open space';
  }
  return requiredEquipment
    .map((equipmentId) => EQUIPMENT_LABELS[equipmentId] ?? equipmentId)
    .join(', ');
}

function focusSummary(focus: WorkoutTarget) {
  if (focus === 'strength') {
    return 'leans into your strength priority';
  }
  if (focus === 'conditioning') {
    return 'keeps conditioning frequency on the calendar';
  }
  return 'preserves mobility and recovery work';
}

function chooseTemplate(params: {
  focus: WorkoutTarget;
  targetWeights: Record<WorkoutTarget, number>;
  styles: Set<string>;
  durationMin: number;
  weekPatternCounts: Map<MovementPattern, number>;
  recentTemplateIds: string[];
  availableTemplates: WorkoutTemplate[];
  previousFormat: string | null;
}) {
  const { focus, targetWeights, styles, durationMin, weekPatternCounts, recentTemplateIds, availableTemplates, previousFormat } =
    params;

  const scored = availableTemplates.map((template) => {
    let score = 0;
    score += template.targetAffinity.strength * (targetWeights.strength / 100) * 8;
    score += template.targetAffinity.conditioning * (targetWeights.conditioning / 100) * 8;
    score += template.targetAffinity.mobility * (targetWeights.mobility / 100) * 8;
    score += template.targetAffinity[focus] * 5;
    score += preferredStyleScore(template, styles);
    score += durationScore(template, durationMin);
    score += patternBalanceScore(template, weekPatternCounts);

    if (recentTemplateIds.includes(template.id)) {
      score -= 3;
    }
    if (previousFormat && previousFormat === template.format) {
      score -= 0.75;
    }
    if (focus === 'conditioning' && template.cardio) {
      score += 1.5;
    }
    if (focus === 'mobility' && template.targetAffinity.mobility >= 0.6) {
      score += 2;
    }
    if (focus === 'strength' && !template.cardio) {
      score += 1;
    }

    return { template, score };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.template.id.localeCompare(b.template.id);
  });

  return scored[0]?.template ?? WORKOUT_LIBRARY.find((template) => template.id === 'hotel_session') ?? WORKOUT_LIBRARY[0];
}

function buildWorkoutSummary(template: WorkoutTemplate, focus: WorkoutTarget, durationMin: number, phase: PhaseMeta) {
  return `${phase.label} week. ${durationMin}-${durationMin + 10} min session that ${focusSummary(
    focus
  )}. Built around ${equipmentSummary(template.requiredEquipment)}.`;
}

export function buildPersistedPlan(inputs: BuildInputs): {
  plan: PersistedPlan;
  summary: string;
  workouts: number;
  movements: number;
} {
  const cycleId = `cycle_${Date.now().toString(36)}`;
  const start = startOfWeekSunday(new Date());
  const workoutDays = normalizeWorkoutDays(inputs.constraints);
  const targetWeights = buildTargetWeights(inputs.targets);
  const styleSet = new Set(inputs.styles);
  const focusCounts = deriveFocusCounts(inputs.constraints.daysPerWeek, targetWeights, styleSet);
  const days: PlanSeedDay[] = [];
  const ownedEquipment = new Set(inputs.ownedEquipment ?? []);
  const availableTemplates = WORKOUT_LIBRARY.filter((template) => hasEquipment(template, ownedEquipment));
  const templatePool = availableTemplates.length ? availableTemplates : WORKOUT_LIBRARY.filter((template) => template.requiredEquipment.length === 0);
  const recentTemplateIds: string[] = [];

  for (let weekIndex = 0; weekIndex < 6; weekIndex += 1) {
    const weeklyFocuses = buildFocusSequence(inputs.constraints.daysPerWeek, focusCounts);
    const weekPatternCounts = new Map<MovementPattern, number>();
    const phase = phaseForWeek(weekIndex);
    let previousFormat: string | null = null;
    let workoutSlot = 0;

    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const date = addDays(start, weekIndex * 7 + dayIndex);
      const isWorkoutDay = workoutDays.includes(dayIndex);
      const kind: PlanDayKind = isWorkoutDay ? 'workout' : 'rest';

      if (!isWorkoutDay) {
        days.push({
          weekIndex,
          dayIndex,
          date: toIsoDate(date),
          kind,
          title: 'Rest Day',
          summary: 'Recovery and mobility.',
          durationMin: 0,
          format: 'REST',
          status: 'planned',
          movementPatterns: [],
          cardio: false,
          requiredEquipment: [],
          volumeScore: 0,
        });
        continue;
      }

      const focus = weeklyFocuses[workoutSlot] ?? 'strength';
      const template = chooseTemplate({
        focus,
        targetWeights,
        styles: styleSet,
        durationMin: inputs.constraints.durationMin,
        weekPatternCounts,
        recentTemplateIds,
        availableTemplates: templatePool,
        previousFormat,
      });
      const volumeScore = Math.round(template.volumeBase * phase.volumeMultiplier * 10) / 10;

      days.push({
        weekIndex,
        dayIndex,
        date: toIsoDate(date),
        kind,
        title: template.title,
        summary: buildWorkoutSummary(template, focus, inputs.constraints.durationMin, phase),
        durationMin: inputs.constraints.durationMin,
        format: template.format,
        status: 'planned',
        movementPatterns: [...template.movementPatterns],
        cardio: template.cardio,
        requiredEquipment: [...template.requiredEquipment],
        volumeScore,
      });

      for (const pattern of template.movementPatterns) {
        weekPatternCounts.set(pattern, (weekPatternCounts.get(pattern) ?? 0) + 1);
      }
      previousFormat = template.format;
      recentTemplateIds.unshift(template.id);
      if (recentTemplateIds.length > 4) {
        recentTemplateIds.pop();
      }
      workoutSlot += 1;
    }
  }

  const summary = summaryFromInputs(inputs);
  const workouts = days.filter((day) => day.kind === 'workout').length;
  const movements = new Set(
    days.flatMap((day) => day.movementPatterns)
  ).size;

  return {
    plan: {
      cycle: {
        id: cycleId,
        createdAt: new Date().toISOString(),
        label: '6-Week Cycle',
        weeks: 6,
      },
      days,
    },
    summary,
    workouts,
    movements,
  };
}
