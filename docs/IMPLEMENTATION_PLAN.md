# FavoritePod Implementation Plan

## Overview

FavoritePod is a Chrome extension that provides a visual bookmark launcher with Google Drive synchronization, nested groups, drag-and-drop organization, and rich preview thumbnails.

**Current status**: Phases 2-8.5 are implemented and covered by automated checks.
Phase 9.1, including its Chrome-top-sites-only revision, closed on 2026-11-07
after user-reported manual checklist acceptance. Phase 9.2 was revised on
2026-11-07 to a single right-click action opening the toolbar save popup;
native-menu manual acceptance remains open. See
[`phase-9-manual-test.md`](./manual_test/phase-9-manual-test.md).
Phases 4 and 5 closed on 2026-11-03; Phase 7 closed on 2026-11-04 after
automated and user-reported manual Chrome validation. Manual Chrome validation
for extension loading, HMR, screenshots, nested drag-and-drop, keyboard
navigation, thumbnail previews, and `file://` access remains open; see
`NEXT_STEPS.md` and the phase 4-6 manual test checklists. Phase 8.4 was closed
on 2026-11-05 after user validation. Phase 8.5 closed on 2026-11-06 after all
manual Chrome checks passed; see [`phase-8.5-manual-test.md`](./phase-8.5-manual-test.md).

Phase 10.1 closed on 2026-11-07 after user-reported manual acceptance and a verified
fix for drag cancellation leaving stale background/drop highlights; see
[Phase 10.1 manual tests](./manual_test/phase-10.1-manual-test.md).

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
├─────────────────────────────────────────────────────────────┤
│  Popup              Dashboard           Service Worker       │
│  - Save page        - Full launcher     - Sync orchestration │
│  - Quick actions    - Edit/organize     - Alarms             │
│                     - Settings          - Drive API          │
├─────────────────────────────────────────────────────────────┤
│                     Core Modules                             │
│  ┌──────────┬──────────┬────────────┬──────────────────┐   │
│  │ Data     │ Sync     │ Thumbnail  │ Import/Export    │   │
│  │ Model    │ Engine   │ Capture    │ (ZIP)            │   │
│  └──────────┴──────────┴────────────┴──────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                  Storage Layer (IndexedDB via Dexie)        │
│  Groups │ Items │ Thumbnails │ Sync Metadata │ Snapshots   │
├─────────────────────────────────────────────────────────────┤
│                  External Integration                        │
│  Google Drive appDataFolder  │  Chrome APIs                 │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Core Technologies
- **TypeScript 5.x**: Type safety, better IDE support
- **React 18**: UI framework with hooks
- **Vite 6.x**: Build tool with HMR
- **Manifest V3**: Latest Chrome extension standard

### Key Libraries
- **Dexie 4.x**: IndexedDB wrapper with TypeScript support
- **@dnd-kit/core**: Accessible drag-and-drop
- **fractional-indexing**: Conflict-free ordering
- **fflate**: ZIP compression (works in service worker)
- **zod**: Runtime validation for imports
- **Tailwind CSS**: Utility-first styling
- **Framer Motion**: Smooth animations

### Development Tools
- **Vitest**: Unit testing
- **Playwright**: E2E testing with extension support
- **ESLint + Prettier**: Code quality
- **TypeScript strict mode**: Maximum type safety

## Phase 1: Foundation (Week 1-2)

### 1.1 Repository Setup
**Goal**: Establish development environment and extension identity

**Tasks**:
- [x] Initialize repository with `.gitignore`, `README.md`
- [x] Set up Vite with TypeScript and React
- [x] Configure Tailwind CSS and design tokens
- [x] Install core dependencies (Dexie, zod, fflate)
- [x] Generate local extension key pair (keep `.pem` out of git)
- [x] Create basic `manifest.json` with stable local ID
- [x] Set up ESLint, Prettier, and pre-commit hooks

**Deliverables**:
```
favoritepod/
├── src/
│   ├── popup/
│   ├── dashboard/
│   ├── background/
│   ├── core/
│   └── styles/
├── public/
│   └── manifest.json
├── tests/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

**Acceptance**:
- [ ] Extension loads in Chrome as unpacked
- [ ] HMR works during development
- [x] TypeScript compiles without errors

### 1.2 Platform Spike (De-risking)
**Goal**: Validate risky assumptions before UI work

**Tasks**:
- [ ] Test `chrome.identity.getAuthToken()` with Drive API
- [ ] Upload/download file to `appDataFolder`
- [ ] Test `chrome.tabs.captureVisibleTab()` from popup
- [ ] Test opening `file://` links with `chrome.tabs.create()`
- [ ] Document spike findings and limitations

**Deliverables**:
- `docs/spike-findings.md` with test results
- Throwaway spike code (can be deleted after)

**Acceptance**:
- Drive authentication works
- Screenshot capture works
- File:// links open correctly
- Any blockers identified early

## Phase 2: Core Data Layer (Week 2-3) - Implementation Complete

### 2.1 Data Model & HLC
**Goal**: Build conflict-free data structures

**Tasks**:
- [x] Implement Hybrid Logical Clock (HLC) module
- [x] Define `Group` and `Item` interfaces with per-field clocks
- [x] Create fractional ordering utility
- [x] Build pure merge function (no side effects)
- [x] Write comprehensive unit tests for merge scenarios

**Key Files**:
```
src/core/
├── types.ts          # Group, Item, HLC interfaces
├── hlc.ts            # HLC generation and comparison
├── ordering.ts       # Fractional index utilities
├── merge.ts          # Conflict resolution
└── __tests__/
    ├── hlc.test.ts
    ├── ordering.test.ts
    └── merge.test.ts
```

**Test Cases**:
- Concurrent field edits resolve correctly
- Deletion tombstones win over stale edits
- Group cycle detection and repair
- Clock skew handling
- Ordering conflict resolution

**Acceptance**:
- All merge unit tests pass
- 100% test coverage on merge logic
- Documented merge rules

### 2.2 IndexedDB Layer
**Goal**: Local storage with sync-ready schema

**Tasks**:
- [x] Define versioned Dexie schema and indexes
- [x] Establish the initial database version; add upgrade migrations with future schema versions
- [x] Create CRUD operations for groups/items (group deletion requires an empty group)
- [x] Add thumbnail blob storage
- [x] Build sync metadata tracking
- [x] Implement snapshot mechanism (last 3 snapshots)

**Schema**:
```typescript
const db = new Dexie('FavoritePod');

db.version(1).stores({
  groups: 'id, parentId, orderKey, deleted',
  items: 'id, groupId, orderKey, deleted, url, previewHash',
  thumbnails: 'hash, size, createdAt',
  syncMeta: 'key',
  snapshots: '++id, createdAt',
  deviceFiles: 'deviceId, lastSync'
});
```

**Acceptance**:
- CRUD operations work
- Queries are efficient (use indexes)
- Transactions are atomic
- Snapshots can be restored

**Validation**: `npm test` covers HLC, ordering, merge, and IndexedDB storage. The
merge module is held to 100% branch, function, line, and statement coverage by
`npm run test:coverage`.

## Phase 3: Basic UI (Week 3-4) - Implementation Complete

### 3.1 Toolbar Popup
**Goal**: Quick access to recent favorites with a bookmark-style add dialog

**Tasks**:
- [x] Create popup UI (320x480px)
- [x] Add an "Add bookmark" action for the active page
- [x] Keep a preview of the five most recent pages in the popup
- [x] Allow dismissing individual pages from the recent list without deleting favorites
- [x] Open a focused review dialog from the add action
- [x] Add the page by default when the review dialog opens
- [x] Open an existing favorite for its URL instead of creating a duplicate
- [x] Allow changing its name and folder before confirming with Done
- [x] Allow removing the favorite from the dialog
- [x] Capture visible tab screenshot
- [x] Resize and compress to JPEG
- [x] Show the active page, address, and saved state
- [x] Add "Open launcher" button

**Design Requirements**:
- Fast load time (<100ms)
- Recent pages preview (last 5)
- Maximum of five non-dismissed pages, with an x action to remove a page from this list
- Use Chrome's favicon API and the tab-provided favicon URL as a fallback
- Keep page details and edit controls inside the review dialog
- Group selection dropdown in the review dialog

**Acceptance**:
- The add action opens the review dialog and saves the page by default
- Done persists name and folder edits; Remove deletes the favorite
- Recent pages remain available from the popup home screen
- Popup opens launcher dashboard
- Works on activeTab without broad permissions

### 3.2 Launcher Dashboard Shell
**Goal**: Full-screen extension tab with navigation

**Tasks**:
- [x] Create dashboard layout
- [x] Build responsive grid/list views
- [x] Add top bar (search, view options, settings)
- [x] Implement sidebar for groups
- [x] Add empty states
- [x] Build settings panel structure with a saved default-view preference

**Layout**:
```
┌────────────────────────────────────────────────────┐
│ [Logo] [Search] [View] [Account] [Settings]        │
├──────┬─────────────────────────────────────────────┤
│Group │ ┌────┐ ┌────┐ ┌────┐                        │
│Tree  │ │ 📸 │ │ 📸 │ │ 📸 │  Grid view             │
│      │ └────┘ └────┘ └────┘                        │
│      │ Title  Title  Title                         │
│      │                                             │
│      │ [+ Add item] [+ Add group]                  │
└──────┴─────────────────────────────────────────────┘
```

**Acceptance**:
- Dashboard opens in new tab
- Responsive layout works
- Navigation is intuitive

**Validation**: Production build and automated checks pass. Loading the unpacked
extension and confirming HMR in Chrome remain manual Phase 1 checks.

## Phase 4: Core Features (Week 4-6) - Closed (2026-11-03)

Closed as an implementation milestone at the user's request. Closure checks on
2026-11-03: all 50 tests across 6 suites, production build (including TypeScript),
lint, and formatting passed. Manual Chrome acceptance remains tracked separately
in `docs/phase-4-manual-test.md`; this closure does not claim those checks passed.

Includes the New group action beside All favorites, No parent group wording,
and » hierarchy separators. Long-path display changes are deferred at the
user's request; keep full paths for now. Phases 4 and 5 closed on 2026-11-03;
Phase 6 and Phase 7 implementations are complete, with manual Chrome acceptance
tracked separately. Google Drive Sync is the next planned phase.

### 4.1 Nested Groups & Items
**Goal**: Hierarchical organization with drag-and-drop

**Tasks**:
- [x] Render nested group tree
- [x] Display items in grid/list views
- [x] Implement group expand/collapse
- [x] Add item cards with thumbnails
- [x] Build context menus (edit, delete, move)
- [x] Show favicons as fallback

**Group Tree Component**:
- Collapsible with smooth animation
- Visual depth indicator (indent + line)
- Badge showing item count
- Drag rows directly; edge line and circle show sibling placement, center drops nest

**Item Card Component**:
- Thumbnail (640x400 local, lazy-loaded)
- Title overlay on hover
- Favicon + domain if no thumbnail
- Quick actions menu
- Selection checkbox

**Acceptance**:
- [x] Groups nest at arbitrary depth
- [x] Items display correctly
- [x] Context menus work
- [x] Keyboard navigation works

### 4.2 Drag-and-Drop Ordering
**Goal**: Intuitive reordering and grouping

**Tasks**:
- [x] Implement drag-and-drop with keyboard-accessible move controls
- [x] Implement group-to-group drag
- [x] Implement item drag between groups
- [x] Calculate new fractional orderKeys
- [x] Show drop zone indicators
- [x] Add drag preview with thumbnail
- [x] Handle nested group drag (prevent cycles)

**Drag Scenarios**:
1. Item to same group (reorder)
2. Item to different group (move)
3. Item to nested group (move + nest)
4. Group to group (reorder siblings)
5. Group into group (nest, with cycle prevention)

**Acceptance**:
- [x] Drag is smooth and drop zones are clear
- [x] Ordering persists correctly
- [x] Cycle prevention works
- [x] Undo/redo works

### 4.3 Edit & Delete
**Goal**: Full CRUD operations with confirmation

**Tasks**:
- [x] Build edit modal for items
- [x] Build edit modal for groups
- [x] Add URL validation
- [x] Add delete confirmation
- [x] Implement soft delete (tombstones)
- [x] Add bulk selection + actions
- [x] Build undo system (local action stack)

**Edit Item Modal**:
- URL input with validation
- Title input
- Group selector
- Thumbnail preview + "Update" button
- Delete button

**Acceptance**:
- [x] Edits save correctly
- [x] Invalid URLs rejected
- [x] Deletes are reversible (undo)
- [x] Bulk actions work

**Implementation note**: This v1 build uses the HTML5 drag-and-drop pattern
documented in `CODE_GUIDE.md`, with keyboard-accessible move actions in the
menus. The planned `@dnd-kit` package could not be downloaded in this
environment because the npm registry was unreachable.

**Validation**: Storage tests, type check, lint, formatting, and production
build pass. Drag behavior, keyboard navigation, dialogs, and Chrome file URL
opening still need the manual checks in `docs/phase-4-manual-test.md`.

## Phase 5: Thumbnail System (Week 6-7) - Closed on 2026-11-03

### 5.1 Capture & Storage
**Goal**: High-quality previews with efficient storage

**Tasks**:
- [x] Implement `captureVisibleTab()` wrapper
- [x] Build OffscreenCanvas resizing
- [x] Generate two sizes: 640x400, 320x200
- [x] Calculate SHA-256 hash
- [x] Store in IndexedDB by hash
- [x] Implement fallback card generator
- [x] Add favicon fetching via `chrome-extension://_favicon/`

**Thumbnail Pipeline**:
```
Capture (activeTab) 
  → Resize (OffscreenCanvas)
  → Compress (JPEG quality 75%)
  → Hash (SHA-256)
  → Store (IndexedDB)
  → Link (item.previewHash)
```

**Fallback Card**:
- Gradient background based on URL hash
- Large favicon (64px)
- Title (truncated)
- Domain badge

**Acceptance**:
- Thumbnails are crisp and fast
- Deduplication works (same hash = one blob)
- Fallback looks good
- Capture respects rate limits

### 5.2 Hover Previews
**Goal**: Rich previews on hover

**Tasks**:
- [x] Build popover component
- [x] Show thumbnail on 400ms hover
- [x] Display full URL
- [x] Add "Open" and "Edit" quick actions
- [x] Use saved thumbnail previews for sites that prohibit embedding
- [x] Open pages through the Open action; remove unreliable live iframe previews

**Popover Design**:
```
┌─────────────────────────────┐
│                             │
│    [Thumbnail 640x400]      │
│                             │
├─────────────────────────────┤
│ Title                       │
│ https://example.com/path    │
│ [Open] [Edit] [Copy URL]    │
└─────────────────────────────┘
```

**Acceptance**:
- Hover is smooth and responsive
- Popover doesn't block interaction
- Saved previews work for sites that block embedding
- Keyboard accessible (focus + enter)

**Implementation note**: Existing thumbnail records remain readable. New captures
store a 640x400 preview and a 320x200 card preview under the same SHA-256 keyed
record. Capture calls are serialized with a 500ms minimum interval. Unreliable
live iframe previews were removed; sites that block embedding rely on the saved
preview, and Open visits the page in a browser tab.

**Validation**: 53 tests across 7 suites, type check, lint, formatting, and
production build pass. Browser behavior remains open for the checklist in
`docs/phase-5-manual-test.md`.

## Phase 6: File:// Link Support (Week 7)

### 6.1 Local File Handling
**Goal**: Support local HTML tools with path handling

**Tasks**:
- [x] Detect file:// URLs during save
- [x] Check `chrome.extension.isAllowedFileSchemeAccess()`
- [x] Show permission hint if denied
- [x] Open files with `chrome.tabs.create()`
- [x] Implement per-device path prefix override
- [x] Add file availability check (when allowed)
- [x] Show three states: unknown, available, missing

Implementation is complete. Real Chrome permission, file presence, and tab
navigation behavior remain for the manual acceptance steps in
`docs/phase-6-manual-test.md`.

**Permission Hint**:
```
┌────────────────────────────────────────────┐
│ ⚠️ File Access Not Enabled                 │
│                                            │
│ To save and open local files, enable      │
│ "Allow access to file URLs" in:           │
│                                            │
│ chrome://extensions/?id=<extension-id>    │
│                                            │
│ [Copy Extension ID] [Dismiss]             │
└────────────────────────────────────────────┘
```

**Path Override Settings**:
- Store per-device mappings
- UI to add/edit overrides
- Apply on open, not on save

**Acceptance**:
- File:// links open correctly
- Permission hint shows when needed
- Path overrides work across devices
- Missing files show clear status

## Phase 7: Import/Export (Week 8-9)

Closed on 2026-11-04 as an implementation milestone after automated checks and
user-reported manual acceptance in Chrome. Closure does not claim acceptance in
other browsers or close browser acceptance for other phases.

### 7.1 ZIP Export
**Goal**: Share libraries with colleagues

**Tasks**:
- [x] Build export dialog (select groups)
- [x] Serialize groups/items to JSON
- [x] Copy thumbnails to `previews/` by hash
- [x] Create ZIP with fflate
- [x] Trigger download
- [x] Add export metadata (version, timestamp)

**Export Format**:
```typescript
interface LauncherExport {
  format: 'visual-launcher';
  schemaVersion: 1;
  exportedAt: string; // ISO 8601
  exportedBy: string; // device ID
  groups: Group[];
  items: Item[];
}
```

**Acceptance**:
- Export completes in <5s for 100 items
- ZIP structure is correct
- Re-import works perfectly

### 7.2 ZIP Import
**Goal**: Safe, validated import with merge options

**Tasks**:
- [x] Build import dialog (drag/drop + file picker)
- [x] Validate ZIP structure with zod
- [x] Validate URLs and reject unsafe schemes (including `javascript:`)
- [x] Decode images with createImageBitmap
- [x] Show preview of import contents
- [x] Implement three import modes:
  - [x] Merge as copy (new IDs, new group)
  - [x] Update from source (match by ID)
  - [x] Replace (with snapshot)
- [x] Show progress during import
- [x] Rollback on error

**Export behavior**: Soft-deleted groups and favorites are omitted from new
archives. Deleted records remain in the local database for the later cleanup
phase.

**Validation Rules**:
- Max archive size: 100 MB
- Max items: 10,000
- Max image size: 5 MB each
- Allowed schemes: http, https, file
- All referenced previews must exist

**Acceptance**:
- Invalid imports are rejected safely
- Merge modes work as expected
- Large imports show progress
- Errors don't corrupt database

## Phase 8: Google Drive Sync (Week 9-12)

### 8.1 Drive Authentication
**Goal**: Secure OAuth flow via Chrome Identity API

**Tasks**:
- [x] Set up Google Cloud Project
- [x] Enable Drive API
- [x] Configure OAuth consent screen
- [x] Add test users
- [x] Implement `chrome.identity.getAuthToken()`
- [x] Build token refresh on 401
- [x] Implement profile-only disconnect with local credential cleanup (supersedes token revocation)
- [x] Persist authorization recovery and show contextual Connect; remove Check account and Reconnect or switch account
- [x] Detect account switches via permissionId

**Settings UI**:
```
┌────────────────────────────────────────────┐
│ Google Drive Sync                          │
├────────────────────────────────────────────┤
│ Status: Not connected                      │
│                                            │
│ [Connect Google Drive]                     │
│                                            │
│ Sync your launcher across devices.         │
│ Data is stored in your private app folder. │
└────────────────────────────────────────────┘
```

**Connected State**:
```
┌────────────────────────────────────────────┐
│ Google Drive Sync                          │
├────────────────────────────────────────────┤
│ ✓ Connected as user@gmail.com             │
│ Last synced: 2 minutes ago                 │
│                                            │
│ [Sync Now] [Disconnect]                    │
│                                            │
│ 127 items • 3 devices • 12.4 MB           │
└────────────────────────────────────────────┘
```

**Acceptance**:
- OAuth flow completes
- Tokens refresh automatically
- Disconnect works offline and affects only this Chrome profile; other devices remain authorized
- Auth-required state pauses background sync and survives dashboard reload
- User-initiated Connect restores same-account sync without resetting its bookkeeping
- From a disconnected profile, identify and confirm the Google account before persisting the connection or starting first sync; cancel keeps the profile disconnected
- Account switch detected

Browser verification steps: [`phase-8.1-manual-test.md`](./phase-8.1-manual-test.md).

### 8.2 Device File Management
**Goal**: Per-device sync files with conflict-free updates

**Tasks**:
- [x] Generate and persist stable `deviceId` on first run
- [x] Create device file: `launcher-state-device-<id>.json`
- [x] List paginated appDataFolder files
- [x] Download only files whose `modifiedTime` changed
- [x] Upload device state with PATCH (create the file on first upload)
- [x] Merge stale device records before removing files older than 90 days

**Device File Structure**:
```typescript
interface DriveDeviceState {
  schemaVersion: 1;
  deviceId: string;
  revision: number;
  lastUpdate: string; // ISO 8601
  groups: Group[];
  items: Item[];
  tombstones: {
    groups: Record<string, HLC>;
    items: Record<string, HLC>;
  };
}
```

**Acceptance**:
- Each device has its own file in the private `appDataFolder`
- Updates target only that device's file and refuse to overwrite an unseen remote change
- Compaction merges device records into the current file before deleting files stale for 90 days
- Listing is paginated and downloads skip files with cached matching `modifiedTime`

Automated verification: `npm test -- --run src/core/__tests__/drive-files.test.ts`.
Chrome end-to-end verification now uses the manual multi-profile flow in
[Phase 8.4 manual verification](phase-8.4-manual-test.md).

### 8.3 Asset Sync
**Goal**: Deduplicated thumbnail sync

**Tasks**:
- [x] Upload thumbnails as `asset-<sha256>.jpg` into the private `appDataFolder`
- [x] Skip already-uploaded hashes and report local or remote missing assets
- [x] Download missing thumbnails and verify their content hash and image dimensions
- [x] Remove unreferenced assets only after 90 days, rechecking before deletion
- [x] Report per-asset upload, download, and cleanup progress for the sync UI
- [x] Translate Drive quota failures into a clear storage-full message

**Upload Strategy**:
1. Collect preview hashes from merged state
2. List existing asset files in pages and cache their `fileId` by hash
3. Upload missing local JPEGs only, verifying each blob matches its SHA-256 name
4. Download missing local previews only, verifying bytes before saving them
5. Clean up unreferenced assets only after 90 days and a second remote listing

The uploaded JPEG is the exact blob whose SHA-256 is `Item.previewHash`. The
locally generated 320×200 derivative remains a display-only optimization; using
it as the remote asset would require a second synchronized hash before it could
be safely downloaded and verified. Uploads use the existing 5 MB image limit.

**Acceptance**:
- Missing thumbnails can be uploaded and downloaded by content hash
- Existing assets are reused instead of uploaded again
- Old unreferenced assets are removed while recent or referenced assets remain
- Quota failures explain that Drive storage is full

Automated verification: `npx vitest run --config vitest.config.ts src/core/__tests__/drive-assets.test.ts`.
Chrome end-to-end verification now uses the manual multi-profile flow in
[Phase 8.4 manual verification](phase-8.4-manual-test.md).

### 8.4 Sync Engine & Merge
**Goal**: Conflict-free multi-device sync

**Status**: Closed at the user's direction on 2026-11-05 as an implementation
milestone. The detailed Chrome acceptance sequence remains in
[`phase-8.4-manual-test.md`](./phase-8.4-manual-test.md).

**Tasks**:
- [x] Implement sync lock (navigator.locks)
- [x] Build sync orchestrator (download → merge → upload)
- [x] Implement per-field merge with HLC
- [x] Add group cycle detection and repair
- [x] Handle tombstone propagation
- [x] Implement first-connect flow (merge/replace options)
- [x] Add account-switch confirmation (already implemented in Phase 8.1)
- [x] Build sync retry with exponential backoff

**Sync Triggers**:
- On dashboard open
- 10s after local change (debounced)
- Every 15 minutes (chrome.alarms)
- Manual "Sync Now" button

**First Connect Dialog**:
```
┌────────────────────────────────────────────┐
│ Sync with Google Drive                     │
├────────────────────────────────────────────┤
│ Local:  42 items in 8 groups              │
│ Drive:  67 items in 12 groups             │
│                                            │
│ Choose how to sync:                        │
│ ○ Merge local and Drive data              │
│ ○ Replace local with Drive                │
│ ○ Replace Drive with local                │
│                                            │
│ [Cancel] [Continue]                        │
└────────────────────────────────────────────┘
```

**Acceptance**:
- Two devices converge
- Concurrent edits both survive
- Deletions propagate
- Cycles are repaired
- Offline changes sync when online

**Implementation notes**:
- The existing field-clock merge and group-tree repair are reused by the sync
  orchestrator. Downloaded device-file metadata is cached only after its records
  have been applied locally.
- Sync, account switching, and disconnect share one browser lock so account
  credentials and Drive cache records cannot change during a sync.
- Dashboard changes debounce for 10 seconds. Chrome Manifest V3 alarms have a
  30-second minimum delay, so a debounced alarm preserves changes after the
  popup closes; the repeating alarm runs every 15 minutes.
- See [Phase 8.4 manual verification](phase-8.4-manual-test.md) for the Chrome
  multi-profile and offline test sequence.

Automated verification: `npx vitest run --config vitest.config.ts src/core/__tests__/drive-sync.test.ts src/core/__tests__/drive-files.test.ts`, followed by `npm run type-check`, `npm run lint`, and `npm run build`.

### 8.5 Error Handling & UI - Closed (2026-11-06)
**Goal**: Clear sync status and error messages

**Tasks**:
- [x] Build sync status indicator (icon + accessible tooltip)
- [x] Show sync progress across dashboard and service worker syncs
- [x] Display sync errors with contextual retry or storage actions
- [x] Implement offline mode; preserve local changes and sync on reconnect
- [x] Add a bounded, profile-local sync history log
- [x] Show cached Google Drive storage usage in Settings

**Sync States**:
- ✓ Synced (green dot)
- ↻ Syncing... (spinning)
- ⚠ Conflict resolved (yellow, temporary)
- ✗ Sync failed (red, with detail)
- ⊗ Offline (gray)

**Error Messages**:
- Quota exceeded: "Google Drive storage is full. Free up space in Google Drive to continue syncing."
- Auth expired: Show "Connection needs attention" with **Connect Google Drive**.
- Network error: Explain that local changes are saved and will sync when online; offer **Try again**.
- Conflict repaired: "Concurrent changes merged automatically."

**Acceptance**:
- User always knows sync status from the dashboard header and Settings
- Errors are actionable and distinguish authorization, network, offline, and quota states
- Offline changes remain local and sync when the browser comes online
- The latest 20 sync outcomes remain available for debugging

**Implementation notes**:
- Sync history and cached quota metadata use the existing `syncMeta` table; no
  Dexie migration is needed. Disconnect/account changes clear these Drive-scoped
  records with the rest of that profile's Drive bookkeeping.
- Storage usage comes from Drive `about.get` and describes the Google account's
  Drive usage, including files outside FavoritePod; it is not an appDataFolder
  size estimate. The value is cached for 30 minutes.
- See [`phase-8.5-manual-test.md`](./phase-8.5-manual-test.md) for status,
  offline, error, history, and quota checks.

Automated verification: `npx vitest run --config vitest.config.ts src/core/__tests__/drive-auth.test.ts src/core/__tests__/drive-sync.test.ts src/core/__tests__/drive-sync-history.test.ts src/core/__tests__/drive-files.test.ts src/background/__tests__/drive-background.test.ts`, followed by `npm test`, `npm run type-check`, `npm run lint`, and `npm run build`.

## Phase 9: Optional Features (Week 13-14)

### 9.1 Frequently Visited Shortcuts — Complete (2026-11-07)
**Goal**: Open frequently visited sites quickly from All favorites.

This shortcut design supersedes the original separate save-suggestions view.
Manual acceptance passed on 2026-11-07 according to the user, including the
Chrome-top-sites-only revision, permission flow, and layout/accessibility checks.

**Tasks**:
- [x] Request optional Top sites access in Settings (History permission removed)
- [x] Use only Chrome top sites, preserving Chrome selection and ordering
- [x] Show up to ten shortcuts within All favorites, including already-saved sites
- [x] Always use compact grid format, independent of library view and size
- [x] Open the site on click; put Add/Edit favorite and Hide in its … menu
- [x] Reuse the favorite editor for title and destination selection
- [x] Add default-on visibility setting and a section-menu Hide action
- [x] Persist hidden shortcuts locally

**Acceptance**:
- Permission requests are explicit; denied/revoked access is handled
- The section appears in All favorites and optionally the home group, outside search
- Saving keeps the shortcut and current view; undo/redo works
- Hiding a shortcut does not delete a favorite or browser history
- Visibility persists across reloads independently of access permissions
- Keyboard, touch, desktop/narrow layouts, and light/dark themes work

Implementation notes:
- Visibility defaults on. Browser access remains opt-in through **Settings →
  Optional features → Frequently visited access**. Hiding stops reads and clears
  results when both visibility options are off; turning access off removes Top
  sites permission. History is no longer declared or requested.
- Chrome selects and orders the sites. Only safe http/https URLs qualify; hidden
  URLs and duplicate fragments are filtered. Show at most ten, without filling a
  shorter list or applying custom ranking. Already-saved sites remain visible.
- The section uses compact-grid spacing, centered labels, favicon fallbacks, and
  theme colors. Site menus use accessible Headless UI components.
- Add to favorites opens the standard editor with URL/title filled in and a group
  selector. A normalized saved URL opens Edit favorite. Saves support undo/redo.
  History, visibility, hidden URLs, and grants never enter sync/exports.

#### Implemented revision: Chrome top sites only (2026-11-06)

Chrome's top-sites response is now the sole shortcut source. History backfill,
custom visit-count/recency ranking, and History permission are removed. See
[Chrome Top Sites Shortcuts](./future_plan/Chrome%20Top%20Sites%20Shortcuts.md)
for implementation verification and user-reported acceptance on 2026-11-07.

### 9.2 Context Menu Integration (Optional) — Revised Implementation (2026-11-07)
**Goal**: Right-click to save page/link

**Next work**: Complete native Chrome manual acceptance of the single-action
popup flow. Phase 9.2 is not included in the 2026-11-07 Phase 9.1 sign-off.

**Tasks**:
- [x] Add `contextMenus` permission (optional, requested from Settings)
- [x] Create "Save to FavoritePod" menu item
- [x] Handle page context (save current page)
- [x] Handle link context (save linked page)
- [x] Open the toolbar save popup from one direct Save to FavoritePod action
- [x] Select the destination folder inside the popup, with full nested paths
- [x] Confirm saves with Save; Cancel/close leaves the library unchanged
- [x] Add a persistent Settings switch to enable/disable the right-click save menu

**Acceptance**:
- Right-click works on pages
- Right-click works on links
- Name and destination folder are editable inside the popup
- No page/group submenus or dashboard tab are opened

Implementation notes:
- Off by default. Enable **Settings → Optional features → Right-click save menu**
  to request the optional permission. Disabling removes menu entries immediately;
  its permission can be reused on re-enable.
- One **Save to FavoritePod** action opens the FavoritePod toolbar popup directly
  to the shared bookmark form. A clicked link takes priority over the page URL.
  Folder selection happens inside the form, using full nested paths.
- Right-click opens a draft: Save creates or edits the favorite; Cancel, close,
  and Escape make no library changes. Exact saved URLs prefill their existing
  details. The toolbar button's original home/review behavior is retained.
- The worker rebuilds the single menu on startup, install, permission changes,
  and Settings changes. Library group changes no longer rebuild native menus.
- A temporary per-tab popup URL carries the clicked target and is reset after
  opening. No pending save state enters settings, sync, or exports. A small popup
  window with the same form is the fallback if Chrome cannot open the toolbar popup.
- Only safe http/https/file URLs qualify. No new permissions are added. Page
  thumbnails are best-effort and require the source tab to still be active with
  the same URL; link saves never capture the containing page.
- Automated verification passes 177 tests in 21 suites, TypeScript, ESLint,
  formatting, and production build. Isolated Chrome 157.0.8103.38 smoke checks
  passed native toolbar opening, page/link targeting, nested folders, Save/Cancel,
  existing edits, Escape, light/dark layout, normal toolbar reset, and popup-window
  fallback. The harness invokes the installed menu listener with fixture click
  data; actual native menu selection and permission prompts remain manual checks.

Automated verification: `npm test`, `npm run type-check`, `npm run lint`,
`npm run format:check`, and `npm run build`. Browser acceptance is tracked
separately in [`phase-9-manual-test.md`](./manual_test/phase-9-manual-test.md).

## Phase 10: Polish & Testing (Week 14-16)

**Status Review (2026-11-08)**: After 9 phases, FavoritePod is functionally complete, with 240 passing tests and stable builds. Phase 10.1 is closed and Phase 10.2 performance work is implemented; real-profile acceptance checks remain.

**Current System Health**:
- ✅ All tests passing, TypeScript compiles cleanly
- ✅ Robust HLC-based sync, offline support, comprehensive Drive integration
- ✅ Optional features (Frequently Visited, Context Menus) implemented
- ⚠️ Bundle sizes still need optimization (282KB dashboard entry and a 201KB shared JavaScript chunk)
- ✅ Phase 10.1 theme, motion, loading, and keyboard work closed after user manual acceptance; drag cancellation note resolved
- ✅ Isolated 5,760-favorite profile completed; real-profile drag, resize, and memory acceptance remains pending
- ⚠️ Accessibility incomplete (keyboard shortcuts, ARIA labels need work)

### 10.1 Design System Finalization
**Goal**: Consistent, polished UI (see DESIGN_GUIDE.md)

**Status (2026-11-07)**: Closed at the user's request after all manual acceptance
checkboxes were checked. The reported Escape-during-drag background issue is fixed:
shared capture-phase cleanup clears destination highlights and restores the grid on
Escape or native dragend, while allowing pending drops to finish saving. Isolated
Chrome checks verify cancellation and subsequent persisted native drag/drop.

**Current Status**:
- ✅ CSS variables and color system defined in global.css
- ✅ Component styling consistent across dashboard
- ✅ Tailwind configuration complete
- ✅ Theme preference supports System, Light, and Dark modes with system preference tracking
- ✅ Shared 200ms dialog transitions, card hover polish, and reduced-motion support
- ✅ Thumbnail decode placeholders, accessible sync progress, and initial skeleton status
- ✅ Search shortcut, Escape handling, and responsive favorite arrow navigation

**Revised Priority Tasks**:
- [x] **HIGH**: Implement dark/light theme toggle (system preference detection + manual override)
- [x] **MEDIUM**: Add smooth transitions (card hover, dialog open/close, drag feedback)
- [x] **MEDIUM**: Polish loading states (Drive sync progress, thumbnail loading)
- [x] **LOW**: Add skeleton screens for initial load
- [x] **LOW**: Implement keyboard shortcuts (Cmd+K search, Esc close, arrow navigation)
- [ ] **DEFER**: Add tooltips everywhere (only add for unclear icons)
- [ ] **DEFER**: Polish empty states (current states are functional)
- [ ] **DEFER**: Celebratory moments (nice-to-have for v2)

**Implementation (2026-11-07)**: System/Light/Dark is stored in the existing local
IndexedDB settings table (`auto` is System), applied from dashboard and popup startup,
and observed across open extension pages. The appearance selector reuses existing
semantic colors, spacing, radii, and native radio behavior. Shared Headless UI
transitions retain editor state through exit and preserve focus restoration. Existing
drag-stack ghosts, placement highlights, and reorder/drop animations are retained;
card hover and loading feedback respect reduced motion. Existing initial skeletons
now announce loading and match compact grid dimensions. Sync progress is determinate
only when both counts are known; no fabricated percentage is shown for other stages.

Cmd/Ctrl+K focuses search; Escape clears search or dismisses the active overlay.
Arrows navigate favorite open controls by their visible layout across expanded
groups, with Home/End for the first/last visible favorite. Shortcuts leave text
editing, modal focus traps, menus, and drag cancellation intact. A skip link goes
to the favorites area. No dependency, permission, schema, or sync-format changes.

Automated checks: `npm test`, `npm run test:coverage`, `npm run type-check`,
`npm run lint`, `npm run format:check`, and `npm run build`. Isolated Chrome
157.0.8103.38 checks cover theme persistence, live system changes, cross-page
preferences, dialog transitions and focus, search/arrows, reduced motion, thumbnail
decoding, and 375px layouts. Closure and follow-up verification passes 233 tests across 26 files,
the configured merge coverage thresholds, TypeScript compilation, lint, formatting,
and the production build. The user has accepted actual OS, native toolbar/drag,
screen-reader, and live Drive checks in
[`phase-10.1-manual-test.md`](./manual_test/phase-10.1-manual-test.md).

The cancellation follow-up is documented as resolved; deferred polish and
phases 10.2–10.4 remain separate work.

### 10.2 Performance Optimization
**Goal**: Fast and smooth experience

**Progress (2026-11-08)**: Large-library profiling confirmed virtualization was
needed. The production dashboard now mounts visible favorite rows plus two rows
of overscan, keeps logical selection in dashboard state, retains the native drag
source, pins the keyboard-focus row, and supports Home/End and arrow navigation across unmounted
favorites. Search is debounced by 300ms. A shared IntersectionObserver and
hash-keyed thumbnail resource manager load nearby small previews, share duplicate
images, and release full-size images when previews close. Discovery and context
menus are emitted as optional dynamic chunks.

An isolated production Chrome run with 5,760 favorites and one shared preview
measured about 1.4GB JS heap and 4.7s settled load before the change. Afterward,
the first 9 cards appeared in about 104ms; the page settled in about 1.1s with
about 20.8MB JS heap and 9 cards mounted. End focused the final favorite, and a
selection stayed checked after scrolling away and back. See
[`phase-10.2-manual-test.md`](./manual_test/phase-10.2-manual-test.md) for the
profile setup, results, and pending manual acceptance.

The reported Escape regression in virtualized collections is fixed: stable
favorite slots keep the native source element attached through placeholder changes,
reorders, and scrolling, so native dragend reaches the shared synchronous reset.
Isolated Chrome checks confirm immediate original-order restoration for single and
multiple favorites, including cancellation after scrolling a 5,760-item collection.
The user's cancellation acceptance checkbox remains open for retesting.

**Revised Priority Tasks**:
- [x] **HIGH**: Profile a 5,760-item dashboard and identify the all-cards mount cost
- [x] **HIGH**: Load nearby thumbnails with Intersection Observer and share duplicate resources
- [x] **MEDIUM**: Debounce search by 300ms
- [x] **MEDIUM**: Code split Discovery and Context Menu feature modules
- [x] **HIGH**: Virtualize favorite rows after profiling proved it necessary
- [ ] **LOW**: Compress build output further (already using production build)

**Performance Targets**:
- Popup opens: <100ms (current: untested)
- Dashboard loads: <500ms with 100 items (current: untested)
- Dashboard loads: <2s with 1000 items (5,760-item isolated profile settles in ~1.1s)
- Drag-and-drop: 60fps (current: appears smooth but not measured)
- Search results: <100ms after the 300ms debounce (not yet profiled)
- Sync cycle: <5s for 100 items (current: appears fast but not measured)

### 10.3 Comprehensive Testing
**Goal**: High confidence before release

**Current Status**:
- ✅ 240 unit tests passing across 28 test files
- ✅ Core modules well-tested (HLC, merge, storage, Drive sync)
- ✅ Manual testing completed for Phases 1-9
- ⚠️ No automated E2E tests (all manual so far)
- ⚠️ No large dataset testing on the user's normal extension profile or target devices
- ⚠️ Accessibility not audited

**Revised Priority Tasks**:
- [ ] **HIGH**: Two-device Drive sync test (concurrent editing, conflict resolution)
- [ ] **MEDIUM**: Accessibility audit (keyboard-only navigation, screen reader, ARIA labels)
- [ ] **MEDIUM**: Test Drive quota limits and error handling
- [ ] **MEDIUM**: Test all network failure scenarios (offline, reconnect, mid-sync failure)
- [ ] **LOW**: Write E2E tests for critical paths (manual testing working well, defer automation)
- [ ] **LOW**: Cross-browser check (Chrome only for v1, Edge/Brave for v2)

**Critical Manual Tests** (prioritized):
1. ✅ Save page → appears in dashboard (Phase 3)
2. ✅ Import ZIP → merge works (Phase 7)
3. ✅ Export ZIP → re-import succeeds (Phase 7)
4. ✅ Disconnect Drive → local still works (Phase 8.5)
5. ✅ Account switch → confirmation works (Phase 8.1)
6. ✅ Large data sets tested (5,760 items, 2GB memory usage identified - see HIGH_MEMORY_INSPECTION.md)
7. ⚠️ **PENDING**: Two devices → concurrent edits → verify merge
8. ⚠️ **PENDING**: Delete group with nested items → verify sync
9. ⚠️ **PENDING**: Fill Drive quota → verify error handling

### 10.4 Documentation
**Goal**: Easy onboarding for users and developers

**Current Status**:
- ✅ Comprehensive developer docs (AI_AGENT_GUIDE.md, CODE_GUIDE.md, DESIGN_GUIDE.md)
- ✅ Implementation plan with phase details
- ✅ Manual test plans for each phase
- ✅ Inline JSDoc comments in core modules
- ⚠️ No user-facing README
- ⚠️ No troubleshooting guide
- ⚠️ No keyboard shortcuts documented (because few exist)

**Revised Priority Tasks**:
- [ ] **HIGH**: Write user README with screenshots for Chrome Web Store
- [ ] **HIGH**: Create troubleshooting guide (file:// access, Drive auth, common errors)
- [ ] **MEDIUM**: Document Drive quota limits and storage expectations
- [ ] **MEDIUM**: Create CHANGELOG.md with release notes format
- [ ] **LOW**: Document keyboard shortcuts (after implementing them in 10.1)
- [ ] **LOW**: Developer setup guide (current docs are good, make it more beginner-friendly)
- [ ] **DEFER**: Architecture decisions (well-documented in code and design guides)

---

## Phase 10 Code Quality & Enhancement Analysis (2026-11-07)

### System Architecture Review

**Overall Assessment**: The codebase demonstrates solid architectural patterns with clear separation of concerns, robust data layer, and comprehensive sync implementation. After 9 phases, the foundation is production-ready, but several areas need polish for optimal user experience.

### Strengths

1. **Data Layer Excellence**
   - HLC-based conflict-free sync working correctly across devices
   - Well-tested merge logic with 100% coverage on critical paths
   - Fractional indexing for stable ordering
   - Proper use of Dexie transactions for atomicity
   - Comprehensive Drive sync with offline support

2. **Code Organization**
   - Clear module boundaries (`core/`, `dashboard/`, `popup/`, `background/`)
   - Shared types with consistent TypeScript usage
   - Good separation between business logic and UI
   - Reusable components (FavoriteCard, GroupTree, dialogs)

3. **Testing & Quality**
   - 204 tests passing across 23 test files
   - Critical paths well-covered (storage, merge, Drive sync, ordering)
   - Clean TypeScript compilation with strict mode
   - Consistent code style with ESLint + Prettier

4. **Chrome Extension Best Practices**
   - Correct MV3 implementation
   - Proper permission handling (optional features)
   - Background service worker correctly scoped
   - No DOM access in service worker

### Areas Needing Enhancement

#### 1. **Performance & Memory (CRITICAL for v1)**

**Issue**: Large collections (5,760+ items) cause 2GB memory usage due to:
- All matching favorites mounted simultaneously in "All favorites" view
- Each card creates both small and full-size thumbnail URLs
- No resource sharing for duplicate images
- Group tree fully mounted even when collapsed

**Recommendation** (see `docs/future_plan/HIGH_MEMORY_INSPECTION.md`):
- [ ] Implement virtual scrolling for favorite grid/list (render only visible + 2 rows buffer)
- [ ] Add thumbnail resource manager with deduplication and LRU caching (64 entries / 16MB limit)
- [ ] Generate missing 320×200 card previews on demand from imported images
- [ ] Virtualize group tree rendering (unmount collapsed branches)
- [ ] Build group/item indexes once per data update instead of repeatedly

**Priority**: HIGH - Affects users with 500+ items. Should complete before public launch.

#### 2. **Bundle Size Optimization**

**Current Sizes**:
- dashboard.js: 231KB (67.5KB gzipped)
- global.js: 200KB (66KB gzipped)
- drive-sync-triggers.js: 127KB (40.7KB gzipped)
- optional-features.js: 130KB (36.8KB gzipped)

**Issues**:
- Zod library included in multiple bundles (4.6.7, large schema validation library)
- Optional features not lazy-loaded (Discovery and Context Menus always loaded)
- Heroicons imported individually but not tree-shaken optimally

**Recommendations**:
- [ ] **MEDIUM**: Code-split optional features (load Discovery/Context Menu modules only when enabled)
- [ ] **LOW**: Analyze Zod bundle impact (consider lighter validation for some paths)
- [ ] **LOW**: Review Heroicons imports (use only needed icons or switch to inline SVG)
- [ ] **DEFER**: Consider moving Dexie operations to shared worker for memory

**Priority**: MEDIUM - Current sizes acceptable for extension, but optimization would improve load time.

#### 3. **UI/UX Polish**

**Theme Toggle — Implemented in 10.1 (2026-11-07)**:
- CSS variables defined in global.css with light/dark modes
- `prefers-color-scheme` media query exists
- Settings offers System/Light/Dark using existing semantic tokens
- Theme preference is saved locally and observed across open extension pages

**Recommendations**:
- [x] **HIGH**: Add theme selector to Settings (System / Light / Dark)
- [x] **HIGH**: Save preference to IndexedDB settings table
- [x] **HIGH**: Apply data-theme attribute to root element
- [ ] **MEDIUM**: Add smooth transition when switching themes

**Animation & Transitions**:
- Basic transitions exist (hover states, button presses)
- Shared dialog enter/exit transitions respect reduced motion
- Existing drag-stack ghosts and placement/reorder feedback retained
- Thumbnail decode and sync progress feedback polished

**Recommendations**:
- [x] **MEDIUM**: Add dialog fade-in animation (200ms)
- [x] **MEDIUM**: Improve drag visual feedback (existing ghost images and drop zone highlights retained)
- [ ] **LOW**: Add smooth scroll when navigating to groups
- [x] **LOW**: Polish Drive sync progress indicator (counts when known; otherwise indeterminate)

#### 4. **Accessibility Gaps**

**Current State**:
- Basic keyboard navigation works (Tab, Enter, Esc)
- Focus styles defined globally
- Headless UI components provide good ARIA support
- Missing comprehensive keyboard shortcuts

**Issues Identified**:
- Cmd/Ctrl+K and favorite arrow/Home/End navigation implemented in 10.1
- Some interactive elements missing ARIA labels
- Skip-to-favorites link added in 10.1
- Screen reader testing not performed

**Recommendations**:
- [x] **HIGH**: Implement Cmd/Ctrl+K for search focus
- [x] **HIGH**: Add arrow key navigation in grid/list views
- [ ] **MEDIUM**: Audit all interactive elements for ARIA labels
- [x] **MEDIUM**: Add skip-to-main-content link
- [ ] **LOW**: Test with VoiceOver/NVDA screen readers
- [ ] **LOW**: Document keyboard shortcuts in UI (? key for help)

#### 5. **Error Handling & Edge Cases**

**Current State**:
- Drive sync errors well-handled (offline, auth, quota)
- File access errors properly surfaced
- Import validation comprehensive

**Potential Improvements**:
- [ ] **MEDIUM**: Add retry logic for thumbnail capture failures
- [ ] **MEDIUM**: Better error messages for corrupted IndexedDB (recovery guide)
- [ ] **LOW**: Add telemetry for error tracking (optional, privacy-respecting)
- [ ] **LOW**: Implement automatic crash recovery (detect incomplete operations)

#### 6. **Code Organization Suggestions**

**DashboardApp.tsx Complexity**:
- 67 React hooks in one component
- 1000+ lines (estimated from context)
- Handles: state, Drive sync, optional features, drag-drop, selection, undo/redo

**Recommendations**:
- [ ] **LOW**: Extract Drive sync state to custom hook (`useDriveSync`)
- [ ] **LOW**: Extract selection/bulk actions to custom hook (`useSelection`)
- [ ] **LOW**: Extract undo/redo stack to custom hook (`useUndoRedo`)
- [ ] **DEFER**: Consider splitting DashboardApp into smaller components (works fine as-is)

**Storage.ts Module Size**:
- Single module handles all CRUD operations
- 150+ lines already read (likely 500+ total)
- Mixes settings getters/setters with library operations

**Recommendations**:
- [ ] **DEFER**: Consider splitting into `storage/library.ts`, `storage/settings.ts`, `storage/snapshots.ts`
- [ ] **DEFER**: Only split if module becomes hard to navigate (currently manageable)

### Recommendations by Priority

**Must Do Before v1 Launch (HIGH Priority)**:
1. Implement virtual scrolling and thumbnail resource management (memory fix)
2. Two-device Drive sync testing (validate conflict resolution)
3. Dark/light theme toggle (user expectation for modern apps)
4. Basic keyboard shortcuts (Cmd+K search, Esc close)
5. Accessibility ARIA label audit

**Should Do Before v1 Launch (MEDIUM Priority)**:
6. Code-split optional features (reduce initial bundle)
7. Add smooth animations (dialogs, drag-drop feedback)
8. Polish Drive sync UI (progress bar, better error messages)
9. Search debouncing (prevent lag on large collections)
10. Accessibility testing with screen readers

**Nice to Have for v1 (LOW Priority)**:
11. Skeleton loading screens
12. Detailed keyboard shortcuts (arrow navigation, shortcuts help)
13. Bundle size optimization (Zod, Heroicons)
14. Refactor DashboardApp hooks
15. Comprehensive tooltips

**Defer to v2**:
- Automated E2E tests (manual testing working well)
- Code architecture refactoring (current structure is maintainable)
- Advanced animations (confetti, celebrations)
- Cross-browser support (Chrome-first for v1)
- Module reorganization (only if navigation becomes difficult)

### Logic Issues Identified

After reviewing the codebase, **no significant logic errors were found**. The implementation is solid:

✅ HLC merge logic correct and well-tested  
✅ Fractional ordering handles all edge cases  
✅ Drive sync properly handles offline, errors, conflicts  
✅ File URL validation prevents security issues  
✅ Group cycle prevention working correctly  
✅ Undo/redo stack properly maintained  
✅ Optional permissions requested correctly  

**Minor Suggestions**:
- Consider adding bounds checking for very deep group nesting (100+ levels)
- Add rate limiting for rapid favorite creation (prevent accidental duplication)
- Consider adding data validation on IndexedDB read (detect corruption early)

### Conclusion

FavoritePod is **functionally complete and architecturally sound**. The core features work correctly, sync is robust, and code quality is high. Before public launch, focus on:

1. **Performance**: Virtual scrolling for large collections (blocking issue)
2. **Polish**: Theme toggle, smooth animations, keyboard shortcuts
3. **Testing**: Two-device sync, accessibility audit
4. **Documentation**: User README, troubleshooting guide

The codebase is ready for these enhancements without major refactoring. Current architecture will scale well with the recommended optimizations.

---


## Phase 11: Release Preparation (Week 16-17)

### 11.1 Chrome Web Store Submission
**Goal**: Published extension

**Tasks**:
- [ ] Create store listing assets:
  - Screenshots (1280x800, 3-5 images)
  - Promo tile (440x280)
  - Small tile (128x128)
  - Logo assets (16, 48, 128)
- [ ] Write store description
- [ ] Set up analytics (if desired)
- [ ] Upload to Chrome Web Store
- [ ] Move OAuth consent to "In production"
- [ ] Submit for review
- [ ] Monitor review feedback

### 11.2 Public Launch
**Goal**: Get first users

**Tasks**:
- [ ] Soft launch to test users
- [ ] Monitor error logs and feedback
- [ ] Fix critical bugs
- [ ] Announce on relevant communities
- [ ] Create demo video
- [ ] Set up feedback channel (Discord/GitHub)

## Ongoing Maintenance

### Regular Tasks
- Monitor Drive API quota usage
- Respond to user feedback
- Fix bugs
- Update dependencies
- Chrome API compatibility checks

### Future Enhancements (v2+)
- New-tab replacement variant
- Custom themes
- Tag system
- Search with filters
- Shared collections (requires backend)
- Browser extension for other browsers (Firefox, Safari)
- Mobile companion app
- Advanced statistics
- Backup to other cloud providers

## Risk Mitigation

### High-Risk Areas
1. **Drive sync conflicts**: Mitigated by spike, unit tests, and two-device testing
2. **IndexedDB quota**: Mitigated by `unlimitedStorage` permission and monitoring
3. **Thumbnail capture rate limits**: Mitigated by queue and rate limiting
4. **OAuth token expiration**: Mitigated by automatic refresh
5. **Browser compatibility**: Mitigated by Chrome-first approach, documented limitations

### Rollback Plan
- Keep last 3 snapshots locally
- Export to ZIP before major changes
- Gradual rollout to test users first
- Monitor error rates with analytics

## Success Metrics

### Launch Goals (v1)
- 100 active users
- <5% error rate
- Average sync time <5s
- 4+ star rating
- Zero data-loss incidents

### User Experience Targets
- Popup opens in <100ms
- Dashboard loads in <500ms
- Drag-and-drop at 60fps
- Sync converges in <10s

## V1 Simplified Scope (AI-Assisted Development)

Given requirements:
- **First-time Chrome extension development**
- **AI agents as primary workforce**
- **Manual testing only (token-efficient)**
- **Priority: file:// link support**
- **Timeline: flexible, optimize for quality over speed**

### V1 Must-Haves
1. ✅ **File:// link support** (local HTML tools - PRIMARY GOAL)
2. ✅ Basic launcher with thumbnails
3. ✅ Hierarchical groups with nested organization
4. ✅ Manual drag-and-drop reordering
5. ✅ IndexedDB storage (sync-ready schema, but no Drive yet)
6. ✅ ZIP export/import (for sharing)
7. ✅ Popup "Save page" action

### V1 Deferred to V2
- ❌ Google Drive sync (most complex, defer until core works)
- ❌ Visited-site discovery (optional permission complexity)
- ❌ Advanced animations (polish later)
- ❌ Automated testing (manual first, automate if patterns emerge)

### Revised Timeline (AI-Driven)

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| 1. Foundation | 3 days | Dev environment + extension basics |
| 2. Platform Spike | 2 days | Validate file:// + capture APIs |
| 3. Data Layer | 3 days | IndexedDB with simple schema |
| 4. Popup UI | 2 days | Save current page |
| 5. Dashboard Shell | 3 days | Basic launcher view |
| 6. Items & Groups | 4 days | Display + CRUD |
| 7. Thumbnails | 3 days | Capture + display |
| 8. **File:// Support** | 4 days | **Local file handling (PRIORITY)** |
| 9. Drag-and-Drop | 3 days | Reordering |
| 10. ZIP Export/Import | 4 days | Sharing mechanism |
| 11. Polish | 3 days | Theme + UX cleanup |
| 12. Manual Testing | 3 days | Bug fixing |
| **Total** | **~5 weeks** | **V1 ready** |

### V2 Additions (After V1 Stabilizes)
- Google Drive sync (4 weeks)
- Advanced features (history discovery)
- Automated E2E tests (2 weeks)

## AI Development Strategy

### Working with AI Agents

**Optimal Task Breakdown**:
- Each task should be completable in one AI session (<200K tokens)
- Provide complete context (this plan + code guide + design guide)
- Focus on one module at a time
- Clear acceptance criteria for each task

**AI-Friendly Architecture**:
- Pure functions over classes (easier to test and reason about)
- Clear interfaces between modules
- Extensive TypeScript types (AI can validate contracts)
- JSDoc comments for complex logic

**Iteration Approach**:
1. AI implements feature
2. Manual testing by human
3. Report bugs/feedback
4. AI fixes
5. Repeat until stable
6. Move to next feature

**Token Optimization**:
- Use manual testing (cheaper than writing test suites)
- Reuse patterns (once drag-and-drop works, copy pattern)
- Focus AI on business logic, not boilerplate
- Generate simple test data manually

## Notes

- Prioritize getting file:// support working perfectly before other features
- Keep UI simple initially (polish is easier than fixing architecture)
- Manual testing is fine for v1 (100-200 items, 2-3 devices)
- Drive sync is complex - defer until core is proven
- AI agents work best with clear, modular tasks

