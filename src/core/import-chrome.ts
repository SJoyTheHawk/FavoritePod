import {
  ExportDataV1Schema,
  type ImportArchive,
  type ImportProgressCallback,
  type ImportResult,
} from './archive';
import { db } from './db';
import { createHLC, tickHLC } from './hlc';
import { importArchive } from './import';
import { keyBetween } from './ordering';
import { getDeviceId } from './storage';
import type { Group, Item } from './types';
import type {
  ChromeFolder,
  ParseChromeBookmarksResult,
  ParsedBookmarksFile,
} from './parse-chrome-bookmarks';

export function getChromeImportTitle(filename: string): string {
  return `Imported: ${
    filename
      .replace(/\.html?$/i, '')
      .trim()
      .slice(0, 80) || 'Chrome import'
  }`;
}

export async function chromeBookmarksToArchive(
  parsed: ParseChromeBookmarksResult,
  filename: string,
  deviceId: string,
): Promise<ImportArchive> {
  const previous = await db.syncMeta.get('lastHlc');
  const clock =
    typeof previous?.value === 'string'
      ? tickHLC(previous.value, deviceId)
      : createHLC(Date.now(), 0, deviceId);
  const groups: Group[] = [];
  const items: Item[] = [];
  function addGroup(title: string, parentId: string | null, orderKey: string): Group {
    const group: Group = {
      id: crypto.randomUUID(),
      parentId,
      orderKey,
      title,
      clock: { parentId: clock, orderKey: clock, title: clock },
    };
    groups.push(group);
    return group;
  }
  const container = addGroup(
    getChromeImportTitle(filename),
    null,
    keyBetween(null, null),
  );
  const contexts = [
    { entries: parsed.folders as ChromeFolder['children'], groupId: container.id },
  ];
  while (contexts.length) {
    const { entries, groupId } = contexts.pop()!;
    let groupKey: string | null = null;
    let itemKey: string | null = null;
    // Anonymous folders only wrap loose root bookmarks; flatten them at this level.
    const flattened = entries.flatMap((entry) =>
      !('url' in entry) && entry.title === '' ? entry.children : [entry],
    );
    const nested = [];
    for (const entry of flattened) {
      if ('url' in entry) {
        itemKey = keyBetween(itemKey, null);
        items.push({
          id: crypto.randomUUID(),
          groupId,
          orderKey: itemKey,
          url: entry.url,
          title: entry.title,
          clock: {
            groupId: clock,
            orderKey: clock,
            url: clock,
            title: clock,
            previewHash: clock,
            faviconUrl: clock,
          },
        });
      } else {
        groupKey = keyBetween(groupKey, null);
        const group = addGroup(entry.title, groupId, groupKey);
        nested.push({ entries: entry.children, groupId: group.id });
      }
    }
    contexts.push(...nested.reverse());
  }
  const data = ExportDataV1Schema.parse({
    format: 'visual-launcher',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: deviceId,
    groups,
    items,
  });
  return { data, thumbnails: new Map(), filename };
}

export const chromBookmarksToArchive = chromeBookmarksToArchive;

export async function importBookmarks(
  parsed: ParsedBookmarksFile,
  onProgress?: ImportProgressCallback,
): Promise<ImportResult> {
  const archive = await chromeBookmarksToArchive(
    parsed,
    parsed.filename,
    await getDeviceId(),
  );
  return importArchive(archive, 'copy', onProgress, { wrapInGroup: false });
}
