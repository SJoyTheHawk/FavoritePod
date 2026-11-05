import { liveQuery } from 'dexie';
import { db } from '../core/db';
import { getContextMenuEnabled, listGroups } from '../core/storage';
import { getDefaultTitle, parseSafeUrl } from '../core/validation';
import {
  buildContextMenuEntries,
  CONTEXT_MENU_GROUP_PREFIX,
  CONTEXT_MENU_LINK_ID,
  CONTEXT_MENU_PAGE_ID,
} from './context-menu-items';

function createMenu(entry: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(entry, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

let refreshQueue: Promise<void> = Promise.resolve();

/** Serialize rebuilds so permission and library changes cannot create duplicate IDs. */
export function refreshContextMenus(): Promise<void> {
  const next = refreshQueue.then(async () => {
    if (!(await chrome.permissions.contains({ permissions: ['contextMenus'] }))) return;
    await chrome.contextMenus.removeAll();
    if (!(await getContextMenuEnabled())) return;
    for (const entry of buildContextMenuEntries(await listGroups())) {
      await createMenu({
        ...entry,
        contexts: entry.contexts as ['page' | 'link', ...('page' | 'link')[]],
        documentUrlPatterns: ['http://*/*', 'https://*/*', 'file:///*'],
      });
    }
  });
  refreshQueue = next.catch(() => undefined);
  return next;
}

export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  if (!(await getContextMenuEnabled())) return;
  const id = String(info.menuItemId);
  if (
    id !== CONTEXT_MENU_PAGE_ID &&
    id !== CONTEXT_MENU_LINK_ID &&
    !id.startsWith(CONTEXT_MENU_GROUP_PREFIX)
  )
    return;
  const isLink =
    id === CONTEXT_MENU_LINK_ID ||
    (id.startsWith(CONTEXT_MENU_GROUP_PREFIX) && Boolean(info.linkUrl));
  const parsed = parseSafeUrl((isLink ? info.linkUrl : (info.pageUrl ?? tab?.url)) ?? '');
  if (!parsed) return;
  const url = new URL(chrome.runtime.getURL('src/dashboard/dashboard.html'));
  url.searchParams.set('addFavoriteUrl', parsed.href);
  url.searchParams.set(
    'addFavoriteTitle',
    isLink ? getDefaultTitle(parsed.href) : tab?.title || getDefaultTitle(parsed.href),
  );
  if (id.startsWith(CONTEXT_MENU_GROUP_PREFIX)) {
    url.searchParams.set(
      'addFavoriteGroupId',
      id.slice(CONTEXT_MENU_GROUP_PREFIX.length),
    );
  }
  await chrome.tabs.create({ url: url.href });
}

export function installContextMenus(): void {
  const reportError = (cause: unknown) =>
    console.error('FavoritePod context menus could not be refreshed.', cause);
  const refresh = () => void refreshContextMenus().catch(reportError);
  const onClick = (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => {
    void handleContextMenuClick(info, tab).catch(reportError);
  };
  const registerClickListener = () => {
    // Optional API namespaces may be unavailable until the permission is granted.
    if (chrome.contextMenus && !chrome.contextMenus.onClicked.hasListener(onClick)) {
      chrome.contextMenus.onClicked.addListener(onClick);
    }
  };
  registerClickListener();
  chrome.permissions.onAdded.addListener(() => {
    registerClickListener();
    refresh();
  });
  chrome.permissions.onRemoved.addListener(refresh);
  chrome.runtime.onInstalled.addListener(refresh);
  chrome.runtime.onStartup.addListener(refresh);

  // Re-read persisted preferences and groups on every worker wake, including
  // group changes from popup, import, and Drive sync. No DOM APIs are used.
  liveQuery(async () => ({
    enabled: await getContextMenuEnabled(),
    groups: await db.groups.toArray(),
  })).subscribe({ next: refresh, error: reportError });
}
