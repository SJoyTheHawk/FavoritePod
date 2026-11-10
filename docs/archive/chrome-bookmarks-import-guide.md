# Implementation Guide: Chrome Bookmarks Import & chrome:// Shortcuts

> Historical reference. For current work, use the [implementation plan](../planning/implementation-plan.md) or [publishing checklist](../publishing/README.md).

## Executive Summary

This guide provides a complete implementation strategy for:
1. **Chrome Bookmarks HTML Import** — Parse and import Chrome's exported bookmark HTML files
2. **chrome:// Shortcut Support** — Add support for Chrome shortcut URLs (e.g., `chrome://settings`, `chrome://extensions`)

Both features align with FavoritePod's existing architecture and require minimal schema changes.

---

## Part 1: Chrome Bookmarks HTML Import

### 1.1 Validation Against Plan

The plan in `docs/archive/chrome-bookmarks-import-plan.md` is **fully compatible** with the current system:

| Requirement | Status | Notes |
|---|---|---|
| Dialog styling & patterns | ✅ Compatible | Existing `ImportExportDialog.tsx` can be extended |
| File picker & drag-drop | ✅ Compatible | Already implemented in `ImportExportDialog` |
| Progress & notifications | ✅ Compatible | Uses existing `ArchiveProgress` interface |
| Folder hierarchy preservation | ✅ Compatible | Uses existing `Group` nesting model |
| URL scheme validation | ⚠️ Needs update | Only HTTP/HTTPS/file supported; need to add chrome:// |
| Core parsing module | ✅ Needed | Create new `parse-chrome-bookmarks.ts` module |
| Import via existing flow | ✅ Compatible | Reuse `importArchive()` and `remapForCopy()` |
| Atomic writes & sync | ✅ Compatible | Uses existing transaction & HLC clock system |

### 1.2 Architecture Overview

```
┌─────────────────────────────────────┐
│   Chrome Bookmarks HTML File        │
│   (user exports from Bookmark Mgr)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ parseChromBookmarksHtml()                    │
│ - Parse HTML using parse5                    │
│ - Extract bookmarks & folders                │
│ - Validate URLs (with chrome:// support)     │
│ - Build folder tree                          │
│ - Skip unsupported URLs                      │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ Intermediate Format                          │
│ {                                            │
│   bookmarks: [{ url, title, added }]         │
│   folders: [{ title, children[] }]           │
│   errors: [{ url, reason }]                  │
│ }                                            │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ chromBookmarksToArchive()                    │
│ - Convert to ImportArchive format            │
│ - Generate fresh IDs                         │
│ - Create HLC clocks                          │
│ - Build import container group               │
└──────────────┬───────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────┐
│ importArchive()  [EXISTING]                  │
│ - Merge/replace/update logic                 │
│ - Atomic database writes                     │
└──────────────────────────────────────────────┘
```

### 1.3 Core Implementation: Bookmark Parser

**File:** `src/core/parse-chrome-bookmarks.ts`

```typescript
import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { isValidUrl } from './validation';

export interface ChromeBookmark {
  url: string;
  title: string;
  added: Date;
}

export interface ChromeFolder {
  title: string;
  added?: Date;
  children: (ChromeBookmark | ChromeFolder)[];
}

export interface ParseChromBookmarksResult {
  folders: ChromeFolder[];
  skipped: Array<{ url?: string; title?: string; reason: string }>;
}

/**
 * Parse Chrome's exported bookmarks HTML file.
 * 
 * Chrome exports bookmarks as HTML with this structure:
 * ```html
 * <!DOCTYPE NETSCAPE-Bookmark-file-1>
 * <!-- This is an auto generated file by Chromium. Editing is not recommended. -->
 * <DT><H3 FOLDED ADD_DATE="1234567890">Folder Name</H3>
 * <DL><p>
 *   <DT><A HREF="https://example.com" ADD_DATE="1234567890">Title</A>
 * </DL><p>
 * ```
 * 
 * Handles:
 * - Omitted closing tags (loose HTML)
 * - HTML entities (&amp;, &quot;, etc.)
 * - FOLDED attribute (folder state, ignored)
 * - ADD_DATE timestamps
 * - Deeply nested folders
 * - Invalid/unsupported URLs (silently skipped with reason)
 */
export function parseChromBookmarksHtml(
  html: string,
): ParseChromBookmarksResult {
  const document = parse(html);
  const skipped: ParseChromBookmarksResult['skipped'] = [];
  const folders: ChromeFolder[] = [];

  function parseNode(node: DefaultTreeAdapterMap['node']): ChromeFolder | ChromeBookmark | null {
    if (node.nodeName === 'a') {
      const href = getAttribute(node, 'href')?.trim();
      const addDate = getAttribute(node, 'add_date');
      const title = getNodeText(node).trim();

      if (!href) {
        skipped.push({ title: title || '(no URL)', reason: 'Missing URL attribute' });
        return null;
      }

      // Validate URL — include chrome:// support
      if (!isValidUrl(href) && !href.startsWith('chrome://')) {
        skipped.push({ url: href, title: title || href, reason: 'Unsupported URL scheme' });
        return null;
      }

      return {
        url: href,
        title: title || href,
        added: addDate ? new Date(parseInt(addDate, 10) * 1000) : new Date(),
      };
    }

    if (node.nodeName === 'h3') {
      const title = getNodeText(node).trim();
      const addDate = getAttribute(node, 'add_date');
      const folder: ChromeFolder = {
        title: title || 'Untitled folder',
        added: addDate ? new Date(parseInt(addDate, 10) * 1000) : undefined,
        children: [],
      };

      // Find sibling DL (definition list) containing children
      let sibling = node.parentNode?.childNodes?.find(
        (n): n is DefaultTreeAdapterMap['node'] =>
          n.nodeName === 'dl' && isFollowingSibling(node, n),
      );

      if (sibling) {
        const childNodes = sibling.childNodes ?? [];
        for (const child of childNodes) {
          if (child.nodeName === 'dt') {
            // DT contains either <A>, <H3>, or nested structure
            for (const descendant of child.childNodes ?? []) {
              const parsed = parseNode(descendant);
              if (parsed) folder.children.push(parsed);
            }
          }
        }
      }

      return folder;
    }

    if (node.childNodes) {
      for (const child of node.childNodes) {
        const result = parseNode(child);
        if (result) {
          if (result.url) {
            // This is a bookmark at root level
            folders.push({
              title: '',
              children: [result],
            });
          } else {
            // This is a folder
            folders.push(result);
          }
        }
      }
    }

    return null;
  }

  // Start parsing from document root
  parseNode(document as DefaultTreeAdapterMap['node']);

  return { folders, skipped };
}

/**
 * Get text content of a node (recursively).
 */
function getNodeText(node: DefaultTreeAdapterMap['node']): string {
  if (node.nodeName === '#text' && 'value' in node) {
    return node.value;
  }
  let text = '';
  if (node.childNodes) {
    for (const child of node.childNodes) {
      text += getNodeText(child);
    }
  }
  return text;
}

/**
 * Get attribute value (case-insensitive).
 */
function getAttribute(
  node: DefaultTreeAdapterMap['node'],
  name: string,
): string | undefined {
  if ('attrs' in node && Array.isArray(node.attrs)) {
    return node.attrs.find((attr) => attr.name.toLowerCase() === name.toLowerCase())
      ?.value;
  }
  return undefined;
}

/**
 * Check if `target` is a following sibling of `node`.
 */
function isFollowingSibling(
  node: DefaultTreeAdapterMap['node'],
  target: DefaultTreeAdapterMap['node'],
): boolean {
  const parent = node.parentNode;
  if (!parent?.childNodes) return false;
  let found = false;
  for (const child of parent.childNodes) {
    if (child === node) found = true;
    if (found && child === target) return true;
  }
  return false;
}
```

### 1.4 Conversion to ImportArchive Format

**File:** `src/core/import-chrome.ts` (new file)

```typescript
import { createHLC } from './hlc';
import { nextOrderKey } from './ordering';
import type { Group, Item } from './types';
import type { ImportArchive } from './archive';
import type { ChromeFolder, ParseChromBookmarksResult } from './parse-chrome-bookmarks';
import { getDefaultTitle } from './validation';

export async function chromBookmarksToArchive(
  parsed: ParseChromBookmarksResult,
  filename: string,
  deviceId: string,
): Promise<ImportArchive> {
  const now = Date.now();
  const clock = createHLC(now, 0, deviceId);

  const groups: Group[] = [];
  const items: Item[] = [];
  const groupOrderKeys: string[] = [];

  // Create root import container
  const importContainerId = crypto.randomUUID();
  const containerTitle = filename
    .replace(/\.html?$/i, '')
    .trim()
    .slice(0, 80) || 'Chrome import';

  groups.push({
    id: importContainerId,
    parentId: null,
    orderKey: nextOrderKey([]),
    title: `Imported: ${containerTitle}`,
    clock: { parentId: clock, orderKey: clock, title: clock },
  });

  // Process folders and bookmarks
  let itemOrderKeys: string[] = [];
  processChromeFolders(
    parsed.folders,
    importContainerId,
    groups,
    items,
    groupOrderKeys,
    itemOrderKeys,
    clock,
  );

  return {
    data: {
      schemaVersion: 1,
      groups,
      items,
    },
    thumbnails: new Map(),
    filename: `${containerTitle}.zip`,
  };
}

function processChromeFolders(
  folders: ChromeFolder[],
  parentId: string,
  groups: Group[],
  items: Item[],
  groupOrderKeys: string[],
  itemOrderKeys: string[],
  baseClock: string,
): void {
  for (const folder of folders) {
    if (!folder.title || folder.title === '') {
      // Loose bookmarks at this level
      for (const child of folder.children) {
        if ('url' in child) {
          processBookmark(child, parentId, items, itemOrderKeys, baseClock);
        }
      }
      continue;
    }

    // Create a new group for this folder
    const groupId = crypto.randomUUID();
    const orderKey = nextOrderKey(groupOrderKeys);
    groupOrderKeys.push(orderKey);

    groups.push({
      id: groupId,
      parentId,
      orderKey,
      title: folder.title,
      clock: { parentId: baseClock, orderKey: baseClock, title: baseClock },
    });

    // Recurse into children
    let nestedItemOrderKeys: string[] = [];
    const nestedFolders = folder.children.filter(
      (child): child is ChromeFolder => !('url' in child),
    );
    processChromeFolders(
      nestedFolders,
      groupId,
      groups,
      items,
      [],
      nestedItemOrderKeys,
      baseClock,
    );

    // Process bookmarks in this folder
    const bookmarks = folder.children.filter(
      (child): child is ChromeBookmark => 'url' in child,
    );
    for (const bookmark of bookmarks) {
      processBookmark(bookmark, groupId, items, nestedItemOrderKeys, baseClock);
    }
  }
}

function processBookmark(
  bookmark: ChromeBookmark,
  groupId: string,
  items: Item[],
  orderKeys: string[],
  baseClock: string,
): void {
  const orderKey = nextOrderKey(orderKeys);
  orderKeys.push(orderKey);

  items.push({
    id: crypto.randomUUID(),
    groupId,
    orderKey,
    url: bookmark.url,
    title: bookmark.title || getDefaultTitle(bookmark.url),
    clock: { groupId: baseClock, orderKey: baseClock, url: baseClock, title: baseClock, previewHash: baseClock, faviconUrl: baseClock },
  });
}
```

### 1.5 UI Integration: Chrome Bookmarks Dialog

**File:** `src/dashboard/components/ChromeBookmarksImportDialog.tsx` (new file)

Extend the existing `ImportExportDialog` to support Chrome HTML import:

```typescript
import { AnimatedDialog, useDialogTransition } from '../../components/AnimatedDialog';
import { useRef, useState, type DragEvent } from 'react';
import { DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ArrowUpTrayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { parseChromBookmarksHtml } from '../../core/parse-chrome-bookmarks';
import { chromBookmarksToArchive } from '../../core/import-chrome';
import { importArchive } from '../../core/import';
import { getDeviceId } from '../../core/storage';

interface ChromeBookmarksImportDialogProps {
  onClose: () => void;
  onImported: (result: { importedGroups: number; importedItems: number }) => void;
}

export function ChromeBookmarksImportDialog({
  onClose: onClosed,
  onImported,
}: ChromeBookmarksImportDialogProps) {
  const dialogTransition = useDialogTransition(onClosed);
  const onClose = dialogTransition.close;
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
  const [preview, setPreview] = useState<{
    bookmarkCount: number;
    folderCount: number;
    skippedCount: number;
    filename: string;
  }>();

  const chooseFile = async (file?: File) => {
    if (!file || busy) return;
    setError(undefined);
    setReviewing(false);
    setPreview(undefined);
    setBusy(true);

    try {
      const html = await file.text();
      const parsed = parseChromBookmarksHtml(html);

      const bookmarkCount = countBookmarks(parsed.folders);
      const folderCount = countFolders(parsed.folders);

      setPreview({
        bookmarkCount,
        folderCount,
        skippedCount: parsed.skipped.length,
        filename: file.name,
      });
      setReviewing(true);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to parse bookmarks file.',
      );
    } finally {
      setBusy(false);
    }
  };

  const applyImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError(undefined);

    try {
      const input = document.getElementById('chrome-bookmarks-input') as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) throw new Error('No file selected.');

      const html = await file.text();
      const parsed = parseChromBookmarksHtml(html);
      const deviceId = await getDeviceId();
      const archive = await chromBookmarksToArchive(parsed, file.name, deviceId);

      const result = await importArchive(archive, 'copy');
      onImported(result);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Failed to import bookmarks.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingFile(false);
    void chooseFile(event.dataTransfer.files[0]);
  };

  return (
    <AnimatedDialog
      className="relative z-50"
      onClose={busy ? () => {} : onClose}
      open={dialogTransition.open}
      afterLeave={dialogTransition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          transition
          className="dialog-panel max-h-[calc(100vh-2rem)] w-full min-w-0 max-w-xl overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <ArrowUpTrayIcon aria-hidden="true" className="h-5 w-5 text-primary" />
              Import Chrome Bookmarks
            </DialogTitle>
            <button
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          {!reviewing ? (
            <div className="mt-5 grid gap-4">
              <div
                className={`rounded-md border border-dashed p-5 text-center transition-colors ${draggingFile ? 'border-primary bg-primary-light/40' : 'border-border bg-surface'}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDraggingFile(true);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) setDraggingFile(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onFileDrop}
              >
                <input
                  accept=".html,.htm,text/html"
                  className="sr-only"
                  id="chrome-bookmarks-input"
                  onChange={(event) => {
                    void chooseFile(event.currentTarget.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  ref={inputRef}
                  type="file"
                />
                <ArrowUpTrayIcon
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-text-secondary"
                />
                <p className="mt-2 text-sm font-medium text-text-primary">
                  Drop Chrome bookmarks HTML here
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Export from Chrome: Bookmark Manager → ⋮ → Export Bookmarks
                </p>
                <button
                  className="mt-3 min-h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  Choose file
                </button>
              </div>

              {error && (
                <p className="rounded-md border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          ) : preview ? (
            <div className="mt-5 grid gap-4">
              <div className="rounded-md border border-border p-3">
                <p className="text-sm font-medium text-text-primary">
                  {preview.folderCount} folders
                </p>
                <p className="text-sm font-medium text-text-primary">
                  {preview.bookmarkCount} bookmarks
                </p>
                {preview.skippedCount > 0 && (
                  <p className="mt-1 text-xs text-warning">
                    {preview.skippedCount} bookmarks skipped (unsupported schemes)
                  </p>
                )}
              </div>

              <p className="text-sm text-text-secondary">
                A new folder "Imported: {preview.filename.replace(/\.html?$/i, '')}" will be created.
              </p>

              {error && (
                <p className="rounded-md border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <button
              className="min-h-10 rounded-md border border-border px-4 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
              disabled={busy}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            {reviewing && (
              <>
                <button
                  className="min-h-10 rounded-md border border-border px-4 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
                  disabled={busy}
                  onClick={() => setReviewing(false)}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void applyImport()}
                  type="button"
                >
                  <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />
                  {busy ? 'Importing...' : 'Import'}
                </button>
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </AnimatedDialog>
  );
}

function countBookmarks(folders: ChromeFolder[]): number {
  let count = 0;
  for (const folder of folders) {
    for (const child of folder.children) {
      if ('url' in child) count++;
      else count += countBookmarks([child]);
    }
  }
  return count;
}

function countFolders(folders: ChromeFolder[]): number {
  let count = folders.filter((f) => f.title).length;
  for (const folder of folders) {
    const nested = folder.children.filter(
      (child): child is ChromeFolder => !('url' in child),
    );
    count += countFolders(nested);
  }
  return count;
}
```

---

## Part 2: Supporting chrome:// and chrome-extension:// Shortcuts

### 2.1 Current State

**Current allowed protocols:** HTTP, HTTPS, file

**Location:** `src/core/validation.ts`, line 1

```typescript
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
```

### 2.2 Protocols in Real Chrome Exports

Chrome bookmarks can contain:
- ✅ `http://`, `https://`, `file://` (already supported)
- ✅ `chrome://` (Settings, Extensions, History, Bookmarks, Downloads)
- ✅ `chrome-extension://` (Extension options pages)
- ⚠️ `ftp://` (deprecated, skip)
- ⚠️ `mailto:`, `tel:`, `sms:` (non-browsable, skip)

### 2.3 Implementation: Add Protocol Support (No Data Loss)

**Decision:** Store legacy protocols (ftp://, mailto:, tel:) but show error when opened, preserving data integrity during round-trip (Chrome → FavoritePod → Chrome).

See: `PROTOCOL_SUPPORT_DECISION.md` for full rationale.

**File:** `src/core/validation.ts` (modify)

```typescript
// Store all protocols, even if we can't open some
const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'file:',
  'chrome:',
  'chrome-extension:',
  'ftp:',        // Store for data preservation; error on open
  'mailto:',     // Works via OS handler
  'tel:',        // Works via OS handler
  'sms:',        // Works via OS handler
]);

export function parseSafeUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.hostname
    ) {
      return null;
    }
    // Non-web protocols don't require hostname
    return parsed;
  } catch {
    return null;
  }
}

export function getUrlLabel(value: string): string {
  const parsed = parseSafeUrl(value);
  if (!parsed) return value;
  if (parsed.protocol === 'file:') return 'Local file';
  if (parsed.protocol === 'chrome:') return 'Chrome shortcut';
  if (parsed.protocol === 'chrome-extension:') return 'Chrome extension';
  if (parsed.protocol === 'ftp:') return 'FTP (legacy)';
  if (parsed.protocol === 'mailto:') return 'Email';
  if (parsed.protocol === 'tel:') return 'Phone';
  if (parsed.protocol === 'sms:') return 'SMS';
  return parsed.hostname || 'Web link';
}

export function getDefaultTitle(value: string): string {
  const parsed = parseSafeUrl(value);
  if (!parsed) return '';
  if (parsed.protocol === 'chrome:') {
    const path = parsed.pathname || parsed.href.slice('chrome://'.length);
    return path.split('/')[0].charAt(0).toUpperCase() + path.split('/')[0].slice(1);
  }
  if (parsed.protocol === 'chrome-extension:') {
    const path = parsed.pathname?.slice(1) || 'extension';
    const name = path.split('/')[0] || 'Extension';
    return name.charAt(0).toUpperCase() + name.slice(1);
  }
  if (parsed.protocol === 'mailto:') {
    return parsed.pathname || 'Email';
  }
  if (parsed.protocol === 'tel:' || parsed.protocol === 'sms:') {
    return parsed.pathname || 'Phone';
  }
  if (parsed.protocol === 'ftp:') {
    return parsed.hostname || 'FTP Server';
  }
  if (parsed.protocol !== 'file:') return parsed.hostname || 'Web link';
  const name = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (!name) return 'Local file';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
```

**File:** `src/core/file-links.ts` (modify `openSavedUrl`)

```typescript
export async function openSavedUrl(url: string): Promise<void> {
  const parsed = parseSafeUrl(url);
  if (!parsed) throw new Error('This favorite has an invalid address.');
  
  if (parsed.protocol === 'file:') {
    await openFileUrl(url);
    return;
  }
  
  if (parsed.protocol === 'ftp:') {
    throw new Error(
      'FTP is no longer supported by Chrome (removed October 2021). ' +
      'Copy the URL and use an FTP client to access it.'
    );
  }
  
  // mailto:, tel:, sms:, chrome://, chrome-extension://, http://, https://
  // All work via chrome.tabs.create() or OS handlers
  await chrome.tabs.create({ url });
}
```

### 2.3 File Links: Support Opening chrome:// URLs

**File:** `src/core/file-links.ts` (modify `openSavedUrl` function)

```typescript
export async function openSavedUrl(url: string): Promise<void> {
  const parsed = parseSafeUrl(url);
  if (!parsed) throw new Error('This favorite has an invalid address.');
  
  if (parsed.protocol === 'file:') {
    await openFileUrl(url);
    return;
  }
  
  if (parsed.protocol === 'chrome:') {
    // Open Chrome shortcuts directly
    await chrome.tabs.create({ url });
    return;
  }
  
  await chrome.tabs.create({ url });
}
```

### 2.4 UI: Display chrome:// Labels

**File:** `src/dashboard/components/FavoriteCard.tsx` (already respects `getUrlLabel()`)

No changes needed — the component already uses `getUrlLabel()` which now returns "Chrome shortcut" for chrome:// URLs.

### 2.5 Tests: Validate chrome:// Support

**File:** `src/core/validation.test.ts` (create or add)

```typescript
import { describe, expect, it } from 'vitest';
import { parseSafeUrl, isValidUrl, getUrlLabel, getDefaultTitle } from './validation';

describe('chrome:// URL support', () => {
  it('accepts chrome:// shortcuts', () => {
    expect(parseSafeUrl('chrome://settings')).not.toBeNull();
    expect(parseSafeUrl('chrome://extensions')).not.toBeNull();
    expect(parseSafeUrl('chrome://history')).not.toBeNull();
    expect(parseSafeUrl('chrome://bookmarks')).not.toBeNull();
    expect(isValidUrl('chrome://downloads')).toBe(true);
  });

  it('parses chrome:// URLs correctly', () => {
    const url = parseSafeUrl('chrome://settings');
    expect(url?.protocol).toBe('chrome:');
    expect(url?.pathname).toBe('settings');
  });

  it('generates readable labels for chrome:// shortcuts', () => {
    expect(getUrlLabel('chrome://settings')).toBe('Chrome shortcut');
    expect(getUrlLabel('chrome://extensions')).toBe('Chrome shortcut');
  });

  it('generates readable titles from chrome:// shortcuts', () => {
    expect(getDefaultTitle('chrome://settings')).toBe('Settings');
    expect(getDefaultTitle('chrome://extensions')).toBe('Extensions');
    expect(getDefaultTitle('chrome://downloads')).toBe('Downloads');
    expect(getDefaultTitle('chrome://bookmarks')).toBe('Bookmarks');
  });

  it('still validates http/https/file URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
    expect(isValidUrl('http://example.com')).toBe(true);
    expect(isValidUrl('file:///path/to/file')).toBe(true);
    expect(isValidUrl('javascript:alert(1)')).toBe(false);
    expect(isValidUrl('data:text/html,<h1>test</h1>')).toBe(false);
  });
});
```

---

## Part 3: Show Hidden Bookmarks Feature

Some bookmarks cannot be opened on the current system:
- `mailto:` — Hidden on mobile (works only on desktop)
- `tel:` — Hidden on desktop (works only on mobile)
- `ftp://` — Hidden everywhere (deprecated in Chrome 2021)

These are filtered out by default to avoid clutter. Add UI toggle "Show hidden bookmarks" to reveal them.

### Implementation

**Mark bookmarks as hidden** (in validation):
```typescript
export function isHiddenOnThisPlatform(url: string): boolean {
  const parsed = parseSafeUrl(url);
  if (!parsed) return false;
  
  const isMobile = window.innerWidth < 768; // or use navigator.userAgent
  
  if (parsed.protocol === 'tel:' || parsed.protocol === 'sms:') {
    return !isMobile; // Hidden on desktop
  }
  if (parsed.protocol === 'mailto:') {
    return isMobile; // Hidden on mobile
  }
  if (parsed.protocol === 'ftp:') {
    return true; // Hidden everywhere
  }
  
  return false;
}
```

**In UI, add toggle:**
```typescript
// In DashboardApp or SettingsDialog
const [showHiddenBookmarks, setShowHiddenBookmarks] = useState(false);

// Filter items
const visibleItems = items.filter(item =>
  showHiddenBookmarks || !isHiddenOnThisPlatform(item.url)
);
```

**When user tries to delete group with hidden bookmarks:**
```typescript
const hiddenCount = items.filter(
  i => i.groupId === groupId && isHiddenOnThisPlatform(i.url)
).length;

if (hiddenCount > 0) {
  throw new Error(
    `Cannot delete: This group contains ${hiddenCount} hidden bookmarks. ` +
    `Enable "Show hidden bookmarks" in settings to see and manage them.`
  );
}
```

**Benefits:**
- User discovers hidden bookmarks when trying to delete group
- Can toggle visibility to see/remove them
- Clear error message guides them to the solution
- Keeps UI clean by default (hides unsupported protocols)

---

## Part 4: Export to Chrome HTML Format

FavoritePod can export bookmarks as **Netscape Bookmark HTML** (same format Chrome uses), compatible with Chrome's import.

### 3.1 Chrome HTML Export Implementation

**New File:** `src/core/export-chrome.ts`

```typescript
import type { Group, Item } from './types';

export function exportToChromiumHtml(
  groups: Group[],
  items: Item[],
  groupIds?: Set<string>,
): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const selectedGroups = groupIds ? groups.filter((g) => groupIds.has(g.id)) : groups;
  
  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an auto generated file by FavoritePod. Editing is not recommended. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks from FavoritePod</TITLE>
<H1>Bookmarks</H1>
<DL><p>
`;

  const rootFolders = selectedGroups.filter((g) => !g.parentId);
  const childrenByParent = new Map<string, Group[]>();
  
  for (const group of selectedGroups) {
    if (!group.parentId) continue;
    const children = childrenByParent.get(group.parentId) ?? [];
    children.push(group);
    childrenByParent.set(group.parentId, children);
  }

  function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderFolder(group: Group, depth: number): string {
    const indent = '  '.repeat(depth);
    const children = childrenByParent.get(group.id) ?? [];
    const folderItems = items.filter((i) => i.groupId === group.id && !i.deleted);
    
    let result = `${indent}<DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${escapeHtml(group.title)}</H3>\n`;
    result += `${indent}<DL><p>\n`;

    for (const item of folderItems) {
      result += `${indent}  <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${timestamp}">${escapeHtml(item.title)}</A>\n`;
    }

    for (const child of children) {
      result += renderFolder(child, depth + 1);
    }

    result += `${indent}</DL><p>\n`;
    return result;
  }

  for (const group of rootFolders) {
    html += renderFolder(group, 1);
  }

  html += `</DL><p>\n`;
  return html;
}

export function downloadChromiumHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

### 3.2 UI Integration: Add Chrome HTML Export Button

In `ImportExportDialog.tsx`, add alongside ZIP export:

```typescript
{mode === 'export' ? (
  <>
    <button
      className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white..."
      onClick={() => exportAsZip()}
      type="button"
    >
      Download ZIP
    </button>
    <button
      className="inline-flex min-h-10 items-center gap-2 rounded-md bg-secondary px-4 text-sm font-medium text-white..."
      onClick={() => exportAsChrome()}
      type="button"
    >
      Export as Chrome HTML
    </button>
  </>
) : ...}
```

### 3.3 Round-Trip Compatibility

```
FavoritePod → Export Chrome HTML
           → Import into Chrome Bookmark Manager
           → Re-export from Chrome
           → Import back into FavoritePod
           ✅ Bookmarks preserved perfectly
```

---

## Part 4: Integration Checklist

### Phase 1: Core Parsing (No UI changes)
- [ ] Add `parse5` to `package.json` dependencies
- [ ] Create `src/core/parse-chrome-bookmarks.ts`
- [ ] Create `src/core/import-chrome.ts`
- [ ] Add tests for parsing and conversion
- [ ] Verify parse5 handles Chrome's loose HTML correctly

### Phase 2: URL Scheme Support
- [ ] Modify `src/core/validation.ts` to support `chrome://` and `chrome-extension://`
- [ ] Update `src/core/file-links.ts` to open chrome:// URLs (already works via `chrome.tabs.create()`)
- [ ] Add validation tests for chrome:// and chrome-extension:// URLs
- [ ] Update `discovery.test.ts` if needed (already filters chrome:// correctly)
- [ ] Update parser to skip unsupported protocols with reason in skipped array

### Phase 3: UI Integration
- [ ] Create `src/dashboard/components/ChromeBookmarksImportDialog.tsx`
- [ ] Update `src/dashboard/components/SettingsDialog.tsx` to add "Import Chrome Bookmarks" button
- [ ] Wire up dialog state in `DashboardApp.tsx`
- [ ] Test file drag-and-drop
- [ ] Test preview display with protocol breakdown
- [ ] Test import completion and notification

### Phase 4: Show Hidden Bookmarks Feature
- [ ] Add toggle in settings/dashboard to show/hide deleted items
- [ ] Filter items where `deleted` flag is set
- [ ] Test that deleted items sync properly to Drive
- [ ] Test recovery (toggle back and deleted items reappear)

### Phase 5: Export to Chrome HTML
- [ ] Create `src/core/export-chrome.ts`
- [ ] Add Chrome HTML export button to `ImportExportDialog.tsx`
- [ ] Test round-trip: export → import into Chrome → re-export → import back
- [ ] Verify folder hierarchy preserved
- [ ] Verify special characters escaped correctly

### Phase 5: Testing & Verification
- [ ] Unit tests: parsing, conversion, validation
- [ ] Integration tests: full import flow
- [ ] Manual testing with real Chrome exports
- [ ] Test edge cases: empty folders, unicode, duplicates, deep nesting
- [ ] Test chrome:// shortcuts open correctly
- [ ] Verify imported records survive export/import cycles

---

## Part 4: Common Chrome Bookmarks Scenarios

### Typical Chrome Bookmarks HTML Structure
```html
<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- auto generated -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>

<H1>Bookmarks</H1>
<DL>
  <p>
  <DT><H3 ADD_DATE="1704067200" LAST_MODIFIED="1704067200" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
  <DL><p>
    <DT><A HREF="https://github.com" ADD_DATE="1704067200">GitHub</A>
    <DT><A HREF="https://stackoverflow.com" ADD_DATE="1704067200">Stack Overflow</A>
  </DL><p>
  <DT><H3 ADD_DATE="1704067200">Work</H3>
  <DL><p>
    <DT><H3 ADD_DATE="1704067200">Projects</H3>
    <DL><p>
      <DT><A HREF="https://jira.example.com" ADD_DATE="1704067200">JIRA</A>
    </DL><p>
  </DL><p>
</DL><p>
```

### Handling Edge Cases

| Scenario | Action |
|---|---|
| Bookmark with no title | Use URL as title |
| Folder with no title | Use "Untitled folder" |
| Missing ADD_DATE | Use current time |
| Malformed URL (e.g., `ht!tps://bad`) | Skip with reason in UI |
| `javascript:` URL | Skip as unsupported |
| Duplicate URLs | Import all (FavoritePod stores each separately) |
| Deep nesting (10+ levels) | Preserve entire hierarchy |
| Unicode in titles/URLs | parse5 handles entities automatically |

---

## Part 5: Dependencies

### New Dependency
Add to `package.json`:
```json
{
  "parse5": "^7.1.0"
}
```

**Why parse5?**
- Handles loose HTML (omitted closing tags) that Chrome exports
- Automatically decodes HTML entities (`&amp;`, `&quot;`, `&#8217;`)
- Well-maintained, focused on correctness per HTML spec
- ~50KB gzipped, no further dependencies

---

## Part 6: Data Flow Diagram

```
User Action: "Import Chrome Bookmarks" button in Settings
                    ▼
          [ChromeBookmarksImportDialog]
                    ▼
            User selects/drops .html file
                    ▼
        parseChromBookmarksHtml(html: string)
                    ▼
            [ParseChromBookmarksResult]
            {folders, skipped}
                    ▼
            Show preview (count & errors)
                    ▼
        User confirms → applyImport()
                    ▼
        chromBookmarksToArchive() creates ImportArchive
                    ▼
        importArchive(archive, 'copy')
                    ▼
    DB writes Groups + Items in transaction
                    ▼
        Refresh UI / show success
```

---

## Implementation Notes

1. **No schema changes** — Uses existing Group/Item structures with fresh IDs
2. **URL validation** — Extend existing validator; no new types needed
3. **Atomic writes** — Leverages existing transaction mechanism
4. **Sync-safe** — Uses HLC clocks; new records get unique IDs
5. **Folder nesting** — Maps directly to Group parentId relationships
6. **Chrome shortcuts** — Silently supported by URL validator; no UI changes needed beyond labels

---

## Summary

✅ **Chrome Bookmarks HTML Import** — Parse & import with full folder hierarchy  
✅ **Export to Chrome HTML** — Netscape format, round-trip compatible  
✅ **Protocol Support** — Store all protocols; hide unsupported on current platform:
  - `ftp://` — Hidden everywhere (deprecated in Chrome 2021)
  - `mailto:` — Hidden on mobile (works on desktop)
  - `tel:`, `sms:` — Hidden on desktop (works on mobile)
  - Show toggle reveals all hidden bookmarks
✅ **Better Group Deletion** — Clear error when hidden bookmarks exist, guides user to toggle visibility  

**User Experience:**
1. User tries to delete group → gets error listing hidden bookmarks
2. User enables "Show hidden bookmarks" in settings
3. User can now see/manage those bookmarks
4. User can now delete group

**Implementation time:** ~5–6 hours
- Phase 1 (parsing): 1–2h
- Phase 2 (protocols): 30 min
- Phase 3 (UI): 1–2h  
- Phase 4 (hidden toggle): 30 min
- Phase 5 (export): 1h
- Phase 6 (testing): 1–2h

**Files changed:** 5 new + 5 modified  
