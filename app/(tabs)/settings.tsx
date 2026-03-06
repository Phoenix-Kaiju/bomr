import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandBackground } from '@/components/brand-background';
import {
  DEFAULT_SETTINGS,
  type ThemePreset,
  type VoiceCueStyle,
  useAppSettings,
} from '@/data/app-settings';
import {
  getFullBackupData,
  replaceAllState,
  resetAllData,
  restoreFullBackupData,
} from '@/data/db';
import { createBackupPayload, parseBackupText } from '@/data/backup';
import { Colors, Fonts, getThemePalette } from '@/constants/theme';

const THEME_OPTIONS: ThemePreset[] = ['NEON', 'SLATE', 'FOREST', 'AMBER', 'MONO'];
const TIMER_MODE_OPTIONS = ['AMRAP', 'EMOM', 'TABATA', 'FOR_TIME'] as const;
const VOICE_CUE_OPTIONS: VoiceCueStyle[] = ['BEEP', 'VOICE_BEEP', 'SILENT'];
const displayLabel = (value: string) => value.replaceAll('_', ' ');

export default function SettingsScreen() {
  const { settings, updateSettings, resetSettings } = useAppSettings();
  const palette = getThemePalette(settings.themePreset);
  const [backupText, setBackupText] = useState('');

  const accent = useMemo(() => palette.tint, [palette.tint]);

  const exportData = async () => {
    const data = await getFullBackupData();
    setBackupText(JSON.stringify(createBackupPayload(data), null, 2));
    Alert.alert('Export ready', 'Backup JSON is available in the text area.');
  };

  const importData = async () => {
    try {
      let nextAppState: Record<string, unknown>;
      const parsed = parseBackupText(backupText);

      if (parsed.fullBackupData) {
        await restoreFullBackupData(parsed.fullBackupData);
        nextAppState = parsed.fullBackupData.appState;
      } else if (parsed.appState) {
        await replaceAllState(parsed.appState);
        nextAppState = parsed.appState;
      } else {
        throw new Error('Invalid backup payload');
      }

      const nextSettings = nextAppState.settings as typeof DEFAULT_SETTINGS | undefined;
      if (nextSettings) {
        await updateSettings(nextSettings);
      } else {
        await resetSettings();
      }
      Alert.alert('Import complete', 'Local data was restored from backup.');
    } catch {
      Alert.alert('Import failed', 'Backup JSON is invalid.');
    }
  };

  const resetAll = () => {
    Alert.alert('Reset app data', 'This clears local BOM, plan, progress, and settings data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await resetAllData({ settings: DEFAULT_SETTINGS });
          await resetSettings();
          setBackupText('');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.screen}>
        <BrandBackground palette={palette} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={[styles.title, { color: palette.text }]}>Settings</Text>

          <Section title="Cues" palette={palette}>
            <ToggleRow
              label="Sound"
              value={settings.soundEnabled}
              onChange={(value) => updateSettings({ soundEnabled: value })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="Haptics"
              value={settings.hapticsEnabled}
              onChange={(value) => updateSettings({ hapticsEnabled: value })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="Vibration"
              value={settings.vibrationEnabled}
              onChange={(value) => updateSettings({ vibrationEnabled: value })}
              accent={accent}
              palette={palette}
            />
            <OptionRow
              label="Voice Cue Style"
              value={settings.voiceCueStyle}
              options={VOICE_CUE_OPTIONS}
              onSelect={(value) => updateSettings({ voiceCueStyle: value as VoiceCueStyle })}
              accent={accent}
              palette={palette}
            />
          </Section>

          <Section title="Voice Cues" palette={palette}>
            <ToggleRow
              label="Lead-in countdown"
              value={settings.voiceLeadInEnabled}
              onChange={(value) => updateSettings({ voiceLeadInEnabled: value })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="EMOM minute cues"
              value={settings.voiceEmomEnabled}
              onChange={(value) => updateSettings({ voiceEmomEnabled: value })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="TABATA work/rest"
              value={settings.voiceTabataEnabled}
              onChange={(value) => updateSettings({ voiceTabataEnabled: value })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="AMRAP finish countdown"
              value={settings.voiceAmrapEnabled}
              onChange={(value) => updateSettings({ voiceAmrapEnabled: value })}
              accent={accent}
              palette={palette}
            />
          </Section>

          <Section title="Appearance" palette={palette}>
            <OptionRow
              label="Theme"
              value={settings.themePreset}
              options={THEME_OPTIONS}
              onSelect={(value) => updateSettings({ themePreset: value as ThemePreset })}
              accent={accent}
              palette={palette}
            />
          </Section>

          <Section title="Timer Defaults" palette={palette}>
            <OptionRow
              label="Default Mode"
              value={settings.defaultTimerMode}
              options={[...TIMER_MODE_OPTIONS]}
              onSelect={(value) => updateSettings({ defaultTimerMode: value as (typeof TIMER_MODE_OPTIONS)[number] })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="3-2-1 Lead-in"
              value={settings.defaultLeadInEnabled}
              onChange={(value) => updateSettings({ defaultLeadInEnabled: value })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="Auto-reset on finish"
              value={settings.autoResetOnFinish}
              onChange={(value) => updateSettings({ autoResetOnFinish: value })}
              accent={accent}
              palette={palette}
            />
          </Section>

          <Section title="Preferences" palette={palette}>
            <OptionRow
              label="Weight Unit"
              value={settings.weightUnit}
              options={['LB', 'KG']}
              onSelect={(value) => updateSettings({ weightUnit: value as 'LB' | 'KG' })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="Prevent Screen Timeout"
              value={settings.keepScreenAwake}
              onChange={(value) => updateSettings({ keepScreenAwake: value })}
              accent={accent}
              palette={palette}
            />
            <ToggleRow
              label="Lock Controls While Running"
              value={settings.lockControlsWhileRunning}
              onChange={(value) => updateSettings({ lockControlsWhileRunning: value })}
              accent={accent}
              palette={palette}
            />
          </Section>

          <Section title="Data" palette={palette}>
            <Pressable style={[styles.actionButton, { borderColor: palette.border }]} onPress={exportData}>
              <Text style={[styles.actionText, { color: palette.text }]}>Export Data</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, { borderColor: palette.border }]} onPress={importData}>
              <Text style={[styles.actionText, { color: palette.text }]}>Import Data</Text>
            </Pressable>
            <Pressable style={[styles.actionButton, { borderColor: '#B94A4F' }]} onPress={resetAll}>
              <Text style={[styles.actionText, { color: '#F2A2A8' }]}>Reset App Data</Text>
            </Pressable>
            <TextInput
              multiline
              numberOfLines={8}
              value={backupText}
              onChangeText={setBackupText}
              placeholder="Export JSON appears here. Paste backup JSON here to import."
              placeholderTextColor={palette.muted}
              style={[styles.backupInput, { color: palette.text, borderColor: palette.border }]}
            />
          </Section>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function Section({
  title,
  palette,
  children,
}: {
  title: string;
  palette: (typeof Colors)['light'];
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  accent,
  palette,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  accent: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: accent, false: '#3A404C' }} />
    </View>
  );
}

function OptionRow({
  label,
  value,
  options,
  onSelect,
  accent,
  palette,
}: {
  label: string;
  value: string;
  options: string[];
  onSelect: (value: string) => void;
  accent: string;
  palette: (typeof Colors)['light'];
}) {
  return (
    <View style={styles.optionRowWrap}>
      <Text style={[styles.rowLabel, { color: palette.text }]}>{label}</Text>
      <View style={styles.optionGrid}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onSelect(option)}
              style={[
                styles.optionChip,
                {
                  borderColor: selected ? accent : palette.border,
                  backgroundColor: selected ? palette.surfaceAlt : palette.surface,
                },
              ]}
            >
              <Text style={[styles.optionText, { color: selected ? accent : palette.text }]}>
                {displayLabel(option)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 120,
    gap: 12,
  },
  title: {
    fontFamily: Fonts.display,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  sectionTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  sectionBody: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontFamily: Fonts.body,
    fontSize: 14,
  },
  optionRowWrap: {
    gap: 8,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  optionText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionText: {
    fontFamily: Fonts.body,
    fontSize: 13,
    fontWeight: '600',
  },
  backupInput: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 160,
    textAlignVertical: 'top',
    padding: 10,
    fontFamily: Fonts.mono,
    fontSize: 12,
  },
});
