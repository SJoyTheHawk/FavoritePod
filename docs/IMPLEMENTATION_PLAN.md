# FavoritePod Implementation Plan

## Overview

FavoritePod is a Chrome extension that provides a visual bookmark launcher with Google Drive synchronization, nested groups, drag-and-drop organization, and rich preview thumbnails.

**Current status**: Phases 2-5 are implemented and covered by automated checks. Manual Chrome validation for extension loading, HMR, screenshots, nested drag-and-drop, keyboard navigation, thumbnail previews, and `file://` access remains open; see `NEXT_STEPS.md`, `docs/phase-4-manual-test.md`, and `docs/phase-5-manual-test.md` for checklists.

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
user's request; keep full paths for now. Phase 5 is implemented; Phase 6 is next.

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

## Phase 5: Thumbnail System (Week 6-7) - Implementation Complete

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
- [x] Implement opt-in iframe preview
- [x] Add iframe timeout fallback (2s)

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
- Iframe fallback works
- Keyboard accessible (focus + enter)

**Implementation note**: Existing thumbnail records remain readable. New captures
store a 640x400 preview and a 320x200 card preview under the same SHA-256 keyed
record. Capture calls are serialized with a 500ms minimum interval. Live page
previews are opt-in and sandboxed; they fall back to the stored preview after
two seconds.

**Validation**: 53 tests across 7 suites, type check, lint, formatting, and
production build pass. Browser behavior remains open for the checklist in
`docs/phase-5-manual-test.md`.

## Phase 6: File:// Link Support (Week 7)

### 6.1 Local File Handling
**Goal**: Support local HTML tools with path handling

**Tasks**:
- [ ] Detect file:// URLs during save
- [ ] Check `chrome.extension.isAllowedFileSchemeAccess()`
- [ ] Show permission hint if denied
- [ ] Open files with `chrome.tabs.create()`
- [ ] Implement per-device path prefix override
- [ ] Add file availability check (when allowed)
- [ ] Show three states: unknown, available, missing

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

### 7.1 ZIP Export
**Goal**: Share libraries with colleagues

**Tasks**:
- [ ] Build export dialog (select groups)
- [ ] Serialize groups/items to JSON
- [ ] Copy thumbnails to `previews/` by hash
- [ ] Create ZIP with fflate
- [ ] Trigger download
- [ ] Add export metadata (version, timestamp)

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
- [ ] Build import dialog (drag/drop + file picker)
- [ ] Validate ZIP structure with zod
- [ ] Validate and sanitize URLs (reject javascript:)
- [ ] Decode images with createImageBitmap
- [ ] Show preview of import contents
- [ ] Implement three import modes:
  - Merge as copy (new IDs, new group)
  - Update from source (match by ID)
  - Replace (with snapshot)
- [ ] Show progress during import
- [ ] Rollback on error

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
- [ ] Set up Google Cloud Project
- [ ] Enable Drive API
- [ ] Configure OAuth consent screen
- [ ] Add test users
- [ ] Implement `chrome.identity.getAuthToken()`
- [ ] Build token refresh on 401
- [ ] Implement disconnect with token revoke
- [ ] Detect account switches via permissionId

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
- Disconnect works cleanly
- Account switch detected

### 8.2 Device File Management
**Goal**: Per-device sync files with conflict-free updates

**Tasks**:
- [ ] Generate stable deviceId on first run
- [ ] Create device file: `launcher-state-device-<id>.json`
- [ ] List appDataFolder files
- [ ] Download only modified files
- [ ] Upload device state with PATCH
- [ ] Implement file compaction (remove stale devices)

**Device File Structure**:
```typescript
interface DeviceFile {
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
- Each device has its own file
- Updates don't overwrite others
- Compaction removes old devices
- File list is efficient

### 8.3 Asset Sync
**Goal**: Deduplicated thumbnail sync

**Tasks**:
- [ ] Upload thumbnails as `asset-<sha256>.jpg`
- [ ] Skip already-uploaded hashes
- [ ] Download missing thumbnails
- [ ] Implement orphan cleanup (unreferenced assets)
- [ ] Track upload progress
- [ ] Handle Drive quota errors

**Upload Strategy**:
1. Collect all hashes from merged state
2. List existing asset files
3. Upload missing hashes only
4. Store Drive fileId for each hash
5. Clean up orphaned assets (>90 days)

**Acceptance**:
- Thumbnails sync correctly
- Deduplication works
- Orphans are cleaned up
- Quota errors are clear

### 8.4 Sync Engine & Merge
**Goal**: Conflict-free multi-device sync

**Tasks**:
- [ ] Implement sync lock (navigator.locks)
- [ ] Build sync orchestrator (download → merge → upload)
- [ ] Implement per-field merge with HLC
- [ ] Add group cycle detection and repair
- [ ] Handle tombstone propagation
- [ ] Implement first-connect flow (merge/replace options)
- [ ] Add account-switch confirmation
- [ ] Build sync retry with exponential backoff

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

### 8.5 Error Handling & UI
**Goal**: Clear sync status and error messages

**Tasks**:
- [ ] Build sync status indicator (icon + tooltip)
- [ ] Show sync progress
- [ ] Display sync errors with actions
- [ ] Implement offline mode
- [ ] Add sync history log
- [ ] Show Drive quota usage

**Sync States**:
- ✓ Synced (green dot)
- ↻ Syncing... (spinning)
- ⚠ Conflict resolved (yellow, temporary)
- ✗ Sync failed (red, with detail)
- ⊗ Offline (gray)

**Error Messages**:
- Quota exceeded: "Drive storage full. Free up space or disconnect sync."
- Auth expired: "Please reconnect Google Drive."
- Network error: "Sync will retry when online."
- Conflict repaired: "Concurrent changes merged automatically."

**Acceptance**:
- User always knows sync status
- Errors are actionable
- Offline mode works
- Logs help debugging

## Phase 9: Optional Features (Week 13-14)

### 9.1 Visited-Site Discovery
**Goal**: Suggest pages to save

**Tasks**:
- [ ] Request optional permissions in settings
- [ ] Implement `chrome.topSites.get()`
- [ ] Implement `chrome.history.search()`
- [ ] Filter already-saved URLs
- [ ] Filter user-hidden suggestions
- [ ] Build suggestions UI (separate tab/section)
- [ ] Add "Save to group" quick action
- [ ] Add "Hide" action (local-only)

**Suggestions UI**:
```
┌────────────────────────────────────────────┐
│ Frequently Visited                         │
├────────────────────────────────────────────┤
│ [Thumbnail] example.com      [+] [Hide]    │
│ [Thumbnail] github.com       [+] [Hide]    │
│ ...                                        │
└────────────────────────────────────────────┘
```

**Acceptance**:
- Permission request works
- Suggestions are relevant
- Filtering works
- Privacy is respected (local hide list)

### 9.2 Context Menu Integration (Optional)
**Goal**: Right-click to save page/link

**Tasks**:
- [ ] Add `contextMenus` permission
- [ ] Create "Save to FavoritePod" menu item
- [ ] Handle page context (save current page)
- [ ] Handle link context (save linked page)
- [ ] Show group selection submenu

**Acceptance**:
- Right-click works on pages
- Right-click works on links
- Group selection is quick

## Phase 10: Polish & Testing (Week 14-16)

### 10.1 Design System Finalization
**Goal**: Consistent, polished UI (see DESIGN_GUIDE.md)

**Tasks**:
- [ ] Implement dark/light theme toggle
- [ ] Add all transitions and animations
- [ ] Polish loading states
- [ ] Add skeleton screens
- [ ] Implement keyboard shortcuts
- [ ] Add tooltips everywhere
- [ ] Polish empty states
- [ ] Add celebratory moments (confetti on first save)

### 10.2 Performance Optimization
**Goal**: Fast and smooth experience

**Tasks**:
- [ ] Lazy-load thumbnails (Intersection Observer)
- [ ] Virtual scrolling for large lists
- [ ] Debounce search input
- [ ] Optimize Dexie queries
- [ ] Minimize popup load time (<100ms)
- [ ] Profile and fix jank
- [ ] Compress build output

**Performance Targets**:
- Popup opens: <100ms
- Dashboard loads: <500ms with 100 items
- Drag-and-drop: 60fps
- Search results: <50ms
- Sync cycle: <5s for 100 items

### 10.3 Comprehensive Testing
**Goal**: High confidence before release

**Tasks**:
- [ ] Write unit tests (80%+ coverage)
- [ ] Write E2E tests for critical paths
- [ ] Manual test on two devices
- [ ] Test with large data sets (1000+ items)
- [ ] Test Drive quota limits
- [ ] Test network failure scenarios
- [ ] Test concurrent editing
- [ ] Accessibility audit (keyboard, screen reader)
- [ ] Cross-browser check (Chrome, Edge, Brave)

**Critical E2E Tests**:
1. Save page → appears in dashboard
2. Create group → drag item → syncs to device 2
3. Edit item on device 1 → appears on device 2
4. Delete group → syncs deletion
5. Import ZIP → merge works
6. Export ZIP → re-import succeeds
7. Disconnect Drive → local still works
8. Account switch → confirmation works

### 10.4 Documentation
**Goal**: Easy onboarding for users and developers

**Tasks**:
- [ ] Write user README with screenshots
- [ ] Document keyboard shortcuts
- [ ] Create developer setup guide
- [ ] Document architecture decisions
- [ ] Add inline code comments
- [ ] Create troubleshooting guide
- [ ] Document Drive quota limits
- [ ] Add changelog template

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

