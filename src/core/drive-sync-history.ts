import { db } from './db';

const HISTORY_KEY = 'drive.syncHistory';
const LAST_SYNC_KEY = 'drive.lastSync';
export const MAX_DRIVE_SYNC_HISTORY = 20;

export type DriveSyncHistoryStatus = 'synced' | 'merged' | 'failed' | 'needs-choice';
export type DriveSyncErrorCode =
  | 'offline'
  | 'authorization-required'
  | 'quota-exceeded'
  | 'network-error'
  | 'sync-error';

export interface DriveSyncHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  status: DriveSyncHistoryStatus;
  message: string;
  errorCode?: DriveSyncErrorCode;
}

function isHistoryEntry(value: unknown): value is DriveSyncHistoryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Partial<DriveSyncHistoryEntry>;
  const validCodes: DriveSyncErrorCode[] = [
    'offline',
    'authorization-required',
    'quota-exceeded',
    'network-error',
    'sync-error',
  ];
  return (
    typeof entry.id === 'string' &&
    typeof entry.startedAt === 'string' &&
    Number.isFinite(Date.parse(entry.startedAt)) &&
    typeof entry.completedAt === 'string' &&
    Number.isFinite(Date.parse(entry.completedAt)) &&
    (entry.status === 'synced' ||
      entry.status === 'merged' ||
      entry.status === 'failed' ||
      entry.status === 'needs-choice') &&
    typeof entry.message === 'string' &&
    (entry.errorCode === undefined || validCodes.includes(entry.errorCode))
  );
}

export async function getDriveSyncHistory(): Promise<DriveSyncHistoryEntry[]> {
  const value = (await db.syncMeta.get(HISTORY_KEY))?.value;
  if (!Array.isArray(value)) return [];
  return value.filter(isHistoryEntry).slice(0, MAX_DRIVE_SYNC_HISTORY);
}

export async function getLastDriveSyncTime(): Promise<string | undefined> {
  const value = (await db.syncMeta.get(LAST_SYNC_KEY))?.value;
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : undefined;
}

export async function recordDriveSyncHistory(
  entry: DriveSyncHistoryEntry,
): Promise<void> {
  await db.transaction('rw', db.syncMeta, async () => {
    const stored = (await db.syncMeta.get(HISTORY_KEY))?.value;
    const history = Array.isArray(stored) ? stored.filter(isHistoryEntry) : [];
    await db.syncMeta.put({
      key: HISTORY_KEY,
      value: [entry, ...history.filter((previous) => previous.id !== entry.id)].slice(
        0,
        MAX_DRIVE_SYNC_HISTORY,
      ),
    });
  });
}
