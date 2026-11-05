# Deferred: FavoritePod Sync Storage Usage

**Decision date:** 2026-11-06 (Asia/Hong_Kong)  
**Status:** Deferred; the prototype was removed from the application.  
**Priority:** Minor enhancement. Complete the major implementation work first.

The user considers this feature useful but wants a dedicated round of failure-path
and try/catch testing before adding it. This record preserves the approach and
remaining work so it can be implemented again when prioritized. It is not a
release acceptance record.

## Intended behavior and privacy boundary

In Settings > Google Drive, show the combined size of FavoritePod's library-state
files and preview images stored in the connected account's private app folder.
The total covers files from all devices represented there, not just this device's
local library. It describes stored file contents, not cumulative network traffic.

- Label: **FavoritePod sync data**.
- Supporting copy: **Library files and previews in FavoritePod’s private Drive folder.**
- Display a readable byte total, including a genuine `0 B` for an empty folder.
- Load when Settings opens with a connected account and an online device.
- Refresh after sync; show a loading/updating state while waiting.
- Handle offline, reconnect-required, and unavailable states explicitly.

Do not restore the earlier account-wide storage quota display or request
`about.storageQuota`. Do not request broader OAuth permissions. The existing
manifest uses `drive.appdata`. The existing migration that deletes the old
`drive.storageQuota` cache and handling of `storageQuotaExceeded` sync errors
remain in place. A failed upload may still explain that Drive storage is full.

The proposed number is a sum of current file `size` metadata. Do not describe it
as an exact account quota charge or remaining capacity. Any future requirement
to include retained revisions or other storage accounting needs separate design
and verification.

## Implementation map

| File | Role when revisiting |
| --- | --- |
| `src/core/drive-sync-storage.ts` | Recreate an aggregation helper, tentatively `getDriveSyncStorageUsage(): Promise<number>`. This prototype file was deleted. |
| `src/core/drive-files.ts` | Existing `listDriveDeviceFiles()` lists library-state metadata; `DriveDeviceFileMetadata.size` is optional. |
| `src/core/drive-assets.ts` | Existing `listDriveAssets()` lists preview metadata; review its database writes before reusing it for a display. |
| `src/core/drive-auth.ts` | Reuse existing connected-account checks and authenticated request/error handling. |
| `src/dashboard/DashboardApp.tsx` | Coordinate fetch lifecycle, account identity, sync completion, and result state. |
| `src/dashboard/components/SettingsDialog.tsx` | Render the total above Sync history, plus loading and failure states. |
| `src/core/__tests__/drive-sync-storage.test.ts` | Recreate aggregation and error-propagation tests. Add lifecycle coverage using the appropriate UI test setup. |

Both existing listing functions call `/drive/v3/files` with
`spaces=appDataFolder`, `trashed = false`, pagination, and fields
`nextPageToken,files(id,name,modifiedTime,mimeType,size)`. They filter recognized
names: `launcher-state-device-<deviceId>.json` and `asset-<sha256>.jpg`.
They already request the file sizes used in the proposed calculation.

The removed prototype used this aggregation:

```typescript
import { listDriveAssets } from './drive-assets';
import { listDriveDeviceFiles } from './drive-files';

export async function getDriveSyncStorageUsage(): Promise<number> {
  const [deviceFiles, assets] = await Promise.all([
    listDriveDeviceFiles(),
    listDriveAssets(),
  ]);
  if (deviceFiles.some((file) => file.size === undefined)) {
    throw new Error('Google Drive did not return all FavoritePod sync file sizes.');
  }
  return (
    deviceFiles.reduce((total, file) => total + file.size!, 0) +
    assets.reduce((total, asset) => total + asset.size, 0)
  );
}
```

This is historical reference, not a finished implementation to copy unchanged.
The Dashboard prototype kept `driveSyncStorageBytes` and
`driveSyncStorageLoading` in memory and passed them to Settings. Its effect used
`settingsOpen`, connection status, `online`, and `driveSyncing` as dependencies.
It waited for syncing to finish, set loading before fetching, set the total on
success, cleared it on rejection, and cleared loading in `finally`. An `active`
flag prevented obsolete promises from updating React state after cleanup.
No new persistent usage cache or database schema was added.

## Issues to resolve before bringing it back

- **Account identity:** Include the connected account's identity in the request
  lifecycle. Status can remain `connected` during an account change. Invalidate
  the old result immediately and never show one account's total for another.
- **Side effects:** `listDriveAssets()` calls `saveMetadata()` for each returned
  file and writes to `db.driveAssets`. A Settings-only read therefore touches
  sync bookkeeping. Consider a metadata-only listing option or helper; test
  failure and account-switch behavior before choosing reuse.
- **Cancellation:** The React `active` flag suppresses UI updates but does not
  abort network requests or database writes. `Promise.all` rejection also leaves
  its other request running. Review stale account writes and background work.
- **Size validation:** Reject missing or invalid sizes rather than treating them
  as zero. Validate nonnegative safe integers and a safe total. The prototype
  only checked for missing library-file sizes and used a non-null assertion.
- **Completeness:** Follow every page, reject repeated page tokens, and avoid
  partial totals when either listing fails. Count a file ID once if repeated;
  distinct remote file IDs with the same preview hash still occupy separate
  files. Define how retained/orphaned app files fit the wording.
- **Refresh behavior:** Check completion events from both the current dashboard
  and background sync. Avoid fetching during uploads/cleanup or repeatedly
  refreshing on unrelated renders. Listings across two requests are not an
  atomic snapshot if another device is changing files.
- **Failure isolation:** A failed optional usage read must not overwrite real
  sync results, stop normal sync, show a misleading zero, or remain loading
  forever. Preserve existing authentication recovery behavior.
- **Presentation:** Decide byte units and rounding consistently. The prototype
  divided by 1024 while labeling units KB/MB/GB/TB; choose explicit binary units
  or decimal conversion when implementing again.

## Required test round

Use mocked Drive responses for failure injection and test actual listing/helper
integration in addition to mocked aggregation. Add UI lifecycle coverage where
needed; the two prototype tests did not exercise React or real request handlers.

| Case | Expected behavior to verify |
| --- | --- |
| Library and preview files across devices/pages | Sum recognized remote file sizes; exclude unrelated and trashed files through scoped requests. |
| Empty folder or one empty category | Show the correct total, including `0 B` only for a successful empty result. |
| Missing, negative, fractional, unsafe, or malformed size | Reject the calculation; no partial total or fallback zero. |
| Repeated file ID or pagination token | No double-counting or infinite loop; repeated tokens fail clearly. |
| Either listing rejects, including a later page | Catch the failure, clear loading in `finally`, and handle the other pending request safely. |
| Network loss, 429, or 5xx | Show unavailable/offline as appropriate; allow a later successful refresh. |
| 401 followed by successful token recovery | Respect existing retry behavior and display the recovered total. |
| Persistent 401, revoked authorization, or disconnected account | Respect reconnect state; no retry loop or stale total. |
| 403 permission denial or quota-related rejection | Handle the optional read failure without inventing a quota count or replacing an unrelated sync result. |
| Invalid JSON, unexpected file payload, or IndexedDB failure | Reject safely; no stuck loading indicator or unhandled rejection. |
| Settings closes/unmounts before success or failure | No stale UI update; examine remaining request/database side effects. |
| Account switches/disconnects during a request | Clear old usage; discard late results and prevent writes for the wrong account. |
| New request finishes before an older request | Only the current request controls both displayed bytes and loading state. |
| Sync starts or finishes while Settings is open | Show updating and refresh afterward, including background sync completion and failure. |
| Offline then online; failure then success | State recovers and a fresh value becomes visible. |
| Privacy request inspection | File listings stay scoped to `appDataFolder`; no account storage quota query or extra OAuth scope. |

Then test the unpacked extension in Chrome with a connected account: open/close
Settings, sync a changed library and previews, reconnect, switch accounts, and
exercise offline/recovery. Inspect request fields and check the layout, keyboard
navigation, and announced loading/error states. Record browser version, build,
steps, and observed results.

## Prior checks and reimplementation order

Before deferral, the prototype passed TypeScript, lint, formatting, production
build, and 152 tests across 17 suites. Only two new tests covered this feature:
summing library/preview sizes and rejecting a missing library-file size. These
checks did not establish the full error-path or lifecycle behavior above. No
completed browser acceptance was recorded.

When this work is prioritized again:

1. Review the current Drive and Settings code, which may have changed.
2. Resolve the read-only metadata, account lifecycle, and size-validation design.
3. Implement the helper and the failure-path tests before connecting the UI.
4. Add the Settings display and lifecycle tests, then run the full project checks.
5. Complete and record the Chrome test round before treating the feature as ready.

The rollback removes only this optional usage calculation and display. The
previous removal of account-wide storage counts remains, along with normal sync,
sync history, and storage-full upload error handling.
