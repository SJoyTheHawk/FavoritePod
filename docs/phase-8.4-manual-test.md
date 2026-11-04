# Phase 8.4 Manual Verification

Use two Chrome profiles with the same approved Google test account. Build the
extension and load the unpacked `dist` directory in both profiles:

```bash
npm run build
```

Keep the profiles on the same extension build so they use the same Drive app-data
format. Each profile has its own local library and device ID.

## First connection

1. In Profile A, connect Google Drive and add a group and favorite. In Profile B,
   connect the same account and add a different group and favorite.
2. Open the dashboard in Profile B. The first-sync dialog should show the local
   and Drive item/group counts and offer Merge, Replace local with Drive, and
   Replace Drive with local.
3. Choose **Merge local and Drive data**. Confirm both profiles show both
   favorites after sync.
4. Repeat with a fresh test account or clear its app-data test files and choose
   each replace option once. Confirm the local snapshot is retained when a
   replacement is selected.

## Conflicts and deletion

1. With both profiles synced, edit the title of the same favorite on Profile A
   and its URL on Profile B before either profile syncs.
2. Run **Sync now** in both profiles. The merged favorite should contain both
   edits, and a later sync should not revert either field.
3. Delete a favorite on Profile A, wait for sync, then open or sync Profile B.
   The favorite should disappear there too.
4. Group-cycle repair is covered by the automated sync test, which imports a
   reciprocal parent cycle from Drive and confirms the stored tree is repaired.

## Triggers and recovery

1. With the dashboard open, make a library change and wait 10 seconds. Confirm
   Drive syncs without pressing **Sync now**.
2. Make a change from the extension popup and close it immediately. The service
   worker alarm should sync it after Chrome’s minimum alarm delay (about 30
   seconds). To inspect the 15-minute periodic alarm, open the service worker
   console from `chrome://extensions` and run `await chrome.alarms.getAll()`.
3. Go offline, make a library change, then reconnect. The online trigger should
   sync the queued local state.
4. Open two dashboards and start sync in both. The second context should skip
   while the first holds the sync lock; after the first completes, Sync now
   should succeed.
5. Confirm Drive account switching still asks before changing accounts and that
   the new account receives a first-sync flow.

Automated coverage for the merge orchestration, retry policy, sync lock, and
deferred device-file cache is in `drive-sync.test.ts` and `drive-files.test.ts`.
