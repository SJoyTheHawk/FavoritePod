import { liveQuery } from 'dexie';
import { getContextMenuEnabled } from '../core/storage';
import { buildSavePopupUrl, POPUP_PATH } from '../core/popup-save-request';
import { getDefaultTitle, parseSafeUrl } from '../core/validation';
import { buildContextMenuEntries, CONTEXT_MENU_ROOT_ID } from './context-menu-items';

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
    for (const entry of buildContextMenuEntries()) {
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

let popupQueue: Promise<void> = Promise.resolve();
let installed = false;

export function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): Promise<void> {
  const next = popupQueue.then(async () => {
    if (
      String(info.menuItemId) !== CONTEXT_MENU_ROOT_ID ||
      tab?.id === undefined ||
      tab.windowId < 0 ||
      !(await getContextMenuEnabled()) ||
      !(await chrome.permissions.contains({ permissions: ['contextMenus'] }))
    )
      return;
    const isLink = Boolean(info.linkUrl);
    const parsed = parseSafeUrl(
      (isLink ? info.linkUrl : (info.pageUrl ?? tab.url)) ?? '',
    );
    if (!parsed) return;
    const url = buildSavePopupUrl({
      url: parsed.href,
      title: isLink
        ? getDefaultTitle(parsed.href)
        : tab.title || getDefaultTitle(parsed.href),
      sourceTabId: tab.id,
      sourceWindowId: tab.windowId,
      capturePage: !isLink,
    });
    try {
      // Scope the temporary entry point to this tab; other windows keep their popup.
      await chrome.action.setPopup({ tabId: tab.id, popup: url });
      await chrome.action.openPopup({ windowId: tab.windowId });
    } catch {
      // Older Chrome or a toolbar popup that cannot open still gets the same form.
      await chrome.windows.create({ url, type: 'popup', width: 360, height: 560 });
    } finally {
      await chrome.action
        .setPopup({ tabId: tab.id, popup: POPUP_PATH })
        .catch(() => undefined);
    }
  });
  popupQueue = next.catch(() => undefined);
  return next;
}

export function installContextMenus(): void {
  if (installed) return;
  installed = true;
  const reportError = (cause: unknown) =>
    console.error('FavoritePod context menus could not be refreshed.', cause);
  const refresh = () => void refreshContextMenus().catch(reportError);
  chrome.permissions.onAdded.addListener(() => {
    refresh();
  });
  chrome.permissions.onRemoved.addListener(refresh);
  chrome.runtime.onInstalled.addListener(refresh);
  chrome.runtime.onStartup.addListener(refresh);

  // Re-read the persisted preference on every worker wake, including
  // setting changes from open extension pages. Group selection lives in the popup.
  liveQuery(getContextMenuEnabled).subscribe({ next: refresh, error: reportError });
}
