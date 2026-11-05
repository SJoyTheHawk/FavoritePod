import { DRIVE_CONNECTION_CHANGED, getDriveConnectionState } from '../core/drive-auth';
import {
  DriveSyncChoiceRequired,
  getDriveSyncErrorCode,
  syncGoogleDrive,
} from '../core/drive-sync';
import { DRIVE_LIBRARY_CHANGED_MESSAGE } from '../core/drive-sync-triggers';

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
});

chrome.runtime.onStartup.addListener(registerPeriodicSync);

chrome.runtime.onMessage.addListener((message: unknown) => {
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
