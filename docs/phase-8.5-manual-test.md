# Phase 8.5 Manual Verification

Build and load the unpacked extension from `dist/`. Connect a test Google
account before checking the Drive-specific states.

## Status and progress

1. In the dashboard header, verify the Google Drive status icon is present. Its
   tooltip should describe the current state; click it to open Settings.
2. With Drive connected, run **Sync now**. Settings should show the active sync
   stage and any available item count while downloading or syncing previews.
3. Change a favorite in another Chrome profile and sync. The receiving profile
   should briefly show that remote changes were merged automatically.
4. Wait for sync to complete. Settings should show the latest sync time and the
   history should contain the outcome.

## Offline behavior and recovery

1. Connect Drive and make a local change. Use Chrome DevTools network throttling
   or disable network access for the dashboard, then choose **Sync now**.
2. Verify FavoritePod reports offline, retains the local change, and records the
   offline attempt. It should not make Drive API requests while `navigator.onLine`
   is false.
3. Restore network access. The online trigger should resume sync automatically
   and clear the current error state after success.
4. Simulate an authorization failure using an expired/revoked test grant. Verify
   the header and Settings identify the authorization state and provide
   **Connect Google Drive**. Successful authorization resumes sync; do not retry
   authorization failures as network errors.
5. Simulate a transient network failure and a Drive quota error. Network failure
   should offer **Try again**; quota failure should offer **Manage storage**.

## History and storage

1. Run successful, failed, and offline sync attempts. Open **Sync history** in
   Settings and verify outcomes, messages, and timestamps are readable.
2. Repeatedly sync until more than 20 outcomes exist. History should retain only
   the newest 20 entries.
3. Open Settings while connected. Drive storage usage should display in human
   readable units and show a usage bar when Google provides a limit. This is the
   account's overall Drive usage, including files outside FavoritePod.
4. Disconnect and reconnect. Drive history and quota cache are profile-local
   Drive metadata; local favorites and thumbnails remain intact.

Automated coverage for quota parsing/cache, bounded history, offline handling,
status progress, and background progress messages is included in the core and
background test suites. Real OAuth expiration, quota, and multiple-profile
behavior still require Chrome verification.
