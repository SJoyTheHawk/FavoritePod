import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import {
  getContextMenuEnabled,
  getHiddenVisitedSiteUrls,
  getSiteDiscoveryEnabled,
  getShowFrequentlyVisited,
  getShowFrequentlyVisitedOnHome,
  hideVisitedSiteUrl,
  setContextMenuEnabled,
  setSiteDiscoveryEnabled,
  setShowFrequentlyVisited,
  setShowFrequentlyVisitedOnHome,
} from '../storage';
import { saveContextMenuEnabled, saveSiteDiscoveryEnabled } from '../optional-features';

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.stubGlobal('chrome', {
    permissions: {
      request: vi.fn().mockResolvedValue(true),
      remove: vi.fn().mockResolvedValue(true),
    },
    runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true }) },
  });
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('optional features', () => {
  it('persists home-page visibility independently of All favorites and permissions', async () => {
    expect(await getShowFrequentlyVisitedOnHome()).toBe(false);
    await setShowFrequentlyVisitedOnHome(true);
    await setShowFrequentlyVisited(false);
    db.close();
    await db.open();
    expect(await getShowFrequentlyVisitedOnHome()).toBe(true);
    expect(await getShowFrequentlyVisited()).toBe(false);
    expect(await getSiteDiscoveryEnabled()).toBe(false);
    await setShowFrequentlyVisitedOnHome(false);
    await setShowFrequentlyVisited(true);
    expect(await getShowFrequentlyVisitedOnHome()).toBe(false);
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(await db.syncMeta.count()).toBe(0);
  });

  it('shows shortcuts by default and persists hiding independently of access', async () => {
    expect(await getShowFrequentlyVisited()).toBe(true);
    expect(await getSiteDiscoveryEnabled()).toBe(false);
    await setSiteDiscoveryEnabled(true);
    await setShowFrequentlyVisited(false);
    db.close();
    await db.open();
    expect(await getShowFrequentlyVisited()).toBe(false);
    expect(await getSiteDiscoveryEnabled()).toBe(true);
    await setShowFrequentlyVisited(true);
    expect(await getShowFrequentlyVisited()).toBe(true);
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(chrome.permissions.remove).not.toHaveBeenCalled();
    expect(await db.syncMeta.count()).toBe(0);
  });

  it('defaults off and persists each feature independently', async () => {
    expect(await getSiteDiscoveryEnabled()).toBe(false);
    expect(await getContextMenuEnabled()).toBe(false);
    await setSiteDiscoveryEnabled(true);
    await setContextMenuEnabled(true);
    db.close();
    await db.open();
    expect(await getSiteDiscoveryEnabled()).toBe(true);
    expect(await getContextMenuEnabled()).toBe(true);
    await setContextMenuEnabled(false);
    expect(await getSiteDiscoveryEnabled()).toBe(true);
    expect(await getContextMenuEnabled()).toBe(false);
  });

  it('keeps discovery off when Top sites permission is denied', async () => {
    vi.mocked(chrome.permissions.request).mockImplementation(async () => false);
    const request = saveSiteDiscoveryEnabled(true);
    // The permission prompt is invoked synchronously in the click call stack.
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      permissions: ['topSites'],
    });
    await expect(request).rejects.toThrow('permission was not granted');
    expect(await getSiteDiscoveryEnabled()).toBe(false);
  });

  it('enables with only Top sites available and preserves local preferences', async () => {
    vi.mocked(chrome.permissions.request).mockImplementation(
      async (request) =>
        request.permissions?.length === 1 && request.permissions[0] === 'topSites',
    );
    await setShowFrequentlyVisited(false);
    await setShowFrequentlyVisitedOnHome(true);
    await hideVisitedSiteUrl('https://hidden.example/');
    await setContextMenuEnabled(true);
    await saveSiteDiscoveryEnabled(true);
    expect(await getSiteDiscoveryEnabled()).toBe(true);
    expect(await getShowFrequentlyVisited()).toBe(false);
    expect(await getShowFrequentlyVisitedOnHome()).toBe(true);
    expect(await getHiddenVisitedSiteUrls()).toEqual(['https://hidden.example/']);
    expect(await getContextMenuEnabled()).toBe(true);
  });

  it('requests only Top sites on enable and removes only that grant on disable', async () => {
    await saveSiteDiscoveryEnabled(true);
    expect(chrome.permissions.request).toHaveBeenCalledExactlyOnceWith({
      permissions: ['topSites'],
    });
    expect(await getSiteDiscoveryEnabled()).toBe(true);
    await saveSiteDiscoveryEnabled(false);
    expect(chrome.permissions.remove).toHaveBeenCalledExactlyOnceWith({
      permissions: ['topSites'],
    });
    expect(await getSiteDiscoveryEnabled()).toBe(false);
  });

  it('enables and disables right-click menus while preserving discovery', async () => {
    await setSiteDiscoveryEnabled(true);
    await saveContextMenuEnabled(true);
    expect(chrome.permissions.request).toHaveBeenCalledWith({
      permissions: ['contextMenus'],
    });
    expect(await getContextMenuEnabled()).toBe(true);
    vi.mocked(chrome.permissions.request).mockClear();
    await saveContextMenuEnabled(false);
    expect(chrome.permissions.request).not.toHaveBeenCalled();
    expect(await getContextMenuEnabled()).toBe(false);
    expect(await getSiteDiscoveryEnabled()).toBe(true);
    expect(chrome.runtime.sendMessage).toHaveBeenCalledTimes(2);
  });

  it('keeps menus disabled when permission is denied and surfaces refresh failures', async () => {
    vi.mocked(chrome.permissions.request).mockImplementationOnce(async () => false);
    await expect(saveContextMenuEnabled(true)).rejects.toThrow(
      'permission was not granted',
    );
    expect(await getContextMenuEnabled()).toBe(false);
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    vi.mocked(chrome.runtime.sendMessage).mockImplementationOnce(async () => ({
      error: 'Refresh failed',
    }));
    await expect(saveContextMenuEnabled(true)).rejects.toThrow('Refresh failed');
  });

  it('persists local hidden URLs atomically, deduplicates them, and rejects unsafe values', async () => {
    await Promise.all([
      hideVisitedSiteUrl('https://one.example/'),
      hideVisitedSiteUrl('https://two.example/'),
    ]);
    await hideVisitedSiteUrl('https://one.example/');
    await hideVisitedSiteUrl('javascript:alert(1)');
    db.close();
    await db.open();
    expect(await getHiddenVisitedSiteUrls()).toEqual([
      'https://one.example/',
      'https://two.example/',
    ]);
    expect(await db.syncMeta.count()).toBe(0);
  });
});
