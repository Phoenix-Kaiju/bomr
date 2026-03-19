import { describe, expect, test, vi } from 'vitest';

import { createBackupPayload, parseBackupText } from '@/data/backup';
import type { FullBackupData } from '@/data/db';

const fullBackupData: FullBackupData = {
  appState: {
    settings: { themePreset: 'NEON' },
    build: { daysPerWeek: 4 },
  },
  cycles: [],
  planDays: [],
  workoutLogs: [],
};

describe('backup helpers', () => {
  test('creates the current full-backup payload shape', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-06T12:00:00Z'));

    expect(createBackupPayload(fullBackupData)).toEqual({
      schemaVersion: 2,
      exportedAt: '2026-03-06T12:00:00.000Z',
      data: fullBackupData,
    });
  });

  test('parses full backup payloads', () => {
    const text = JSON.stringify(createBackupPayload(fullBackupData));

    expect(parseBackupText(text)).toEqual({
      fullBackupData,
    });
  });

  test('parses legacy app-state-only payloads', () => {
    const appState = { settings: { themePreset: 'AMBER' } };

    expect(parseBackupText(JSON.stringify({ state: appState }))).toEqual({
      appState,
    });
  });

  test('rejects invalid payloads', () => {
    expect(() => parseBackupText(JSON.stringify({ foo: 'bar' }))).toThrow('Invalid backup payload');
  });

  test('rejects full backups with an unsupported schema version', () => {
    const payload = {
      schemaVersion: 1,
      exportedAt: '2026-03-06T12:00:00.000Z',
      data: fullBackupData,
    };

    expect(() => parseBackupText(JSON.stringify(payload))).toThrow('Unsupported backup schema version');
  });

  test('rejects invalid settings values in legacy app-state payloads', () => {
    const payload = {
      state: {
        settings: {
          themePreset: 'ULTRAVIOLET',
        },
      },
    };

    expect(() => parseBackupText(JSON.stringify(payload))).toThrow('settings.themePreset');
  });

  test('rejects plan days with invalid enum values', () => {
    const payload = {
      schemaVersion: 2,
      exportedAt: '2026-03-06T12:00:00.000Z',
      data: {
        ...fullBackupData,
        cycles: [
          {
            id: 'cycle_1',
            created_at: '2026-03-06T12:00:00.000Z',
            label: 'Cycle 1',
            weeks: 6,
            is_active: 1,
          },
        ],
        planDays: [
          {
            id: 'day_1',
            cycle_id: 'cycle_1',
            week_index: 0,
            day_index: 1,
            date: '2026-03-07',
            kind: 'sprint',
            title: 'Workout',
            summary: 'Summary',
            duration_min: 45,
            format: 'EMOM',
            status: 'planned',
            movement_patterns: '[]',
            cardio_flag: 0,
            required_equipment: '[]',
            volume_score: 1,
          },
        ],
      },
    };

    expect(() => parseBackupText(JSON.stringify(payload))).toThrow('planDays[0].kind');
  });
});
