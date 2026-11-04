import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import * as driveAssets from '../drive-assets';
import * as driveAuth from '../drive-auth';
import * as driveFiles from '../drive-files';
import { createHLC } from '../hlc';
import { isItemDeleted } from '../merge';
import * as storage from '../storage';
import type { DriveDeviceState, Group, Item, LibraryState } from '../types';

vi.mock('../drive-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof driveAuth>()),
  verifyGoogleDriveAccount: vi.fn(),
}));

vi.mock('../storage', () => ({
  createSnapshot: vi.fn(),
  getDeviceId: vi.fn(),
}));

vi.mock('../drive-files', () => ({
  cacheDownloadedDriveDeviceFiles: vi.fn(),
  compactStaleDriveDeviceFiles: vi.fn(),
  createLocalDriveDeviceState: vi.fn(),
  downloadAllDriveDeviceFiles: vi.fn(),
  downloadChangedDriveDeviceFiles: vi.fn(),
  listDriveDeviceFiles: vi.fn(),
  uploadDriveDeviceState: vi.fn(),
}));

vi.mock('../drive-assets', () => ({
  compactOrphanDriveAssets: vi.fn(),
  downloadMissingDriveAssets: vi.fn(),
  uploadMissingDriveAssets: vi.fn(),
}));

import { retryDriveSync, syncGoogleDrive } from '../drive-sync';
import type { DriveSyncChoiceRequired } from '../drive-sync';

const account = { emailAddress: 'drive@example.com', permissionId: 'drive-user' };

function group(id: string, timestamp: number): Group {
  const clock = createHLC(timestamp, 0, id);
  return {
    id,
    parentId: null,
    orderKey: 'a0',
    title: id,
    clock: { parentId: clock, orderKey: clock, title: clock },
  };
}

function item(
  id: string,
  groupId: string,
  timestamp: number,
  values: Partial<Item> = {},
): Item {
  const clock = createHLC(timestamp, 0, id);
  return {
    id,
    groupId,
    orderKey: 'a0',
    url: `https://${id}.example.com`,
    title: id,
    clock: {
      groupId: clock,
      orderKey: clock,
      url: clock,
      title: clock,
      previewHash: clock,
      faviconUrl: clock,
    },
    ...values,
  };
}

function state(deviceId: string, records: LibraryState, revision = 1): DriveDeviceState {
  return {
    schemaVersion: 1,
    deviceId,
    revision,
    lastUpdate: '2026-06-01T12:00:00.000Z',
    ...records,
    tombstones: {
      groups: Object.fromEntries(
        records.groups.flatMap((record) =>
          record.deleted ? [[record.id, record.deleted]] : [],
        ),
      ),
      items: Object.fromEntries(
        records.items.flatMap((record) =>
          record.deleted ? [[record.id, record.deleted]] : [],
        ),
      ),
    },
  };
}

async function localState(revision = 1): Promise<DriveDeviceState> {
  return state(
    'device-local',
    {
      groups: await db.groups.toArray(),
      items: await db.items.toArray(),
    },
    revision,
  );
}

function configureRemote(remote: DriveDeviceState): void {
  const metadata = {
    fileId: 'drive-file',
    deviceId: remote.deviceId,
    name: `launcher-state-device-${remote.deviceId}.json`,
    modifiedTime: '2026-06-01T12:00:00.000Z',
    mimeType: 'application/json',
    size: 100,
  };
  vi.mocked(driveFiles.listDriveDeviceFiles).mockResolvedValue([metadata]);
  vi.mocked(driveFiles.downloadAllDriveDeviceFiles).mockResolvedValue({
    downloaded: [{ metadata, state: remote }],
    unchanged: [],
  });
  vi.mocked(driveFiles.downloadChangedDriveDeviceFiles).mockResolvedValue({
    downloaded: [{ metadata, state: remote }],
    unchanged: [],
  });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.clearAllMocks();
  await db.syncMeta.put({ key: 'drive.account', value: account });
  vi.mocked(driveAuth.verifyGoogleDriveAccount).mockReset().mockResolvedValue(undefined);
  vi.mocked(storage.getDeviceId).mockResolvedValue('device-local');
  vi.mocked(storage.createSnapshot).mockResolvedValue({
    createdAt: Date.now(),
    groups: [],
    items: [],
    thumbnails: [],
  });
  vi.mocked(driveFiles.createLocalDriveDeviceState).mockImplementation(localState);
  vi.mocked(driveFiles.uploadDriveDeviceState).mockImplementation(
    async (proposed) => proposed,
  );
  vi.mocked(driveFiles.compactStaleDriveDeviceFiles).mockImplementation(async () => ({
    state: await localState(),
    deletedDeviceIds: [],
    retainedDeviceIds: [],
  }));
  vi.mocked(driveAssets.downloadMissingDriveAssets).mockResolvedValue({
    downloadedHashes: [],
    existingHashes: [],
    missingRemoteHashes: [],
  });
  vi.mocked(driveAssets.uploadMissingDriveAssets).mockResolvedValue({
    uploadedHashes: [],
    existingHashes: [],
    missingLocalHashes: [],
  });
  vi.mocked(driveAssets.compactOrphanDriveAssets).mockResolvedValue({
    deletedHashes: [],
    retainedHashes: [],
  });
  vi.stubGlobal('navigator', {
    locks: {
      request: async (
        _name: string,
        _options: unknown,
        callback: (lock: object | null) => unknown,
      ) => callback({}),
    },
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Google Drive sync orchestration', () => {
  it('asks before combining two populated libraries and leaves both untouched', async () => {
    const localGroup = group('local-group', 10);
    const remoteGroup = group('remote-group', 20);
    await db.groups.put(localGroup);
    await db.items.put(item('local-item', localGroup.id, 10));
    configureRemote(
      state('device-remote', {
        groups: [remoteGroup],
        items: [item('remote-item', remoteGroup.id, 20)],
      }),
    );

    await expect(syncGoogleDrive()).rejects.toMatchObject({
      preview: {
        local: { groups: 1, items: 1 },
        drive: { groups: 1, items: 1 },
      },
    } satisfies Partial<DriveSyncChoiceRequired>);

    expect((await db.groups.toArray()).map(({ id }) => id)).toEqual(['local-group']);
    expect((await db.items.toArray()).map(({ id }) => id)).toEqual(['local-item']);
    expect(driveFiles.cacheDownloadedDriveDeviceFiles).not.toHaveBeenCalled();
    expect(driveFiles.uploadDriveDeviceState).not.toHaveBeenCalled();
  });

  it('merges independent field edits and records the initial sync', async () => {
    const sharedGroup = group('shared-group', 10);
    await db.groups.put(sharedGroup);
    await db.items.put(
      item('shared-item', sharedGroup.id, 100, {
        title: 'Local title',
        url: 'https://local.example.com',
        clock: {
          groupId: createHLC(100, 0, 'local'),
          orderKey: createHLC(100, 0, 'local'),
          url: createHLC(300, 0, 'local'),
          title: createHLC(300, 0, 'local'),
          previewHash: createHLC(100, 0, 'local'),
          faviconUrl: createHLC(100, 0, 'local'),
        },
      }),
    );
    configureRemote(
      state('device-remote', {
        groups: [sharedGroup],
        items: [
          item('shared-item', sharedGroup.id, 200, {
            title: 'Drive title',
            url: 'https://drive.example.com',
            clock: {
              groupId: createHLC(200, 0, 'remote'),
              orderKey: createHLC(200, 0, 'remote'),
              url: createHLC(400, 0, 'remote'),
              title: createHLC(200, 0, 'remote'),
              previewHash: createHLC(200, 0, 'remote'),
              faviconUrl: createHLC(200, 0, 'remote'),
            },
          }),
        ],
      }),
    );

    const result = await syncGoogleDrive('merge');
    const merged = await db.items.get('shared-item');

    expect(result.status).toBe('synced');
    expect(merged?.title).toBe('Local title');
    expect(merged?.url).toBe('https://drive.example.com');
    expect(await db.syncMeta.get('drive.initialSyncCompleted')).toEqual({
      key: 'drive.initialSyncCompleted',
      value: true,
    });
    expect(driveFiles.cacheDownloadedDriveDeviceFiles).toHaveBeenCalledOnce();
  });

  it('marks Drive-only records deleted when replacing Drive with local data', async () => {
    const localGroup = group('local-group', 10);
    const remoteGroup = group('remote-group', 20);
    await db.groups.put(localGroup);
    await db.items.put(item('local-item', localGroup.id, 10));
    const remoteOnlyItem = item('remote-item', remoteGroup.id, 20);
    configureRemote(
      state('device-remote', {
        groups: [remoteGroup],
        items: [remoteOnlyItem],
      }),
    );

    await syncGoogleDrive('replace-drive');

    const replacedItem = await db.items.get(remoteOnlyItem.id);
    expect(replacedItem?.deleted).toBeDefined();
    expect(isItemDeleted(replacedItem!)).toBe(true);
    expect(await db.items.get('local-item')).toBeDefined();
    expect(storage.createSnapshot).toHaveBeenCalledOnce();
  });

  it('repairs a group-parent cycle received from Drive', async () => {
    const first = group('group-a', 10);
    const second = group('group-b', 20);
    const cycle = state('device-remote', {
      groups: [
        { ...first, parentId: second.id },
        { ...second, parentId: first.id },
      ],
      items: [],
    });
    configureRemote(cycle);

    await syncGoogleDrive();

    const groups = await db.groups.toArray();
    expect(groups.filter(({ parentId }) => parentId === null)).toHaveLength(1);
    expect(groups.every((record) => record.id !== record.parentId)).toBe(true);
  });

  it('skips a second sync when another extension context owns the lock', async () => {
    vi.stubGlobal('navigator', {
      locks: {
        request: async (
          _name: string,
          _options: unknown,
          callback: (lock: object | null) => unknown,
        ) => callback(null),
      },
    });

    await expect(syncGoogleDrive()).resolves.toEqual({
      status: 'skipped',
      reason: 'already-running',
    });
  });

  it.each(['disconnected', 'authorization-required'] as const)(
    'blocks %s before network access',
    async (status) => {
      if (status === 'disconnected') await db.syncMeta.delete('drive.account');
      else await db.syncMeta.put({ key: 'drive.authorizationRequired', value: true });
      await expect(syncGoogleDrive()).rejects.toMatchObject({ code: status });
      expect(driveAuth.verifyGoogleDriveAccount).not.toHaveBeenCalled();
      expect(driveFiles.listDriveDeviceFiles).not.toHaveBeenCalled();
      expect(driveFiles.uploadDriveDeviceState).not.toHaveBeenCalled();
    },
  );

  it('does not retry failed authorization as a network failure', async () => {
    vi.mocked(driveAuth.verifyGoogleDriveAccount).mockRejectedValue(
      new driveAuth.DriveAuthorizationRequiredError(),
    );
    await expect(syncGoogleDrive()).rejects.toMatchObject({
      code: 'authorization-required',
    });
    expect(driveAuth.verifyGoogleDriveAccount).toHaveBeenCalledOnce();
    expect(driveFiles.listDriveDeviceFiles).not.toHaveBeenCalled();
  });

  it('resumes sync after same-account authorization without resetting initial sync', async () => {
    await db.syncMeta.bulkPut([
      { key: 'drive.authorizationRequired', value: true },
      { key: 'drive.initialSyncCompleted', value: true },
    ]);
    configureRemote(state('remote', { groups: [], items: [] }));
    vi.stubGlobal('chrome', {
      identity: { getAuthToken: vi.fn().mockResolvedValue({ token: 'new-token' }) },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ user: account }))),
    );
    await driveAuth.connectGoogleDrive();
    await expect(syncGoogleDrive()).resolves.toMatchObject({ status: 'synced' });
    expect(driveFiles.downloadChangedDriveDeviceFiles).toHaveBeenCalledOnce();
    expect(driveFiles.downloadAllDriveDeviceFiles).not.toHaveBeenCalled();
  });

  it('retries only explicitly transient failures with exponential jitter', async () => {
    const failure = Object.assign(new Error('temporary'), { retryable: true });
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(failure)
      .mockResolvedValue('done');
    const sleep = vi.fn(async () => undefined);

    await expect(
      retryDriveSync(operation, {
        attempts: 3,
        baseDelayMs: 100,
        random: () => 0,
        sleep,
      }),
    ).resolves.toBe('done');
    expect(sleep.mock.calls).toEqual([[50], [100]]);

    const permanent = new Error('invalid request');
    const noRetry = vi.fn<() => Promise<string>>().mockRejectedValue(permanent);
    await expect(retryDriveSync(noRetry, { sleep })).rejects.toBe(permanent);
    expect(noRetry).toHaveBeenCalledOnce();
  });
});
