import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../core/db';
import { setContextMenuEnabled } from '../core/storage';
import { POPUP_PATH, readPopupSaveRequest } from '../core/popup-save-request';
import { handleContextMenuClick, refreshContextMenus } from './context-menus';
import { CONTEXT_MENU_ROOT_ID } from './context-menu-items';

const tab = {
  id: 7,
  windowId: 3,
  title: 'Current page',
  url: 'https://page.example/',
} as chrome.tabs.Tab;
const page = { menuItemId: CONTEXT_MENU_ROOT_ID, editable: false, pageUrl: tab.url };

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.stubGlobal('chrome', {
    permissions: { contains: vi.fn().mockResolvedValue(true) },
    runtime: { getURL: (path: string) => 'chrome-extension://test/' + path },
    contextMenus: {
      create: vi.fn((_entry, callback: () => void) => callback()),
      removeAll: vi.fn().mockResolvedValue(undefined),
    },
    action: {
      setPopup: vi.fn().mockResolvedValue(undefined),
      openPopup: vi.fn().mockResolvedValue(undefined),
    },
    windows: { create: vi.fn().mockResolvedValue({}) },
    tabs: { create: vi.fn().mockResolvedValue({}) },
  });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Chrome context menus', () => {
  it('avoids the optional API without permission and removes menus when switched off', async () => {
    vi.mocked(chrome.permissions.contains).mockImplementationOnce(async () => false);
    await refreshContextMenus();
    expect(chrome.contextMenus.removeAll).not.toHaveBeenCalled();
    await refreshContextMenus();
    expect(chrome.contextMenus.removeAll).toHaveBeenCalledOnce();
    expect(chrome.contextMenus.create).not.toHaveBeenCalled();
  });

  it('serializes rebuilds and creates only the single direct save action', async () => {
    await setContextMenuEnabled(true);
    await Promise.all([refreshContextMenus(), refreshContextMenus()]);
    expect(chrome.contextMenus.removeAll).toHaveBeenCalledTimes(2);
    expect(chrome.contextMenus.create).toHaveBeenCalledTimes(2);
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      {
        id: CONTEXT_MENU_ROOT_ID,
        title: 'Save to FavoritePod',
        contexts: ['page', 'link'],
        documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*'],
      },
      expect.any(Function),
    );
  });

  it('opens the toolbar popup in the source window then restores its normal home', async () => {
    await setContextMenuEnabled(true);
    await handleContextMenuClick(page, tab);
    const call = vi.mocked(chrome.action.setPopup).mock.calls[0][0];
    expect(call.tabId).toBe(7);
    expect(readPopupSaveRequest(call.popup!)).toEqual({
      url: tab.url,
      title: tab.title,
      sourceTabId: 7,
      sourceWindowId: 3,
      capturePage: true,
    });
    expect(chrome.action.openPopup).toHaveBeenCalledWith({ windowId: 3 });
    expect(chrome.action.setPopup).toHaveBeenLastCalledWith({
      tabId: 7,
      popup: POPUP_PATH,
    });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
    expect(chrome.windows.create).not.toHaveBeenCalled();
    expect(await db.items.count()).toBe(0);
  });

  it('prefers the clicked link and never assigns the containing page title or preview', async () => {
    await setContextMenuEnabled(true);
    await handleContextMenuClick({ ...page, linkUrl: 'https://link.example/path' }, tab);
    const request = readPopupSaveRequest(
      vi.mocked(chrome.action.setPopup).mock.calls[0][0].popup!,
    );
    expect(request).toMatchObject({
      url: 'https://link.example/path',
      title: 'link.example',
      capturePage: false,
    });
  });

  it('allows file links and ignores unsafe, unknown, missing-tab, disabled, or revoked actions', async () => {
    await setContextMenuEnabled(true);
    await handleContextMenuClick({ ...page, linkUrl: 'file:///Users/me/tool.html' }, tab);
    expect(
      readPopupSaveRequest(vi.mocked(chrome.action.setPopup).mock.calls[0][0].popup!)
        ?.url,
    ).toBe('file:///Users/me/tool.html');
    await handleContextMenuClick({ ...page, linkUrl: 'javascript:alert(1)' }, tab);
    await handleContextMenuClick({ ...page, menuItemId: 'favoritepod.save.groups' }, tab);
    await handleContextMenuClick(page);
    vi.mocked(chrome.permissions.contains).mockImplementationOnce(async () => false);
    await handleContextMenuClick(page, tab);
    await setContextMenuEnabled(false);
    await handleContextMenuClick(page, tab);
    expect(chrome.action.openPopup).toHaveBeenCalledOnce();
  });

  it('falls back to the same popup form if Chrome cannot open the toolbar popup', async () => {
    await setContextMenuEnabled(true);
    vi.mocked(chrome.action.openPopup).mockRejectedValueOnce(
      new Error('Cannot open popup'),
    );
    await handleContextMenuClick(page, tab);
    const fallback = vi.mocked(chrome.windows.create).mock.calls[0][0]!;
    expect(fallback).toMatchObject({ type: 'popup', width: 360, height: 560 });
    expect(readPopupSaveRequest(fallback.url as string)?.url).toBe(tab.url);
    expect(chrome.action.setPopup).toHaveBeenLastCalledWith({
      tabId: 7,
      popup: POPUP_PATH,
    });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });

  it('restores the normal popup and accepts a later click after both open paths fail', async () => {
    await setContextMenuEnabled(true);
    vi.mocked(chrome.action.openPopup).mockRejectedValueOnce(new Error('Popup failed'));
    vi.mocked(chrome.windows.create).mockRejectedValueOnce(new Error('Window failed'));
    await expect(handleContextMenuClick(page, tab)).rejects.toThrow('Window failed');
    expect(chrome.action.setPopup).toHaveBeenLastCalledWith({
      tabId: 7,
      popup: POPUP_PATH,
    });
    await handleContextMenuClick(page, tab);
    expect(chrome.action.openPopup).toHaveBeenCalledTimes(2);
  });

  it('keeps rapid requests from overwriting each other before their popups open', async () => {
    await setContextMenuEnabled(true);
    await Promise.all([
      handleContextMenuClick(page, tab),
      handleContextMenuClick({ ...page, linkUrl: 'https://other.example/' }, tab),
    ]);
    const requests = vi
      .mocked(chrome.action.setPopup)
      .mock.calls.map(([arg]) => arg.popup!);
    expect(readPopupSaveRequest(requests[0])?.url).toBe(tab.url);
    expect(requests[1]).toBe(POPUP_PATH);
    expect(readPopupSaveRequest(requests[2])?.url).toBe('https://other.example/');
    expect(requests[3]).toBe(POPUP_PATH);
  });
});
