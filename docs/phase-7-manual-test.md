# Phase 7 Manual Test

Manual Chrome acceptance was completed on 2026-11-04 per user report. This
acceptance covers Chrome only.

Automated archive tests cover ZIP validation, URL safety, scoped export, copy
imports, preview round-trips, replace snapshots, and transaction rollback. Run
the checks below in Chrome with the built extension to verify downloads, file
picker/drop behavior, and the dashboard flow.

## Export

1. [x] Build the extension and load `dist/` as an unpacked extension. Create a
   parent group with a nested group, then save favorites with and without
   previews in both groups.
2. [x] Open the launcher and choose **Export library**. Confirm all groups are
   selected, download the ZIP, and inspect it. `launcher.json` should contain
   schema version 1, active group and favorite records, and device/timestamp
   metadata. Soft-deleted groups and favorites should be omitted; referenced
   images should be under `previews/<sha256>.jpg`.
3. [x] Export only the nested group. Confirm the parent group is retained for
   hierarchy, the nested group's favorites are included, and sibling favorites
   are omitted.
4. [x] Confirm the browser downloads a `.zip` file and the launcher remains usable.

## Import

1. [x] In a second Chrome profile with the extension loaded, open **Import library**.
   Load an exported ZIP with both the file picker and drag/drop. Confirm the
   preview reports the archive's groups, favorites, and preview count.
2. [x] Import as **Merge as copy**. Confirm a new `Imported: <filename>` group is
   created, nested groups and favorites appear under it, and existing IDs and
   favorites remain unchanged.
3. [x] Export that imported library, then import it in the first profile using
   **Update from source**. Confirm matching IDs update and unrelated records
   remain.
4. [x] Use **Replace library** with the same archive. Confirm the library matches
   the archive, the prior data remains available as a snapshot in IndexedDB,
   and the active group selection returns to All favorites.
5. [x] Try a ZIP with no `launcher.json`, a future schema version, a `javascript:`
   favorite URL, a missing referenced preview, and a corrupted or hash-mismatched
   preview. Each archive should be rejected before any library data changes.
6. [x] Import an archive with several hundred items. Confirm progress advances and
   the dashboard remains responsive after completion.

## Verification

- [x] Console: no errors in the dashboard.
- [x] Application > IndexedDB > `FavoritePod`: inspect `groups`, `items`,
  `thumbnails`, and `snapshots` after each mode.
- [x] Confirm restored preview images display after closing and reopening the
  dashboard.
