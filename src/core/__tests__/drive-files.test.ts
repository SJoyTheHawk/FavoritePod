import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import {
  compactStaleDriveDeviceFiles,
  cacheDownloadedDriveDeviceFiles,
  createLocalDriveDeviceState,
  downloadChangedDriveDeviceFiles,
  downloadAllDriveDeviceFiles,
  getDeviceStateFileName,
  listDriveDeviceFiles,
  uploadDriveDeviceState,
} from '../drive-files';
import { createHLC } from '../hlc';
import type { DriveDeviceState, Group } from '../types';

const identity = {
  getAuthToken: vi.fn().mockResolvedValue({ token: 'drive-test-token' }),
  removeCachedAuthToken: vi.fn().mockResolvedValue(undefined),
};

function makeGroup(id: string, deviceId = 'device-test'): Group {
  const clock = createHLC(10, 0, deviceId);
  return {
    id,
    parentId: null,
    orderKey: 'a0',
    title: id,
    clock: { parentId: clock, orderKey: clock, title: clock },
  };
}

function makeState(
  deviceId: string,
  revision = 1,
  groups: Group[] = [],
): DriveDeviceState {
  return {
    schemaVersion: 1,
    deviceId,
    revision,
    lastUpdate: '2026-01-01T00:00:00.000Z',
    groups,
    items: [],
    tombstones: { groups: {}, items: {} },
  };
}

function remoteFile(
  deviceId: string,
  fileId: string,
  modifiedTime = '2026-01-01T00:00:00.000Z',
) {
  return {
    id: fileId,
    name: getDeviceStateFileName(deviceId),
    mimeType: 'application/json',
    modifiedTime,
    size: '123',
  };
}

function remoteMetadata(
  deviceId: string,
  fileId: string,
  modifiedTime = '2026-01-01T00:00:00.000Z',
) {
  return {
    fileId,
    deviceId,
    name: getDeviceStateFileName(deviceId),
    modifiedTime,
    mimeType: 'application/json',
    size: 123,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status });
}

function listResponse(files: unknown[], nextPageToken?: string): Response {
  return jsonResponse({ files, ...(nextPageToken ? { nextPageToken } : {}) });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.syncMeta.put({
    key: 'drive.account',
    value: { emailAddress: 'test@example.com', permissionId: 'test-user' },
  });
  identity.getAuthToken.mockReset().mockResolvedValue({ token: 'drive-test-token' });
  identity.removeCachedAuthToken.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', { identity });
  vi.stubGlobal('fetch', vi.fn());
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Google Drive device files', () => {
  it('preserves authorization failures while listing device files', async () => {
    identity.getAuthToken.mockRejectedValue(new Error('OAuth2 not granted or revoked.'));
    await expect(listDriveDeviceFiles()).rejects.toMatchObject({
      code: 'authorization-required',
      retryable: false,
    });
    expect((await db.syncMeta.get('drive.authorizationRequired'))?.value).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('preserves genuine network errors without setting recovery state', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(listDriveDeviceFiles()).rejects.toMatchObject({
      code: 'network-error',
      retryable: true,
    });
    expect(await db.syncMeta.get('drive.authorizationRequired')).toBeUndefined();
  });

  it('generates and keeps one stable device ID', async () => {
    const first = await createLocalDriveDeviceState();
    const second = await createLocalDriveDeviceState();

    expect(first.deviceId).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
    expect(second.deviceId).toBe(first.deviceId);
    expect(await db.syncMeta.get('deviceId')).toEqual({
      key: 'deviceId',
      value: first.deviceId,
    });
  });

  it('builds a stable device snapshot including deletion tombstones', async () => {
    await db.syncMeta.put({ key: 'deviceId', value: 'device-local' });
    const group = {
      ...makeGroup('group-deleted', 'device-local'),
      deleted: createHLC(20, 0, 'device-local'),
    };
    await db.groups.put(group);

    const state = await createLocalDriveDeviceState(
      3,
      new Date('2026-06-01T12:00:00.000Z'),
    );

    expect(state).toMatchObject({
      schemaVersion: 1,
      deviceId: 'device-local',
      revision: 3,
      lastUpdate: '2026-06-01T12:00:00.000Z',
      tombstones: { groups: { 'group-deleted': group.deleted }, items: {} },
      groups: [group],
    });
  });

  it('lists all pages in appDataFolder and ignores unrelated app files', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        listResponse(
          [
            remoteFile('device-a', 'file-a'),
            { id: 'asset', name: 'asset-hash.jpg', mimeType: 'image/jpeg' },
          ],
          'next-page',
        ),
      )
      .mockResolvedValueOnce(listResponse([remoteFile('device-b', 'file-b')]));

    const files = await listDriveDeviceFiles();

    expect(files.map((file) => file.deviceId)).toEqual(['device-a', 'device-b']);
    const [firstUrl] = vi.mocked(fetch).mock.calls[0] ?? [];
    const [secondUrl] = vi.mocked(fetch).mock.calls[1] ?? [];
    expect(String(firstUrl)).toContain('spaces=appDataFolder');
    expect(String(firstUrl)).toContain('pageSize=1000');
    expect(String(secondUrl)).toContain('pageToken=next-page');
  });

  it('downloads only changed files and updates the local modified-time cache', async () => {
    const unchanged = remoteMetadata('device-a', 'file-a');
    const changed = remoteMetadata('device-b', 'file-b', '2026-01-03T00:00:00.000Z');
    await db.deviceFiles.put({
      deviceId: 'device-a',
      fileId: 'file-a',
      name: unchanged.name,
      modifiedTime: unchanged.modifiedTime,
      lastSync: 1,
      revision: 2,
    });
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(makeState('device-b', 7, [makeGroup('remote-group', 'device-b')])),
    );

    const result = await downloadChangedDriveDeviceFiles([unchanged, changed]);

    expect(result.unchanged).toEqual([unchanged]);
    expect(result.downloaded).toHaveLength(1);
    expect(result.downloaded[0]?.state.revision).toBe(7);
    expect(await db.deviceFiles.get('device-b')).toMatchObject({
      fileId: 'file-b',
      modifiedTime: changed.modifiedTime,
      revision: 7,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0]?.[0])).toContain(
      '/files/file-b?alt=media',
    );
  });

  it('can defer modified-time cache updates until downloaded records are applied', async () => {
    const metadata = remoteMetadata('device-b', 'file-b');
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(makeState('device-b', 4, [makeGroup('remote-group', 'device-b')])),
    );

    const result = await downloadAllDriveDeviceFiles([metadata], {
      deferCacheUpdate: true,
    });

    expect(result.downloaded).toHaveLength(1);
    expect(await db.deviceFiles.get('device-b')).toBeUndefined();
    await cacheDownloadedDriveDeviceFiles(result.downloaded);
    expect(await db.deviceFiles.get('device-b')).toMatchObject({
      fileId: 'file-b',
      revision: 4,
    });
  });

  it('rejects invalid device contents and does not cache them', async () => {
    const metadata = remoteMetadata('device-b', 'file-b');
    vi.mocked(fetch).mockResolvedValue(jsonResponse(makeState('some-other-device')));

    await expect(downloadChangedDriveDeviceFiles([metadata])).rejects.toThrow(
      'contains a different device ID',
    );
    expect(await db.deviceFiles.get('device-b')).toBeUndefined();
  });

  it('rejects malformed hybrid clocks before records reach the merge layer', async () => {
    const metadata = remoteMetadata('device-b', 'file-b');
    const invalidState = makeState('device-b', 1, [makeGroup('remote-group')]);
    invalidState.groups[0]!.clock.title = 'not-a-clock';
    vi.mocked(fetch).mockResolvedValue(jsonResponse(invalidState));

    await expect(downloadChangedDriveDeviceFiles([metadata])).rejects.toThrow(
      'unsupported or invalid format',
    );
    expect(await db.deviceFiles.get('device-b')).toBeUndefined();
  });

  it('creates its appDataFolder file once with a multipart upload', async () => {
    await db.syncMeta.put({ key: 'deviceId', value: 'device-local' });
    await db.groups.put(makeGroup('group-local', 'device-local'));
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([]))
      .mockResolvedValueOnce(jsonResponse(remoteFile('device-local', 'file-local')));

    const state = await createLocalDriveDeviceState();
    const uploaded = await uploadDriveDeviceState(
      state,
      new Date('2026-06-01T12:00:00.000Z'),
    );

    expect(uploaded.revision).toBe(1);
    const [, init] = vi.mocked(fetch).mock.calls[1] ?? [];
    expect(String(vi.mocked(fetch).mock.calls[1]?.[0])).toContain(
      '/upload/drive/v3/files?uploadType=multipart',
    );
    expect(new Headers(init?.headers).get('Content-Type')).toContain('multipart/related');
    expect(String(init?.body)).toContain('"parents":["appDataFolder"]');
    expect(String(init?.body)).toContain('group-local');
    expect(await db.deviceFiles.get('device-local')).toMatchObject({
      fileId: 'file-local',
      revision: 1,
    });
  });

  it('PATCHes the existing device file and advances its revision', async () => {
    await db.syncMeta.put({ key: 'deviceId', value: 'device-local' });
    const previous = remoteFile('device-local', 'file-local');
    await db.deviceFiles.put({
      deviceId: 'device-local',
      fileId: previous.id,
      name: previous.name,
      modifiedTime: previous.modifiedTime,
      lastSync: 1,
      revision: 4,
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(listResponse([previous]))
      .mockResolvedValueOnce(
        jsonResponse(
          remoteFile('device-local', 'file-local', '2026-01-02T00:00:00.000Z'),
        ),
      );

    const uploaded = await uploadDriveDeviceState(
      makeState('device-local', 4),
      new Date('2026-06-01T12:00:00.000Z'),
    );

    expect(uploaded.revision).toBe(5);
    const [url, init] = vi.mocked(fetch).mock.calls[1] ?? [];
    expect(String(url)).toContain('/upload/drive/v3/files/file-local?uploadType=media');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(String(init?.body))).toMatchObject({ revision: 5 });
    expect(await db.deviceFiles.get('device-local')).toMatchObject({ revision: 5 });
  });

  it('refuses to overwrite a remote file changed since the last download', async () => {
    await db.syncMeta.put({ key: 'deviceId', value: 'device-local' });
    const cached = remoteFile('device-local', 'file-local');
    await db.deviceFiles.put({
      deviceId: 'device-local',
      fileId: cached.id,
      name: cached.name,
      modifiedTime: cached.modifiedTime,
      lastSync: 1,
      revision: 1,
    });
    vi.mocked(fetch).mockResolvedValue(
      listResponse([
        remoteFile('device-local', 'file-local', '2026-01-02T00:00:00.000Z'),
      ]),
    );

    await expect(uploadDriveDeviceState(makeState('device-local'))).rejects.toThrow(
      'changed since it was downloaded',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('merges all states and uploads before deleting a device stale for 90 days', async () => {
    const now = new Date('2026-06-01T12:00:00.000Z');
    const oldTime = '2025-01-01T00:00:00.000Z';
    const currentTime = '2026-05-30T00:00:00.000Z';
    await db.syncMeta.put({ key: 'deviceId', value: 'device-current' });
    await db.groups.put(makeGroup('local-group', 'device-current'));
    const currentFile = remoteFile('device-current', 'current-file', currentTime);
    const staleFile = remoteFile('device-old', 'stale-file', oldTime);
    const currentAfterUpload = remoteFile(
      'device-current',
      'current-file',
      '2026-06-01T12:00:00.000Z',
    );
    let listCount = 0;
    const requestOrder: string[] = [];
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      requestOrder.push(`${method} ${url.pathname}`);
      if (url.pathname === '/drive/v3/files' && method === 'GET') {
        listCount += 1;
        return listResponse([
          listCount >= 3 ? currentAfterUpload : currentFile,
          staleFile,
        ]);
      }
      if (url.pathname.endsWith('/files/current-file') && method === 'GET') {
        return jsonResponse(
          makeState('device-current', 4, [makeGroup('current-remote')]),
        );
      }
      if (url.pathname.endsWith('/files/stale-file') && method === 'GET') {
        return jsonResponse(
          makeState('device-old', 9, [makeGroup('stale-remote', 'device-old')]),
        );
      }
      if (url.pathname.endsWith('/files/current-file') && method === 'PATCH') {
        const saved = JSON.parse(String(init?.body)) as DriveDeviceState;
        expect(saved.groups.map((group) => group.id)).toEqual(
          expect.arrayContaining(['local-group', 'current-remote', 'stale-remote']),
        );
        return jsonResponse(currentAfterUpload);
      }
      if (url.pathname.endsWith('/files/stale-file') && method === 'DELETE') {
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected Drive request: ${method} ${url}`);
    });

    const result = await compactStaleDriveDeviceFiles(now);

    expect(result.deletedDeviceIds).toEqual(['device-old']);
    expect(result.retainedDeviceIds).toEqual([]);
    expect(result.state.revision).toBe(5);
    const uploadIndex = requestOrder.findIndex((request) => request.startsWith('PATCH '));
    const deleteIndex = requestOrder.findIndex((request) =>
      request.startsWith('DELETE '),
    );
    expect(uploadIndex).toBeGreaterThan(-1);
    expect(deleteIndex).toBeGreaterThan(uploadIndex);
    expect(await db.deviceFiles.get('device-old')).toBeUndefined();
  });
});
