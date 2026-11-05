import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../core/db';
import {
  createGroup,
  setContextMenuEnabled,
  updateGroup,
  deleteGroup,
} from '../core/storage';
import { handleContextMenuClick, refreshContextMenus } from './context-menus';
import {
  CONTEXT_MENU_GROUP_PREFIX,
  CONTEXT_MENU_LINK_ID,
  CONTEXT_MENU_PAGE_ID,
} from './context-menu-items';

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.stubGlobal('chrome', {
    permissions: { contains: vi.fn().mockResolvedValue(true) },
    runtime: { getURL: (path: string) => `chrome-extension://test/${path}` },
    contextMenus: {
      create: vi.fn((_entry, callback: () => void) => callback()),
      removeAll: vi.fn().mockResolvedValue(undefined),
    },
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

  it('serializes rebuilds and reflects renamed, nested, and deleted groups', async () => {
    const parent = await createGroup({ title: 'Work' });
    const child = await createGroup({ title: 'Tools', parentId: parent.id });
    await setContextMenuEnabled(true);
    await Promise.all([refreshContextMenus(), refreshContextMenus()]);
    expect(chrome.contextMenus.removeAll).toHaveBeenCalledTimes(2);
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Work » Tools' }),
      expect.any(Function),
    );
    await updateGroup(child.id, { title: 'Research' });
    vi.mocked(chrome.contextMenus.create).mockClear();
    await refreshContextMenus();
    expect(chrome.contextMenus.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Work » Research' }),
      expect.any(Function),
    );
    await deleteGroup(child.id);
    vi.mocked(chrome.contextMenus.create).mockClear();
    await refreshContextMenus();
    expect(chrome.contextMenus.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: `${CONTEXT_MENU_GROUP_PREFIX}${child.id}` }),
      expect.any(Function),
    );
  });

  it('opens the page editor with its title and the link editor with the linked URL', async () => {
    await setContextMenuEnabled(true);
    await handleContextMenuClick({
      menuItemId: CONTEXT_MENU_PAGE_ID,
      editable: false,
      pageUrl: 'https://page.example/',
    });
    let url = new URL(vi.mocked(chrome.tabs.create).mock.calls[0][0].url!);
    expect(url.searchParams.get('addFavoriteUrl')).toBe('https://page.example/');
    expect(url.searchParams.get('addFavoriteTitle')).toBe('page.example');
    await handleContextMenuClick({
      menuItemId: CONTEXT_MENU_LINK_ID,
      editable: false,
      pageUrl: 'https://page.example/',
      linkUrl: 'https://link.example/path',
    });
    url = new URL(vi.mocked(chrome.tabs.create).mock.calls[1][0].url!);
    expect(url.searchParams.get('addFavoriteUrl')).toBe('https://link.example/path');
    expect(url.searchParams.get('addFavoriteTitle')).toBe('link.example');
  });

  it('preselects the group, permits file links, and rejects unsafe or disabled actions', async () => {
    await setContextMenuEnabled(true);
    await handleContextMenuClick({
      menuItemId: `${CONTEXT_MENU_GROUP_PREFIX}work`,
      editable: false,
      linkUrl: 'file:///Users/me/tool.html',
    });
    const url = new URL(vi.mocked(chrome.tabs.create).mock.calls[0][0].url!);
    expect(url.searchParams.get('addFavoriteGroupId')).toBe('work');
    expect(url.searchParams.get('addFavoriteUrl')).toBe('file:///Users/me/tool.html');
    await handleContextMenuClick({
      menuItemId: CONTEXT_MENU_LINK_ID,
      editable: false,
      linkUrl: 'javascript:alert(1)',
    });
    await setContextMenuEnabled(false);
    await handleContextMenuClick({
      menuItemId: CONTEXT_MENU_PAGE_ID,
      editable: false,
      pageUrl: 'https://example.com/',
    });
    expect(chrome.tabs.create).toHaveBeenCalledOnce();
  });
});
