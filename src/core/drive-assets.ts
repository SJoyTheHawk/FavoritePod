import { db } from './db';
import { DriveAuthError, driveFetch } from './drive-auth';
import { MAX_IMAGE_SIZE } from './archive';
import { hashBlob } from './thumbnail';
import type { DriveAssetFile, Thumbnail } from './types';

const DRIVE_API = 'https://www.googleapis.com';
const ASSET_PREFIX = 'asset-';
const ASSET_SUFFIX = '.jpg';
const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = 40_000_000;
export const STALE_DRIVE_ASSET_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const HASH_PATTERN = /^[a-f0-9]{64}$/;

export interface DriveAssetMetadata {
  hash: string;
  fileId: string;
  name: string;
  modifiedTime: string;
  mimeType: string;
  size: number;
}

export type DriveAssetSyncStage = 'uploading' | 'downloading' | 'cleaning';

export interface DriveAssetProgress {
  stage: DriveAssetSyncStage;
  current: number;
  total: number;
  hash?: string;
}

export type DriveAssetProgressCallback = (progress: DriveAssetProgress) => void;

export interface UploadDriveAssetsResult {
  uploadedHashes: string[];
  existingHashes: string[];
  missingLocalHashes: string[];
}

export interface DownloadDriveAssetsResult {
  downloadedHashes: string[];
  existingHashes: string[];
  missingRemoteHashes: string[];
}

export interface CompactDriveAssetsResult {
  deletedHashes: string[];
  retainedHashes: string[];
}

export class DriveAssetError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'DriveAssetError';
  }
}

export function getDriveAssetFileName(hash: string): string {
  if (!HASH_PATTERN.test(hash)) {
    throw new DriveAssetError('A preview has an invalid SHA-256 hash.');
  }
  return `${ASSET_PREFIX}${hash}${ASSET_SUFFIX}`;
}

function hashFromName(name: string): string | null {
  if (!name.startsWith(ASSET_PREFIX) || !name.endsWith(ASSET_SUFFIX)) return null;
  const hash = name.slice(ASSET_PREFIX.length, -ASSET_SUFFIX.length);
  return HASH_PATTERN.test(hash) ? hash : null;
}

function metadataFromApi(value: unknown): DriveAssetMetadata | null {
  if (typeof value !== 'object' || value === null) return null;
  const file = value as Record<string, unknown>;
  if (
    typeof file.id !== 'string' ||
    typeof file.name !== 'string' ||
    typeof file.modifiedTime !== 'string' ||
    file.mimeType !== 'image/jpeg'
  ) {
    return null;
  }
  const hash = hashFromName(file.name);
  const timestamp = Date.parse(file.modifiedTime);
  const size = Number(file.size);
  if (!hash || !Number.isFinite(timestamp) || !Number.isSafeInteger(size) || size < 0) {
    return null;
  }
  return {
    hash,
    fileId: file.id,
    name: file.name,
    modifiedTime: new Date(timestamp).toISOString(),
    mimeType: 'image/jpeg',
    size,
  };
}

async function ensureDriveAssetSuccess(
  response: Response,
  action: string,
): Promise<void> {
  if (response.ok) return;
  if (response.status === 401) {
    throw new DriveAssetError(
      'Google Drive authorization expired. Reconnect and try again.',
    );
  }
  if (response.status === 403) {
    let reasons: string[] = [];
    try {
      const payload: unknown = await response.json();
      const error = (payload as { error?: { errors?: Array<{ reason?: unknown }> } })
        ?.error;
      reasons = (error?.errors ?? []).flatMap((entry) =>
        typeof entry.reason === 'string' ? [entry.reason] : [],
      );
    } catch {
      // Use the generic authorization message if Google returned no JSON details.
    }
    if (reasons.includes('storageQuotaExceeded')) {
      throw new DriveAssetError(
        'Google Drive storage is full. Free up space or disconnect sync.',
      );
    }
    if (reasons.some((reason) => reason.toLowerCase().includes('ratelimit'))) {
      throw new DriveAssetError(
        'Google Drive is rate limiting asset sync. Try again later.',
      );
    }
    throw new DriveAssetError(
      'Google Drive denied this asset operation. Check Drive authorization and API access.',
    );
  }
  if (response.status === 413) {
    throw new DriveAssetError(
      'Google Drive rejected the preview because it is too large.',
    );
  }
  if (response.status === 429 || response.status >= 500) {
    throw new DriveAssetError(
      `Google Drive is temporarily unavailable while trying to ${action}.`,
      true,
    );
  }
  if (response.status >= 400 && response.status < 500) {
    let detail = '';
    try {
      const payload: unknown = await response.clone().json();
      const error = (payload as { error?: { message?: unknown } })?.error;
      if (typeof error?.message === 'string' && error.message) {
        detail = `: ${error.message}`;
      }
    } catch {
      // Keep the status-based message when Drive does not return JSON details.
    }
    throw new DriveAssetError(
      `Could not ${action} (Google Drive HTTP ${response.status})${detail}.`,
    );
  }
  throw new DriveAssetError(
    `Could not ${action} (Google Drive HTTP ${response.status}).`,
  );
}

function saveMetadata(metadata: DriveAssetMetadata): Promise<void> {
  const record: DriveAssetFile = {
    hash: metadata.hash,
    fileId: metadata.fileId,
    name: metadata.name,
    modifiedTime: metadata.modifiedTime,
    lastSync: Date.now(),
    size: metadata.size,
  };
  return db.driveAssets.put(record).then(() => undefined);
}

function uniqueHashes(hashes: readonly string[]): string[] {
  const result = [...new Set(hashes)];
  for (const hash of result) getDriveAssetFileName(hash);
  return result;
}

/** List all content-addressed preview files in this app's private Drive folder. */
export async function listDriveAssets(): Promise<DriveAssetMetadata[]> {
  const files: DriveAssetMetadata[] = [];
  const seenTokens = new Set<string>();
  let pageToken: string | undefined;

  do {
    const url = new URL('/drive/v3/files', DRIVE_API);
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('q', `trashed = false and name contains '${ASSET_PREFIX}'`);
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
      throw new DriveAssetError(
        'Could not reach Google Drive to list preview files.',
        true,
      );
    }
    await ensureDriveAssetSuccess(response, 'list preview files');

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DriveAssetError('Google Drive returned an unreadable preview file list.');
    }
    if (typeof payload !== 'object' || payload === null) {
      throw new DriveAssetError('Google Drive returned an invalid preview file list.');
    }
    const page = payload as { files?: unknown; nextPageToken?: unknown };
    if (page.files !== undefined && !Array.isArray(page.files)) {
      throw new DriveAssetError('Google Drive returned an invalid preview file list.');
    }
    for (const value of page.files ?? []) {
      if (typeof value !== 'object' || value === null) continue;
      const name = (value as { name?: unknown }).name;
      if (typeof name !== 'string' || !hashFromName(name)) continue;
      const metadata = metadataFromApi(value);
      if (!metadata) {
        throw new DriveAssetError(`Google Drive returned invalid metadata for ${name}.`);
      }
      files.push(metadata);
    }

    if (typeof page.nextPageToken === 'string' && page.nextPageToken) {
      if (seenTokens.has(page.nextPageToken)) {
        throw new DriveAssetError('Google Drive repeated a preview-list page token.');
      }
      seenTokens.add(page.nextPageToken);
      pageToken = page.nextPageToken;
    } else {
      pageToken = undefined;
    }
  } while (pageToken);

  files.sort(
    (left, right) =>
      left.hash.localeCompare(right.hash) ||
      left.modifiedTime.localeCompare(right.modifiedTime),
  );
  for (const metadata of files) await saveMetadata(metadata);
  return files;
}

async function uploadAsset(
  thumbnail: Thumbnail,
  hash: string,
): Promise<DriveAssetMetadata> {
  if (thumbnail.blob.size > MAX_IMAGE_SIZE) {
    throw new DriveAssetError(
      `A preview is larger than ${MAX_IMAGE_SIZE / (1024 * 1024)} MB.`,
    );
  }
  if (thumbnail.blob.size < 1) {
    throw new DriveAssetError(`Preview ${hash} is empty.`);
  }
  if (thumbnail.blob.type && thumbnail.blob.type !== 'image/jpeg') {
    throw new DriveAssetError(`Preview ${hash} is not a JPEG image.`);
  }
  if ((await hashBlob(thumbnail.blob)) !== hash) {
    throw new DriveAssetError(`Preview ${hash} failed its SHA-256 integrity check.`);
  }

  const boundary = `favoritepod-${crypto.randomUUID()}`;
  const metadata = {
    name: getDriveAssetFileName(hash),
    mimeType: 'image/jpeg',
    parents: ['appDataFolder'],
  };
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const body = new Blob(
    [
      `--${boundary}\r\n`,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      'Content-Type: image/jpeg\r\n\r\n',
      thumbnail.blob,
      closeDelimiter,
    ],
    {
      type: `multipart/related; boundary=${boundary}`,
    },
  );
  const url = new URL('/upload/drive/v3/files', DRIVE_API);
  url.searchParams.set('uploadType', 'multipart');
  url.searchParams.set('fields', 'id,name,modifiedTime,mimeType,size');

  let response: Response;
  try {
    response = await driveFetch(url, { method: 'POST', body });
  } catch (cause) {
    if (cause instanceof DriveAuthError) throw cause;
    throw new DriveAssetError('Could not upload the preview to Google Drive.', true);
  }
  await ensureDriveAssetSuccess(response, 'upload preview');

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new DriveAssetError(
      'Google Drive returned an unreadable preview upload response.',
    );
  }
  const uploaded = metadataFromApi(payload);
  if (!uploaded || uploaded.hash !== hash) {
    throw new DriveAssetError(
      'Google Drive created a preview file with an unexpected name.',
    );
  }
  return uploaded;
}

/** Upload local previews referenced by the merged library, skipping Drive hits. */
export async function uploadMissingDriveAssets(
  hashes: readonly string[],
  onProgress?: DriveAssetProgressCallback,
): Promise<UploadDriveAssetsResult> {
  const targets = uniqueHashes(hashes);
  const remoteFiles = await listDriveAssets();
  const remoteByHash = new Map(remoteFiles.map((file) => [file.hash, file]));
  const uploadedHashes: string[] = [];
  const existingHashes: string[] = [];
  const missingLocalHashes: string[] = [];

  onProgress?.({ stage: 'uploading', current: 0, total: targets.length });
  for (let index = 0; index < targets.length; index += 1) {
    const hash = targets[index]!;
    const remote = remoteByHash.get(hash);
    if (remote) {
      existingHashes.push(hash);
    } else {
      const thumbnail = await db.thumbnails.get(hash);
      if (!thumbnail) {
        missingLocalHashes.push(hash);
      } else {
        const uploaded = await uploadAsset(thumbnail, hash);
        await saveMetadata(uploaded);
        uploadedHashes.push(hash);
      }
    }
    onProgress?.({ stage: 'uploading', current: index + 1, total: targets.length, hash });
  }

  return { uploadedHashes, existingHashes, missingLocalHashes };
}

async function decodeDimensions(blob: Blob, hash: string): Promise<[number, number]> {
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(blob);
  } catch {
    throw new DriveAssetError(`Preview ${hash} is not a readable JPEG image.`);
  }
  try {
    if (
      image.width < 1 ||
      image.height < 1 ||
      image.width > MAX_IMAGE_DIMENSION ||
      image.height > MAX_IMAGE_DIMENSION ||
      image.width * image.height > MAX_IMAGE_PIXELS
    ) {
      throw new DriveAssetError(`Preview ${hash} has invalid image dimensions.`);
    }
    return [image.width, image.height];
  } finally {
    image.close();
  }
}

async function downloadAsset(metadata: DriveAssetMetadata): Promise<Thumbnail> {
  if (metadata.size > MAX_IMAGE_SIZE) {
    throw new DriveAssetError(`Preview ${metadata.hash} is larger than 5 MB.`);
  }
  let response: Response;
  try {
    response = await driveFetch(
      `${DRIVE_API}/drive/v3/files/${encodeURIComponent(metadata.fileId)}?alt=media`,
    );
  } catch (cause) {
    if (cause instanceof DriveAuthError) throw cause;
    throw new DriveAssetError(
      `Could not download preview ${metadata.hash} from Google Drive.`,
      true,
    );
  }
  await ensureDriveAssetSuccess(response, 'download preview');

  const contentLength = Number(response.headers.get('Content-Length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE) {
    throw new DriveAssetError(`Preview ${metadata.hash} is larger than 5 MB.`);
  }
  let data: ArrayBuffer;
  try {
    data = await response.arrayBuffer();
  } catch {
    throw new DriveAssetError(
      `Google Drive returned unreadable bytes for preview ${metadata.hash}.`,
      true,
    );
  }
  if (data.byteLength > MAX_IMAGE_SIZE) {
    throw new DriveAssetError(`Preview ${metadata.hash} is larger than 5 MB.`);
  }
  const blob = new Blob([data], { type: 'image/jpeg' });
  if ((await hashBlob(blob)) !== metadata.hash) {
    throw new DriveAssetError(
      `Downloaded preview ${metadata.hash} failed its integrity check.`,
    );
  }
  const [width, height] = await decodeDimensions(blob, metadata.hash);
  const thumbnail: Thumbnail = {
    hash: metadata.hash,
    blob,
    size: blob.size,
    width,
    height,
    createdAt: Date.now(),
  };
  await db.transaction('rw', db.thumbnails, db.driveAssets, async () => {
    await db.thumbnails.put(thumbnail);
    await db.driveAssets.put({
      hash: metadata.hash,
      fileId: metadata.fileId,
      name: metadata.name,
      modifiedTime: metadata.modifiedTime,
      lastSync: Date.now(),
      size: metadata.size,
    });
  });
  return thumbnail;
}

/** Fetch wanted previews that are not already present in IndexedDB. */
export async function downloadMissingDriveAssets(
  hashes: readonly string[],
  onProgress?: DriveAssetProgressCallback,
): Promise<DownloadDriveAssetsResult> {
  const targets = uniqueHashes(hashes);
  const remoteFiles = await listDriveAssets();
  const remoteByHash = new Map(remoteFiles.map((file) => [file.hash, file]));
  const downloadedHashes: string[] = [];
  const existingHashes: string[] = [];
  const missingRemoteHashes: string[] = [];

  onProgress?.({ stage: 'downloading', current: 0, total: targets.length });
  for (let index = 0; index < targets.length; index += 1) {
    const hash = targets[index]!;
    const local = await db.thumbnails.get(hash);
    if (local) {
      existingHashes.push(hash);
    } else {
      const remote = remoteByHash.get(hash);
      if (!remote) {
        missingRemoteHashes.push(hash);
      } else {
        await downloadAsset(remote);
        downloadedHashes.push(hash);
      }
    }
    onProgress?.({
      stage: 'downloading',
      current: index + 1,
      total: targets.length,
      hash,
    });
  }

  return { downloadedHashes, existingHashes, missingRemoteHashes };
}

/** Remove remote previews unreferenced for at least 90 days after rechecking. */
export async function compactOrphanDriveAssets(
  referencedHashes: readonly string[],
  now = new Date(),
  onProgress?: DriveAssetProgressCallback,
): Promise<CompactDriveAssetsResult> {
  if (!Number.isFinite(now.getTime())) {
    throw new DriveAssetError('The asset compaction time is invalid.');
  }
  const references = new Set(uniqueHashes(referencedHashes));
  const originalFiles = await listDriveAssets();
  const cutoff = now.getTime() - STALE_DRIVE_ASSET_AGE_MS;
  const candidates = originalFiles.filter(
    (file) => !references.has(file.hash) && Date.parse(file.modifiedTime) < cutoff,
  );
  const latestFiles = await listDriveAssets();
  const remainingFiles = new Map(latestFiles.map((file) => [file.fileId, file]));
  const deletedHashes: string[] = [];
  const retainedHashes: string[] = [];

  onProgress?.({ stage: 'cleaning', current: 0, total: candidates.length });
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]!;
    const current = remainingFiles.get(candidate.fileId);
    if (!current) {
      deletedHashes.push(candidate.hash);
      const duplicate = [...remainingFiles.values()]
        .filter((file) => file.hash === candidate.hash)
        .sort((left, right) => right.modifiedTime.localeCompare(left.modifiedTime))[0];
      if (duplicate) await saveMetadata(duplicate);
      else await db.driveAssets.delete(candidate.hash);
      onProgress?.({
        stage: 'cleaning',
        current: index + 1,
        total: candidates.length,
        hash: candidate.hash,
      });
      continue;
    }
    if (
      references.has(candidate.hash) ||
      current.modifiedTime !== candidate.modifiedTime ||
      Date.parse(current.modifiedTime) >= cutoff
    ) {
      retainedHashes.push(candidate.hash);
      onProgress?.({
        stage: 'cleaning',
        current: index + 1,
        total: candidates.length,
        hash: candidate.hash,
      });
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
      throw new DriveAssetError(
        `Could not reach Google Drive to delete orphan preview ${candidate.hash}.`,
        true,
      );
    }
    if (response.status !== 404) {
      await ensureDriveAssetSuccess(response, 'delete orphan preview');
    }
    remainingFiles.delete(candidate.fileId);
    deletedHashes.push(candidate.hash);
    const duplicate = [...remainingFiles.values()]
      .filter((file) => file.hash === candidate.hash)
      .sort((left, right) => right.modifiedTime.localeCompare(left.modifiedTime))[0];
    if (duplicate) await saveMetadata(duplicate);
    else await db.driveAssets.delete(candidate.hash);
    onProgress?.({
      stage: 'cleaning',
      current: index + 1,
      total: candidates.length,
      hash: candidate.hash,
    });
  }

  return {
    deletedHashes: [...new Set(deletedHashes)],
    retainedHashes: [...new Set(retainedHashes)],
  };
}
