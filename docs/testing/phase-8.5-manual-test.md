# Phase 8.5 Manual Verification

Build and load the unpacked extension from `dist/`. Connect a test Google
account before checking the Drive-specific states.

**Result**: All manual test items passed in Chrome on 2026-11-06, as reported
by the user. The account-wide storage display tested then was subsequently
removed; the checklist below omits that retired feature.

## Status and progress

- [x] In the dashboard header, find the Google Drive button. When no account is
      connected, it shows a cloud. Click it and check that a small Google Drive
      sign-in window opens without opening the rest of Settings.
- [x] Finish sign-in. The button should show a check mark. Click the check mark to
      sync your favorites. While syncing, it should show moving arrows and ignore
      additional clicks.
- [x] Wait for the sync to finish. A notification should say **Favorites synced**.
      Settings should show the latest sync time and the sync history should contain
      the result.
- [x] Change a favorite in another Chrome profile and sync. The receiving profile
      should briefly explain that changes from another device were included.

## Offline behavior and recovery

- [x] Connect Drive and make a local change. Turn off the network, then click the
      Drive button while it shows a cross.
- [x] The button should show moving arrows briefly, then return to the cross. A
      notification should say **Failed to sync favorites**. The local change must
      remain saved, and no Drive API request should be made while offline.
- [x] Restore network access. FavoritePod should try again automatically and the
      button should return to a check mark after a successful sync.
- [x] Simulate an authorization failure using an expired or revoked test grant.
      The Drive button should offer a focused reconnect window. Successful sign-in
      resumes syncing; authorization failures should not be retried as network
      failures.
- [x] Simulate a temporary network failure and a Drive storage-limit error. A
      failed manual sync should show **Failed to sync favorites**; a storage-limit
      error should show a warning icon, **Google Drive storage is full**, and a
      separate muted explanation in Settings. **Manage storage** should be the
      primary button in the centered action row, beside a secondary **Sync now**
      and **Disconnect**. Check that the text and actions wrap without overlapping
      in a narrow window and remain readable in light and dark themes. Tab to
      **Manage storage**, check its visible focus ring, and press Enter to open
      Google Drive storage in a new tab. After restoring normal requests and
      successfully syncing, the warning and storage button should disappear and
      **Sync now** should return to its normal primary style.

## History and storage

- [x] Run successful, failed, and offline sync attempts. Open **Sync history** in
      Settings and verify outcomes, messages, and timestamps are readable.
- [x] Repeatedly sync until more than 20 outcomes exist. History should retain only
      the newest 20 entries.
- [x] Disconnect and reconnect. Drive history is profile-local metadata;
      local favorites and thumbnails remain intact.

Automated coverage for bounded history, offline handling, status progress, and
background progress messages is included in the core and background suites.
The recorded Chrome acceptance includes OAuth recovery, storage-limit handling,
and multi-profile behavior. The removed quota-display check is preserved in Git
history; [app-folder usage](../planning/deferred-sync-storage-usage.md) is deferred.
