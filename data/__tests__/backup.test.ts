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
});
