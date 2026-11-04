import { db } from './db';
import {
  compactOrphanDriveAssets,
  downloadMissingDriveAssets,
  uploadMissingDriveAssets,
} from './drive-assets';
import { requireDriveConnection, verifyGoogleDriveAccount } from './drive-auth';
import {
  cacheDownloadedDriveDeviceFiles,
  compactStaleDriveDeviceFiles,
  createLocalDriveDeviceState,
  downloadAllDriveDeviceFiles,
  downloadChangedDriveDeviceFiles,
  listDriveDeviceFiles,
  uploadDriveDeviceState,
  type DownloadedDriveDeviceFile,
} from './drive-files';
import { compareHLC, tickHLC } from './hlc';
import { isGroupDeleted, isItemDeleted, mergeLibrary } from './merge';
import { createSnapshot, getDeviceId } from './storage';
import { withoutDriveChangeNotification } from './drive-sync-triggers';
import type { DriveDeviceState, Group, HLC, Item, LibraryState } from './types';

const SYNC_LOCK_NAME = 'favoritepod-google-drive-sync';
const INITIAL_SYNC_KEY = 'drive.initialSyncCompleted';
const LAST_SYNC_KEY = 'drive.lastSync';
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 750;
const RETRY_MAX_DELAY_MS = 8_000;

export type DriveSyncChoice = 'merge' | 'replace-local' | 'replace-drive';

export interface DriveSyncCounts {
  groups: number;
  items: number;
}

export interface DriveSyncPreview {
  local: DriveSyncCounts;
  drive: DriveSyncCounts;
}

export type DriveSyncStage =
  'checking' | 'downloading' | 'merging' | 'uploading' | 'complete';

export interface DriveSyncProgress {
  stage: DriveSyncStage;
}

export type DriveSyncProgressCallback = (progress: DriveSyncProgress) => void;

export type DriveSyncResult =
  | { status: 'skipped'; reason: 'already-running' }
  | {
      status: 'synced';
      syncedAt: string;
      uploadedAssets: number;
      downloadedAssets: number;
      missingAssets: number;
    };

export class DriveSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriveSyncError';
  }
}

export class DriveSyncChoiceRequired extends Error {
  constructor(readonly preview: DriveSyncPreview) {
    super('Choose how to combine this library with Google Drive.');
    this.name = 'DriveSyncChoiceRequired';
  }
}

export interface DriveSyncRetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
}

function delay(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function canRetry(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'retryable' in cause &&
    (cause as { retryable?: unknown }).retryable === true
  );
}

/** Retry only network, rate-limit, and transient server errors with jitter. */
export async function retryDriveSync<T>(
  operation: () => Promise<T>,
  options: DriveSyncRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? RETRY_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? RETRY_BASE_DELAY_MS;
  const maxDelayMs = options.maxDelayMs ?? RETRY_MAX_DELAY_MS;
  const random = options.random ?? Math.random;
  const sleep = options.sleep ?? delay;

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (cause) {
      if (!canRetry(cause) || attempt + 1 >= attempts) throw cause;
      const ceiling = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      const jittered = Math.round(ceiling * (0.5 + random()));
      await sleep(jittered);
    }
  }
}

function recordClocks(state: LibraryState): HLC[] {
  return [
    ...state.groups.flatMap((group) => [
      ...Object.values(group.clock),
      ...(group.deleted ? [group.deleted] : []),
    ]),
    ...state.items.flatMap((item) => [
      ...Object.values(item.clock),
      ...(item.deleted ? [item.deleted] : []),
    ]),
  ];
}

function latestClock(clocks: readonly HLC[]): HLC | undefined {
  return clocks.reduce<HLC | undefined>(
    (latest, clock) =>
      latest === undefined || compareHLC(clock, latest) > 0 ? clock : latest,
    undefined,
  );
}

function counts(state: LibraryState): DriveSyncCounts {
  return {
    groups: state.groups.filter((group) => !isGroupDeleted(group)).length,
    items: state.items.filter((item) => !isItemDeleted(item)).length,
  };
}

function hasContent(state: LibraryState): boolean {
  // Tombstones are meaningful local data, and a single empty group may be a
  // user's organization choice rather than an automatically created default.
  return state.items.length > 0 || state.groups.length > 0;
}

function mergeDeviceStates(states: readonly DriveDeviceState[]): LibraryState {
  return states.reduce<LibraryState>((merged, state) => mergeLibrary(merged, state), {
    groups: [],
    items: [],
  });
}

function allDownloaded(result: {
  downloaded: DownloadedDriveDeviceFile[];
}): DriveDeviceState[] {
  return result.downloaded.map(({ state }) => state);
}

function createAuthoritativeLocalState(
  local: LibraryState,
  remote: LibraryState,
  deviceId: string,
  seedClock: HLC | undefined,
  now: number,
): { state: LibraryState; lastClock: HLC | undefined } {
  let cursor = latestClock([
    ...(seedClock ? [seedClock] : []),
    ...recordClocks(local),
    ...recordClocks(remote),
  ]);
  const nextClock = (): HLC => {
    cursor = tickHLC(cursor, deviceId, now);
    return cursor;
  };
  const localGroupIds = new Set(local.groups.map((group) => group.id));
  const localItemIds = new Set(local.items.map((item) => item.id));
  const groups: Group[] = local.groups.map((group) => {
    const clock = {
      parentId: nextClock(),
      orderKey: nextClock(),
      title: nextClock(),
    };
    const next = { ...group, clock };
    if (group.deleted) next.deleted = nextClock();
    else delete next.deleted;
    return next;
  });
  const items: Item[] = local.items.map((item) => {
    const clock = {
      groupId: nextClock(),
      orderKey: nextClock(),
      url: nextClock(),
      title: nextClock(),
      previewHash: nextClock(),
      faviconUrl: nextClock(),
    };
    const next = { ...item, clock };
    if (item.deleted) next.deleted = nextClock();
    else delete next.deleted;
    return next;
  });

  for (const group of remote.groups) {
    if (localGroupIds.has(group.id)) continue;
    groups.push({ ...group, deleted: nextClock() });
  }
  for (const item of remote.items) {
    if (localItemIds.has(item.id)) continue;
    items.push({ ...item, deleted: nextClock() });
  }

  return {
    state: mergeLibrary({ groups: [], items: [] }, { groups, items }),
    lastClock: cursor,
  };
}

function sameRecords<T extends { id: string }>(left: T[], right: T[]): boolean {
  if (left.length !== right.length) return false;
  const orderedLeft = [...left].sort((a, b) => a.id.localeCompare(b.id));
  const orderedRight = [...right].sort((a, b) => a.id.localeCompare(b.id));
  return orderedLeft.every((record, index) => {
    return JSON.stringify(record) === JSON.stringify(orderedRight[index]);
  });
}

async function readLibrary(): Promise<LibraryState> {
  return db.transaction('r', db.groups, db.items, async () => ({
    groups: await db.groups.toArray(),
    items: await db.items.toArray(),
  }));
}

async function applyRemoteState(
  remote: LibraryState,
  choice: DriveSyncChoice,
  deviceId: string,
  now: Date,
): Promise<LibraryState> {
  if (choice === 'replace-local') await createSnapshot();
  if (choice === 'replace-drive') await createSnapshot();

  return withoutDriveChangeNotification(() =>
    db.transaction('rw', db.groups, db.items, db.syncMeta, async () => {
      const local: LibraryState = {
        groups: await db.groups.toArray(),
        items: await db.items.toArray(),
      };
      let next: LibraryState;
      let replacementClock: HLC | undefined;

      if (choice === 'replace-local') {
        next = remote;
      } else if (choice === 'replace-drive') {
        const previousRecord = await db.syncMeta.get('lastHlc');
        const previousClock =
          typeof previousRecord?.value === 'string' ? previousRecord.value : undefined;
        const replaced = createAuthoritativeLocalState(
          local,
          remote,
          deviceId,
          previousClock,
          now.getTime(),
        );
        next = replaced.state;
        replacementClock = replaced.lastClock;
      } else {
        next = mergeLibrary(local, remote);
      }

      if (!sameRecords(local.groups, next.groups)) {
        await db.groups.clear();
        if (next.groups.length) await db.groups.bulkPut(next.groups);
      }
      if (!sameRecords(local.items, next.items)) {
        await db.items.clear();
        if (next.items.length) await db.items.bulkPut(next.items);
      }

      const mergedClock = latestClock(recordClocks(next));
      const previousRecord = await db.syncMeta.get('lastHlc');
      const previousClock =
        typeof previousRecord?.value === 'string' ? previousRecord.value : undefined;
      const baseClock = latestClock([
        ...(replacementClock ? [replacementClock] : []),
        ...(previousClock ? [previousClock] : []),
        ...(mergedClock ? [mergedClock] : []),
      ]);
      if (baseClock) {
        await db.syncMeta.put({
          key: 'lastHlc',
          value: tickHLC(baseClock, deviceId, now.getTime()),
        });
      }
      return next;
    }),
  );
}

function collectPreviewHashes(state: LibraryState): string[] {
  return [
    ...new Set(
      state.items
        .filter((item) => !isItemDeleted(item))
        .flatMap((item) => (item.previewHash ? [item.previewHash] : [])),
    ),
  ];
}

async function setInitialSyncCompleted(): Promise<void> {
  await db.transaction('rw', db.syncMeta, async () => {
    await db.syncMeta.put({ key: INITIAL_SYNC_KEY, value: true });
  });
}

async function setLastSync(syncedAt: string): Promise<void> {
  await db.transaction('rw', db.syncMeta, async () => {
    await db.syncMeta.put({ key: LAST_SYNC_KEY, value: syncedAt });
  });
}

async function performSync(
  requestedChoice: DriveSyncChoice | undefined,
  setResolvedChoice: (choice: DriveSyncChoice) => void,
  onProgress?: DriveSyncProgressCallback,
): Promise<DriveSyncResult> {
  await requireDriveConnection();
  await verifyGoogleDriveAccount();
  const deviceId = await getDeviceId();
  const firstSync = (await db.syncMeta.get(INITIAL_SYNC_KEY))?.value !== true;
  onProgress?.({ stage: 'checking' });
  const files = await listDriveDeviceFiles();
  onProgress?.({ stage: 'downloading' });
  const downloaded = firstSync
    ? await downloadAllDriveDeviceFiles(files, { deferCacheUpdate: true })
    : await downloadChangedDriveDeviceFiles(files, { deferCacheUpdate: true });
  const remoteStates = allDownloaded(downloaded);
  const remote = mergeDeviceStates(remoteStates);
  const local = await readLibrary();
  let choice = requestedChoice;

  if (firstSync && !choice) {
    const preview = { local: counts(local), drive: counts(remote) };
    const localHasContent = hasContent(local);
    const remoteHasContent = hasContent(remote);
    if (localHasContent && remoteHasContent) {
      throw new DriveSyncChoiceRequired(preview);
    }
    choice = remoteHasContent && !localHasContent ? 'replace-local' : 'merge';
  }
  choice ??= 'merge';
  setResolvedChoice(choice);

  onProgress?.({ stage: 'merging' });
  await applyRemoteState(remote, choice, deviceId, new Date());
  await cacheDownloadedDriveDeviceFiles(downloaded.downloaded);

  onProgress?.({ stage: 'uploading' });
  const cachedDeviceFile = await db.deviceFiles.get(deviceId);
  const state = await createLocalDriveDeviceState(
    Math.max(1, (cachedDeviceFile?.revision ?? 0) + 1),
  );
  await uploadDriveDeviceState(state);

  const compacted = await compactStaleDriveDeviceFiles();
  const finalState = await applyRemoteState(
    compacted.state,
    'merge',
    deviceId,
    new Date(),
  );
  await setInitialSyncCompleted();
  const finalHashes = collectPreviewHashes(finalState);
  const finalDownloads = await downloadMissingDriveAssets(finalHashes);
  const finalUploads = await uploadMissingDriveAssets(finalHashes);
  await compactOrphanDriveAssets(finalHashes);

  const syncedAt = new Date().toISOString();
  await setLastSync(syncedAt);
  onProgress?.({ stage: 'complete' });
  if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
    void chrome.runtime
      .sendMessage({ type: 'favoritepod.sync.completed' })
      .catch(() => undefined);
  }

  return {
    status: 'synced',
    syncedAt,
    uploadedAssets: finalUploads.uploadedHashes.length,
    downloadedAssets: finalDownloads.downloadedHashes.length,
    missingAssets:
      finalDownloads.missingRemoteHashes.length + finalUploads.missingLocalHashes.length,
  };
}

/** Serialize, merge, and sync this account's library across extension contexts. */
export async function syncGoogleDrive(
  choice?: DriveSyncChoice,
  onProgress?: DriveSyncProgressCallback,
): Promise<DriveSyncResult> {
  const result = await withGoogleDriveSyncLock(() => {
    let resolvedChoice = choice;
    return retryDriveSync(() =>
      performSync(
        resolvedChoice,
        (nextChoice) => {
          resolvedChoice = nextChoice;
        },
        onProgress,
      ),
    );
  });
  return result ?? { status: 'skipped', reason: 'already-running' };
}

/** Run account mutations under the same lock used by sync in every extension context. */
export async function withGoogleDriveSyncLock<T>(
  operation: () => Promise<T>,
): Promise<T | null> {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    throw new DriveSyncError('This browser cannot safely coordinate Drive sync yet.');
  }

  return navigator.locks.request(
    SYNC_LOCK_NAME,
    { mode: 'exclusive', ifAvailable: true },
    (lock) => (lock ? operation() : Promise.resolve(null)),
  );
}

export async function hasCompletedInitialDriveSync(): Promise<boolean> {
  return (await db.syncMeta.get(INITIAL_SYNC_KEY))?.value === true;
}
