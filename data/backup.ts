import type { FullBackupData } from '@/data/db';

export type BackupPayload = {
  schemaVersion: number;
  exportedAt: string;
  data: FullBackupData;
};

export function createBackupPayload(data: FullBackupData): BackupPayload {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function parseBackupText(text: string): {
  fullBackupData?: FullBackupData;
  appState?: Record<string, unknown>;
} {
  const parsed = JSON.parse(text) as {
    schemaVersion?: number;
    data?: FullBackupData;
    state?: Record<string, unknown>;
  };

  if (parsed?.data && typeof parsed.data === 'object') {
    return { fullBackupData: parsed.data };
  }

  if (parsed?.state && typeof parsed.state === 'object') {
    return { appState: parsed.state };
  }

  throw new Error('Invalid backup payload');
}
