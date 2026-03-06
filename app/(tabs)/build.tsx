import React, { useEffect, useRef, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';

import { BrandBackground } from '@/components/brand-background';
import { createShadowStyle } from '@/constants/shadows';
import { Fonts, getThemePalette } from '@/constants/theme';
import { useAppSettings } from '@/data/app-settings';
import { getState, replacePlan, setState } from '@/data/db';
import { buildPersistedPlan, type BuildInputs } from '@/data/planner';

type Target = { id: string; label: string; value: number };

const DEFAULT_TARGETS: Target[] = [
  { id: 'strength', label: 'Hypertrophy + progressive overload', value: 60 },
  { id: 'conditioning', label: 'Conditioning', value: 25 },
  { id: 'mobility', label: 'Mobility', value: 15 },
];

const STYLES = ['Bodybuilding', 'Functional', 'CrossFit-style', 'Recovery'];

const DEFAULT_CONSTRAINTS = {
  daysPerWeek: 4,
  durationMin: 45,
  preferredDays: ['Mon', 'Wed', 'Fri', 'Sat'],
};

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_OWNED_EQUIPMENT = ['rack', 'bench', 'db', 'bands', 'pullup'];

type PlanState = {
  createdAt: string;
  summary: string;
  workouts: number;
  movements: number;
};

type BomState = {
  owned: string[];
};

const STEP = 5;

export default function BuildScreen() {
  const { settings } = useAppSettings();
  const palette = getThemePalette(settings.themePreset);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [targets, setTargets] = useState<Target[]>(DEFAULT_TARGETS);
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS);
  const [selectedStyles, setSelectedStyles] = useState<string[]>(STYLES);
  const resortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const savedBuild = await getState<BuildInputs>('build');
      const savedPlan = await getState<PlanState>('plan');
      if (active && savedBuild?.targets?.length) {
        setTargets(savedBuild.targets);
      }
      if (active && savedBuild?.constraints) {
        setConstraints(savedBuild.constraints);
      }
      if (active && savedBuild?.styles?.length) {
        setSelectedStyles(savedBuild.styles);
      }
      if (active && savedPlan) {
        setPlan(savedPlan);
      }
    })();
    return () => {
      active = false;
      if (resortTimeoutRef.current) {
        clearTimeout(resortTimeoutRef.current);
      }
    };
  }, []);

  const scheduleResort = () => {
    if (resortTimeoutRef.current) {
      clearTimeout(resortTimeoutRef.current);
    }
    resortTimeoutRef.current = setTimeout(() => {
      setTargets((prev) => [...prev].sort((a, b) => b.value - a.value));
    }, 5000);
  };

  const normalizeTargets = (nextTargets: Target[], lockedId: string) => {
    const locked = nextTargets.find((t) => t.id === lockedId);
    if (!locked) {
      return nextTargets;
    }
    locked.value = Math.min(100, Math.max(0, Math.round(locked.value / STEP) * STEP));
    const others = nextTargets.filter((t) => t.id !== lockedId);
    if (others.length === 0) {
      locked.value = 100;
      return nextTargets;
    }

    const remaining = 100 - locked.value;
    const totalOther = others.reduce((sum, t) => sum + t.value, 0);

    if (totalOther === 0) {
      const even = Math.floor(remaining / (others.length * STEP)) * STEP;
      others.forEach((t) => {
        t.value = even;
      });
    } else {
      others.forEach((t) => {
        const raw = (t.value / totalOther) * remaining;
        t.value = Math.round(raw / STEP) * STEP;
      });
    }

    const assigned = others.reduce((sum, t) => sum + t.value, 0);
    let diff = remaining - assigned;
    let safety = 0;
    while (diff !== 0 && safety < 200) {
      const direction = diff > 0 ? STEP : -STEP;
      const candidates = others.filter((t) => (direction > 0 ? t.value < 100 : t.value > 0));
      if (candidates.length === 0) {
        if (direction > 0 && locked.value < 100) {
          locked.value = Math.min(100, locked.value + STEP);
          diff -= STEP;
        } else if (direction < 0 && locked.value > 0) {
          locked.value = Math.max(0, locked.value - STEP);
          diff += STEP;
        } else {
          break;
        }
      } else {
        candidates.sort((a, b) => (direction > 0 ? a.value - b.value : b.value - a.value));
        candidates[0].value = Math.min(100, Math.max(0, candidates[0].value + direction));
        diff -= direction;
      }
      safety += 1;
    }

    return nextTargets;
  };

  const updateTargetValue = (id: string, nextValue: number) => {
    setTargets((prev) => {
      const next = prev.map((target) => ({ ...target }));
      const target = next.find((t) => t.id === id);
      if (!target) {
        return prev;
      }
      target.value = nextValue;
      return normalizeTargets(next, id);
    });
  };

  const handlePlan = async () => {
    const bom = await getState<BomState>('bom');
    const inputs: BuildInputs = {
      targets,
      constraints,
      styles: selectedStyles,
      ownedEquipment: bom ? bom.owned ?? [] : DEFAULT_OWNED_EQUIPMENT,
    };
    const generated = buildPersistedPlan(inputs);
    const newPlan: PlanState = {
      createdAt: generated.plan.cycle.createdAt,
      summary: generated.summary,
      workouts: generated.workouts,
      movements: generated.movements,
    };
    await setState('build', inputs);
    await replacePlan(generated.plan);
    await setState('plan', newPlan);
    setPlan(newPlan);
  };

  const cycleDaysPerWeek = () => {
    setConstraints((prev) => {
      const next = prev.daysPerWeek >= 7 ? 2 : prev.daysPerWeek + 1;
      return { ...prev, daysPerWeek: next };
    });
  };

  const cycleDuration = () => {
    setConstraints((prev) => {
      const next = prev.durationMin >= 90 ? 20 : prev.durationMin + 5;
      return { ...prev, durationMin: next };
    });
  };

  const togglePreferredDay = (day: string) => {
    setConstraints((prev) => {
      const exists = prev.preferredDays.includes(day);
      const nextDays = exists
        ? prev.preferredDays.filter((d) => d !== day)
        : [...prev.preferredDays, day];
      return { ...prev, preferredDays: nextDays };
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.screen}>
        <BrandBackground palette={palette} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: palette.text }]}>Build</Text>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Targets</Text>
            {targets.map((goal) => (
              <View key={goal.id} style={styles.goalRow}>
              <View style={styles.goalHeader}>
                <Text style={[styles.goalLabel, { color: palette.text }]}>{goal.label}</Text>
                <Text style={[styles.goalValue, { color: palette.muted }]}>{goal.value}%</Text>
              </View>
                <Slider
                  value={goal.value}
                  minimumValue={0}
                  maximumValue={100}
                  step={STEP}
                  onValueChange={(value) => updateTargetValue(goal.id, value)}
                  onSlidingComplete={scheduleResort}
                  minimumTrackTintColor={palette.tint}
                  maximumTrackTintColor={palette.surfaceAlt}
                  thumbTintColor={palette.tint}
                  style={styles.goalSlider}
                />
              </View>
            ))}
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Constraints</Text>
            <View style={styles.constraintRow}>
              <Pressable
                onPress={cycleDaysPerWeek}
                style={[styles.constraintBlock, { backgroundColor: palette.surfaceAlt }]}
              >
                <Text style={[styles.constraintValue, { color: palette.text }]}>
                  {constraints.daysPerWeek} days
                </Text>
                <Text style={[styles.constraintLabel, { color: palette.muted }]}>per week</Text>
              </Pressable>
              <Pressable
                onPress={cycleDuration}
                style={[styles.constraintBlock, { backgroundColor: palette.surfaceAlt }]}
              >
                <Text style={[styles.constraintValue, { color: palette.text }]}>
                  {constraints.durationMin} min
                </Text>
                <Text style={[styles.constraintLabel, { color: palette.muted }]}>per session</Text>
              </Pressable>
            </View>
            <View style={styles.constraintRow}>
              <View style={[styles.constraintBlockWide, { backgroundColor: palette.surfaceAlt }]}>
                <Text style={[styles.constraintLabel, { color: palette.muted }]}>preferred days</Text>
                <View style={styles.dayRow}>
                  {WEEK_DAYS.map((day) => {
                    const active = constraints.preferredDays.includes(day);
                    return (
                      <Pressable
                        key={day}
                        onPress={() => togglePreferredDay(day)}
                        style={[
                          styles.dayPill,
                          {
                            borderColor: active ? palette.tint : palette.border,
                            backgroundColor: palette.surface,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.dayPillText, { color: active ? palette.tint : palette.text }]}
                        >
                          {day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Style</Text>
            <View style={styles.pillRow}>
              {STYLES.map((style) => {
                const active = selectedStyles.includes(style);
                return (
                  <Pressable
                    key={style}
                    onPress={() =>
                      setSelectedStyles((prev) =>
                        prev.includes(style) ? prev.filter((item) => item !== style) : [...prev, style]
                      )
                    }
                    style={[
                      styles.pill,
                      {
                        borderColor: active ? palette.tint : palette.border,
                        backgroundColor: palette.surfaceAlt,
                      },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: active ? palette.tint : palette.text }]}>
                      {style}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.planWrap}>
            <Pressable
              onPress={handlePlan}
              style={({ pressed }) => [
                styles.planButton,
                { backgroundColor: palette.tint, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.planText, { color: '#0B0D10' }]}>PLAN</Text>
            </Pressable>
            <Text style={[styles.planMeta, { color: palette.muted }]}>
              Generates a 6-week cycle based on your inputs.
            </Text>
          </View>

          {plan ? (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>Plan Review</Text>
              <Text style={[styles.previewText, { color: palette.muted }]}>{plan.summary}</Text>
              <View style={styles.previewRow}>
                <View style={[styles.previewBadge, { backgroundColor: palette.surfaceAlt }]}>
                  <Text style={[styles.previewBadgeText, { color: palette.text }]}>{plan.workouts} workouts</Text>
                </View>
                <View style={[styles.previewBadge, { backgroundColor: palette.surfaceAlt }]}>
                  <Text style={[styles.previewBadgeText, { color: palette.text }]}>{plan.movements} movements added</Text>
                </View>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingBottom: 120,
    paddingTop: 12,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
    ...createShadowStyle({ color: '#1C1B19', opacity: 0.06, radius: 12, offsetY: 6 }),
  },
  cardTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  goalRow: {
    marginBottom: 14,
  },
  goalLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  goalValue: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  goalHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexDirection: 'row',
    width: '100%',
  },
  goalTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 6,
  },
  goalSlider: {
    width: '100%',
    height: 36,
    marginTop: 2,
  },
  goalFill: {
    height: '100%',
    borderRadius: 999,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 18,
    fontWeight: '600',
  },
  sectionMeta: {
    fontFamily: Fonts.body,
    fontSize: 13,
    marginTop: 4,
  },
  planWrap: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 22,
  },
  planButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    ...createShadowStyle({ color: '#2FE6C8', opacity: 0.4, radius: 16, offsetY: 8 }),
  },
  planText: {
    fontFamily: Fonts.display,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  planMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    alignItems: 'flex-start',
    alignContent: 'flex-start',
  },
  pill: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    marginRight: 10,
    marginBottom: 10,
  },
  pillText: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  constraintRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  constraintBlock: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  constraintBlockWide: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    alignContent: 'flex-start',
    marginTop: 8,
  },
  dayPill: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    minWidth: 44,
    marginRight: 8,
    marginBottom: 8,
  },
  dayPillText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  constraintValue: {
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '600',
  },
  constraintLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  previewText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  previewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  previewBadge: {
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  previewBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
});
