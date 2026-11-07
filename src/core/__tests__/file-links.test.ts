import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import {
  applyPathOverride,
  checkFileAvailability,
  getFileAvailabilityStats,
  getPathOverrides,
  openFileUrl,
  savePathOverrides,
  type PathOverride,
} from '../file-links';
import { getDeviceId } from '../storage';

const override: PathOverride = {
  from: 'file:///Users/alice/tools/',
  to: 'file:///Volumes/tools/',
};
const isAllowedFileSchemeAccess = vi.fn<() => Promise<boolean>>();

beforeEach(async () => {
  await db.delete();
  await db.open();
  isAllowedFileSchemeAccess.mockResolvedValue(true);
  vi.stubGlobal('chrome', {
    extension: { isAllowedFileSchemeAccess },
    runtime: { id: 'favoritepod-id' },
    tabs: { create: vi.fn().mockResolvedValue({ id: 1 }) },
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('local file links', () => {
  it('applies the longest matching folder prefix and preserves the remaining URL', () => {
    const result = applyPathOverride(
      'file:///Users/alice/tools/nested/my%20tool/index.html?mode=1#start',
      [
        override,
        {
          from: 'file:///Users/alice/tools/nested/',
          to: 'file:///Volumes/nested-tools/',
        },
      ],
    );
    expect(result).toBe('file:///Volumes/nested-tools/my%20tool/index.html?mode=1#start');
    expect(applyPathOverride('file:///Users/alice/toolshed/index.html', [override])).toBe(
      'file:///Users/alice/toolshed/index.html',
    );
    expect(applyPathOverride('https://example.com/tools', [override])).toBe(
      'https://example.com/tools',
    );
  });

  it('stores path overrides separately for each local device identity', async () => {
    await db.syncMeta.put({ key: 'deviceId', value: 'device-a' });
    await savePathOverrides([override]);
    expect(await getPathOverrides()).toEqual([
      { from: 'file:///Users/alice/tools/', to: 'file:///Volumes/tools/' },
    ]);

    await db.syncMeta.put({ key: 'deviceId', value: 'device-b' });
    expect(await getPathOverrides()).toEqual([]);
    await savePathOverrides([
      { from: 'file:///Users/alice/tools', to: 'file:///D:/tools' },
    ]);

    await db.syncMeta.put({ key: 'deviceId', value: 'device-a' });
    expect((await getPathOverrides())[0]?.to).toBe('file:///Volumes/tools/');
  });

  it('creates one stable device identity for concurrent first reads', async () => {
    const ids = await Promise.all(Array.from({ length: 8 }, () => getDeviceId()));
    expect(new Set(ids).size).toBe(1);
    expect(await db.syncMeta.get('deviceId')).toMatchObject({ value: ids[0] });
  });

  it('checks access before opening the rewritten local URL', async () => {
    await savePathOverrides([override]);
    await openFileUrl('file:///Users/alice/tools/app/index.html');
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'file:///Volumes/tools/app/index.html',
    });

    isAllowedFileSchemeAccess.mockResolvedValue(false);
    await expect(openFileUrl('file:///Users/alice/tools/app/index.html')).rejects.toThrow(
      'FILE_ACCESS_DENIED',
    );
  });

  it('reports unknown without access, and available or missing with access', async () => {
    isAllowedFileSchemeAccess.mockResolvedValue(false);
    expect(
      await checkFileAvailability('file:///Users/alice/tools/app.html', [override]),
    ).toBe('unknown');

    isAllowedFileSchemeAccess.mockResolvedValue(true);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    expect(
      await checkFileAvailability('file:///Users/alice/tools/app.html', [override]),
    ).toBe('available');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(
      await checkFileAvailability('file:///Users/alice/tools/missing.html', [override]),
    ).toBe('missing');
  });

  it('shares missing-file probes across duplicate cards and remounts until expiry', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('File not found'));
    vi.stubGlobal('fetch', fetchMock);
    const url = 'file:///Users/alice/removed-dedup.png';
    expect(
      await Promise.all(Array.from({ length: 88 }, () => checkFileAvailability(url, []))),
    ).toEqual(Array(88).fill('missing'));
    expect(await checkFileAvailability(url, [])).toBe('missing');
    expect(fetchMock).toHaveBeenCalledOnce();
    now.mockReturnValue(31_001);
    const cancel = vi.fn().mockResolvedValue(undefined);
    fetchMock.mockResolvedValue({ ok: true, body: { cancel } });
    expect(await checkFileAvailability(url, [])).toBe('available');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
  });

  it('checks permission before cached results and keys probes by the rewritten path', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const url = 'file:///Users/alice/tools/cache-target.html';
    expect(await checkFileAvailability(url, [])).toBe('available');
    isAllowedFileSchemeAccess.mockResolvedValue(false);
    expect(await checkFileAvailability(url, [])).toBe('unknown');
    expect(fetchMock).toHaveBeenCalledOnce();
    isAllowedFileSchemeAccess.mockResolvedValue(true);
    fetchMock.mockResolvedValue({ ok: false });
    expect(await checkFileAvailability(url, [override])).toBe('missing');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'file:///Volumes/tools/cache-target.html',
      { signal: expect.any(AbortSignal) },
    );
  });

  it('bounds cached file statuses without retaining file response bodies', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body: { cancel } }));
    for (let index = 0; index < 280; index++) {
      await checkFileAvailability('file:///Users/alice/bounded-' + index, []);
    }
    expect(getFileAvailabilityStats()).toMatchObject({
      cachedResults: 256,
      pendingChecks: 0,
    });
    expect(cancel).toHaveBeenCalledTimes(280);
  });
});
