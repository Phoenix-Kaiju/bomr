import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Audio, type AVPlaybackSource } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';

import { BrandBackground } from '@/components/brand-background';
import { createShadowStyle } from '@/constants/shadows';
import { Fonts, getThemePalette } from '@/constants/theme';
import { useAppSettings } from '@/data/app-settings';
import { getState, setState } from '@/data/db';

type EquipmentItem = {
  id: string;
  label: string;
};

const BASE_EQUIPMENT: EquipmentItem[] = [
  { id: 'rack', label: 'Power rack' },
  { id: 'bench', label: 'Adjustable bench' },
  { id: 'db', label: 'Dumbbells' },
  { id: 'kb', label: 'Kettlebells' },
  { id: 'bb', label: 'Barbell + plates' },
  { id: 'pullup', label: 'Pull-up bar' },
  { id: 'bands', label: 'Resistance bands' },
  { id: 'rower', label: 'Rower' },
  { id: 'bike', label: 'Assault bike' },
  { id: 'rings', label: 'Gymnastic rings' },
  { id: 'box', label: 'Plyo box' },
  { id: 'sled', label: 'Sled' },
];

const EXTRA_SUGGESTIONS = [
  'Dip bars',
  'Cable pulley',
  'Landmine attachment',
  'Adjustable kettlebell',
  'Medicine ball',
  'Weighted vest',
  'Battle ropes',
  'Jump rope',
  'Ab wheel',
  'Trap bar',
  'EZ curl bar',
  'Sandbag',
  'Ski erg',
  'Treadmill',
  'Air runner',
  'Leg roller',
  'Foam roller',
  'Plyometric hurdle',
];

const WEIGHT_OPTIONS = {
  db: ['5', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55', '60', '65', '70', '75', '80', '85', '90', '95', '100'],
  kb: ['8', '12', '16', '20', '20.4', '24', '28', '31.8', '32'],
  bb: ['2.5', '5', '10', '25', '35', '45'],
} as const;

type BomState = {
  owned: string[];
  customEquipment: string[];
  weights: {
    db: string[];
    kb: Record<string, number>;
    bb: Record<string, number>;
  };
};

type BomMode = 'closed' | 'add' | 'review';
type TimerPreset = 'AMRAP' | 'EMOM' | 'TABATA' | 'FOR_TIME';

const normalize = (value: string) => value.trim().toLowerCase();

const TIMER_PRESETS: TimerPreset[] = ['AMRAP', 'EMOM', 'TABATA', 'FOR_TIME'];

const TIMER_DEFAULTS = {
  AMRAP: { durationSec: 14 * 60 },
  EMOM: { durationSec: 12 * 60 },
  TABATA: { rounds: 8, workSec: 20, restSec: 10 },
  FOR_TIME: { targetSec: 10 * 60 },
} as const;

type TimerSettings = {
  amrapSec: number;
  emomSec: number;
  tabataRounds: number;
  tabataWorkSec: number;
  tabataRestSec: number;
  forTimeSec: number;
};

const formatClock = (totalSec: number) => {
  const clamped = Math.max(0, totalSec);
  const min = Math.floor(clamped / 60);
  const sec = clamped % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const toKg = (lb: number) => lb / 2.2046226218;
const toLb = (kg: number) => kg * 2.2046226218;
const formatWeight = (value: string, unit: 'LB' | 'KG') => {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return value;
  }
  const formatted = unit === 'KG' ? toKg(num) : toLb(num);
  const rounded = Math.round(formatted * 10) / 10;
  return `${rounded}`;
};

export default function BomScreen() {
  const { settings } = useAppSettings();
  const palette = getThemePalette(settings.themePreset);
  const accent = palette.tint;

  const [mode, setMode] = useState<BomMode>('closed');
  const [query, setQuery] = useState('');
  const [timerMode, setTimerMode] = useState<TimerPreset>('AMRAP');
  const [timerRunning, setTimerRunning] = useState(false);
  const [preStartSec, setPreStartSec] = useState<number | null>(null);
  const [timerElapsedMs, setTimerElapsedMs] = useState(0);
  const [runStartedAtMs, setRunStartedAtMs] = useState<number | null>(null);
  const [clockNowMs, setClockNowMs] = useState(Date.now());
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    amrapSec: TIMER_DEFAULTS.AMRAP.durationSec,
    emomSec: TIMER_DEFAULTS.EMOM.durationSec,
    tabataRounds: TIMER_DEFAULTS.TABATA.rounds,
    tabataWorkSec: TIMER_DEFAULTS.TABATA.workSec,
    tabataRestSec: TIMER_DEFAULTS.TABATA.restSec,
    forTimeSec: TIMER_DEFAULTS.FOR_TIME.targetSec,
  });
  const lastCueSecondRef = useRef<number>(-1);
  const voiceThrottleRef = useRef<number>(0);

  const [owned, setOwned] = useState(new Set(['rack', 'bench', 'db', 'bands', 'pullup']));
  const [dirty, setDirty] = useState(false);
  const [expanded, setExpanded] = useState(new Set<string>());
  const [customEquipment, setCustomEquipment] = useState<string[]>([]);
  const [weightSelections, setWeightSelections] = useState({
    db: new Set<string>(['20', '30', '40']),
    kb: new Map<string, number>([
      ['16', 2],
      ['24', 1],
    ]),
    bb: new Map<string, number>([
      ['10', 2],
      ['25', 2],
      ['45', 4],
    ]),
  });
  const beepSoundRef = useRef<Audio.Sound | null>(null);
  const doneSoundRef = useRef<Audio.Sound | null>(null);
  const preStartIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const allEquipment = useMemo(() => {
    const custom = customEquipment.map((label) => ({
      id: `custom:${normalize(label).replace(/[^a-z0-9]+/g, '-')}`,
      label,
    }));
    return [...BASE_EQUIPMENT, ...custom];
  }, [customEquipment]);

  const ownedSorted = useMemo(() => {
    return allEquipment
      .filter((item) => owned.has(item.id))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allEquipment, owned]);

  const typeaheadOptions = useMemo(() => {
    const catalog = [...BASE_EQUIPMENT.map((x) => x.label), ...customEquipment, ...EXTRA_SUGGESTIONS];
    const unique = Array.from(new Set(catalog));
    const needle = normalize(query);

    if (!needle) {
      return unique.slice(0, 6);
    }

    const direct = unique.filter((label) => normalize(label).includes(needle));
    const hasExact = unique.some((label) => normalize(label) === needle);

    if (!hasExact) {
      return [`Add "${query.trim()}"`, ...direct].slice(0, 8);
    }

    return direct.slice(0, 8);
  }, [customEquipment, query]);

  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await getState<BomState>('bom');
      if (!saved || !active) {
        return;
      }
      setOwned(new Set(saved.owned ?? []));
      setCustomEquipment(saved.customEquipment ?? []);
      setWeightSelections({
        db: new Set(saved.weights?.db ?? []),
        kb: new Map(Object.entries(saved.weights?.kb ?? {})),
        bb: new Map(Object.entries(saved.weights?.bb ?? {})),
      });
      setDirty(false);
    })();

    return () => {
      active = false;
      if (preStartIntervalRef.current) {
        clearInterval(preStartIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const timer = setTimeout(() => {
      const payload: BomState = {
        owned: Array.from(owned),
        customEquipment,
        weights: {
          db: Array.from(weightSelections.db),
          kb: Object.fromEntries(weightSelections.kb),
          bb: Object.fromEntries(weightSelections.bb),
        },
      };
      setState('bom', payload).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [dirty, owned, weightSelections, customEquipment]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });

        const beepSource: AVPlaybackSource = require('@/assets/sounds/beep.wav');
        const doneSource: AVPlaybackSource = require('@/assets/sounds/done.wav');

        const { sound: beep } = await Audio.Sound.createAsync(beepSource, { volume: 0.85 });
        const { sound: done } = await Audio.Sound.createAsync(doneSource, { volume: 1 });
        if (!mounted) {
          await beep.unloadAsync();
          await done.unloadAsync();
          return;
        }
        beepSoundRef.current = beep;
        doneSoundRef.current = done;
      } catch {
        // Keep timer functional even if audio fails to initialize.
      }
    })();

    return () => {
      mounted = false;
      beepSoundRef.current?.unloadAsync().catch(() => undefined);
      doneSoundRef.current?.unloadAsync().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!timerRunning) {
      return;
    }
    const interval = setInterval(() => {
      setClockNowMs(Date.now());
    }, 200);
    return () => clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    setTimerRunning(false);
    setPreStartSec(null);
    setTimerElapsedMs(0);
    setRunStartedAtMs(null);
    setClockNowMs(Date.now());
  }, [timerMode]);

  useEffect(() => {
    if (!timerRunning && settings.defaultTimerMode !== timerMode) {
      setTimerMode(settings.defaultTimerMode);
    }
  }, [settings.defaultTimerMode, timerRunning, timerMode]);

  const effectiveElapsedMs =
    timerElapsedMs + (timerRunning && runStartedAtMs ? Math.max(0, clockNowMs - runStartedAtMs) : 0);

  const timerModel = useMemo(() => {
    if (preStartSec !== null) {
      return {
        displayClock: `00:0${preStartSec}`,
        subtitle: 'Starting',
        progress: (3 - preStartSec) / 3,
        done: false,
        capMs: 0,
      };
    }

    if (timerMode === 'AMRAP' || timerMode === 'EMOM') {
      const totalSec = timerMode === 'AMRAP' ? timerSettings.amrapSec : timerSettings.emomSec;
      const elapsedSec = Math.min(totalSec, Math.floor(effectiveElapsedMs / 1000));
      const remainingSec = Math.max(0, totalSec - elapsedSec);
      const minute = Math.min(totalSec / 60, Math.floor(elapsedSec / 60) + 1);
      return {
        displayClock: formatClock(remainingSec),
        subtitle: timerMode === 'EMOM' ? `Minute ${minute}` : 'AMRAP',
        progress: totalSec > 0 ? elapsedSec / totalSec : 0,
        done: remainingSec === 0,
        capMs: totalSec * 1000,
      };
    }

    if (timerMode === 'TABATA') {
      const rounds = timerSettings.tabataRounds;
      const workSec = timerSettings.tabataWorkSec;
      const restSec = timerSettings.tabataRestSec;
      const cycleSec = workSec + restSec;
      const totalSec = rounds * cycleSec;
      const elapsedSec = Math.min(totalSec, Math.floor(effectiveElapsedMs / 1000));
      const currentRound = Math.min(rounds, Math.floor(elapsedSec / cycleSec) + 1);
      const cyclePosSec = elapsedSec % cycleSec;
      const isWork = cyclePosSec < workSec;
      const phaseRemaining = elapsedSec >= totalSec ? 0 : isWork ? workSec - cyclePosSec : cycleSec - cyclePosSec;
      return {
        displayClock: formatClock(phaseRemaining),
        subtitle: `Round ${currentRound}/${rounds} ${isWork ? 'Work' : 'Rest'}`,
        progress: totalSec > 0 ? elapsedSec / totalSec : 0,
        done: elapsedSec >= totalSec,
        capMs: totalSec * 1000,
      };
    }

    const targetSec = timerSettings.forTimeSec;
    const elapsedSec = Math.floor(effectiveElapsedMs / 1000);
    return {
      displayClock: formatClock(elapsedSec),
      subtitle: 'For Time',
      progress: targetSec > 0 ? Math.min(elapsedSec / targetSec, 1) : 0,
      done: false,
      capMs: 0,
    };
  }, [preStartSec, effectiveElapsedMs, timerMode, timerSettings]);

  useEffect(() => {
    if (!timerRunning || !timerModel.done) {
      return;
    }
    setTimerRunning(false);
    setRunStartedAtMs(null);
    setTimerElapsedMs(settings.autoResetOnFinish ? 0 : timerModel.capMs);
    if (settings.hapticsEnabled && settings.voiceCueStyle !== 'SILENT') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
    if (settings.vibrationEnabled && settings.voiceCueStyle !== 'SILENT') {
      Vibration.vibrate(70);
    }
    if (settings.soundEnabled && settings.voiceCueStyle !== 'SILENT') {
      doneSoundRef.current
        ?.replayAsync()
        .catch(async () => {
          try {
            await doneSoundRef.current?.setPositionAsync(0);
            await doneSoundRef.current?.playAsync();
          } catch {
            // Ignore playback errors.
          }
        });
    }
    if (settings.voiceCueStyle === 'VOICE_BEEP') {
      const enabled =
        (timerMode === 'AMRAP' && settings.voiceAmrapEnabled) ||
        (timerMode === 'EMOM' && settings.voiceEmomEnabled) ||
        (timerMode === 'TABATA' && settings.voiceTabataEnabled) ||
        (timerMode === 'FOR_TIME');
      if (enabled) {
        Speech.speak('done', { language: 'en-US', rate: 0.95, pitch: 1.0 });
      }
    }
  }, [
    timerRunning,
    timerModel,
    timerMode,
    settings.autoResetOnFinish,
    settings.hapticsEnabled,
    settings.vibrationEnabled,
    settings.soundEnabled,
    settings.voiceCueStyle,
    settings.voiceAmrapEnabled,
    settings.voiceEmomEnabled,
    settings.voiceTabataEnabled,
  ]);

  useEffect(() => {
    if (!timerRunning) {
      lastCueSecondRef.current = -1;
      return;
    }

    const elapsedSec = Math.floor(effectiveElapsedMs / 1000);
    if (elapsedSec === lastCueSecondRef.current) {
      return;
    }
    lastCueSecondRef.current = elapsedSec;

    const cue = (strong = false) => {
      if (settings.voiceCueStyle === 'SILENT') {
        return;
      }
      if (settings.hapticsEnabled) {
        Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined
        );
      }
      if (settings.vibrationEnabled) {
        Vibration.vibrate(strong ? 40 : 20);
      }
      if (settings.soundEnabled) {
        beepSoundRef.current
          ?.replayAsync()
          .catch(async () => {
            try {
              await beepSoundRef.current?.setPositionAsync(0);
              await beepSoundRef.current?.playAsync();
            } catch {
              // Ignore playback errors.
            }
          });
      }
    };

    const speak = (text: string, enabled: boolean) => {
      if (settings.voiceCueStyle !== 'VOICE_BEEP' || !enabled) {
        return;
      }
      const now = Date.now();
      if (now - voiceThrottleRef.current < 650) {
        return;
      }
      voiceThrottleRef.current = now;
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.95,
        pitch: 1.0,
      });
    };

    if (timerMode === 'TABATA') {
      const cycle = timerSettings.tabataWorkSec + timerSettings.tabataRestSec;
      if (cycle > 0) {
        const pos = elapsedSec % cycle;
        if (pos === 0 || pos === timerSettings.tabataWorkSec) {
          cue(true);
          speak(pos === 0 ? 'work' : 'rest', settings.voiceTabataEnabled);
          return;
        }
      }
    }

    if (timerMode === 'EMOM') {
      const secondInMinute = elapsedSec % 60;
      if (secondInMinute === 57 || secondInMinute === 58 || secondInMinute === 59) {
        cue();
        speak(String(60 - secondInMinute), settings.voiceEmomEnabled);
        return;
      }
      if (elapsedSec > 0 && secondInMinute === 0) {
        cue(true);
        speak('minute', settings.voiceEmomEnabled);
        return;
      }
    }

    if (timerMode === 'AMRAP') {
      const total = timerSettings.amrapSec;
      const remaining = total - elapsedSec;
      if (remaining > 0 && remaining <= 3) {
        cue();
        speak(String(remaining), settings.voiceAmrapEnabled);
      }
    }
  }, [
    timerRunning,
    timerMode,
    effectiveElapsedMs,
    timerSettings,
    settings.hapticsEnabled,
    settings.vibrationEnabled,
    settings.soundEnabled,
    settings.voiceCueStyle,
    settings.voiceEmomEnabled,
    settings.voiceTabataEnabled,
    settings.voiceAmrapEnabled,
  ]);

  const setOwnedState = (id: string, hasIt: boolean) => {
    setOwned((prev) => {
      const next = new Set(prev);
      if (hasIt) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
    setDirty(true);
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleWeight = (id: keyof typeof WEIGHT_OPTIONS, value: string) => {
    setWeightSelections((prev) => {
      const next = { ...prev };
      if (id === 'db') {
        const set = new Set(next.db);
        if (set.has(value)) {
          set.delete(value);
        } else {
          set.add(value);
        }
        next.db = set;
      }
      return next;
    });
    setDirty(true);
  };

  const adjustCount = (id: 'kb' | 'bb', value: string, delta: number) => {
    setWeightSelections((prev) => {
      const next = { ...prev };
      const map = new Map(next[id]);
      const current = map.get(value) ?? 0;
      const updated = Math.max(0, current + delta);
      if (updated === 0) {
        map.delete(value);
      } else {
        map.set(value, updated);
      }
      next[id] = map;
      return next;
    });
    setDirty(true);
  };

  const handleTimerToggle = () => {
    const playBeep = () => {
      if (settings.voiceCueStyle === 'SILENT') {
        return;
      }
      if (settings.hapticsEnabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      }
      if (settings.vibrationEnabled) {
        Vibration.vibrate(20);
      }
      if (settings.soundEnabled) {
        beepSoundRef.current
          ?.replayAsync()
          .catch(async () => {
            try {
              await beepSoundRef.current?.setPositionAsync(0);
              await beepSoundRef.current?.playAsync();
            } catch {
              // Ignore playback errors.
            }
          });
      }
    };

    const speak = (text: string) => {
      if (settings.voiceCueStyle !== 'VOICE_BEEP') {
        return;
      }
      const now = Date.now();
      if (now - voiceThrottleRef.current < 650) {
        return;
      }
      voiceThrottleRef.current = now;
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.95,
        pitch: 1.0,
      });
    };

    const startRun = () => {
      setRunStartedAtMs(Date.now());
      setClockNowMs(Date.now());
      setTimerRunning(true);
    };

    if (timerRunning) {
      setTimerElapsedMs((prev) =>
        prev + (runStartedAtMs ? Math.max(0, Date.now() - runStartedAtMs) : 0)
      );
      setRunStartedAtMs(null);
      setTimerRunning(false);
      return;
    }

    if (preStartSec !== null) {
      return;
    }

    if (!settings.defaultLeadInEnabled) {
      startRun();
      return;
    }

    let remaining = 3;
    setPreStartSec(remaining);
    playBeep();
    speak('3');
    preStartIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (preStartIntervalRef.current) {
          clearInterval(preStartIntervalRef.current);
          preStartIntervalRef.current = null;
        }
        setPreStartSec(null);
        if (settings.voiceCueStyle === 'VOICE_BEEP' && settings.voiceLeadInEnabled) {
          Speech.speak('start', { language: 'en-US', rate: 0.95, pitch: 1.0 });
        }
        startRun();
        return;
      }
      setPreStartSec(remaining);
      playBeep();
      speak(String(remaining));
    }, 1000);
  };

  const handleTimerReset = () => {
    if (preStartIntervalRef.current) {
      clearInterval(preStartIntervalRef.current);
      preStartIntervalRef.current = null;
    }
    setTimerRunning(false);
    setPreStartSec(null);
    setTimerElapsedMs(0);
    setRunStartedAtMs(null);
    setClockNowMs(Date.now());
  };

  const adjustTimerSetting = (field: keyof TimerSettings, delta: number, min: number, max: number) => {
    if (timerRunning && settings.lockControlsWhileRunning) {
      return;
    }
    setTimerSettings((prev) => ({
      ...prev,
      [field]: Math.max(min, Math.min(max, prev[field] + delta)),
    }));
  };

  const addEquipmentFromText = (raw: string) => {
    const label = raw.trim();
    if (!label) {
      return;
    }

    const existing = allEquipment.find((item) => normalize(item.label) === normalize(label));

    if (existing) {
      setOwnedState(existing.id, true);
      return;
    }

    setCustomEquipment((prev) => {
      if (prev.some((item) => normalize(item) === normalize(label))) {
        return prev;
      }
      return [...prev, label];
    });

    const customId = `custom:${normalize(label).replace(/[^a-z0-9]+/g, '-')}`;
    setOwnedState(customId, true);
  };

  const selectSuggestion = (value: string) => {
    if (value.startsWith('Add "')) {
      addEquipmentFromText(query);
      setQuery('');
      return;
    }
    addEquipmentFromText(value);
    setQuery('');
  };

  const renderEquipmentRow = (item: EquipmentItem) => {
    const isOwned = owned.has(item.id);
    const hasWeights = item.id === 'db' || item.id === 'kb' || item.id === 'bb';
    const isExpanded = expanded.has(item.id);

    return (
      <Swipeable
        key={item.id}
        onSwipeableRightOpen={() => setOwnedState(item.id, true)}
        onSwipeableLeftOpen={() => setOwnedState(item.id, false)}
        renderLeftActions={() => (
          <Pressable onPress={() => setOwnedState(item.id, true)} style={[styles.swipeAction, styles.swipeLeft]}>
            <Text style={styles.swipeText}>+</Text>
          </Pressable>
        )}
        renderRightActions={() => (
          <Pressable onPress={() => setOwnedState(item.id, false)} style={[styles.swipeAction, styles.swipeRight]}>
            <Text style={styles.swipeText}>-</Text>
          </Pressable>
        )}
      >
        <View>
          <Pressable
            onPress={() => hasWeights && toggleExpanded(item.id)}
            style={[
              styles.listRow,
              {
                borderColor: isOwned ? palette.tint : palette.border,
                backgroundColor: palette.surface,
              },
            ]}
          >
            <View style={styles.listRowTop}>
              <Text style={[styles.listLabel, { color: palette.text }]}>{item.label}</Text>
              {hasWeights ? (
                <Text style={[styles.listChevron, { color: palette.muted }]}>{isExpanded ? '▾' : '▸'}</Text>
              ) : null}
            </View>
          </Pressable>

          {hasWeights && isExpanded ? (
            <View style={[styles.subMenu, { borderColor: palette.border }]}>
              <Text style={[styles.subTitle, { color: palette.muted }]}>
                {`Weights (${settings.weightUnit.toLowerCase()})`}
              </Text>
              <View style={styles.subGrid}>
                {WEIGHT_OPTIONS[item.id as keyof typeof WEIGHT_OPTIONS].map((value) => {
                  const isDb = item.id === 'db';
                  const isKb = item.id === 'kb';
                  const selected = isDb
                    ? weightSelections.db.has(value)
                    : isKb
                    ? (weightSelections.kb.get(value) ?? 0) > 0
                    : (weightSelections.bb.get(value) ?? 0) > 0;
                  const count = isKb
                    ? weightSelections.kb.get(value) ?? 0
                    : item.id === 'bb'
                    ? weightSelections.bb.get(value) ?? 0
                    : 0;
                  const disabled = !isOwned;

                  const displayUnit = settings.weightUnit;
                  const baseUnit = item.id === 'kb' ? 'KG' : 'LB';
                  const displayValue =
                    displayUnit === baseUnit ? value : formatWeight(value, displayUnit);

                  return (
                    <Pressable
                      key={value}
                      onPress={() =>
                        isDb ? toggleWeight('db', value) : adjustCount(item.id as 'kb' | 'bb', value, 1)
                      }
                      onLongPress={() =>
                        isDb ? toggleWeight('db', value) : adjustCount(item.id as 'kb' | 'bb', value, -1)
                      }
                      disabled={disabled}
                      style={[
                        styles.subPill,
                        {
                          borderColor: selected ? palette.tint : palette.border,
                          backgroundColor: selected ? '#111B21' : palette.surfaceAlt,
                          opacity: disabled ? 0.5 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.subPillText, { color: palette.text }]}>{displayValue}</Text>
                      {!isDb && count > 0 ? (
                        <View style={[styles.countBadge, { backgroundColor: accent }]}>
                          <Text style={[styles.countBadgeText, { color: '#0B0D10' }]}>{count}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </Swipeable>
    );
  };

  const controlsLocked = timerRunning && settings.lockControlsWhileRunning;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <View style={styles.screen}>
        <BrandBackground palette={palette} />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.headerRow}>
            <Text style={[styles.brandTitle, { color: palette.text }]}>BOMR</Text>
          </View>

          <View style={[styles.modeCard, { borderColor: palette.border, backgroundColor: palette.surface }]}>
            <Text style={[styles.modeTitle, { color: palette.text }]}>Equipment Setup</Text>
            <Text style={[styles.modeMeta, { color: palette.muted }]}>
              Add equipment with explicit controls, then review owned gear and weights below.
            </Text>
            <View style={styles.modeActionRow}>
              <Pressable
                onPress={() => setMode((prev) => (prev === 'add' ? 'closed' : 'add'))}
                style={[
                  styles.modeActionButton,
                  {
                    backgroundColor: mode === 'add' ? accent : palette.surfaceAlt,
                    borderColor: mode === 'add' ? accent : palette.border,
                  },
                ]}
              >
                <Text style={[styles.modeActionText, { color: mode === 'add' ? '#0B0D10' : palette.text }]}>
                  {mode === 'add' ? 'Close Add' : 'Add Equipment'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setMode((prev) => (prev === 'review' ? 'closed' : 'review'))}
                style={[
                  styles.modeActionButton,
                  {
                    backgroundColor: mode === 'review' ? accent : palette.surfaceAlt,
                    borderColor: mode === 'review' ? accent : palette.border,
                  },
                ]}
              >
                <Text style={[styles.modeActionText, { color: mode === 'review' ? '#0B0D10' : palette.text }]}>
                  {mode === 'review' ? 'Close Review' : `Review Owned (${owned.size})`}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.timerShell}>
            <View style={[styles.timerCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.timerNeon} />
              <View style={styles.timerTop}>
                <View style={styles.timerControlStack}>
                  <Pressable
                    onPress={handleTimerToggle}
                    style={[
                      styles.timerControlButton,
                      { backgroundColor: timerRunning ? '#B94A4F' : accent },
                    ]}
                  >
                    <Text style={[styles.timerControlIcon, { color: timerRunning ? '#F6F7F9' : '#0B0D10' }]}>
                      {timerRunning ? '||' : '>'}
                    </Text>
                    <Text style={[styles.timerControlLabel, { color: timerRunning ? '#F6F7F9' : '#0B0D10' }]}>
                      {timerRunning ? 'Pause' : 'Start'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={handleTimerReset}
                    style={[
                      styles.timerResetButton,
                      { borderColor: palette.border, backgroundColor: palette.surfaceAlt },
                    ]}
                  >
                    <Text style={[styles.timerResetText, { color: palette.text }]}>Reset</Text>
                  </Pressable>
                </View>
                <View style={styles.timerClockWrap}>
                  <Text style={styles.timerClockText}>{timerModel.displayClock}</Text>
                  <Text style={[styles.timerModeMeta, { color: palette.muted }]}>{timerModel.subtitle}</Text>
                </View>
              </View>
              <View style={styles.timerProgressTrack}>
                <View style={[styles.timerProgressFill, { width: `${Math.max(timerModel.progress * 100, 2)}%` }]} />
              </View>
              <View style={styles.timerModeRow}>
                {TIMER_PRESETS.map((preset) => (
                  <Pressable
                    key={preset}
                    disabled={controlsLocked}
                    onPress={() => {
                      if (!controlsLocked) {
                        setTimerMode(preset);
                      }
                    }}
                    style={[
                      styles.timerModeChip,
                      {
                        borderColor: timerMode === preset ? accent : palette.border,
                        backgroundColor: timerMode === preset ? '#111B21' : palette.surfaceAlt,
                        opacity: controlsLocked ? 0.55 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.timerModeChipText,
                        { color: timerMode === preset ? accent : palette.text },
                      ]}
                    >
                      {preset === 'FOR_TIME' ? 'FOR TIME' : preset}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.timerSettingsRow}>
                {(timerMode === 'AMRAP' || timerMode === 'EMOM') && (
                  <View style={styles.timerSettingCard}>
                    <Text style={[styles.timerSettingLabel, { color: palette.muted }]}>Duration</Text>
                    <View style={styles.timerSettingControl}>
                      <Pressable
                        disabled={controlsLocked}
                        onPress={() =>
                          adjustTimerSetting(
                            timerMode === 'AMRAP' ? 'amrapSec' : 'emomSec',
                            -60,
                            60,
                            60 * 90
                          )
                        }
                        style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                      >
                        <Text style={[styles.timerSettingStepText, { color: palette.text }]}>-</Text>
                      </Pressable>
                      <Text style={[styles.timerSettingValue, { color: palette.text }]}>
                        {Math.floor((timerMode === 'AMRAP' ? timerSettings.amrapSec : timerSettings.emomSec) / 60)} min
                      </Text>
                      <Pressable
                        disabled={controlsLocked}
                        onPress={() =>
                          adjustTimerSetting(
                            timerMode === 'AMRAP' ? 'amrapSec' : 'emomSec',
                            60,
                            60,
                            60 * 90
                          )
                        }
                        style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                      >
                        <Text style={[styles.timerSettingStepText, { color: palette.text }]}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                {timerMode === 'TABATA' && (
                  <View style={styles.timerSettingsGrid}>
                    <View style={styles.timerSettingCard}>
                      <Text style={[styles.timerSettingLabel, { color: palette.muted }]}>Rounds</Text>
                      <View style={styles.timerSettingControl}>
                        <Pressable
                          disabled={controlsLocked}
                          onPress={() => adjustTimerSetting('tabataRounds', -1, 1, 30)}
                          style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                        >
                          <Text style={[styles.timerSettingStepText, { color: palette.text }]}>-</Text>
                        </Pressable>
                        <Text style={[styles.timerSettingValue, { color: palette.text }]}>
                          {timerSettings.tabataRounds}
                        </Text>
                        <Pressable
                          disabled={controlsLocked}
                          onPress={() => adjustTimerSetting('tabataRounds', 1, 1, 30)}
                          style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                        >
                          <Text style={[styles.timerSettingStepText, { color: palette.text }]}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.timerSettingCard}>
                      <Text style={[styles.timerSettingLabel, { color: palette.muted }]}>Work</Text>
                      <View style={styles.timerSettingControl}>
                        <Pressable
                          disabled={controlsLocked}
                          onPress={() => adjustTimerSetting('tabataWorkSec', -5, 5, 120)}
                          style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                        >
                          <Text style={[styles.timerSettingStepText, { color: palette.text }]}>-</Text>
                        </Pressable>
                        <Text style={[styles.timerSettingValue, { color: palette.text }]}>
                          {timerSettings.tabataWorkSec}s
                        </Text>
                        <Pressable
                          disabled={controlsLocked}
                          onPress={() => adjustTimerSetting('tabataWorkSec', 5, 5, 120)}
                          style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                        >
                          <Text style={[styles.timerSettingStepText, { color: palette.text }]}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.timerSettingCard}>
                      <Text style={[styles.timerSettingLabel, { color: palette.muted }]}>Rest</Text>
                      <View style={styles.timerSettingControl}>
                        <Pressable
                          disabled={controlsLocked}
                          onPress={() => adjustTimerSetting('tabataRestSec', -5, 5, 120)}
                          style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                        >
                          <Text style={[styles.timerSettingStepText, { color: palette.text }]}>-</Text>
                        </Pressable>
                        <Text style={[styles.timerSettingValue, { color: palette.text }]}>
                          {timerSettings.tabataRestSec}s
                        </Text>
                        <Pressable
                          disabled={controlsLocked}
                          onPress={() => adjustTimerSetting('tabataRestSec', 5, 5, 120)}
                          style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                        >
                          <Text style={[styles.timerSettingStepText, { color: palette.text }]}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                )}
                {timerMode === 'FOR_TIME' && (
                  <View style={styles.timerSettingCard}>
                    <Text style={[styles.timerSettingLabel, { color: palette.muted }]}>Target</Text>
                    <View style={styles.timerSettingControl}>
                      <Pressable
                        disabled={controlsLocked}
                        onPress={() => adjustTimerSetting('forTimeSec', -60, 60, 60 * 90)}
                        style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                      >
                        <Text style={[styles.timerSettingStepText, { color: palette.text }]}>-</Text>
                      </Pressable>
                      <Text style={[styles.timerSettingValue, { color: palette.text }]}>
                        {Math.floor(timerSettings.forTimeSec / 60)} min
                      </Text>
                      <Pressable
                        disabled={controlsLocked}
                        onPress={() => adjustTimerSetting('forTimeSec', 60, 60, 60 * 90)}
                        style={[styles.timerSettingStep, { borderColor: palette.border, opacity: controlsLocked ? 0.5 : 1 }]}
                      >
                        <Text style={[styles.timerSettingStepText, { color: palette.text }]}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>

          {mode === 'add' ? (
            <View style={[styles.modeCard, { borderColor: palette.border, backgroundColor: palette.surface }]}> 
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Type equipment"
                placeholderTextColor={palette.muted}
                style={[styles.typeaheadInput, { color: palette.text, borderColor: palette.border }]}
              />
              <View style={styles.suggestionsWrap}>
                {typeaheadOptions.map((option) => (
                  <Pressable
                    key={option}
                    onPress={() => selectSuggestion(option)}
                    style={[styles.suggestionRow, { borderColor: palette.border }]}
                  >
                    <Text style={[styles.suggestionText, { color: palette.text }]}>{option}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {mode === 'review' ? (
            <View
              style={[
                styles.modeCard,
                styles.reviewModeCard,
                { borderColor: palette.border, backgroundColor: palette.surface },
              ]}
            >
              <Text style={[styles.reviewTitle, { color: palette.text }]}>Owned Equipment</Text>
              <Text style={[styles.reviewMeta, { color: palette.muted }]}>
                Swipe right to mark owned and left to remove. Tap items with weights to expand plate or bell options.
              </Text>
              <View style={styles.reviewListWrap}>
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  <View style={styles.listWrap}>{ownedSorted.map((item) => renderEquipmentRow(item))}</View>
                </ScrollView>
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
    paddingBottom: 220,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  brandTitle: {
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  modeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  modeTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  modeMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
  },
  modeActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  modeActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  modeActionText: {
    fontFamily: Fonts.display,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewModeCard: {
    marginBottom: 24,
  },
  reviewMeta: {
    fontFamily: Fonts.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    marginBottom: 10,
  },
  typeaheadInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontFamily: Fonts.body,
    fontSize: 14,
    marginBottom: 10,
  },
  suggestionsWrap: {
    gap: 8,
  },
  suggestionRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  suggestionText: {
    fontFamily: Fonts.body,
    fontSize: 13,
  },
  reviewTitle: {
    fontFamily: Fonts.display,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  reviewListWrap: {
    maxHeight: 300,
  },
  listWrap: {
    gap: 12,
  },
  listRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  listRowTop: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    minHeight: 24,
  },
  listLabel: {
    fontFamily: Fonts.body,
    fontSize: 15,
    textAlign: 'center',
  },
  listChevron: {
    position: 'absolute',
    right: 0,
    fontFamily: Fonts.body,
    fontSize: 18,
  },
  subMenu: {
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#0F141B',
  },
  subTitle: {
    fontFamily: Fonts.body,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  subGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  subPill: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    position: 'relative',
  },
  subPillText: {
    fontFamily: Fonts.body,
    fontSize: 12,
  },
  countBadge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '700',
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 96,
    marginVertical: 4,
    borderRadius: 16,
  },
  swipeLeft: {
    backgroundColor: '#1F6B55',
  },
  swipeRight: {
    backgroundColor: '#2A2F38',
  },
  swipeText: {
    fontFamily: Fonts.body,
    color: '#F2F6FB',
    fontSize: 24,
    fontWeight: '700',
  },
  timerShell: {
    marginBottom: 20,
  },
  timerCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    minHeight: 220,
    ...createShadowStyle({ color: '#2FE6C8', opacity: 0.35, radius: 18, offsetY: 10 }),
  },
  timerNeon: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2FE6C8',
    opacity: 0.35,
  },
  timerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timerControlStack: {
    gap: 8,
  },
  timerControlButton: {
    minWidth: 110,
    minHeight: 90,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timerResetButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  timerResetText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '600',
  },
  timerControlIcon: {
    fontFamily: Fonts.display,
    fontSize: 18,
    fontWeight: '700',
    color: '#0B0D10',
  },
  timerControlLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    marginTop: 6,
  },
  timerClockWrap: {
    marginLeft: 'auto',
    justifyContent: 'center',
    alignItems: 'flex-end',
    minHeight: 90,
  },
  timerClockText: {
    fontFamily: Fonts.display,
    fontSize: 60,
    lineHeight: 62,
    fontWeight: '700',
    color: '#F2F6FB',
    letterSpacing: 1.1,
  },
  timerModeMeta: {
    fontFamily: Fonts.body,
    fontSize: 13,
    marginTop: 6,
    letterSpacing: 0.4,
  },
  timerProgressTrack: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#0B0F14',
    marginTop: 18,
  },
  timerProgressFill: {
    height: '100%',
    width: '2%',
    borderRadius: 999,
    backgroundColor: '#2FE6C8',
    ...createShadowStyle({ color: '#2FE6C8', opacity: 0.5, radius: 10, offsetY: 0 }),
  },
  timerModeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  timerModeChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  timerModeChipText: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  timerSettingsRow: {
    marginTop: 10,
  },
  timerSettingsGrid: {
    gap: 8,
  },
  timerSettingCard: {
    borderWidth: 1,
    borderColor: '#1F2530',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#10151D',
  },
  timerSettingLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  timerSettingControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  timerSettingStep: {
    width: 26,
    height: 26,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerSettingStepText: {
    fontFamily: Fonts.body,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  timerSettingValue: {
    fontFamily: Fonts.display,
    fontSize: 14,
    fontWeight: '600',
  },
});
