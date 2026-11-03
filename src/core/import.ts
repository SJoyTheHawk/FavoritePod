import { strFromU8, unzipSync } from 'fflate';
import { compareHLC, createHLC, receiveHLC } from './hlc';
import {
  ExportBaseSchema,
  ExportDataV1Schema,
  MAX_ARCHIVE_SIZE,
  MAX_IMAGE_SIZE,
  MAX_MANIFEST_SIZE,
  MAX_RECORDS,
  SUPPORTED_IMPORT_VERSIONS,
  type ExportDataV1,
  type ImportArchive,
  type ImportMode,
  type ImportProgressCallback,
  type ImportResult,
} from './archive';
import { db } from './db';
import { createSnapshot, getDeviceId } from './storage';
import { isGroupDeleted } from './merge';
import { hashBlob } from './thumbnail';
import { nextOrderKey } from './ordering';
import { isValidUrl } from './validation';
import type { Group, Item, Thumbnail } from './types';

const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = 40_000_000;
const BATCH_SIZE = 100;

function assertSafeFavicon(value: string | undefined): void {
  if (!value) return;
  if (/^data:image\/(?:png|jpeg|gif|webp);base64,/i.test(value)) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'http:' || url.protocol === 'https:') return;
  } catch {
    // Reject values which cannot be parsed as an HTTP URL.
  }
  throw new Error('The archive contains an invalid favicon URL.');
}

function validateRecords(data: ExportDataV1): void {
  const groupsById = new Map<string, Group>();
  for (const group of data.groups) {
    if (groupsById.has(group.id)) throw new Error(`Duplicate group ID: ${group.id}`);
    for (const clock of Object.values(group.clock)) compareHLC(clock, clock);
    if (group.deleted) compareHLC(group.deleted, group.deleted);
    groupsById.set(group.id, group);
  }

  for (const group of data.groups) {
    if (group.parentId && !groupsById.has(group.parentId))
      throw new Error(`Group "${group.title}" refers to a missing parent group.`);
    const path = new Set<string>([group.id]);
    let parentId = group.parentId;
    while (parentId) {
      if (path.has(parentId)) throw new Error('The archive contains a group cycle.');
      path.add(parentId);
      parentId = groupsById.get(parentId)?.parentId ?? null;
    }
  }

  const itemIds = new Set<string>();
  for (const item of data.items) {
    if (itemIds.has(item.id)) throw new Error(`Duplicate favorite ID: ${item.id}`);
    itemIds.add(item.id);
    if (!groupsById.has(item.groupId))
      throw new Error(`Favorite "${item.title}" refers to a missing group.`);
    if (!isValidUrl(item.url) || item.url !== item.url.trim())
      throw new Error(`The archive contains an invalid URL: ${item.url}`);
    assertSafeFavicon(item.faviconUrl);
    for (const clock of Object.values(item.clock)) compareHLC(clock, clock);
    if (item.deleted) compareHLC(item.deleted, item.deleted);
  }

  if (data.groups.length > MAX_RECORDS || data.items.length > MAX_RECORDS)
    throw new Error(
      `The archive exceeds the ${MAX_RECORDS.toLocaleString()} record limit.`,
    );
}

function isPreviewPath(path: string): boolean {
  return /^previews\/[a-f0-9]{64}\.jpg$/.test(path);
}

export async function parseImportFile(
  file: File,
  onProgress?: ImportProgressCallback,
): Promise<ImportArchive> {
  if (file.size > MAX_ARCHIVE_SIZE)
    throw new Error('The archive is larger than the 100 MB limit.');
  if (!file.size) throw new Error('The selected archive is empty.');

  const archiveBytes = new Uint8Array(await file.arrayBuffer());
  let manifestCount = 0;
  let entryCount = 0;
  let totalUncompressed = 0;
  let invalidEntry: string | undefined;
  const entryNames = new Set<string>();
  const unzipped = unzipSync(archiveBytes, {
    filter(entry) {
      if (entry.name.endsWith('/')) return false;
      if (entryNames.has(entry.name)) {
        invalidEntry = `The archive contains a duplicate file: ${entry.name}`;
        return false;
      }
      entryNames.add(entry.name);
      entryCount += 1;
      if (entryCount > MAX_RECORDS + 1) {
        invalidEntry = 'The archive contains too many files.';
        return false;
      }

      if (entry.name === 'launcher.json') {
        manifestCount += 1;
        if (manifestCount > 1)
          invalidEntry = 'The archive contains duplicate launcher.json files.';
        if (entry.originalSize > MAX_MANIFEST_SIZE)
          invalidEntry = 'The launcher manifest is larger than 20 MB.';
      } else if (isPreviewPath(entry.name)) {
        if (entry.originalSize > MAX_IMAGE_SIZE)
          invalidEntry = 'A preview image is larger than 5 MB.';
      } else {
        invalidEntry = `The archive contains an unsupported file: ${entry.name}`;
      }

      totalUncompressed += entry.originalSize;
      if (totalUncompressed > MAX_ARCHIVE_SIZE)
        invalidEntry = 'The uncompressed archive contents exceed 100 MB.';
      return !invalidEntry;
    },
  });
  if (invalidEntry) throw new Error(invalidEntry);

  const manifest = unzipped['launcher.json'];
  if (!manifest) throw new Error('Missing launcher.json in ZIP.');
  let rawData: unknown;
  try {
    rawData = JSON.parse(strFromU8(manifest));
  } catch {
    throw new Error('The launcher manifest is not valid JSON.');
  }

  const baseResult = ExportBaseSchema.safeParse(rawData);
  if (!baseResult.success) throw new Error('Invalid FavoritePod export format.');
  const version = baseResult.data.schemaVersion;
  if (
    !SUPPORTED_IMPORT_VERSIONS.some((supportedVersion) => supportedVersion === version)
  ) {
    throw new Error(
      `Unsupported schema version ${version}. This extension supports version ${SUPPORTED_IMPORT_VERSIONS.join(', ')}. Please update FavoritePod to import this file.`,
    );
  }

  const parsed = ExportDataV1Schema.safeParse(rawData);
  if (!parsed.success)
    throw new Error(`Invalid version 1 export: ${parsed.error.message}`);
  const data = parsed.data;
  validateRecords(data);

  const referencedHashes = new Set(
    data.items.flatMap((item) => (item.previewHash ? [item.previewHash] : [])),
  );
  const imagePaths = [...referencedHashes].map((hash) => `previews/${hash}.jpg`);
  const thumbnails = new Map<string, Thumbnail>();
  onProgress?.({ stage: 'validating', current: 0, total: imagePaths.length });

  for (let index = 0; index < imagePaths.length; index += 1) {
    const path = imagePaths[index];
    const hash = path.slice('previews/'.length, -'.jpg'.length);
    const bytes = unzipped[path];
    if (!bytes) throw new Error(`The archive is missing a referenced preview (${hash}).`);
    const blob = new Blob([bytes], { type: 'image/jpeg' });
    if ((await hashBlob(blob)) !== hash)
      throw new Error(`A preview image failed its integrity check (${hash}).`);

    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob);
    } catch {
      throw new Error(`A preview image could not be decoded (${hash}).`);
    }
    const validDimensions =
      bitmap.width > 0 &&
      bitmap.height > 0 &&
      bitmap.width <= MAX_IMAGE_DIMENSION &&
      bitmap.height <= MAX_IMAGE_DIMENSION &&
      bitmap.width * bitmap.height <= MAX_IMAGE_PIXELS;
    const { width, height } = bitmap;
    bitmap.close();
    if (!validDimensions)
      throw new Error(`A preview image has invalid dimensions (${hash}).`);

    thumbnails.set(hash, {
      hash,
      blob,
      size: blob.size,
      width,
      height,
      createdAt: Date.now(),
    });
    onProgress?.({ stage: 'validating', current: index + 1, total: imagePaths.length });
  }

  return { data, thumbnails, filename: file.name };
}

function remapForCopy(
  archive: ImportArchive,
  existingGroups: Group[],
  deviceId: string,
): { groups: Group[]; items: Item[] } {
  const groupIds = new Map(
    archive.data.groups.map((group) => [group.id, crypto.randomUUID()]),
  );
  const itemIds = new Map(
    archive.data.items.map((item) => [item.id, crypto.randomUUID()]),
  );
  const currentRootKeys = existingGroups
    .filter((group) => !group.parentId && !isGroupDeleted(group))
    .map((group) => group.orderKey);
  const now = Date.now();
  const clock = createHLC(now, 0, deviceId);
  const title =
    archive.filename
      .replace(/\.zip$/i, '')
      .trim()
      .slice(0, 80) || 'Imported library';
  const container: Group = {
    id: crypto.randomUUID(),
    parentId: null,
    orderKey: nextOrderKey(currentRootKeys),
    title: `Imported: ${title}`,
    clock: { parentId: clock, orderKey: clock, title: clock },
  };
  const groups = archive.data.groups.map((group) => ({
    ...group,
    id: groupIds.get(group.id)!,
    parentId: group.parentId ? groupIds.get(group.parentId)! : container.id,
  }));
  const items = archive.data.items.map((item) => ({
    ...item,
    id: itemIds.get(item.id)!,
    groupId: groupIds.get(item.groupId)!,
  }));
  return { groups: [container, ...groups], items };
}

async function putBatches<T>(
  table: { bulkPut(records: T[]): Promise<unknown> },
  records: T[],
  onBatch: (count: number) => void,
): Promise<void> {
  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = records.slice(offset, offset + BATCH_SIZE);
    await table.bulkPut(batch);
    onBatch(batch.length);
  }
}

export async function importArchive(
  archive: ImportArchive,
  mode: ImportMode,
  onProgress?: ImportProgressCallback,
): Promise<ImportResult> {
  if (mode === 'replace') await createSnapshot();
  const deviceId = await getDeviceId();

  return db.transaction(
    'rw',
    db.groups,
    db.items,
    db.thumbnails,
    db.syncMeta,
    db.settings,
    async () => {
      let groups = archive.data.groups as Group[];
      let items = archive.data.items as Item[];
      const existingGroups = mode === 'copy' ? await db.groups.toArray() : [];
      if (mode === 'copy') {
        const copied = remapForCopy(archive, existingGroups, deviceId);
        groups = copied.groups;
        items = copied.items;
      }

      const thumbnailRecords = [...archive.thumbnails.values()];
      if (mode === 'replace') {
        await db.groups.clear();
        await db.items.clear();
        await db.thumbnails.clear();
      }

      const total = groups.length + items.length + thumbnailRecords.length;
      let current = 0;
      onProgress?.({ stage: 'writing', current, total });
      const report = (count: number) => {
        current += count;
        onProgress?.({ stage: 'writing', current, total });
      };
      await putBatches(db.groups, groups, report);
      await putBatches(db.items, items, report);
      await putBatches(db.thumbnails, thumbnailRecords, report);

      if (mode === 'replace') {
        const groupIds = new Set(groups.map((group) => group.id));
        for (const key of ['homePageGroupId', 'lastSelectedGroupId', 'lastUsedGroupId']) {
          const record = await db.settings.get(key);
          if (typeof record?.value === 'string' && !groupIds.has(record.value))
            await db.settings.delete(key);
        }
        if (
          !(await db.settings.get('homePageGroupId')) &&
          (await db.settings.get('openBehavior'))?.value === 'home'
        )
          await db.settings.put({ key: 'openBehavior', value: 'all' });
      }

      const incomingClocks = [
        ...groups.flatMap((group) => [
          ...Object.values(group.clock),
          ...(group.deleted ? [group.deleted] : []),
        ]),
        ...items.flatMap((item) => [
          ...Object.values(item.clock),
          ...(item.deleted ? [item.deleted] : []),
        ]),
      ];
      if (incomingClocks.length) {
        let latest = incomingClocks[0];
        for (const clock of incomingClocks.slice(1))
          if (compareHLC(clock, latest) > 0) latest = clock;
        const lastRecord = await db.syncMeta.get('lastHlc');
        const previous =
          typeof lastRecord?.value === 'string' ? lastRecord.value : undefined;
        await db.syncMeta.put({
          key: 'lastHlc',
          value: receiveHLC(previous, latest, deviceId),
        });
      }

      return { importedGroups: groups.length, importedItems: items.length };
    },
  );
}

export type { ImportMode, ImportProgressCallback, ImportResult } from './archive';
