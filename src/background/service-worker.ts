import { DRIVE_CONNECTION_CHANGED, getDriveConnectionState } from '../core/drive-auth';
import {
  DriveSyncChoiceRequired,
  getDriveSyncErrorCode,
  syncGoogleDrive,
} from '../core/drive-sync';
import { DRIVE_LIBRARY_CHANGED_MESSAGE } from '../core/drive-sync-triggers';
import { CONTEXT_MENUS_REFRESH_MESSAGE } from '../core/optional-features';
import { getContextMenuEnabled } from '../core/storage';
import type * as ContextMenuModuleType from './context-menus';

type ContextMenuModule = typeof ContextMenuModuleType;
let contextMenuModule: Promise<ContextMenuModule> | undefined;

function loadContextMenuModule(): Promise<ContextMenuModule> {
  contextMenuModule ??= import('./context-menus');
  return contextMenuModule;
}

async function installContextMenusIfEnabled(): Promise<void> {
  if (
    !chrome.permissions ||
    !(await chrome.permissions.contains({ permissions: ['contextMenus'] })) ||
    !(await getContextMenuEnabled())
  ) {
    return;
  }
  (await loadContextMenuModule()).installContextMenus();
}

function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab,
): void {
  void loadContextMenuModule()
    .then((module) => module.handleContextMenuClick(info, tab))
    .catch((cause: unknown) =>
      console.error('FavoritePod context-menu action failed.', cause),
    );
}

function registerContextMenuClickListener(): void {
  const clickEvent = chrome.contextMenus?.onClicked;
  if (!clickEvent || clickEvent.hasListener(handleContextMenuClick)) return;
  try {
    clickEvent.addListener(handleContextMenuClick);
  } catch {
    // Optional permission may be absent until Chrome reports it as added.
  }
}

registerContextMenuClickListener();
chrome.permissions?.onAdded.addListener((permissions) => {
  if (!permissions.permissions?.includes('contextMenus')) return;
  registerContextMenuClickListener();
  void installContextMenusIfEnabled();
});
void installContextMenusIfEnabled();

const PERIODIC_SYNC_ALARM = 'favoritepod-drive-periodic-sync';
const DEBOUNCED_SYNC_ALARM = 'favoritepod-drive-debounced-sync';

function registerPeriodicSync(): void {
  void chrome.alarms.create(PERIODIC_SYNC_ALARM, {
    delayInMinutes: 15,
    periodInMinutes: 15,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  console.info('FavoritePod installed.');
  registerPeriodicSync();
  void installContextMenusIfEnabled();
});

chrome.runtime.onStartup.addListener(() => {
  registerPeriodicSync();
  void installContextMenusIfEnabled();
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (typeof message !== 'object' || message === null || !('type' in message)) {
    return;
  }

  if (
    message.type === DRIVE_LIBRARY_CHANGED_MESSAGE &&
    (!('source' in message) || message.source !== 'service-worker')
  ) {
    // MV3 alarms have a 30-second minimum delay; the open dashboard handles the
    // planned 10-second debounce while this alarm survives popup closure.
    void chrome.alarms.create(DEBOUNCED_SYNC_ALARM, { delayInMinutes: 0.5 });
    void chrome.runtime
      .sendMessage({ type: DRIVE_LIBRARY_CHANGED_MESSAGE, source: 'service-worker' })
      .catch(() => undefined);
  } else if (
    message.type === CONTEXT_MENUS_REFRESH_MESSAGE &&
    sender.id === chrome.runtime.id
  ) {
    void loadContextMenuModule()
      .then((module) => {
        module.installContextMenus();
        return module.refreshContextMenus();
      })
      .then(
        () => sendResponse({ ok: true }),
        () =>
          sendResponse({ error: 'Could not update the right-click menu. Try again.' }),
      );
    return true;
  } else if (
    message.type === 'favoritepod.sync.completed' ||
    message.type === DRIVE_CONNECTION_CHANGED
  ) {
    void chrome.alarms.clear(DEBOUNCED_SYNC_ALARM);
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== PERIODIC_SYNC_ALARM && alarm.name !== DEBOUNCED_SYNC_ALARM) {
    return;
  }

  void (async () => {
    try {
      if ((await getDriveConnectionState()).status !== 'connected') return;
      await syncGoogleDrive(undefined, (progress) => {
        void chrome.runtime
          .sendMessage({ type: 'favoritepod.sync.progress', progress })
          .catch(() => undefined);
      });
    } catch (cause) {
      if (cause instanceof DriveSyncChoiceRequired) {
        void chrome.runtime
          .sendMessage({
            type: 'favoritepod.sync.choice-required',
            preview: cause.preview,
          })
          .catch(() => undefined);
        return;
      }
      const message =
        cause instanceof Error ? cause.message : 'Google Drive sync failed.';
      console.error('FavoritePod Drive sync failed.', cause);
      void chrome.runtime
        .sendMessage({
          type: 'favoritepod.sync.failed',
          message,
          code: getDriveSyncErrorCode(cause),
        })
        .catch(() => undefined);
    }
  })();
});
