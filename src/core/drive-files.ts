import { z } from 'zod';
import { ClockSchema, GroupSchema, ItemSchema, MAX_RECORDS } from './archive';
import { db } from './db';
import { DriveAuthError, driveFetch } from './drive-auth';
import { mergeLibrary } from './merge';
import { getDeviceId } from './storage';
import { tickHLC } from './hlc';
import { withoutDriveChangeNotification } from './drive-sync-triggers';
import type {
  DeviceFile,
  DriveDeviceState,
  Group,
  HLC,
  Item,
  LibraryState,
} from './types';

const DRIVE_API = 'https://www.googleapis.com';
const DEVICE_FILE_PREFIX = 'launcher-state-device-';
const DEVICE_FILE_SUFFIX = '.json';
const MAX_DEVICE_FILE_BYTES = 20 * 1024 * 1024;
export const STALE_DEVICE_FILE_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const DriveDeviceStateSchema = z
  .object({
    schemaVersion: z.literal(1),
    deviceId: z.string().min(1).max(128),
    revision: z.number().int().positive(),
    lastUpdate: z.string().datetime(),
    groups: z.array(GroupSchema).max(MAX_RECORDS),
    items: z.array(ItemSchema).max(MAX_RECORDS),
    tombstones: z
      .object({
        groups: z.record(z.string().min(1).max(128), ClockSchema),
        items: z.record(z.string().min(1).max(128), ClockSchema),
      })
      .strict(),
  })
  .strict();

export interface DriveDeviceFileMetadata {
  fileId: string;
  deviceId: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
  size?: number;
}

export interface DownloadedDriveDeviceFile {
  metadata: DriveDeviceFileMetadata;
  state: DriveDeviceState;
}

export interface DownloadChangedDeviceFilesResult {
  downloaded: DownloadedDriveDeviceFile[];
  unchanged: DriveDeviceFileMetadata[];
}

export interface DownloadDriveDeviceFilesOptions {
  /** Let the caller commit metadata only after the downloaded state is applied. */
  deferCacheUpdate?: boolean;
}

export interface CompactionResult {
  state: DriveDeviceState;
  deletedDeviceIds: string[];
  retainedDeviceIds: string[];
}

export class DriveFileError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'DriveFileError';
  }
}

function deviceIdFromName(name: string): string | null {
  if (!name.startsWith(DEVICE_FILE_PREFIX) || !name.endsWith(DEVICE_FILE_SUFFIX)) {
    return null;
  }
  const deviceId = name.slice(DEVICE_FILE_PREFIX.length, -DEVICE_FILE_SUFFIX.length);
  return /^[A-Za-z0-9_-]{1,128}$/.test(deviceId) ? deviceId : null;
}

export function getDeviceStateFileName(deviceId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(deviceId)) {
    throw new DriveFileError('The local device ID cannot be used as a Drive file name.');
  }
  return `${DEVICE_FILE_PREFIX}${deviceId}${DEVICE_FILE_SUFFIX}`;
}

function metadataFromApi(value: unknown): DriveDeviceFileMetadata | null {
  if (typeof value !== 'object' || value === null) return null;
  const file = value as Record<string, unknown>;
  if (
    typeof file.id !== 'string' ||
    typeof file.name !== 'string' ||
    typeof file.modifiedTime !== 'string' ||
    typeof file.mimeType !== 'string'
  ) {
    return null;
  }
  const deviceId = deviceIdFromName(file.name);
  const modifiedTimestamp = Date.parse(file.modifiedTime);
  if (!deviceId || !Number.isFinite(modifiedTimestamp)) return null;
  const size = typeof file.size === 'string' ? Number(file.size) : undefined;
  return {
    fileId: file.id,
    deviceId,
    name: file.name,
    modifiedTime: new Date(modifiedTimestamp).toISOString(),
    mimeType: file.mimeType,
    ...(size !== undefined && Number.isFinite(size) ? { size } : {}),
  };
}

async function ensureDriveSuccess(response: Response, action: string): Promise<void> {
  if (response.ok) return;
  if (response.status === 401) {
    throw new DriveFileError(
      'Google Drive authorization expired. Reconnect and try again.',
    );
  }
  if (response.status === 403) {
    throw new DriveFileError(
      'Google Drive denied this operation. Check the Drive API and app-data authorization.',
    );
  }
  if (response.status === 404) {
    throw new DriveFileError(`The Drive file needed to ${action} no longer exists.`);
  }
  if (response.status === 429 || response.status >= 500) {
    throw new DriveFileError(
      `Google Drive is temporarily unavailable while trying to ${action}.`,
      true,
    );
  }
  throw new DriveFileError(`Could not ${action} (Google Drive HTTP ${response.status}).`);
}

async function updateLocalFileRecord(
  metadata: DriveDeviceFileMetadata,
  revision: number,
): Promise<void> {
  const record: DeviceFile = {
    deviceId: metadata.deviceId,
    fileId: metadata.fileId,
    name: metadata.name,
    modifiedTime: metadata.modifiedTime,
    lastSync: Date.now(),
    revision,
  };
  await db.deviceFiles.put(record);
}

function createTombstones(groups: Group[], items: Item[]) {
  return {
    groups: Object.fromEntries(
      groups.flatMap((group) => (group.deleted ? [[group.id, group.deleted]] : [])),
    ),
    items: Object.fromEntries(
      items.flatMap((item) => (item.deleted ? [[item.id, item.deleted]] : [])),
    ),
  };
}

function stateFromRecords(
  deviceId: string,
  revision: number,
  lastUpdate: Date,
  records: LibraryState,
): DriveDeviceState {
  const groups = [...records.groups].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const items = [...records.items].sort((left, right) => left.id.localeCompare(right.id));
  return {
    schemaVersion: 1,
    deviceId,
    revision,
    lastUpdate: lastUpdate.toISOString(),
    groups,
    items,
    tombstones: createTombstones(groups, items),
  };
}

function validateDeviceState(value: unknown): DriveDeviceState {
  const result = DriveDeviceStateSchema.safeParse(value);
  if (!result.success) {
    throw new DriveFileError('A Drive device file has an unsupported or invalid format.');
  }
  return result.data;
}

/** Build a versioned snapshot of this device's current local records. */
export async function createLocalDriveDeviceState(
  revision = 1,
  lastUpdate = new Date(),
): Promise<DriveDeviceState> {
  if (!Number.isInteger(revision) || revision < 1) {
    throw new DriveFileError('A Drive device-file revision must be a positive integer.');
  }
  if (!Number.isFinite(lastUpdate.getTime())) {
    throw new DriveFileError('The Drive device-file update time is invalid.');
  }
  const deviceId = await getDeviceId();
  const records = await db.transaction('r', db.groups, db.items, async () => ({
    groups: await db.groups.toArray(),
    items: await db.items.toArray(),
  }));
  return validateDeviceState(stateFromRecords(deviceId, revision, lastUpdate, records));
}

/** List all launcher state files in the current app's private Drive folder. */
export async function listDriveDeviceFiles(): Promise<DriveDeviceFileMetadata[]> {
  const files: DriveDeviceFileMetadata[] = [];
  let pageToken: string | undefined;
  const visitedTokens = new Set<string>();

  do {
    const url = new URL('/drive/v3/files', DRIVE_API);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set(
      'q',
      `trashed = false and name contains '${DEVICE_FILE_PREFIX}'`,
    );
    url.searchParams.set('pageSize', '1000');
    url.searchParams.set(
      'fields',
      'nextPageToken,files(id,name,modifiedTime,mimeType,size)',
    );
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    let response: Response;
    try {
      response = await driveFetch(url);
    } catch (cause) {
      if (cause instanceof DriveAuthError) throw cause;
      throw new DriveFileError(
        'Could not reach Google Drive to list device files.',
        true,
      );
    }
    await ensureDriveSuccess(response, 'list device files');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DriveFileError('Google Drive returned an unreadable file list.');
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new DriveFileError('Google Drive returned an invalid file list.');
    }

    const page = payload as { files?: unknown; nextPageToken?: unknown };
    if (page.files !== undefined && !Array.isArray(page.files)) {
      throw new DriveFileError('Google Drive returned an invalid file list.');
    }
    for (const value of page.files ?? []) {
      if (typeof value !== 'object' || value === null) continue;
      const name = (value as { name?: unknown }).name;
      if (typeof name !== 'string' || !deviceIdFromName(name)) continue;
      const metadata = metadataFromApi(value);
      if (!metadata) {
        throw new DriveFileError(
          `Google Drive returned incomplete metadata for ${name}.`,
        );
      }
      files.push(metadata);
    }

    if (typeof page.nextPageToken === 'string' && page.nextPageToken) {
      if (visitedTokens.has(page.nextPageToken)) {
        throw new DriveFileError('Google Drive repeated a file-list page token.');
      }
      visitedTokens.add(page.nextPageToken);
      pageToken = page.nextPageToken;
    } else {
      pageToken = undefined;
    }
  } while (pageToken);

  return files.sort(
    (left, right) =>
      left.deviceId.localeCompare(right.deviceId) ||
      left.modifiedTime.localeCompare(right.modifiedTime),
  );
}

async function downloadDeviceFile(
  metadata: DriveDeviceFileMetadata,
): Promise<DriveDeviceState> {
  if (metadata.size !== undefined && metadata.size > MAX_DEVICE_FILE_BYTES) {
    throw new DriveFileError(`${metadata.name} exceeds the 20 MB device-file limit.`);
  }
  let response: Response;
  try {
    response = await driveFetch(
      `${DRIVE_API}/drive/v3/files/${encodeURIComponent(metadata.fileId)}?alt=media`,
    );
  } catch (cause) {
    if (cause instanceof DriveAuthError) throw cause;
    throw new DriveFileError(
      `Could not download ${metadata.name} from Google Drive.`,
      true,
    );
  }
  await ensureDriveSuccess(response, `download ${metadata.name}`);

  const contentLength = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_DEVICE_FILE_BYTES) {
    throw new DriveFileError(`${metadata.name} exceeds the 20 MB device-file limit.`);
  }
  let text: string;
  try {
    text = await response.text();
  } catch {
    throw new DriveFileError(`Could not read ${metadata.name} from Google Drive.`, true);
  }
  if (new TextEncoder().encode(text).byteLength > MAX_DEVICE_FILE_BYTES) {
    throw new DriveFileError(`${metadata.name} exceeds the 20 MB device-file limit.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DriveFileError(`${metadata.name} does not contain valid JSON.`);
  }
  const state = validateDeviceState(parsed);
  if (state.deviceId !== metadata.deviceId) {
    throw new DriveFileError(`${metadata.name} contains a different device ID.`);
  }
  return state;
}

async function downloadDriveDeviceFiles(
  files: DriveDeviceFileMetadata[],
  force: boolean,
  deferCacheUpdate = false,
): Promise<DownloadChangedDeviceFilesResult> {
  const downloaded: DownloadedDriveDeviceFile[] = [];
  const unchanged: DriveDeviceFileMetadata[] = [];

  for (const metadata of files) {
    const cached = await db.deviceFiles.get(metadata.deviceId);
    if (
      !force &&
      cached?.fileId === metadata.fileId &&
      cached.modifiedTime === metadata.modifiedTime
    ) {
      unchanged.push(metadata);
      continue;
    }
    downloaded.push({ metadata, state: await downloadDeviceFile(metadata) });
  }

  if (!deferCacheUpdate) await cacheDownloadedDriveDeviceFiles(downloaded);
  return { downloaded, unchanged };
}

/** Download new or changed device files, skipping matching cached modified times. */
export async function downloadChangedDriveDeviceFiles(
  files?: DriveDeviceFileMetadata[],
  options: DownloadDriveDeviceFilesOptions = {},
): Promise<DownloadChangedDeviceFilesResult> {
  const metadata = files ?? (await listDriveDeviceFiles());
  return downloadDriveDeviceFiles(metadata, false, options.deferCacheUpdate);
}

/** Download every listed device state, bypassing the modified-time cache. */
export async function downloadAllDriveDeviceFiles(
  files?: DriveDeviceFileMetadata[],
  options: DownloadDriveDeviceFilesOptions = {},
): Promise<DownloadChangedDeviceFilesResult> {
  const metadata = files ?? (await listDriveDeviceFiles());
  return downloadDriveDeviceFiles(metadata, true, options.deferCacheUpdate);
}

/** Persist cache entries only after the caller has applied every downloaded state. */
export async function cacheDownloadedDriveDeviceFiles(
  downloaded: readonly DownloadedDriveDeviceFile[],
): Promise<void> {
  await db.transaction('rw', db.deviceFiles, async () => {
    for (const { metadata, state } of downloaded) {
      await updateLocalFileRecord(metadata, state.revision);
    }
  });
}

async function uploadMedia(
  url: string,
  body: BodyInit,
  contentType: string,
  method: 'POST' | 'PATCH',
): Promise<DriveDeviceFileMetadata> {
  let response: Response;
  try {
    response = await driveFetch(url, {
      method,
      headers: { 'Content-Type': contentType },
      body,
    });
  } catch (cause) {
    if (cause instanceof DriveAuthError) throw cause;
    throw new DriveFileError('Could not upload the device state to Google Drive.', true);
  }
  await ensureDriveSuccess(response, 'upload device state');

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DriveFileError('Google Drive returned an unreadable upload response.');
  }
  const metadata = metadataFromApi(payload);
  if (!metadata) {
    throw new DriveFileError('Google Drive did not return the uploaded file metadata.');
  }
  return metadata;
}

/** Upload one device's snapshot, creating it once and PATCHing it on later writes. */
export async function uploadDriveDeviceState(
  proposedState: DriveDeviceState,
  now = new Date(),
): Promise<DriveDeviceState> {
  if (!Number.isFinite(now.getTime())) {
    throw new DriveFileError('The Drive device-file update time is invalid.');
  }
  const state = validateDeviceState(proposedState);
  const deviceId = await getDeviceId();
  if (state.deviceId !== deviceId) {
    throw new DriveFileError('A device can only upload its own Drive state file.');
  }

  const cached = await db.deviceFiles.get(deviceId);
  const listedFiles = await listDriveDeviceFiles();
  const matchingFiles = listedFiles.filter((file) => file.deviceId === deviceId);
  if (matchingFiles.length > 1) {
    throw new DriveFileError(
      'Multiple Drive state files use this device ID. Refusing to overwrite one of them.',
    );
  }

  const remote = matchingFiles[0];
  let result: DriveDeviceFileMetadata;
  const nextState = validateDeviceState({
    ...state,
    revision: Math.max(state.revision, (cached?.revision ?? 0) + 1),
    lastUpdate: now.toISOString(),
  });
  const content = JSON.stringify(nextState);
  if (new TextEncoder().encode(content).byteLength > MAX_DEVICE_FILE_BYTES) {
    throw new DriveFileError('The device state exceeds the 20 MB Drive file limit.');
  }

  if (remote) {
    if (!cached?.fileId || cached.fileId !== remote.fileId || !cached.modifiedTime) {
      throw new DriveFileError(
        'This device already has a Drive file. Download and merge it before uploading.',
      );
    }
    if (cached.modifiedTime !== remote.modifiedTime) {
      throw new DriveFileError(
        'The Drive state changed since it was downloaded. Download and merge it before uploading.',
      );
    }
    const url = new URL(
      `/upload/drive/v3/files/${encodeURIComponent(remote.fileId)}`,
      DRIVE_API,
    );
    url.searchParams.set('uploadType', 'media');
    url.searchParams.set('fields', 'id,name,modifiedTime,mimeType,size');
    result = await uploadMedia(url.toString(), content, 'application/json', 'PATCH');
  } else {
    const boundary = `favoritepod-${crypto.randomUUID()}`;
    const metadata = {
      name: getDeviceStateFileName(deviceId),
      mimeType: 'application/json',
      parents: ['appDataFolder'],
    };
    const body = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify(metadata),
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      content,
      `--${boundary}--`,
      '',
    ].join('\r\n');
    const url = new URL('/upload/drive/v3/files', DRIVE_API);
    url.searchParams.set('uploadType', 'multipart');
    url.searchParams.set('fields', 'id,name,modifiedTime,mimeType,size');
    result = await uploadMedia(
      url.toString(),
      body,
      `multipart/related; boundary=${boundary}`,
      'POST',
    );
    if (result.deviceId !== deviceId) {
      throw new DriveFileError('Google Drive created a file with an unexpected name.');
    }
  }

  if (result.deviceId !== deviceId) {
    throw new DriveFileError('Google Drive updated a file with an unexpected name.');
  }
  await updateLocalFileRecord(result, nextState.revision);
  return nextState;
}

/** Snapshot this device's local records and save its per-device Drive file. */
export async function uploadLocalDriveDeviceState(
  now = new Date(),
): Promise<DriveDeviceState> {
  const deviceId = await getDeviceId();
  const cached = await db.deviceFiles.get(deviceId);
  const local = await createLocalDriveDeviceState((cached?.revision ?? 0) + 1, now);
  return uploadDriveDeviceState(local, now);
}

/**
 * Merge all remote device files with local records, upload the merged state for
 * this device, then delete files that have stayed stale for at least 90 days.
 */
export async function compactStaleDriveDeviceFiles(
  now = new Date(),
): Promise<CompactionResult> {
  if (!Number.isFinite(now.getTime())) {
    throw new DriveFileError('The compaction time is invalid.');
  }
  const currentDeviceId = await getDeviceId();
  const listedBeforeMerge = await listDriveDeviceFiles();
  const cutoff = now.getTime() - STALE_DEVICE_FILE_AGE_MS;
  const staleCandidates = listedBeforeMerge.filter(
    (file) => file.deviceId !== currentDeviceId && Date.parse(file.modifiedTime) < cutoff,
  );
  if (staleCandidates.length === 0) {
    const cached = await db.deviceFiles.get(currentDeviceId);
    return {
      state: await createLocalDriveDeviceState(Math.max(1, cached?.revision ?? 1), now),
      deletedDeviceIds: [],
      retainedDeviceIds: [],
    };
  }

  const allRemote = await downloadDriveDeviceFiles(listedBeforeMerge, true, true);
  const localRecords = await db.transaction('r', db.groups, db.items, async () => ({
    groups: await db.groups.toArray(),
    items: await db.items.toArray(),
  }));
  let merged: LibraryState = localRecords;
  for (const remote of allRemote.downloaded) {
    merged = mergeLibrary(merged, remote.state);
  }

  await withoutDriveChangeNotification(() =>
    db.transaction('rw', db.groups, db.items, db.syncMeta, async () => {
      const current: LibraryState = {
        groups: await db.groups.toArray(),
        items: await db.items.toArray(),
      };
      const next = mergeLibrary(current, merged);
      await db.groups.clear();
      await db.items.clear();
      if (next.groups.length) await db.groups.bulkPut(next.groups);
      if (next.items.length) await db.items.bulkPut(next.items);
      const clocks = [
        ...next.groups.flatMap((group) => [
          ...Object.values(group.clock),
          ...(group.deleted ? [group.deleted] : []),
        ]),
        ...next.items.flatMap((item) => [
          ...Object.values(item.clock),
          ...(item.deleted ? [item.deleted] : []),
        ]),
      ];
      if (clocks.length) {
        let latest = clocks[0]!;
        for (const clock of clocks.slice(1)) if (clock > latest) latest = clock;
        const stored = await db.syncMeta.get('lastHlc');
        const previous = typeof stored?.value === 'string' ? stored.value : undefined;
        const base: HLC = previous && previous > latest ? previous : latest;
        await db.syncMeta.put({
          key: 'lastHlc',
          value: tickHLC(base, currentDeviceId, now.getTime()),
        });
      }
    }),
  );
  await cacheDownloadedDriveDeviceFiles(allRemote.downloaded);

  const localCache = await db.deviceFiles.get(currentDeviceId);
  const latestRevision = Math.max(
    localCache?.revision ?? 0,
    ...allRemote.downloaded
      .filter((file) => file.state.deviceId === currentDeviceId)
      .map((file) => file.state.revision),
  );
  const currentRecords = await db.transaction('r', db.groups, db.items, async () => ({
    groups: await db.groups.toArray(),
    items: await db.items.toArray(),
  }));
  const state = stateFromRecords(
    currentDeviceId,
    latestRevision + 1,
    now,
    currentRecords,
  );
  const uploadedState = await uploadDriveDeviceState(state, now);

  const latestFiles = await listDriveDeviceFiles();
  const remainingFiles = new Map(latestFiles.map((file) => [file.fileId, file]));
  const deletedDeviceIds: string[] = [];
  const retainedDeviceIds: string[] = [];

  for (const candidate of staleCandidates) {
    const current = remainingFiles.get(candidate.fileId);
    if (!current) {
      deletedDeviceIds.push(candidate.deviceId);
      if (
        ![...remainingFiles.values()].some((file) => file.deviceId === candidate.deviceId)
      ) {
        await db.deviceFiles.delete(candidate.deviceId);
      }
      continue;
    }
    if (
      current.modifiedTime !== candidate.modifiedTime ||
      Date.parse(current.modifiedTime) >= cutoff
    ) {
      retainedDeviceIds.push(candidate.deviceId);
      continue;
    }

    let response: Response;
    try {
      response = await driveFetch(
        `${DRIVE_API}/drive/v3/files/${encodeURIComponent(candidate.fileId)}`,
        { method: 'DELETE' },
      );
    } catch (cause) {
      if (cause instanceof DriveAuthError) throw cause;
      retainedDeviceIds.push(candidate.deviceId);
      continue;
    }
    if (!response.ok && response.status !== 404) {
      retainedDeviceIds.push(candidate.deviceId);
      continue;
    }
    remainingFiles.delete(candidate.fileId);
    deletedDeviceIds.push(candidate.deviceId);
    const sameDeviceStillExists = [...remainingFiles.values()].some(
      (file) => file.deviceId === candidate.deviceId,
    );
    if (!sameDeviceStillExists) await db.deviceFiles.delete(candidate.deviceId);
  }

  return {
    state: uploadedState,
    deletedDeviceIds: [...new Set(deletedDeviceIds)],
    retainedDeviceIds: [...new Set(retainedDeviceIds)],
  };
}
