import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';

import { BrandBackground } from '@/components/brand-background';
import { createShadowStyle } from '@/constants/shadows';
import { Fonts, getThemePalette } from '@/constants/theme';
import { useAppSettings } from '@/data/app-settings';
import { getActiveCycle, getPlanDaysForCycle, getState, getWorkoutLogs } from '@/data/db';
import { computeProgressSnapshot, type ProgressSnapshot } from '@/data/gaps';


type BomState = {
  owned: string[];
};

function statusText(status: 'planned' | 'completed' | 'skipped') {
  if (status === 'completed') {
    return 'Completed';
  }
  if (status === 'skipped') {
    return 'Skipped';
  }
  return 'Planned';
}

export default function ProgressScreen() {
  const { settings } = useAppSettings();
  const palette = getThemePalette(settings.themePreset);
  const isFocused = useIsFocused();

  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [cycleLabel, setCycleLabel] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let active = true;
    (async () => {
      setLoading(true);
      const cycle = await getActiveCycle();
      if (!active) {
        return;
      }

      if (!cycle) {
        setSnapshot(null);
        setCycleLabel('');
        setLoading(false);
        return;
      }

      const [days, logs, bom] = await Promise.all([
        getPlanDaysForCycle(cycle.id),
        getWorkoutLogs(cycle.id, 1000),
        getState<BomState>('bom'),
      ]);

      if (!active) {
        return;
      }

      setCycleLabel(cycle.label);
      setSnapshot(computeProgressSnapshot(days, logs, bom?.owned ?? []));
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [isFocused]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}> 
      <View style={styles.screen}>
        <BrandBackground palette={palette} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: palette.text }]}>Progress</Text>

          {!snapshot && !loading ? (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>No Active Cycle</Text>
              <Text style={[styles.cardText, { color: palette.muted }]}>Build a plan to unlock progress metrics.</Text>
            </View>
          ) : null}

          {snapshot ? (
            <>
              <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>Completion</Text>
                <Text style={[styles.cardText, { color: palette.muted }]}>{cycleLabel}</Text>
                <View style={styles.completionRow}>
                  <View style={[styles.completionBlock, { backgroundColor: palette.surfaceAlt }]}>
                    <Text style={[styles.completionValue, { color: palette.text }]}>{snapshot.week.percent}%</Text>
                    <Text style={[styles.completionLabel, { color: palette.muted }]}>this week</Text>
                    <Text style={[styles.completionMeta, { color: palette.muted }]}>
                      {snapshot.week.completed}/{snapshot.week.planned} complete
                    </Text>
                  </View>
                  <View style={[styles.completionBlock, { backgroundColor: palette.surfaceAlt }]}>
                    <Text style={[styles.completionValue, { color: palette.text }]}>{snapshot.cycle.percent}%</Text>
                    <Text style={[styles.completionLabel, { color: palette.muted }]}>cycle total</Text>
                    <Text style={[styles.completionMeta, { color: palette.muted }]}>
                      {snapshot.cycle.skipped} skipped
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>History</Text>
              </View>
              {snapshot.history.length ? (
                snapshot.history.map((entry) => (
                  <View
                    key={entry.id}
                    style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <View style={styles.rowTop}>
                      <Text style={[styles.listTitle, { color: palette.text }]}>{entry.title}</Text>
                      <Text style={[styles.listMeta, { color: palette.muted }]}>{entry.date}</Text>
                    </View>
                    <Text style={[styles.listMeta, { color: palette.muted }]}>{statusText(entry.status)}</Text>
                    {entry.notes ? (
                      <Text style={[styles.listNote, { color: palette.muted }]}>{entry.notes}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <View style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.listMeta, { color: palette.muted }]}>No workout events yet.</Text>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Training Gaps</Text>
              </View>
              {snapshot.gaps.length ? (
                snapshot.gaps.map((gap) => (
                  <View
                    key={gap.label}
                    style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <Text style={[styles.listTitle, { color: palette.text }]}>{gap.label}</Text>
                    <Text style={[styles.listMeta, { color: palette.muted }]}>{gap.detail}</Text>
                  </View>
                ))
              ) : (
                <View style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.listMeta, { color: palette.muted }]}>No training gaps flagged this week.</Text>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>Equipment Gaps</Text>
              </View>
              {snapshot.equipmentGaps.length ? (
                snapshot.equipmentGaps.map((gap) => (
                  <View
                    key={gap.label}
                    style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.border }]}
                  >
                    <Text style={[styles.listTitle, { color: palette.text }]}>{gap.label}</Text>
                    <Text style={[styles.listMeta, { color: palette.muted }]}>{gap.detail}</Text>
                  </View>
                ))
              ) : (
                <View style={[styles.listRow, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                  <Text style={[styles.listMeta, { color: palette.muted }]}>No equipment blockers for upcoming workouts.</Text>
                </View>
              )}
            </>
          ) : null}

          {loading ? (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}> 
              <Text style={[styles.cardText, { color: palette.muted }]}>Loading progress data...</Text>
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
    marginBottom: 8,
  },
  cardText: {
    fontFamily: Fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  completionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  completionBlock: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  completionValue: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '700',
  },
  completionLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 4,
  },
  completionMeta: {
    fontFamily: Fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 18,
    fontWeight: '600',
  },
  listRow: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  listTitle: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  listMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 6,
  },
  listNote: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
