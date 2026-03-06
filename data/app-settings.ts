import { useEffect, useState } from 'react';

import { getState, setState } from '@/data/db';

export type ThemePreset = 'NEON' | 'SLATE' | 'FOREST' | 'AMBER' | 'MONO';
export type VoiceCueStyle = 'BEEP' | 'VOICE_BEEP' | 'SILENT';
export type TimerPresetDefault = 'AMRAP' | 'EMOM' | 'TABATA' | 'FOR_TIME';

export type AppSettings = {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  vibrationEnabled: boolean;
  themePreset: ThemePreset;
  defaultTimerMode: TimerPresetDefault;
  defaultLeadInEnabled: boolean;
  autoResetOnFinish: boolean;
  weightUnit: 'LB' | 'KG';
  keepScreenAwake: boolean;
  lockControlsWhileRunning: boolean;
  voiceCueStyle: VoiceCueStyle;
  voiceLeadInEnabled: boolean;
  voiceEmomEnabled: boolean;
  voiceTabataEnabled: boolean;
  voiceAmrapEnabled: boolean;
};

const SETTINGS_KEY = 'settings';

export const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  vibrationEnabled: true,
  themePreset: 'NEON',
  defaultTimerMode: 'AMRAP',
  defaultLeadInEnabled: true,
  autoResetOnFinish: false,
  weightUnit: 'LB',
  keepScreenAwake: false,
  lockControlsWhileRunning: true,
  voiceCueStyle: 'BEEP',
  voiceLeadInEnabled: true,
  voiceEmomEnabled: true,
  voiceTabataEnabled: true,
  voiceAmrapEnabled: true,
};

let currentSettings: AppSettings = DEFAULT_SETTINGS;
let loaded = false;
const listeners = new Set<(settings: AppSettings) => void>();

const normalizeSettings = (raw: Partial<AppSettings> | null | undefined): AppSettings => ({
  ...DEFAULT_SETTINGS,
  ...(raw ?? {}),
});

export async function loadSettings(): Promise<AppSettings> {
  if (loaded) {
    return currentSettings;
  }
  const stored = await getState<Partial<AppSettings>>(SETTINGS_KEY);
  currentSettings = normalizeSettings(stored);
  loaded = true;
  return currentSettings;
}

function emit() {
  for (const listener of listeners) {
    listener(currentSettings);
  }
}

export function subscribeSettings(listener: (settings: AppSettings) => void) {
  listeners.add(listener);
  listener(currentSettings);
  return () => listeners.delete(listener);
}

export async function updateSettings(patch: Partial<AppSettings>) {
  currentSettings = normalizeSettings({ ...currentSettings, ...patch });
  await setState(SETTINGS_KEY, currentSettings);
  loaded = true;
  emit();
}

export async function resetSettings() {
  currentSettings = DEFAULT_SETTINGS;
  await setState(SETTINGS_KEY, currentSettings);
  loaded = true;
  emit();
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(currentSettings);

  useEffect(() => {
    let active = true;
    loadSettings().then((next) => {
      if (active) {
        setSettings(next);
      }
    });
    const unsubscribe = subscribeSettings((next) => {
      if (active) {
        setSettings(next);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
  };
}
