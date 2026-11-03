import { zipSync, strToU8 } from 'fflate';
import {
  CURRENT_EXPORT_VERSION,
  MAX_ARCHIVE_SIZE,
  MAX_IMAGE_SIZE,
  MAX_MANIFEST_SIZE,
  MAX_RECORDS,
  type ExportDataV1,
} from './archive';
import { db } from './db';
import { getDeviceId } from './storage';
import type { Group, Item } from './types';
import { hashBlob } from './thumbnail';
import { isGroupDeleted } from './merge';

export interface ExportOptions {
  groupIds?: readonly string[];
  onProgress?: (current: number, total: number) => void;
}

function compareOrder(
  left: { id: string; orderKey: string },
  right: { id: string; orderKey: string },
) {
  return left.orderKey === right.orderKey
    ? left.id.localeCompare(right.id)
    : left.orderKey < right.orderKey
      ? -1
      : 1;
}

function selectExportRecords(
  allGroups: Group[],
  allItems: Item[],
  selectedGroupIds?: readonly string[],
): { groups: Group[]; items: Item[] } {
  if (!selectedGroupIds) {
    return {
      groups: allGroups.sort(compareOrder),
      items: allItems.sort(compareOrder),
    };
  }

  const byId = new Map(allGroups.map((group) => [group.id, group]));
  const contentIds = new Set(selectedGroupIds);
  for (const id of contentIds) {
    const group = byId.get(id);
    if (!group || isGroupDeleted(group))
      throw new Error('A selected group is unavailable.');
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const group of allGroups) {
      if (group.parentId && contentIds.has(group.parentId) && !contentIds.has(group.id)) {
        contentIds.add(group.id);
        changed = true;
      }
    }
  }

  const includedIds = new Set(contentIds);
  for (const id of contentIds) {
    let current = byId.get(id);
    while (current?.parentId && !includedIds.has(current.parentId)) {
      includedIds.add(current.parentId);
      current = byId.get(current.parentId);
    }
  }

  const groups = allGroups
    .filter((group) => includedIds.has(group.id))
    .sort(compareOrder);
  const items = allItems
    .filter((item) => contentIds.has(item.groupId))
    .sort(compareOrder);
  return { groups, items };
}

export async function exportToZip(options: ExportOptions = {}): Promise<Blob> {
  const [exportedBy, allGroups, allItems] = await Promise.all([
    getDeviceId(),
    db.groups.toArray(),
    db.items.toArray(),
  ]);
  const selected = selectExportRecords(allGroups, allItems, options.groupIds);
  const groups = selected.groups;
  const items = selected.items;
  if (groups.length > MAX_RECORDS || items.length > MAX_RECORDS)
    throw new Error(
      `The export exceeds the ${MAX_RECORDS.toLocaleString()} record limit.`,
    );
  const groupIds = new Set(groups.map((group) => group.id));
  const includedItems = items.filter((item) => groupIds.has(item.groupId));
  const exportData: ExportDataV1 = {
    format: 'visual-launcher',
    schemaVersion: CURRENT_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exportedBy,
    groups,
    items: includedItems,
  };

  const hashes = [
    ...new Set(
      includedItems.flatMap((item) => (item.previewHash ? [item.previewHash] : [])),
    ),
  ];
  const total = hashes.length;
  const manifest = strToU8(JSON.stringify(exportData, null, 2));
  if (manifest.byteLength > MAX_MANIFEST_SIZE)
    throw new Error('The launcher manifest is larger than 20 MB.');
  const files: Record<string, Uint8Array> = {
    'launcher.json': manifest,
  };

  for (let index = 0; index < hashes.length; index += 1) {
    const hash = hashes[index];
    const thumbnail = await db.thumbnails.get(hash);
    if (!thumbnail) throw new Error(`A preview image is missing (${hash}).`);
    if (thumbnail.blob.size > MAX_IMAGE_SIZE)
      throw new Error('A preview image is larger than 5 MB.');
    if ((await hashBlob(thumbnail.blob)) !== hash)
      throw new Error(`A preview image failed its integrity check (${hash}).`);
    files[`previews/${hash}.jpg`] = new Uint8Array(await thumbnail.blob.arrayBuffer());
    options.onProgress?.(index + 1, total);
  }

  const zipped = zipSync(files, { level: 6 });
  if (zipped.byteLength > MAX_ARCHIVE_SIZE)
    throw new Error('The export is larger than the 100 MB archive limit.');
  return new Blob([zipped], { type: 'application/zip' });
}

export function downloadZip(blob: Blob, filename = 'favoritepod-export.zip'): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
