import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../core/db';
import { DRIVE_CONNECTION_CHANGED } from '../../core/drive-auth';
import { DriveSyncChoiceRequired, syncGoogleDrive } from '../../core/drive-sync';

vi.mock('../../core/drive-sync', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return { ...original, syncGoogleDrive: vi.fn() };
});

vi.mock('../context-menus', () => ({
  installContextMenus: vi.fn(),
  refreshContextMenus: vi.fn().mockResolvedValue(undefined),
}));

const listeners: {
  alarm?: (alarm: { name: string }) => void;
  message?: (message: unknown) => void;
} = {};
const clearAlarm = vi.fn().mockResolvedValue(true);

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.clearAllMocks();
  vi.stubGlobal('chrome', {
    runtime: {
      onInstalled: { addListener: vi.fn() },
      onStartup: { addListener: vi.fn() },
      onMessage: {
        addListener: (listener: typeof listeners.message) => {
          listeners.message = listener;
        },
      },
      sendMessage: vi.fn().mockResolvedValue(undefined),
    },
    alarms: {
      create: vi.fn().mockResolvedValue(undefined),
      clear: clearAlarm,
      onAlarm: {
        addListener: (listener: typeof listeners.alarm) => {
          listeners.alarm = listener;
        },
      },
    },
  });
  // Install once; listeners read the fresh database and Chrome stub per test.
  if (!listeners.alarm) await import('../service-worker');
  vi.mocked(syncGoogleDrive).mockResolvedValue({
    status: 'skipped',
    reason: 'already-running',
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Drive background connection gates', () => {
  it.each(['disconnected', 'authorization-required'] as const)(
    'skips all sync alarms while %s',
    async (status) => {
      if (status === 'authorization-required') {
        await db.syncMeta.bulkPut([
          {
            key: 'drive.account',
            value: { emailAddress: 'test@example.com', permissionId: 'test' },
          },
          { key: 'drive.authorizationRequired', value: true },
        ]);
      }
      listeners.alarm?.({ name: 'favoritepod-drive-periodic-sync' });
      listeners.alarm?.({ name: 'favoritepod-drive-debounced-sync' });
      // Drain pending IndexedDB reads before checking that sync was not invoked.
      await db.syncMeta.toArray();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(syncGoogleDrive).not.toHaveBeenCalled();
    },
  );

  it('runs a connected profile alarm', async () => {
    await db.syncMeta.put({
      key: 'drive.account',
      value: { emailAddress: 'test@example.com', permissionId: 'test' },
    });
    listeners.alarm?.({ name: 'favoritepod-drive-periodic-sync' });
    await vi.waitFor(() => expect(syncGoogleDrive).toHaveBeenCalledOnce());
  });

  it('publishes progress from an alarm-driven sync to dashboard windows', async () => {
    await db.syncMeta.put({
      key: 'drive.account',
      value: { emailAddress: 'test@example.com', permissionId: 'test' },
    });
    vi.mocked(syncGoogleDrive).mockImplementation(async (_choice, onProgress) => {
      onProgress?.({ stage: 'downloading', current: 1, total: 2 });
      return {
        status: 'synced',
        syncedAt: '2026-11-05T12:00:00.000Z',
        uploadedAssets: 0,
        downloadedAssets: 0,
        missingAssets: 0,
        mergedRemoteChanges: false,
      };
    });

    listeners.alarm?.({ name: 'favoritepod-drive-periodic-sync' });

    await vi.waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'favoritepod.sync.progress',
        progress: { stage: 'downloading', current: 1, total: 2 },
      }),
    );
  });

  it('sends choice-required when an alarm reaches first sync with two libraries', async () => {
    await db.syncMeta.put({
      key: 'drive.account',
      value: { emailAddress: 'test@example.com', permissionId: 'test' },
    });
    const preview = { local: { groups: 1, items: 1 }, drive: { groups: 2, items: 2 } };
    vi.mocked(syncGoogleDrive).mockRejectedValue(new DriveSyncChoiceRequired(preview));

    listeners.alarm?.({ name: 'favoritepod-drive-periodic-sync' });

    await vi.waitFor(() =>
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'favoritepod.sync.choice-required',
        preview,
      }),
    );
  });

  it('clears the pending debounce when connection state changes', () => {
    listeners.message?.({ type: DRIVE_CONNECTION_CHANGED, status: 'disconnected' });
    expect(clearAlarm).toHaveBeenCalledWith('favoritepod-drive-debounced-sync');
  });
});
