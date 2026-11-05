import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import {
  getDriveSyncHistory,
  getLastDriveSyncTime,
  MAX_DRIVE_SYNC_HISTORY,
  recordDriveSyncHistory,
} from '../drive-sync-history';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await db.delete();
});

describe('Drive sync history', () => {
  it('keeps the newest entries within the configured history limit', async () => {
    for (let index = 0; index <= MAX_DRIVE_SYNC_HISTORY; index += 1) {
      const timestamp = new Date(index * 1000).toISOString();
      await recordDriveSyncHistory({
        id: String(index),
        startedAt: timestamp,
        completedAt: timestamp,
        status: 'synced',
        message: `Sync ${index}`,
      });
    }

    const history = await getDriveSyncHistory();
    expect(history).toHaveLength(MAX_DRIVE_SYNC_HISTORY);
    expect(history[0]?.id).toBe(String(MAX_DRIVE_SYNC_HISTORY));
    expect(history.at(-1)?.id).toBe('1');
  });

  it('ignores malformed persisted entries', async () => {
    await db.syncMeta.put({
      key: 'drive.syncHistory',
      value: [null, { id: 'bad', status: 'invalid' }],
    });

    await expect(getDriveSyncHistory()).resolves.toEqual([]);
  });

  it('reads the last successful sync timestamp from existing metadata', async () => {
    const syncedAt = '2026-11-05T12:00:00.000Z';
    await db.syncMeta.put({ key: 'drive.lastSync', value: syncedAt });

    await expect(getLastDriveSyncTime()).resolves.toBe(syncedAt);
  });
});
