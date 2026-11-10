# FavoritePod code guide

This guide maps the current implementation. Function signatures and invariants
live in the linked source files; release tasks live in the
[implementation plan](../planning/implementation-plan.md).

## Project structure

| Location                                                     | Responsibility                                      |
| ------------------------------------------------------------ | --------------------------------------------------- |
| [src/popup/](../../src/popup/)                               | Toolbar home and bookmark save/review               |
| [src/dashboard/](../../src/dashboard/)                       | Library, folders, settings, drag/drop, and previews |
| [src/background/](../../src/background/)                     | Service worker, alarms, and context menus           |
| [src/core/](../../src/core/)                                 | Persistence, merge, import/export, URLs, and Drive  |
| [src/components/](../../src/components/)                     | Shared dialogs, loading, and UI components          |
| [src/styles/](../../src/styles/)                             | Global styles and semantic theme tokens             |
| [public/manifest.json](../../public/manifest.json)           | Chrome entry points, permissions, and OAuth         |
| [vite.config.ts](../../vite.config.ts)                       | Vite/CRXJS build and development reload             |
| [scripts/package-store.mjs](../../scripts/package-store.mjs) | Store ZIP packaging                                 |

The stack is TypeScript, React, Vite/CRXJS, Tailwind CSS, Dexie, Zod, and fflate.
[package.json](../../package.json) records the dependencies and commands.

## Storage and synchronization

- [types.ts](../../src/core/types.ts) defines groups, favorites, thumbnails,
  snapshots, and Drive metadata.
- [db.ts](../../src/core/db.ts) defines IndexedDB tables and migrations.
  [storage.ts](../../src/core/storage.ts) owns library mutations and local settings.
- [hlc.ts](../../src/core/hlc.ts), [merge.ts](../../src/core/merge.ts), and
  [ordering.ts](../../src/core/ordering.ts) implement field clocks, deterministic
  merge, and fractional order keys. Preserve tombstones and clock updates.
- [drive-auth.ts](../../src/core/drive-auth.ts) manages Chrome Identity tokens and
  connected-account metadata. Disconnect is profile-specific and preserves
  local library data and remote Drive files.
- [drive-files.ts](../../src/core/drive-files.ts) reads/writes per-device state;
  [drive-assets.ts](../../src/core/drive-assets.ts) handles preview files in
  Drive's hidden appDataFolder.
- [drive-sync.ts](../../src/core/drive-sync.ts) coordinates synchronization;
  [drive-sync-triggers.ts](../../src/core/drive-sync-triggers.ts) and
  [drive-sync-history.ts](../../src/core/drive-sync-history.ts) handle triggering
  and local history.

The extension requests only the drive.appdata OAuth scope. It does not operate
a developer backend for library data. A disconnected profile must not start
background authentication or sync.

## Saving and opening pages

The toolbar flow is in [PopupApp.tsx](../../src/popup/PopupApp.tsx) and
[BookmarkDialog.tsx](../../src/popup/BookmarkDialog.tsx).
[popup-thumbnail.ts](../../src/core/popup-thumbnail.ts) handles toolbar capture;
[thumbnail.ts](../../src/core/thumbnail.ts) handles preview conversion and hashing.
The initial bookmark is saved automatically; Save confirms edits.

Use [validation.ts](../../src/core/validation.ts) for allowed address formats and
[file-links.ts](../../src/core/file-links.ts) for opening, local path overrides,
and availability checks. Local access requires Chrome's separate file-access
switch. Availability checks cancel the response body; original file contents
are not cached or uploaded by sync.

[optional-features.ts](../../src/core/optional-features.ts) manages optional
permissions. [discovery.ts](../../src/core/discovery.ts) uses Chrome Top sites;
it does not backfill with History. [context-menus.ts](../../src/background/context-menus.ts)
opens the save form for the selected page or link.

## Import and export

[archive.ts](../../src/core/archive.ts) defines ZIP validation and limits.
[export.ts](../../src/core/export.ts) exports the selected library;
[import.ts](../../src/core/import.ts) validates and applies copy, update, or
replace imports. Replace mode snapshots the library first.

Chrome HTML handling is in [parse-chrome-bookmarks.ts](../../src/core/parse-chrome-bookmarks.ts),
[import-chrome.ts](../../src/core/import-chrome.ts), and
[export-chrome.ts](../../src/core/export-chrome.ts). Imported HTML is parsed as
data, never executed. See the [schema guide](schema-versions.md) for ZIP versions.

## UI and resource ownership

Use existing components and the [design guide](design-guide.md).
[FavoriteCollection.tsx](../../src/dashboard/components/FavoriteCollection.tsx)
virtualizes rows. [thumbnail-resources.ts](../../src/dashboard/thumbnail-resources.ts)
shares object URLs; [thumbnail-visibility.ts](../../src/dashboard/thumbnail-visibility.ts)
and [viewport-buffer.ts](../../src/dashboard/viewport-buffer.ts) control loading.
Release resources through their existing owners.

[resize-observer.ts](../../src/dashboard/resize-observer.ts) batches geometry
updates into animation frames. Keep drag cancellation synchronous and preserve
keyboard focus across virtualized rows. The accepted large-library limitations
are recorded in the [performance checklist](../testing/phase-10.2-manual-test.md).

## Development and debugging

Run `npm ci`, then `npm run dev`. Load `dist/` unpacked in Chrome. Stop the dev
server before `npm run build`; both write to the same directory.

Inspect popup and dashboard DevTools separately. Open the service worker's
DevTools from `chrome://extensions`. For file failures, check file access, the
original file's existence, and path overrides. For Drive sign-in failures, check
that the OAuth client and extension IDs match.

Tests run with `npm test`; use `npm run type-check`, `npm run lint`,
`npm run format:check`, and `npm run build` before handing off application changes.
Manual Chrome checks are in [testing/](../testing/).

Use `npm run package:store` for an upload ZIP. It preserves the local manifest
key while omitting it from the store package. OAuth configuration is shared by
both builds unless explicitly configured otherwise; see the
[publishing checklist](../publishing/README.md).
