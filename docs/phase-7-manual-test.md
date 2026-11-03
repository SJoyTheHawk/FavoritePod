# Phase 7 Manual Test

Automated archive tests cover ZIP validation, URL safety, scoped export, copy
imports, preview round-trips, replace snapshots, and transaction rollback. Run
the checks below in Chrome with the built extension to verify downloads, file
picker/drop behavior, and the dashboard flow.

## Export

1. Build the extension and load `dist/` as an unpacked extension. Create a
   parent group with a nested group, then save favorites with and without
   previews in both groups.
2. Open the launcher and choose **Export library**. Confirm all groups are
   selected, download the ZIP, and inspect it. `launcher.json` should contain
   schema version 1, group and item records, and device/timestamp metadata;
   referenced images should be under `previews/<sha256>.jpg`.
3. Export only the nested group. Confirm the parent group is retained for
   hierarchy, the nested group's favorites are included, and sibling favorites
   are omitted.
4. Confirm the browser downloads a `.zip` file and the launcher remains usable.

## Import

1. In a second Chrome profile with the extension loaded, open **Import library**.
   Load an exported ZIP with both the file picker and drag/drop. Confirm the
   preview reports the archive's groups, favorites, and preview count.
2. Import as **Merge as copy**. Confirm a new `Imported: <filename>` group is
   created, nested groups and favorites appear under it, and existing IDs and
   favorites remain unchanged.
3. Export that imported library, then import it in the first profile using
   **Update from source**. Confirm matching IDs update and unrelated records
   remain.
4. Use **Replace library** with the same archive. Confirm the library matches
   the archive, the prior data remains available as a snapshot in IndexedDB,
   and the active group selection returns to All favorites.
5. Try a ZIP with no `launcher.json`, a future schema version, a `javascript:`
   favorite URL, a missing referenced preview, and a corrupted or hash-mismatched
   preview. Each archive should be rejected before any library data changes.
6. Import an archive with several hundred items. Confirm progress advances and
   the dashboard remains responsive after completion.

## Verification

- Console: no errors in the dashboard.
- Application > IndexedDB > `FavoritePod`: inspect `groups`, `items`,
  `thumbnails`, and `snapshots` after each mode.
- Confirm restored preview images display after closing and reopening the
  dashboard.
