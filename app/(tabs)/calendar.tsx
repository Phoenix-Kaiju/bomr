import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandBackground } from '@/components/brand-background';
import { getTabHref } from '@/constants/navigation';
import { createShadowStyle } from '@/constants/shadows';
import { Fonts, getThemePalette } from '@/constants/theme';
import { useAppSettings } from '@/data/app-settings';
import {
  getActiveCycle,
  getPlanDaysForWeek,
  getWorkoutLogs,
  getWeekIndexForDate,
  movePlanDayWithinWeek,
  overridePlanDayKind,
  setPlanDayStatus,
  skipWorkoutWithAutoBump,
} from '@/data/db';
import type { CycleRecord, PlanDayRecord, WorkoutLogRecord } from '@/data/types';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NOTE_PRESETS = ['Felt heavy', 'Cut short', 'Swap movement', 'Increase next time'];

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function weekMonthLabel(days: PlanDayRecord[]) {
  if (!days.length) {
    return 'No scheduled days';
  }
  const first = parseIsoDate(days[0].date);
  const last = parseIsoDate(days[days.length - 1].date);
  const firstLabel = first.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  const lastLabel = last.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
  if (first.getMonth() === last.getMonth()) {
    return `${first.toLocaleDateString(undefined, { month: 'long' })} ${first.getDate()}-${last.getDate()}`;
  }
  return `${firstLabel} - ${lastLabel}`;
}

function dayMeta(day: PlanDayRecord) {
  if (day.kind === 'rest') {
    return day.status === 'skipped' ? 'Rest override skipped' : 'Planned rest';
  }

  const duration = day.durationMin > 0 ? `${day.durationMin}-${day.durationMin + 10} min` : 'Session';
  if (day.status === 'completed') {
    return `${duration} • Completed`;
  }
  if (day.status === 'skipped') {
    return `${duration} • Skipped`;
  }
  return `${duration} • ${day.format}`;
}

function statusIcon(status: PlanDayRecord['status'], kind: PlanDayRecord['kind'], color: string, muted: string, border: string) {
  if (kind === 'rest') {
    return <MaterialIcons name="nightlight-round" size={18} color={muted} />;
  }
  if (status === 'completed') {
    return <MaterialIcons name="check-circle" size={22} color={color} />;
  }
  if (status === 'skipped') {
    return <MaterialIcons name="cancel" size={20} color={muted} />;
  }
  return <MaterialIcons name="radio-button-unchecked" size={20} color={border} />;
}

function latestNoteForDay(logs: WorkoutLogRecord[], dayId: string) {
  return logs.find((log) => log.planDayId === dayId)?.notes?.trim() ?? '';
}

function mergePreset(note: string, preset: string) {
  const trimmed = note.trim();
  if (!trimmed) {
    return preset;
  }
  const separator = /[.!?]$/.test(trimmed) ? ' ' : '. ';
  return `${trimmed}${separator}${preset}`;
}

export default function CalendarScreen() {
  const { settings } = useAppSettings();
  const palette = getThemePalette(settings.themePreset);
  const router = useRouter();

  const [cycle, setCycle] = useState<CycleRecord | null>(null);
  const [weekIndex, setWeekIndex] = useState(0);
  const [weekDays, setWeekDays] = useState<PlanDayRecord[]>([]);
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const selectedDay = useMemo(
    () => weekDays.find((day) => day.id === selectedDayId) ?? null,
    [selectedDayId, weekDays]
  );

  const refreshWeek = async (activeCycle: CycleRecord, targetWeek = weekIndex) => {
    const days = await getPlanDaysForWeek(activeCycle.id, targetWeek);
    setWeekDays(days);
    setSelectedDayId((prev) => {
      if (!prev) {
        return prev;
      }
      return days.some((day) => day.id === prev) ? prev : null;
    });
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const activeCycle = await getActiveCycle();
      if (!active) {
        return;
      }
      setCycle(activeCycle);

      if (!activeCycle) {
        setWeekDays([]);
        setWeekIndex(0);
        setLoading(false);
        return;
      }

      const todayWeek = await getWeekIndexForDate(activeCycle.id, toIsoDate(new Date()));
      const initialWeek = todayWeek ?? 0;
      setWeekIndex(initialWeek);
      const days = await getPlanDaysForWeek(activeCycle.id, initialWeek);
      if (!active) {
        return;
      }
      setWeekDays(days);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!cycle) {
      return;
    }

    (async () => {
      const days = await getPlanDaysForWeek(cycle.id, weekIndex);
      if (!active) {
        return;
      }
      setWeekDays(days);
    })();

    return () => {
      active = false;
    };
  }, [cycle, weekIndex]);

  useEffect(() => {
    let active = true;

    if (!cycle || !selectedDayId) {
      setNoteDraft('');
      return;
    }

    (async () => {
      const logs = await getWorkoutLogs(cycle.id, 500);
      if (!active) {
        return;
      }
      setNoteDraft(latestNoteForDay(logs, selectedDayId));
    })();

    return () => {
      active = false;
    };
  }, [cycle, selectedDayId]);

  const runAction = async (action: () => Promise<void>) => {
    if (!cycle || actionBusy) {
      return;
    }
    setActionBusy(true);
    try {
      await action();
      await refreshWeek(cycle);
    } finally {
      setActionBusy(false);
    }
  };

  const moveSelectedBy = async (offset: number) => {
    if (!selectedDay || !cycle) {
      return;
    }
    const target = weekDays.find((day) => day.dayIndex === selectedDay.dayIndex + offset);
    if (!target) {
      return;
    }

    await runAction(async () => {
      await movePlanDayWithinWeek(selectedDay.id, target.id);
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.screen}>
        <BrandBackground palette={palette} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: palette.text }]}>Calendar</Text>

          {!cycle && !loading ? (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>No Active Cycle</Text>
              <Text style={[styles.cardMeta, { color: palette.muted }]}>
                Calendar is the home screen, but setup still starts with your equipment and plan inputs.
              </Text>
              <View style={styles.emptyActionRow}>
                <Pressable
                  onPress={() => router.navigate(getTabHref('bom'))}
                  style={[styles.emptyActionButton, { backgroundColor: palette.tint }]}
                >
                  <Text style={[styles.emptyActionText, { color: '#0B0D10' }]}>Open BOM</Text>
                </Pressable>
                <Pressable
                  onPress={() => router.navigate(getTabHref('build'))}
                  style={[
                    styles.emptyActionButton,
                    {
                      backgroundColor: palette.surfaceAlt,
                      borderColor: palette.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[styles.emptyActionText, { color: palette.text }]}>Open Build</Text>
                </Pressable>
              </View>
              <View style={styles.setupSteps}>
                <Text style={[styles.setupStep, { color: palette.muted }]}>1. Confirm equipment in BOM.</Text>
                <Text style={[styles.setupStep, { color: palette.muted }]}>2. Build a 6-week cycle.</Text>
                <Text style={[styles.setupStep, { color: palette.muted }]}>3. Come back here to run the week.</Text>
              </View>
            </View>
          ) : null}

          {cycle ? (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.monthRow}>
                <View>
                  <Text style={[styles.monthTitle, { color: palette.text }]}>{weekMonthLabel(weekDays)}</Text>
                  <Text style={[styles.cardMeta, { color: palette.muted }]}>{cycle.label}</Text>
                </View>
                <View style={styles.weekPillGroup}>
                  <Pressable
                    onPress={() => setWeekIndex((prev) => Math.max(0, prev - 1))}
                    style={[styles.weekNav, { borderColor: palette.border, backgroundColor: palette.surfaceAlt }]}
                  >
                    <Text style={[styles.weekNavText, { color: palette.text }]}>-</Text>
                  </Pressable>
                  <View style={[styles.monthPill, { backgroundColor: palette.surfaceAlt }]}>
                    <Text style={[styles.monthPillText, { color: palette.muted }]}>Week {weekIndex + 1} of {cycle.weeks}</Text>
                  </View>
                  <Pressable
                    onPress={() => setWeekIndex((prev) => Math.min(cycle.weeks - 1, prev + 1))}
                    style={[styles.weekNav, { borderColor: palette.border, backgroundColor: palette.surfaceAlt }]}
                  >
                    <Text style={[styles.weekNavText, { color: palette.text }]}>+</Text>
                  </Pressable>
                </View>
              </View>

              {weekDays.map((day) => {
                const dayDate = parseIsoDate(day.date);
                return (
                  <Pressable
                    key={day.id}
                    onPress={() => setSelectedDayId(day.id)}
                    style={[styles.dayRow, { borderColor: palette.border }]}
                  >
                    <View style={styles.dateBlock}>
                      <Text style={[styles.dateDay, { color: palette.muted }]}>{DAY_NAMES[day.dayIndex]}</Text>
                      <Text style={[styles.dateNum, { color: palette.text }]}>{dayDate.getDate()}</Text>
                    </View>
                    <View style={styles.dayContent}>
                      <Text style={[styles.dayTitle, { color: day.kind === 'rest' ? palette.muted : palette.text }]}>
                        {day.title}
                      </Text>
                      <Text style={[styles.dayMeta, { color: palette.muted }]}>{dayMeta(day)}</Text>
                    </View>
                    <View style={styles.dayStatus}>
                      {statusIcon(day.status, day.kind, palette.accent, palette.muted, palette.border)}
                    </View>
                  </Pressable>
                );
              })}

              {weekDays.length === 0 ? (
                <View style={[styles.emptyWeekRow, { borderColor: palette.border }]}>
                  <Text style={[styles.emptyWeekText, { color: palette.muted }]}>
                    No scheduled days this week.
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>Auto-bump</Text>
            <Text style={[styles.cardMeta, { color: palette.muted }]}>
              Skip bumps only workout days inside the same Sunday-start week. Last workout day skip stays skipped.
            </Text>
          </View>
        </ScrollView>
      </View>

      <Modal visible={Boolean(selectedDay)} animationType="slide" transparent onRequestClose={() => setSelectedDayId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
            {selectedDay ? (
              <>
                <Text style={[styles.modalTitle, { color: palette.text }]}>{selectedDay.title}</Text>
                <Text style={[styles.modalMeta, { color: palette.muted }]}> 
                  {DAY_NAMES[selectedDay.dayIndex]} • {parseIsoDate(selectedDay.date).toLocaleDateString()} • {dayMeta(selectedDay)}
                </Text>
                <Text style={[styles.modalSummary, { color: palette.muted }]}>{selectedDay.summary}</Text>

                {selectedDay.kind === 'workout' ? (
                  <View style={styles.notesBlock}>
                    <Text style={[styles.notesLabel, { color: palette.text }]}>Workout Notes</Text>
                    <Text style={[styles.notesMeta, { color: palette.muted }]}>
                      Save quick context with the workout so Progress reflects what actually happened.
                    </Text>
                    <TextInput
                      multiline
                      numberOfLines={4}
                      editable={!actionBusy}
                      value={noteDraft}
                      onChangeText={setNoteDraft}
                      placeholder="Log how the session felt, what changed, or what to adjust next time."
                      placeholderTextColor={palette.muted}
                      style={[
                        styles.notesInput,
                        {
                          color: palette.text,
                          borderColor: palette.border,
                          backgroundColor: palette.surfaceAlt,
                        },
                      ]}
                    />
                    <View style={styles.presetRow}>
                      {NOTE_PRESETS.map((preset) => (
                        <Pressable
                          key={preset}
                          disabled={actionBusy}
                          onPress={() => setNoteDraft((prev) => mergePreset(prev, preset))}
                          style={[
                            styles.presetChip,
                            {
                              borderColor: palette.border,
                              backgroundColor: palette.surfaceAlt,
                              opacity: actionBusy ? 0.6 : 1,
                            },
                          ]}
                        >
                          <Text style={[styles.presetChipText, { color: palette.text }]}>{preset}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}

                <View style={styles.buttonGrid}>
                  <Pressable
                    disabled={actionBusy || selectedDay.kind === 'rest'}
                    onPress={() =>
                      runAction(async () => {
                        await setPlanDayStatus(selectedDay.id, 'completed', noteDraft.trim() || null);
                      })
                    }
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: selectedDay.kind === 'rest' ? palette.surfaceAlt : palette.accent,
                        opacity: pressed || actionBusy ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionText, { color: '#0B0D10' }]}>Complete</Text>
                  </Pressable>

                  <Pressable
                    disabled={
                      actionBusy ||
                      selectedDay.kind === 'rest' ||
                      selectedDay.status === 'completed'
                    }
                    onPress={() =>
                      runAction(async () => {
                        await skipWorkoutWithAutoBump(selectedDay.id, noteDraft.trim() || null);
                      })
                    }
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: palette.surfaceAlt,
                        borderColor: palette.border,
                        borderWidth: 1,
                        opacity:
                          pressed ||
                          actionBusy ||
                          selectedDay.kind === 'rest' ||
                          selectedDay.status === 'completed'
                            ? 0.85
                            : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionText, { color: palette.text }]}>Skip + Bump</Text>
                  </Pressable>
                </View>

                <View style={styles.buttonGrid}>
                  <Pressable
                    disabled={actionBusy || selectedDay.dayIndex <= 0}
                    onPress={() => moveSelectedBy(-1)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: palette.surfaceAlt,
                        borderColor: palette.border,
                        borderWidth: 1,
                        opacity: pressed || actionBusy || selectedDay.dayIndex <= 0 ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionText, { color: palette.text }]}>Move Earlier</Text>
                  </Pressable>

                  <Pressable
                    disabled={actionBusy || selectedDay.dayIndex >= 6}
                    onPress={() => moveSelectedBy(1)}
                    style={({ pressed }) => [
                      styles.actionButton,
                      {
                        backgroundColor: palette.surfaceAlt,
                        borderColor: palette.border,
                        borderWidth: 1,
                        opacity: pressed || actionBusy || selectedDay.dayIndex >= 6 ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.actionText, { color: palette.text }]}>Move Later</Text>
                  </Pressable>
                </View>

                <Pressable
                  disabled={actionBusy}
                  onPress={() =>
                    runAction(async () => {
                      await overridePlanDayKind(selectedDay.id, selectedDay.kind === 'rest' ? 'workout' : 'rest');
                    })
                  }
                  style={({ pressed }) => [
                    styles.toggleButton,
                    {
                      backgroundColor: palette.surfaceAlt,
                      borderColor: palette.border,
                      opacity: pressed || actionBusy ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.toggleText, { color: palette.text }]}>
                    {selectedDay.kind === 'rest' ? 'Override To Workout' : 'Set As Rest'}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setSelectedDayId(null)}
                  style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.75 : 1 }]}
                >
                  <Text style={[styles.closeText, { color: palette.muted }]}>Close</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
    marginBottom: 8,
  },
  cardMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  emptyActionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  emptyActionText: {
    fontFamily: Fonts.display,
    fontSize: 13,
    fontWeight: '600',
  },
  setupSteps: {
    marginTop: 14,
    gap: 6,
  },
  setupStep: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 8,
  },
  monthTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '600',
  },
  weekPillGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weekNav: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekNavText: {
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '700',
  },
  monthPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  monthPillText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  dateBlock: {
    width: 52,
  },
  dateDay: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginBottom: 2,
  },
  dateNum: {
    fontFamily: Fonts.display,
    fontSize: 18,
    fontWeight: '600',
  },
  dayContent: {
    flex: 1,
  },
  dayTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  dayMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  dayStatus: {
    width: 30,
    alignItems: 'flex-end',
  },
  emptyWeekRow: {
    borderTopWidth: 1,
    paddingVertical: 14,
  },
  emptyWeekText: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 18,
    paddingBottom: 28,
  },
  modalTitle: {
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '700',
  },
  modalMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 6,
  },
  modalSummary: {
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 14,
  },
  notesBlock: {
    marginBottom: 14,
  },
  notesLabel: {
    fontFamily: Fonts.display,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  notesMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  notesInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 96,
    textAlignVertical: 'top',
    fontFamily: Fonts.body,
    fontSize: 13,
    lineHeight: 18,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  presetChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  presetChipText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  actionText: {
    fontFamily: Fonts.display,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 4,
  },
  toggleText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    paddingVertical: 10,
    marginTop: 6,
    alignItems: 'center',
  },
  closeText: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
});
