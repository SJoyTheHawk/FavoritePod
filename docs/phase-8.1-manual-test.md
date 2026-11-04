# Phase 8.1: Google Drive authorization manual test

## Before testing

1. Run npm run build and reload FavoritePod from chrome://extensions in every test profile. Close old dashboard tabs and reopen them so every context uses the new build.
2. Use the same extension ID and OAuth client in each profile. While the OAuth app is in Testing mode, use an approved test account.
3. Settings > Google Drive stays below Import and export. Disconnected state shows **Not connected** beside the title and a centered **Connect Google Drive** button.

## Connect and verify

1. Click **Connect Google Drive**. Approve access if Google asks. FavoritePod then shows the Google account detected for this Chrome profile; confirm it with **Connect** before the profile is connected. If FavoritePod already has a Google grant, Chrome may return the account without showing a consent screen.
2. Verify the connected email, **Sync now**, and **Disconnect**. There must be no **Check account** or **Reconnect or switch account** buttons.
3. Finish any first-sync merge/replace choice. Reload the dashboard and verify that the account remains connected and syncing works.

## Disconnect affects only one profile

1. Connect profiles A, B, and C to the same approved Google account and finish initial sync in each.
2. Open two dashboard tabs in B. Choose **Disconnect** in one tab. A centered confirmation dialog should appear over Settings with the title **Disconnect Google Drive?** and text **Disconnecting from Google Drive will stop syncing your favorites. Your saved favorites will remain available locally.** Cancel, Escape, or clicking outside should close only the confirmation and return focus to Settings. Reopen it to continue. During disconnection, both buttons are disabled; any failure appears inside the dialog for retry.
3. Confirm. Both B dashboards must show **Not connected**. Favorites, groups, previews, snapshots, and device identity must remain. There must be no Google token/revoke network request from disconnect.
4. Change a favorite in A and sync A and C. Both must continue without a new consent prompt. B must stay disconnected after dashboard reload and browser restart, including when alarms fire.
5. Click **Connect Google Drive** in B. Confirm the displayed account to connect this profile. Cancel the confirmation once and verify B stays disconnected; start again, confirm, and finish its first-sync choice. Verify all three profiles can sync.
6. Verify disconnect also succeeds while offline. Prefer browser network emulation for this check; radio toggling is unnecessary. Cached-credential cleanup failure is covered automatically.

## Authorization recovery

1. Use a dedicated test Google account. Revoke FavoritePod access through that account's Google settings; unlike local Disconnect, this intentionally affects the account's other installations too.
2. In A, run **Sync now**. After rejection of the cached token/silent authorization, the section must show the email, **Connection needs attention**, **Connect Google Drive**, and **Disconnect**. It must not mislabel this as a network outage.
3. Reload the dashboard and open another dashboard. Both must retain the recovery state. Wait for an alarm: it must not repeatedly request tokens or open consent.
4. Make a local change. Click **Connect Google Drive**, cancel consent, and verify the recovery state and change remain.
5. Click Connect again and authorize the same account. Sync must resume automatically; verify the queued change in another authorized profile. Existing first-sync bookkeeping must be preserved.
6. Simulate an ordinary request/network failure. It must show a connection error with bounded retries and retain the normal connected controls. It must not permanently require consent.

## Account changes

Chrome controls which account getAuthToken returns; this UI does not implement a custom account chooser. A disconnected profile confirms the returned account before reconnecting. To use another account, change the Chrome profile's signed-in account first.

If recovery returns an account different from the remembered account, the confirmation must name both. Cancel must preserve the previous account, library, and bookkeeping and keep sync paused. Confirm must recheck the selected identity, clear account-specific bookkeeping, and offer the existing first-sync merge/replace choice before applying the other account's library.

After a profile-only disconnect, the profile has no remembered account. Connect first identifies the account and asks the user to confirm it before persisting the connection. Cancel leaves the profile disconnected. Chrome may reuse FavoritePod's existing Google grant and skip its consent screen; the account-confirmation step is FavoritePod's explicit reconnect check.

## Automated verification and limitations

Run npm test, npm run type-check, npm run lint, and npm run build.
Core tests cover local-only disconnect (including cache cleanup failure), auth/network distinctions, bounded token refresh, recovery persistence, account mismatch, and sync gating. Browser OAuth and real isolation between three signed-in profiles require manual verification. A successful unit-test run is not a substitute for those checks.

This behavior supersedes the former revoke-on-disconnect design. Full account-wide revocation is available through Google Account settings, not an additional permanent FavoritePod button.
