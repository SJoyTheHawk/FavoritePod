import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { liveQuery } from 'dexie';
import {
  verifyGoogleDriveAccount,
  getDriveConnectionState,
  getDriveStorageQuota,
  markDriveAuthorizationRequired,
  driveFetch,
  DRIVE_CONNECTION_CHANGED,
  cancelGoogleDriveConnection,
  connectGoogleDrive,
  confirmGoogleDriveConnection,
  disconnectGoogleDrive,
  getConnectedDriveAccount,
  prepareGoogleDriveConnection,
  switchGoogleDriveAccount,
} from '../drive-auth';

const identity = {
  getAuthToken: vi.fn(),
  removeCachedAuthToken: vi.fn(),
  clearAllCachedAuthTokens: vi.fn(),
};

const alice = {
  emailAddress: 'alice@example.com',
  permissionId: 'permission-alice',
};
const bob = {
  emailAddress: 'bob@example.com',
  permissionId: 'permission-bob',
};

function aboutResponse(
  account: typeof alice,
  status = 200,
  storageQuota?: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({ user: account, ...(storageQuota ? { storageQuota } : {}) }),
    { status },
  );
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  identity.getAuthToken.mockReset();
  identity.clearAllCachedAuthTokens.mockReset().mockResolvedValue(undefined);
  identity.removeCachedAuthToken.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', {
    identity,
    runtime: { sendMessage: vi.fn().mockResolvedValue(undefined) },
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Google Drive authorization', () => {
  it('reads and caches Drive account storage usage', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken.mockResolvedValue({ token: 'drive-token' });
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get('fields')?.startsWith('user(')) {
        return aboutResponse(alice);
      }
      return aboutResponse(alice, 200, {
        usage: '2097152',
        usageInDrive: '1048576',
        usageInDriveTrash: '1024',
        limit: '10485760',
      });
    });

    const quota = await getDriveStorageQuota();
    expect(quota).toMatchObject({
      usageInDrive: 1_048_576,
      usage: 2_097_152,
      usageInDriveTrash: 1_024,
      limit: 10_485_760,
    });
    const [request] = vi.mocked(fetch).mock.calls[1] ?? [];
    const url = new URL(String(request));
    expect(url.pathname).toBe('/drive/v3/about');
    expect(url.searchParams.get('fields')).toBe(
      'storageQuota(limit,usage,usageInDrive,usageInDriveTrash)',
    );

    await expect(getDriveStorageQuota()).resolves.toEqual(quota);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('supports accounts with unlimited Drive storage', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken.mockResolvedValue({ token: 'drive-token' });
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get('fields')?.startsWith('user(')) {
        return aboutResponse(alice);
      }
      return aboutResponse(alice, 200, { usageInDrive: '2048' });
    });

    await expect(getDriveStorageQuota()).resolves.toMatchObject({
      usageInDrive: 2048,
      limit: undefined,
    });
  });

  it('requires confirmation before saving a newly authorized profile', async () => {
    identity.getAuthToken.mockResolvedValue({ token: 'temporary-access-token' });
    vi.mocked(fetch).mockImplementation(async () => aboutResponse(alice));

    await expect(prepareGoogleDriveConnection()).resolves.toEqual(alice);
    expect(await getDriveConnectionState()).toEqual({
      status: 'disconnected',
      account: null,
    });
    expect(await db.syncMeta.get('drive.initialSyncCompleted')).toBeUndefined();
    expect(identity.getAuthToken).toHaveBeenNthCalledWith(1, { interactive: true });
    expect(fetch).toHaveBeenCalledTimes(1);

    await expect(confirmGoogleDriveConnection(alice)).resolves.toEqual({
      status: 'connected',
      account: alice,
    });

    expect(identity.getAuthToken).toHaveBeenNthCalledWith(2, { interactive: false });
    expect(fetch).toHaveBeenCalledTimes(2);
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toContain('/drive/v3/about?fields=user(emailAddress,permissionId)');
    expect(init?.method).toBe('GET');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer temporary-access-token',
    );
    expect(await getConnectedDriveAccount()).toEqual(alice);
    expect(
      (await db.syncMeta.toArray()).some(
        (record) => record.value === 'temporary-access-token',
      ),
    ).toBe(false);
  });

  it('keeps a disconnected profile disconnected when the account confirmation is cancelled', async () => {
    identity.getAuthToken.mockResolvedValue({ token: 'temporary-access-token' });
    vi.mocked(fetch).mockImplementation(async () => aboutResponse(alice));
    await prepareGoogleDriveConnection();
    const requestCount = vi.mocked(fetch).mock.calls.length;

    await cancelGoogleDriveConnection();

    expect(vi.mocked(fetch).mock.calls).toHaveLength(requestCount);
    expect(identity.clearAllCachedAuthTokens).toHaveBeenCalledOnce();
    expect(await getDriveConnectionState()).toEqual({
      status: 'disconnected',
      account: null,
    });
    expect(await db.syncMeta.get('drive.account')).toBeUndefined();
  });

  it('does not let a disconnected profile bypass account confirmation', async () => {
    await expect(connectGoogleDrive()).rejects.toMatchObject({ code: 'disconnected' });
    expect(identity.getAuthToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not connect if the signed-in account changes before confirmation', async () => {
    identity.getAuthToken.mockResolvedValue({ token: 'temporary-access-token' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(aboutResponse(alice))
      .mockResolvedValueOnce(aboutResponse(bob));
    const candidate = await prepareGoogleDriveConnection();

    await expect(confirmGoogleDriveConnection(candidate)).rejects.toThrow(
      'Google returned a different account',
    );

    expect(await getDriveConnectionState()).toEqual({
      status: 'disconnected',
      account: null,
    });
  });

  it('detects account switches and only clears Drive records after confirmation', async () => {
    await db.syncMeta.bulkPut([
      { key: 'deviceId', value: 'device-local' },
      { key: 'lastHlc', value: '2026-11-04T12:00:00.000Z-0000-device-local' },
      { key: 'drive.account', value: alice },
      { key: 'drive.lastSync', value: 123 },
      { key: 'unrelated', value: 'keep' },
    ]);
    await db.deviceFiles.put({
      deviceId: 'device-local',
      fileId: 'old-file',
      lastSync: 10,
      revision: 1,
    });
    await db.driveAssets.put({
      hash: 'a'.repeat(64),
      fileId: 'asset-file',
      name: `asset-${'a'.repeat(64)}.jpg`,
      modifiedTime: '2026-01-01T00:00:00.000Z',
      lastSync: 10,
      size: 100,
    });
    identity.getAuthToken.mockResolvedValue({ token: 'bob-token' });
    vi.mocked(fetch).mockImplementation(async () => aboutResponse(bob));

    await expect(connectGoogleDrive()).resolves.toEqual({
      status: 'account-switch-required',
      previousAccount: alice,
      nextAccount: bob,
    });
    expect(await getConnectedDriveAccount()).toEqual(alice);
    expect(await db.deviceFiles.count()).toBe(1);
    expect(await db.driveAssets.count()).toBe(1);

    await switchGoogleDriveAccount(bob);

    expect(await getConnectedDriveAccount()).toEqual(bob);
    expect(await db.deviceFiles.count()).toBe(0);
    expect(await db.driveAssets.count()).toBe(0);
    expect(await db.syncMeta.get('drive.lastSync')).toBeUndefined();
    expect(await db.syncMeta.get('deviceId')).toMatchObject({ value: 'device-local' });
    expect(await db.syncMeta.get('lastHlc')).toBeDefined();
    expect(await db.syncMeta.get('unrelated')).toMatchObject({ value: 'keep' });
  });

  it('evicts a 401 token and retries the Drive request once', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken
      .mockResolvedValueOnce({ token: 'expired-token' })
      .mockResolvedValueOnce({ token: 'fresh-token' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(aboutResponse(alice));

    await expect(verifyGoogleDriveAccount()).resolves.toBeUndefined();

    expect(identity.getAuthToken).toHaveBeenNthCalledWith(1, { interactive: false });
    expect(identity.getAuthToken).toHaveBeenNthCalledWith(2, { interactive: false });
    expect(identity.removeCachedAuthToken).toHaveBeenCalledTimes(1);
    expect(identity.removeCachedAuthToken).toHaveBeenCalledWith({
      token: 'expired-token',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry more than once when the refreshed token also gets a 401', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken
      .mockResolvedValueOnce({ token: 'expired-token' })
      .mockResolvedValueOnce({ token: 'still-invalid-token' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    await expect(verifyGoogleDriveAccount()).rejects.toThrow(
      'Google Drive needs authorization',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(identity.removeCachedAuthToken).toHaveBeenNthCalledWith(1, {
      token: 'expired-token',
    });
    expect(identity.removeCachedAuthToken).toHaveBeenNthCalledWith(2, {
      token: 'still-invalid-token',
    });
  });

  it('disconnects only locally without tokens or requests while preserving local data', async () => {
    await db.syncMeta.bulkPut([
      { key: 'deviceId', value: 'device-local' },
      { key: 'lastHlc', value: '2026-11-04T12:00:00.000Z-0000-device-local' },
      { key: 'drive.account', value: alice },
    ]);
    await db.deviceFiles.put({
      deviceId: 'device-local',
      fileId: 'file-id',
      lastSync: 1,
      revision: 1,
    });
    await db.driveAssets.put({
      hash: 'b'.repeat(64),
      fileId: 'asset-file',
      name: `asset-${'b'.repeat(64)}.jpg`,
      modifiedTime: '2026-01-01T00:00:00.000Z',
      lastSync: 10,
      size: 100,
    });
    const { createItem, createSnapshot } = await import('../storage');
    await createItem({ url: 'https://example.com', title: 'Keep me' });
    await createSnapshot();
    const before = await Promise.all([
      db.groups.toArray(),
      db.items.toArray(),
      db.thumbnails.toArray(),
      db.snapshots.toArray(),
    ]);
    const lastClock = await db.syncMeta.get('lastHlc');
    await expect(disconnectGoogleDrive()).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
    expect(identity.getAuthToken).not.toHaveBeenCalled();
    expect(identity.clearAllCachedAuthTokens).toHaveBeenCalledOnce();
    expect(
      await Promise.all([
        db.groups.toArray(),
        db.items.toArray(),
        db.thumbnails.toArray(),
        db.snapshots.toArray(),
      ]),
    ).toEqual(before);
    expect(await db.syncMeta.get('lastHlc')).toEqual(lastClock);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: DRIVE_CONNECTION_CHANGED,
      status: 'disconnected',
    });
    expect(await getConnectedDriveAccount()).toBeNull();
    expect(await db.deviceFiles.count()).toBe(0);
    expect(await db.driveAssets.count()).toBe(0);
    expect(await db.syncMeta.get('deviceId')).toMatchObject({ value: 'device-local' });
  });

  it('commits disconnection even when local credential cleanup fails', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.clearAllCachedAuthTokens.mockRejectedValue(new Error('cache unavailable'));
    await expect(disconnectGoogleDrive()).resolves.toBeUndefined();
    expect(await getDriveConnectionState()).toEqual({
      status: 'disconnected',
      account: null,
    });
    await expect(
      driveFetch('https://www.googleapis.com/drive/v3/files'),
    ).rejects.toMatchObject({ code: 'disconnected' });
    expect(identity.getAuthToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('notifies open state observers and preserves recovery across database reopen', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    const observed = vi.fn();
    const subscription = liveQuery(getDriveConnectionState).subscribe(observed);
    try {
      await vi.waitFor(() =>
        expect(observed).toHaveBeenLastCalledWith({
          status: 'connected',
          account: alice,
        }),
      );
      await markDriveAuthorizationRequired();
      await vi.waitFor(() =>
        expect(observed).toHaveBeenLastCalledWith({
          status: 'authorization-required',
          account: alice,
        }),
      );
      db.close();
      await db.open();
      expect((await getDriveConnectionState()).status).toBe('authorization-required');
      await disconnectGoogleDrive();
      await vi.waitFor(() =>
        expect(observed).toHaveBeenLastCalledWith({
          status: 'disconnected',
          account: null,
        }),
      );
    } finally {
      subscription.unsubscribe();
    }
  });

  it('rejects stale switch confirmation after another dashboard disconnects', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    await disconnectGoogleDrive();
    await expect(switchGoogleDriveAccount(bob)).rejects.toMatchObject({
      code: 'disconnected',
    });
    expect(identity.getAuthToken).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('persists failed silent consent and blocks subsequent Drive requests', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken.mockRejectedValue(new Error('OAuth2 not granted or revoked.'));
    await expect(
      driveFetch('https://www.googleapis.com/drive/v3/files'),
    ).rejects.toMatchObject({ code: 'authorization-required', retryable: false });
    expect(await getDriveConnectionState()).toEqual({
      status: 'authorization-required',
      account: alice,
    });
    await expect(verifyGoogleDriveAccount()).rejects.toMatchObject({
      code: 'authorization-required',
    });
    expect(identity.getAuthToken).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('recovers the same account without resetting sync bookkeeping', async () => {
    await db.syncMeta.bulkPut([
      { key: 'drive.account', value: alice },
      { key: 'drive.initialSyncCompleted', value: true },
    ]);
    await markDriveAuthorizationRequired();
    identity.getAuthToken.mockResolvedValue({ token: 'new-token' });
    vi.mocked(fetch).mockResolvedValue(aboutResponse(alice));
    await connectGoogleDrive();
    expect(await getDriveConnectionState()).toEqual({
      status: 'connected',
      account: alice,
    });
    expect((await db.syncMeta.get('drive.initialSyncCompleted'))?.value).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenLastCalledWith({
      type: DRIVE_CONNECTION_CHANGED,
      status: 'connected',
    });
  });

  it('keeps recovery state and pending changes if consent is cancelled', async () => {
    await db.syncMeta.bulkPut([
      { key: 'drive.account', value: alice },
      { key: 'drive.lastSync', value: 'keep' },
    ]);
    await markDriveAuthorizationRequired();
    identity.getAuthToken.mockRejectedValue(
      new Error('The user did not approve access.'),
    );
    await expect(connectGoogleDrive()).rejects.toThrow('not completed');
    expect((await getDriveConnectionState()).status).toBe('authorization-required');
    expect((await db.syncMeta.get('drive.lastSync'))?.value).toBe('keep');
  });

  it('treats Identity network failures as retryable without requiring consent', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken.mockRejectedValue(
      new Error('OAuth2 request failed: Connection failed (-2).'),
    );
    await expect(
      driveFetch('https://www.googleapis.com/drive/v3/files'),
    ).rejects.toMatchObject({ code: 'network-error', retryable: true });
    expect((await getDriveConnectionState()).status).toBe('connected');
  });

  it('blocks sync when Chrome silently returns a different account', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken.mockResolvedValue({ token: 'bob-token' });
    vi.mocked(fetch).mockImplementation(async () => aboutResponse(bob));
    await expect(verifyGoogleDriveAccount()).rejects.toMatchObject({
      code: 'authorization-required',
    });
    expect(await getConnectedDriveAccount()).toEqual(alice);
  });
});
