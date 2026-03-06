import { beforeEach, describe, expect, test, vi } from 'vitest';

import { buildPersistedPlan, type BuildInputs } from '@/data/planner';

const baseInputs: BuildInputs = {
  targets: [
    { id: 'strength', label: 'Hypertrophy + progressive overload', value: 60 },
    { id: 'conditioning', label: 'Conditioning', value: 25 },
    { id: 'mobility', label: 'Mobility', value: 15 },
  ],
  constraints: {
    daysPerWeek: 4,
    durationMin: 45,
    preferredDays: ['Mon', 'Wed', 'Fri', 'Sat'],
  },
  styles: ['Bodybuilding', 'Functional'],
  ownedEquipment: ['rack', 'bench', 'db', 'bands', 'pullup'],
};

function workoutDays(inputs: BuildInputs) {
  return buildPersistedPlan(inputs).plan.days.filter((day) => day.kind === 'workout');
}

describe('buildPersistedPlan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-02T12:00:00Z'));
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-03-02T12:00:00Z').getTime());
  });

  test('is deterministic for the same inputs', () => {
    const first = buildPersistedPlan(baseInputs);
    const second = buildPersistedPlan(baseInputs);

    expect(first.summary).toBe(second.summary);
    expect(first.plan.days).toEqual(second.plan.days);
    expect(first.workouts).toBe(second.workouts);
    expect(first.movements).toBe(second.movements);
  });

  test('changes workout composition based on owned equipment', () => {
    const dumbbellOnly = workoutDays({
      ...baseInputs,
      ownedEquipment: ['db'],
      styles: ['Functional'],
    });

    const fullGym = workoutDays({
      ...baseInputs,
      ownedEquipment: ['rack', 'bench', 'bb', 'db', 'pullup', 'bike', 'bands'],
      styles: ['Bodybuilding', 'Functional'],
    });

    expect(dumbbellOnly.every((day) => day.requiredEquipment.every((item) => item === 'db' || item === ''))).toBe(true);
    expect(dumbbellOnly.some((day) => day.requiredEquipment.includes('bb'))).toBe(false);
    expect(fullGym.some((day) => day.requiredEquipment.includes('bb') || day.requiredEquipment.includes('bike'))).toBe(true);
  });

  test('increases cardio-heavy workouts when conditioning is prioritized', () => {
    const strengthPlan = workoutDays({
      ...baseInputs,
      targets: [
        { id: 'strength', label: 'Hypertrophy + progressive overload', value: 80 },
        { id: 'conditioning', label: 'Conditioning', value: 10 },
        { id: 'mobility', label: 'Mobility', value: 10 },
      ],
      ownedEquipment: ['rack', 'bench', 'bb', 'db', 'pullup'],
    });

    const conditioningPlan = workoutDays({
      ...baseInputs,
      targets: [
        { id: 'strength', label: 'Hypertrophy + progressive overload', value: 20 },
        { id: 'conditioning', label: 'Conditioning', value: 65 },
        { id: 'mobility', label: 'Mobility', value: 15 },
      ],
      styles: ['Functional', 'CrossFit-style'],
      ownedEquipment: ['db', 'kb', 'bike', 'bands', 'rower'],
    });

    const strengthCardioCount = strengthPlan.filter((day) => day.cardio).length;
    const conditioningCardioCount = conditioningPlan.filter((day) => day.cardio).length;

    expect(conditioningCardioCount).toBeGreaterThan(strengthCardioCount);
  });
});
