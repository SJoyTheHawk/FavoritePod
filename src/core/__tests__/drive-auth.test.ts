import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import {
  checkGoogleDriveAccount,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getConnectedDriveAccount,
  switchGoogleDriveAccount,
} from '../drive-auth';

const identity = {
  getAuthToken: vi.fn(),
  removeCachedAuthToken: vi.fn(),
};

const alice = {
  emailAddress: 'alice@example.com',
  permissionId: 'permission-alice',
};
const bob = {
  emailAddress: 'bob@example.com',
  permissionId: 'permission-bob',
};

function aboutResponse(account: typeof alice, status = 200): Response {
  return new Response(JSON.stringify({ user: account }), { status });
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  identity.getAuthToken.mockReset();
  identity.removeCachedAuthToken.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', { identity });
  vi.stubGlobal('fetch', vi.fn());
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Google Drive authorization', () => {
  it('connects interactively, identifies the account, and stores no token', async () => {
    identity.getAuthToken.mockResolvedValue({ token: 'temporary-access-token' });
    vi.mocked(fetch).mockResolvedValue(aboutResponse(alice));

    await expect(connectGoogleDrive()).resolves.toEqual({
      status: 'connected',
      account: alice,
    });

    expect(identity.getAuthToken).toHaveBeenCalledWith({ interactive: true });
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
    vi.mocked(fetch).mockResolvedValue(aboutResponse(bob));

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
    identity.getAuthToken
      .mockResolvedValueOnce({ token: 'expired-token' })
      .mockResolvedValueOnce({ token: 'fresh-token' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(aboutResponse(alice));

    await expect(checkGoogleDriveAccount()).resolves.toEqual({
      status: 'connected',
      account: alice,
    });

    expect(identity.getAuthToken).toHaveBeenNthCalledWith(1, { interactive: false });
    expect(identity.getAuthToken).toHaveBeenNthCalledWith(2, { interactive: false });
    expect(identity.removeCachedAuthToken).toHaveBeenCalledTimes(1);
    expect(identity.removeCachedAuthToken).toHaveBeenCalledWith({
      token: 'expired-token',
    });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry more than once when the refreshed token also gets a 401', async () => {
    identity.getAuthToken
      .mockResolvedValueOnce({ token: 'expired-token' })
      .mockResolvedValueOnce({ token: 'still-invalid-token' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }));

    await expect(checkGoogleDriveAccount()).rejects.toThrow(
      'Google rejected the refreshed token',
    );
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(identity.removeCachedAuthToken).toHaveBeenNthCalledWith(1, {
      token: 'expired-token',
    });
    expect(identity.removeCachedAuthToken).toHaveBeenNthCalledWith(2, {
      token: 'still-invalid-token',
    });
  });

  it('revokes the access token and clears Drive data while keeping local identity metadata', async () => {
    await db.syncMeta.bulkPut([
      { key: 'deviceId', value: 'device-local' },
      { key: 'lastHlc', value: 'local-clock' },
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
    identity.getAuthToken.mockResolvedValue({ token: 'revoke-me' });
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await expect(disconnectGoogleDrive()).resolves.toEqual({ revocationConfirmed: true });

    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/revoke',
      expect.objectContaining({
        method: 'POST',
        body: new URLSearchParams({ token: 'revoke-me' }),
      }),
    );
    expect(identity.removeCachedAuthToken).toHaveBeenCalledWith({ token: 'revoke-me' });
    expect(await getConnectedDriveAccount()).toBeNull();
    expect(await db.deviceFiles.count()).toBe(0);
    expect(await db.driveAssets.count()).toBe(0);
    expect(await db.syncMeta.get('deviceId')).toMatchObject({ value: 'device-local' });
    expect(await db.syncMeta.get('lastHlc')).toMatchObject({ value: 'local-clock' });
  });

  it('still disconnects locally when Google cannot confirm revocation', async () => {
    await db.syncMeta.put({ key: 'drive.account', value: alice });
    identity.getAuthToken.mockResolvedValue({ token: 'revoke-me' });
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 503 }));

    await expect(disconnectGoogleDrive()).resolves.toEqual({
      revocationConfirmed: false,
    });
    expect(await getConnectedDriveAccount()).toBeNull();
    expect(identity.removeCachedAuthToken).toHaveBeenCalledWith({ token: 'revoke-me' });
  });
});
