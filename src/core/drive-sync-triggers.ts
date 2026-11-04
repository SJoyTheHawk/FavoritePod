import { db } from './db';

export const DRIVE_LIBRARY_CHANGED_EVENT = 'favoritepod:library-changed';
export const DRIVE_LIBRARY_CHANGED_MESSAGE = 'favoritepod.library.changed';

let suppressionDepth = 0;
let notificationQueued = false;

function notifyLibraryChanged(): void {
  if (suppressionDepth > 0 || notificationQueued) return;
  notificationQueued = true;
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    // Notify the service worker before a popup can close; it owns the durable
    // alarm that will retry this change after the popup context is gone.
    void chrome.runtime
      .sendMessage({ type: DRIVE_LIBRARY_CHANGED_MESSAGE })
      .catch(() => undefined);
  }
  setTimeout(() => {
    notificationQueued = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(DRIVE_LIBRARY_CHANGED_EVENT));
    }
  }, 0);
}

/** Mark writes made while applying a remote merge so they do not queue a new sync. */
export async function withoutDriveChangeNotification<T>(
  operation: () => Promise<T>,
): Promise<T> {
  suppressionDepth += 1;
  try {
    return await operation();
  } finally {
    suppressionDepth -= 1;
  }
}

/** Broadcast group and item mutations to the active dashboard and service worker. */
export function installDriveSyncChangeHooks(): void {
  const shared = globalThis as typeof globalThis & {
    __favoritePodDriveSyncHooksInstalled?: boolean;
  };
  if (shared.__favoritePodDriveSyncHooksInstalled) return;
  shared.__favoritePodDriveSyncHooksInstalled = true;

  for (const table of [db.groups, db.items]) {
    table.hook('creating').subscribe(notifyLibraryChanged);
    table.hook('updating').subscribe(notifyLibraryChanged);
    table.hook('deleting').subscribe(notifyLibraryChanged);
  }
}
