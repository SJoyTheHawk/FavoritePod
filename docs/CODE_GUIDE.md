# FavoritePod Code Guide

## Table of Contents
1. [Project Structure](#project-structure)
2. [Technology Decisions](#technology-decisions)
3. [Chrome Extension Fundamentals](#chrome-extension-fundamentals)
4. [Data Model](#data-model)
5. [Module Reference](#module-reference)
6. [API Reference](#api-reference)
7. [Common Patterns](#common-patterns)
8. [Debugging Guide](#debugging-guide)

---

## Project Structure

```
favoritepod/
├── src/
│   ├── popup/                    # Toolbar popup (320x480px)
│   │   ├── PopupApp.tsx          # Main popup component
│   │   ├── popup.html            # Popup HTML entry
│   │   ├── popup.tsx             # React mount point
│   │   └── components/           # Popup-specific components
│   │
│   ├── dashboard/                # Full launcher dashboard
│   │   ├── DashboardApp.tsx      # Main dashboard component
│   │   ├── dashboard.html        # Dashboard HTML entry
│   │   ├── dashboard.tsx         # React mount point
│   │   ├── components/           # Dashboard components
│   │   │   ├── ItemCard.tsx      # Individual item display
│   │   │   ├── GroupList.tsx     # Group sidebar
│   │   │   ├── GridView.tsx      # Grid layout
│   │   │   ├── ListView.tsx      # List layout
│   │   │   ├── HoverPreview.tsx  # Thumbnail preview popover
│   │   │   └── SettingsPanel.tsx # Settings UI
│   │   └── hooks/                # Dashboard hooks
│   │       ├── useItems.ts       # Item data access
│   │       ├── useGroups.ts      # Group data access
│   │       └── useDragDrop.ts    # Drag-and-drop logic
│   │
│   ├── background/               # Service worker (MV3)
│   │   ├── service-worker.ts     # Main background script
│   │   ├── alarms.ts             # Periodic sync triggers
│   │   └── context-menus.ts      # Right-click menu (optional)
│   │
│   ├── core/                     # Shared business logic
│   │   ├── types.ts              # TypeScript interfaces
│   │   ├── db.ts                 # Dexie database
│   │   ├── storage.ts            # CRUD operations
│   │   ├── thumbnail.ts          # Thumbnail capture/resize
│   │   ├── file-links.ts         # file:// URL handling
│   │   ├── export.ts             # ZIP export
│   │   ├── import.ts             # ZIP import with validation
│   │   ├── validation.ts         # Zod schemas
│   │   └── utils.ts              # Helper functions
│   │
│   ├── styles/                   # Global styles
│   │   ├── globals.css           # Tailwind imports + resets
│   │   ├── themes.css            # CSS variables for theming
│   │   └── animations.css        # Reusable animations
│   │
│   └── shared/                   # Shared UI components
│       ├── Button.tsx            # Styled button
│       ├── Modal.tsx             # Modal dialog
│       ├── Input.tsx             # Styled input
│       ├── Dropdown.tsx          # Select dropdown
│       └── Tooltip.tsx           # Tooltip component
│
├── public/
│   ├── manifest.json             # Extension manifest (MV3)
│   ├── icons/                    # Extension icons
│   │   ├── icon-16.png
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   └── _locales/                 # i18n (optional for v1)
│
├── docs/
│   ├── project_plan.md           # Original requirements
│   ├── IMPLEMENTATION_PLAN.md    # Phase-by-phase plan
│   ├── CODE_GUIDE.md             # This file
│   └── DESIGN_GUIDE.md           # Design system
│
├── tests/                        # Manual test plans (v1)
│   ├── test-plan.md              # Manual test checklist
│   └── test-data/                # Sample data for testing
│
├── package.json
├── vite.config.ts                # Vite build config
├── tailwind.config.ts            # Tailwind setup
├── tsconfig.json                 # TypeScript config
├── .gitignore
└── README.md                     # User-facing docs
```

---

## Technology Decisions

### Core Stack (Locked In)
- **TypeScript 5.x**: Type safety, better IDE support
- **React 18**: Familiar, well-documented, good for AI agents
- **Vite 6.x**: Fast HMR, simple config
- **Manifest V3**: Required for new extensions

### Libraries (Recommended)

**Essential**:
```json
{
  "dexie": "^4.0.0",              // IndexedDB wrapper
  "fflate": "^0.8.0",             // ZIP compression
  "zod": "^4.6.7"                 // Runtime validation
}
```

**UI & Styling**:
```json
{
  "tailwindcss": "^3.4.0",        // Utility-first CSS
  "clsx": "^2.1.0",               // Conditional classes
  "@headlessui/react": "^2.0.0"   // Accessible components
}
```

**Drag-and-Drop** (v1 can use simple HTML5, @dnd-kit for v2):
```json
{
  "@dnd-kit/core": "^6.1.0",      // Defer to v2 if needed
  "@dnd-kit/sortable": "^8.0.0"
}
```

**Development**:
```json
{
  "@crxjs/vite-plugin": "^2.0.0", // Chrome extension dev
  "typescript": "^5.5.0",
  "eslint": "^10.14.0",
  "prettier": "^3.3.0"
}
```

ESLint 10 requires Node.js 20.19 or newer. The project setup uses Node.js 20.19+.

### Build Tool Setup

**vite.config.ts**:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './public/manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/popup.html',
        dashboard: 'src/dashboard/dashboard.html'
      }
    }
  }
});
```

---

## Chrome Extension Fundamentals

### Manifest V3 Structure

**public/manifest.json**:
```json
{
  "manifest_version": 3,
  "name": "FavoritePod",
  "version": "0.1.0",
  "description": "Visual bookmark launcher with local file support",
  
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png"
    }
  },
  
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  
  "permissions": [
    "activeTab",
    "unlimitedStorage"
  ],
  
  "optional_permissions": [
    "history",
    "topSites"
  ],
  
  "host_permissions": [
    "file:///*"
  ]
}
```

### Key Permission Concepts

| Permission | Purpose | User Experience |
|------------|---------|-----------------|
| `activeTab` | Read the active tab, capture its screenshot, open its URL | Temporary when the popup is used |
| `favicon` | Read Chrome’s cached website icons as a fallback | Reload the extension after manifest changes |
| `unlimitedStorage` | Protect the IndexedDB library from normal quota eviction | No install warning |
| `history` (optional) | Visited-site suggestions (planned) | Runtime permission dialog |

**Important**: Do not request `<all_urls>` host permissions. The `file:///*`
host permission is limited to local files and is required for Phase 6 file
availability checks. Users must still enable “Allow access to file URLs” in
Chrome's extension details. The extension uses `activeTab` for the popup's
active-tab workflow and stores data in IndexedDB, which does not require
Chrome's separate `storage` permission.

### Extension Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Extension Pages                    │
│  ┌─────────────┐           ┌──────────────────┐   │
│  │   Popup     │           │   Dashboard       │   │
│  │  (popup/)   │           │  (dashboard/)     │   │
│  │             │           │                   │   │
│  │ • Save page │           │ • Full launcher   │   │
│  │ • Quick     │           │ • Edit/organize   │   │
│  │   actions   │           │ • Settings        │   │
│  └──────┬──────┘           └────────┬──────────┘   │
│         │                           │               │
│         └──────────┬────────────────┘               │
│                    │                                │
│         ┌──────────▼──────────┐                    │
│         │   Shared Core       │                    │
│         │   (core/)           │                    │
│         │                     │                    │
│         │ • IndexedDB (Dexie) │                    │
│         │ • Business logic    │                    │
│         │ • Utilities         │                    │
│         └──────────┬──────────┘                    │
│                    │                                │
├────────────────────┼────────────────────────────────┤
│                    │                                │
│         ┌──────────▼──────────┐                    │
│         │  Service Worker     │                    │
│         │  (background/)      │                    │
│         │                     │                    │
│         │ • Lifecycle manager │                    │
│         │ • Context menus     │                    │
│         │ • Alarms (future)   │                    │
│         └─────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

### Context Isolation Rules

1. **Service worker** (background/):
   - No DOM, no `window`, no `localStorage`
   - Can use IndexedDB, Chrome APIs
   - Can message extension pages
   - Terminated when idle (MV3 design)

2. **Extension pages** (popup/, dashboard/):
   - Full DOM access
   - Can use React, IndexedDB, Chrome APIs
   - Share IndexedDB with service worker
   - Can message each other

3. **Content scripts** (not used in v1):
   - Injected into web pages
   - Isolated JS context
   - Not needed for this extension

---

## Data Model

`src/core/types.ts` is the canonical source for `Group`, `Item`, and supporting
records. Groups and items carry a Hybrid Logical Clock (HLC) for each
mergeable field. Deletions use a `deleted` HLC, so a later edit can
deterministically restore a record. `parentId` supports nested groups; a
first-run library creates a root group named `Favorites`.

Ordering keys come from `fractional-indexing` and must be compared using
JavaScript code-point string order (`<`/`>` or default `.sort()`). Locale-aware
comparison can reverse keys such as `aZ` and `aa`.

### IndexedDB Schema (Dexie)

`src/core/db.ts` owns the schema. Version 1 creates these tables and indexes:

| Table | Primary key | Indexed fields |
|-------|-------------|-----------------|
| `groups` | `id` | `parentId`, `orderKey`, `deleted` |
| `items` | `id` | `groupId`, `orderKey`, `deleted`, `url`, `previewHash` |
| `thumbnails` | `hash` | `size`, `createdAt` |
| `syncMeta` | `key` | - |
| `snapshots` | auto ID | `createdAt` |
| `deviceFiles` | `deviceId` | `lastSync` |
| `settings` | `key` | - |

Snapshots include groups, items, and thumbnail blobs. `storage.ts` keeps the
three newest snapshots and restores their contents in one Dexie transaction.
Future schema changes should add a Dexie version and migration; version 1
currently needs no migration.

### URL Validation

**CRITICAL SECURITY**: Only allow safe URL schemes.

```typescript
const ALLOWED_SCHEMES = ['http:', 'https:', 'file:'];

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ALLOWED_SCHEMES.includes(url.protocol);
  } catch {
    return false;
  }
}

export function sanitizeUrl(urlString: string): string | null {
  if (!isValidUrl(urlString)) {
    return null;
  }
  return urlString;
}
```

**Why**: `javascript:`, `data:`, and other schemes can execute code. Always reject them in imports and edits.

---

## Module Reference

### 1. Core Database Module

`src/core/storage.ts` is the local library API. It validates URLs, updates
per-field HLCs inside Dexie transactions, assigns fractional order keys, and
soft-deletes records with tombstones. Its current public operations include:

```typescript
createGroup(input: { title: string; parentId?: string | null }): Promise<Group>
updateGroup(id: string, updates: Partial<Pick<Group, GroupField>>): Promise<Group>
deleteGroup(id: string): Promise<void>
createItem(input: CreateItemInput): Promise<Item>
updateItem(id: string, updates: Partial<Pick<Item, ItemField>>): Promise<Item>
deleteItem(id: string): Promise<void>
listGroups(): Promise<Group[]>
listItems(groupId?: string): Promise<Item[]>
getRecentItems(limit?: number): Promise<Item[]>
getDefaultView(): Promise<LibraryView | undefined>
setDefaultView(view: LibraryView): Promise<void>
createSnapshot(): Promise<LibrarySnapshot>
restoreSnapshot(id: number): Promise<void>
```

Keep library mutations in this module so clocks, ordering, default-group
creation, and metadata remain in the same atomic transaction.

### 2. Thumbnail Capture Module

**src/core/thumbnail.ts**:
```typescript
// Capture visible tab as JPEG thumbnail
export async function captureVisibleTab(): Promise<{
  dataUrl: string;
  blob: Blob;
  hash: string;
} | null> {
  try {
    // Get current window
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    
    if (!tab?.windowId) return null;
    
    // Capture (requires activeTab permission from popup click)
    const dataUrl = await chrome.tabs.captureVisibleTab(
      tab.windowId,
      { format: 'jpeg', quality: 80 }
    );
    
    // Convert to blob
    const response = await fetch(dataUrl);
    const originalBlob = await response.blob();
    
    // Resize to 640x400
    const resizedBlob = await resizeImage(originalBlob, 640, 400);
    
    // Calculate SHA-256 hash
    const arrayBuffer = await resizedBlob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return {
      dataUrl,
      blob: resizedBlob,
      hash
    };
  } catch (error) {
    console.error('Capture failed:', error);
    return null;
  }
}

// Resize image using OffscreenCanvas
async function resizeImage(
  blob: Blob,
  maxWidth: number,
  maxHeight: number
): Promise<Blob> {
  const img = await createImageBitmap(blob);
  
  // Calculate aspect-fit dimensions
  let width = img.width;
  let height = img.height;
  
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }
  
  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }
  
  // Use OffscreenCanvas for resize
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Cannot get canvas context');
  
  ctx.drawImage(img, 0, 0, width, height);
  
  return canvas.convertToBlob({
    type: 'image/jpeg',
    quality: 0.75
  });
}

// Save thumbnail to IndexedDB
export async function saveThumbnail(
  blob: Blob,
  hash: string
): Promise<void> {
  const img = await createImageBitmap(blob);
  
  await db.thumbnails.put({
    hash,
    blob,
    size: blob.size,
    width: img.width,
    height: img.height,
    createdAt: Date.now()
  });
}

// Get thumbnail by hash
export async function getThumbnail(hash: string): Promise<Blob | null> {
  const thumbnail = await db.thumbnails.get(hash);
  return thumbnail?.blob ?? null;
}
```

### 3. File:// Link Handler

**src/core/file-links.ts**:

This is the **PRIMARY FEATURE** for v1.

```typescript
// Check if file:// scheme access is enabled
export async function hasFileAccess(): Promise<boolean> {
  return chrome.extension.isAllowedFileSchemeAccess();
}

// Open file:// URL (must use chrome.tabs.create, not <a> tag)
export async function openFileUrl(url: string): Promise<void> {
  if (!url.startsWith('file://')) {
    throw new Error('Not a file:// URL');
  }
  
  const hasAccess = await hasFileAccess();
  if (!hasAccess) {
    throw new Error('FILE_ACCESS_DENIED');
  }
  
  await chrome.tabs.create({ url });
}

// Get extension settings URL (for showing permission hint)
export function getExtensionSettingsUrl(): string {
  const extensionId = chrome.runtime.id;
  return `chrome://extensions/?id=${extensionId}`;
}

// Try to check if file exists (only works with file access)
export async function checkFileExists(url: string): Promise<'unknown' | 'available' | 'missing'> {
  const hasAccess = await hasFileAccess();
  if (!hasAccess) {
    return 'unknown';
  }
  
  try {
    // Try to fetch file (requires file access permission)
    const response = await fetch(url);
    return response.ok ? 'available' : 'missing';
  } catch {
    return 'missing';
  }
}

// Per-device path prefix override (for cross-platform sync in v2)
// Example: /Users/alice/tools → C:\Users\alice\tools
export interface PathOverride {
  from: string;  // Original prefix
  to: string;    // Device-specific prefix
}

export async function getPathOverrides(): Promise<PathOverride[]> {
  const settings = await db.settings.get('pathOverrides');
  return settings?.value ?? [];
}

export async function savePathOverrides(overrides: PathOverride[]): Promise<void> {
  await db.settings.put({
    key: 'pathOverrides',
    value: overrides
  });
}

export function applyPathOverride(url: string, overrides: PathOverride[]): string {
  if (!url.startsWith('file://')) return url;
  
  for (const override of overrides) {
    const fromPattern = `file://${override.from}`;
    if (url.startsWith(fromPattern)) {
      return url.replace(fromPattern, `file://${override.to}`);
    }
  }
  
  return url;
}
```

### 4. ZIP Export/Import

**src/core/export.ts**:
```typescript
import { strToU8, zipSync } from 'fflate';
import { db } from './db';

export interface ExportData {
  format: 'visual-launcher';
  schemaVersion: 1;
  exportedAt: string;
  groups: Group[];
  items: Item[];
}

export async function exportToZip(): Promise<Blob> {
  // Get all data
  const groups = await db.groups.toArray();
  const items = await db.items.toArray();
  
  // Build export data
  const exportData: ExportData = {
    format: 'visual-launcher',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    groups,
    items
  };
  
  // Collect thumbnails
  const thumbnailMap: Record<string, Uint8Array> = {};
  const uniqueHashes = new Set(
    items.map(item => item.previewHash).filter(Boolean) as string[]
  );
  
  for (const hash of uniqueHashes) {
    const thumbnail = await db.thumbnails.get(hash);
    if (thumbnail) {
      const arrayBuffer = await thumbnail.blob.arrayBuffer();
      thumbnailMap[`previews/${hash}.jpg`] = new Uint8Array(arrayBuffer);
    }
  }
  
  // Create ZIP
  const files: Record<string, Uint8Array> = {
    'launcher.json': strToU8(JSON.stringify(exportData, null, 2)),
    ...thumbnailMap
  };
  
  const zipped = zipSync(files, {
    level: 6, // Medium compression
  });
  
  return new Blob([zipped], { type: 'application/zip' });
}

export function downloadZip(blob: Blob, filename: string = 'favoritepod-export.zip'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

**src/core/import.ts**:
```typescript
import { unzipSync, strFromU8 } from 'fflate';
import { db, Group, Item } from './db';
import { z } from 'zod';
import { isValidUrl } from './validation';

// Validation schema
const ExportSchema = z.object({
  format: z.literal('visual-launcher'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  groups: z.array(z.any()), // Define full schemas later
  items: z.array(z.any())
});

export type ImportMode = 'merge' | 'replace';

export async function importFromZip(
  file: File,
  mode: ImportMode
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  
  try {
    // Read ZIP
    const arrayBuffer = await file.arrayBuffer();
    const unzipped = unzipSync(new Uint8Array(arrayBuffer));
    
    // Parse launcher.json
    const launcherJson = unzipped['launcher.json'];
    if (!launcherJson) {
      throw new Error('Missing launcher.json in ZIP');
    }
    
    const jsonStr = strFromU8(launcherJson);
    const data = JSON.parse(jsonStr);
    
    // Validate format
    const parseResult = ExportSchema.safeParse(data);
    if (!parseResult.success) {
      throw new Error('Invalid export format');
    }
    
    // Validate all URLs
    for (const item of data.items) {
      if (!isValidUrl(item.url)) {
        errors.push(`Invalid URL rejected: ${item.url}`);
        item._skip = true;
      }
    }
    
    // Validate images
    const thumbnailHashes = new Set<string>();
    for (const [path, bytes] of Object.entries(unzipped)) {
      if (path.startsWith('previews/')) {
        const hash = path.replace('previews/', '').replace('.jpg', '');
        
        try {
          // Verify it's a valid image
          const blob = new Blob([bytes], { type: 'image/jpeg' });
          await createImageBitmap(blob);
          thumbnailHashes.add(hash);
        } catch {
          errors.push(`Corrupted image: ${path}`);
        }
      }
    }
    
    // Import in transaction
    await db.transaction('rw', [db.groups, db.items, db.thumbnails], async () => {
      if (mode === 'replace') {
        // Clear existing data (v1 simple replace)
        await db.groups.clear();
        await db.items.clear();
        // Keep thumbnails for now (cleanup separately)
      }
      
      // Import groups
      for (const group of data.groups) {
        await db.groups.put(group);
      }
      
      // Import items
      let imported = 0;
      for (const item of data.items) {
        if (item._skip) continue;
        delete item._skip;
        await db.items.put(item);
        imported++;
      }
      
      // Import thumbnails
      for (const [path, bytes] of Object.entries(unzipped)) {
        if (path.startsWith('previews/')) {
          const hash = path.replace('previews/', '').replace('.jpg', '');
          if (thumbnailHashes.has(hash)) {
            const blob = new Blob([bytes], { type: 'image/jpeg' });
            const img = await createImageBitmap(blob);
            
            await db.thumbnails.put({
              hash,
              blob,
              size: blob.size,
              width: img.width,
              height: img.height,
              createdAt: Date.now()
            });
          }
        }
      }
      
      return { imported, errors };
    });
    
    return { imported: data.items.length - errors.length, errors };
  } catch (error) {
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

---

## API Reference

### Chrome Extension APIs Used

#### chrome.tabs
```typescript
// Get current tab
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

// Capture screenshot (requires activeTab)
const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
  format: 'jpeg',
  quality: 80
});

// Open URL in new tab
await chrome.tabs.create({ url: 'https://example.com' });

// Open file:// URL (requires file access)
await chrome.tabs.create({ url: 'file:///Users/example/file.html' });
```

#### chrome.runtime
```typescript
// Get extension ID
const extensionId = chrome.runtime.id;

// Get manifest
const manifest = chrome.runtime.getManifest();

// Build extension URL
const faviconUrl = chrome.runtime.getURL('/_favicon/?pageUrl=...');
```

#### chrome.extension
```typescript
// Check file:// access permission
const hasAccess = await chrome.extension.isAllowedFileSchemeAccess();
```

#### chrome.storage (optional, v1 uses IndexedDB)
```typescript
// Set data
await chrome.storage.local.set({ key: 'value' });

// Get data
const data = await chrome.storage.local.get('key');
```

---

## Common Patterns

### Pattern 1: Add Bookmark Review

The toolbar popup keeps recent favorites on its home screen. Its **Add bookmark**
action opens a review dialog for the active tab. When that dialog opens, look up
the exact URL in the library; edit the existing favorite when found, otherwise
capture a thumbnail when possible and create the favorite in the last-used
folder. **Done** persists name and folder edits, while **Remove** deletes the
favorite. Closing the dialog without either action leaves the default favorite
in place when it was newly created.

The popup's recent-pages list uses `useRecentItems(5)` so updates from the review
dialog appear without reloading the popup. `dismissRecentItem(id)` hides a row
from this list without deleting its favorite; editing that favorite restores it
to recent pages. `captureFavicon` reads the tab icon (then Chrome's `_favicon/`
endpoint if necessary), decodes it, and stores a 32px PNG data URL in `faviconUrl`.
The shared `FaviconImage` prefers saved pixels, then the cached Chrome icon, and
finally a globe/file fallback. It is used by the popup, review dialog, and launcher.
Reopening Add bookmark for an existing URL refreshes its icon without duplicating
the favorite. A failed capture preserves the previous icon. The `faviconUrl` field
has its own merge clock; database version 2 backfills clocks for legacy records.
The `_favicon/` endpoint requires the manifest's `favicon` permission.

### Pattern 2: Display Items with Thumbnails

```typescript
// In dashboard (dashboard/components/ItemCard.tsx)
function ItemCard({ item }: { item: Item }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadThumbnail() {
      if (!item.previewHash) return;
      
      const blob = await getThumbnail(item.previewHash);
      if (blob) {
        setThumbnailUrl(URL.createObjectURL(blob));
      }
    }
    
    loadThumbnail();
    
    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [item.previewHash]);
  
  return (
    <div className="item-card">
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt={item.title} />
      ) : (
        <FallbackCard title={item.title} url={item.url} />
      )}
      <div className="item-title">{item.title}</div>
    </div>
  );
}
```

### Pattern 3: Open Item (handles file://)

```typescript
async function handleOpenItem(item: Item) {
  try {
    if (item.url.startsWith('file://')) {
      // Special handling for file:// URLs
      await openFileUrl(item.url);
    } else {
      // Regular URLs can use chrome.tabs.create
      await chrome.tabs.create({ url: item.url });
    }
  } catch (error) {
    if (error.message === 'FILE_ACCESS_DENIED') {
      // Show permission hint
      setShowFileAccessHint(true);
    } else {
      setErrorMessage('Could not open link');
    }
  }
}
```

### Pattern 4: Drag-and-Drop Ordering (v1)

The dashboard uses the HTML5 drag-and-drop API for favorite and group moves.
`src/dashboard/drag.ts` writes a typed payload; persistence stays in
`src/core/storage.ts` through `moveItem()` and `moveGroup()`, which calculate
fractional keys and prevent group cycles. The target row or card shows the drop
state, and the dragged card supplies its preview image.

Native drag-and-drop does not provide keyboard operation. Keep equivalent
actions in the menus: favorites can move to a group or move up/down, and groups
can change parent or move up/down. This keeps ordering available without a
pointer and avoids putting ordering logic in the React components.

---

## Debugging Guide

### Chrome Extension DevTools

1. **Extension Management**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" → select `dist/` folder
   - Click "Reload" after changes

2. **Popup Debugging**:
   - Right-click extension icon → "Inspect popup"
   - Console, Network, and Elements tabs available
   - Popup closes when DevTools loses focus (pin it open)

3. **Dashboard Debugging**:
   - Open dashboard in tab
   - Use regular DevTools (F12)
   - Full debugging experience

4. **Service Worker Debugging**:
   - Go to `chrome://extensions/`
   - Find your extension
   - Click "service worker" link
   - View console logs, set breakpoints

5. **View IndexedDB**:
   - DevTools → Application tab → Storage → IndexedDB
   - Browse tables and data
   - Run queries manually

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Popup won't open | Manifest path wrong | Check `action.default_popup` path |
| Can't capture screenshot | Missing `activeTab` | Add to manifest permissions |
| Can't open file:// | Missing file access | User must enable in chrome://extensions |
| IndexedDB quota exceeded | Too many images | Add `unlimitedStorage` permission |
| Service worker crashes | Long-running code | Break into smaller tasks |
| Vite HMR broken | Extension context | Reload extension manually |

### Logging Best Practices

```typescript
// Use structured logging
console.log('[FavoritePod]', 'Action:', data);

// Error logging with context
console.error('[FavoritePod] Failed to save item:', {
  itemId: item.id,
  error: error.message,
  stack: error.stack
});

// Performance logging
console.time('[FavoritePod] Thumbnail capture');
const result = await captureVisibleTab();
console.timeEnd('[FavoritePod] Thumbnail capture');
```

---

## Next Steps

1. **Read DESIGN_GUIDE.md** for UI/UX patterns
2. **Start with Phase 1** in IMPLEMENTATION_PLAN.md
3. **Build the spike** (Phase 1.2) to validate risky APIs
4. **Iterate module by module** using this guide as reference

---

## AI Agent Notes

This guide is designed for AI agents to implement FavoritePod:

- **Copy-paste ready**: Code examples work as-is
- **Type-safe**: Full TypeScript types provided
- **Modular**: Each module can be built independently
- **Testable**: Pure functions where possible
- **Documented**: Comments explain "why", not just "what"

When asking an AI agent to implement a module:
1. Provide this CODE_GUIDE.md
2. Reference the specific module section
3. Include acceptance criteria from IMPLEMENTATION_PLAN.md
4. Request manual test instructions

Example prompt:
```
Implement the thumbnail capture module (src/core/thumbnail.ts) following 
CODE_GUIDE.md section "Module Reference #2". Include:
1. captureVisibleTab() function
2. resizeImage() helper
3. saveThumbnail() and getThumbnail() functions
4. Manual test instructions for me to verify it works

Also create a simple test page (test-thumbnail.html) I can load in the 
dashboard to test capturing.
```

