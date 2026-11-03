import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import {
  applyPathOverride,
  checkFileAvailability,
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
      await checkFileAvailability('file:///Users/alice/tools/app.html', [override]),
    ).toBe('missing');
  });
});
