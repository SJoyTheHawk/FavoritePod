import { getThumbnail } from '../core/storage';

export type ThumbnailResourceSize = 'small' | 'full';

export interface ThumbnailResource {
  url: string;
  release: () => void;
}

interface ResourceEntry {
  url: string;
  blob: Blob;
  size: ThumbnailResourceSize;
  references: number;
  lastUsed: number;
}

const resources = new Map<string, ResourceEntry>();
const pending = new Map<string, Promise<ResourceEntry | undefined>>();
let usageClock = 0;

function resourceKey(hash: string, size: ThumbnailResourceSize): string {
  return `${hash}:${size}`;
}

function removeResource(key: string, entry: ResourceEntry): void {
  resources.delete(key);
  URL.revokeObjectURL(entry.url);
}

function trimSmallCache(): void {
  const unused = [...resources.entries()].filter(
    ([, entry]) => entry.size === 'small' && entry.references === 0,
  );
  let cachedBytes = unused.reduce((total, [, entry]) => total + entry.blob.size, 0);
  unused.sort(([, left], [, right]) => left.lastUsed - right.lastUsed);
  while (unused.length > 64 || cachedBytes > 16 * 1024 * 1024) {
    const [key, entry] = unused.shift()!;
    cachedBytes -= entry.blob.size;
    removeResource(key, entry);
  }
}

async function loadResource(
  hash: string,
  size: ThumbnailResourceSize,
): Promise<ResourceEntry | undefined> {
  const key = resourceKey(hash, size);
  const existing = resources.get(key);
  if (existing) return existing;
  const current = pending.get(key);
  if (current) return current;

  const request = getThumbnail(hash)
    .then((thumbnail) => {
      if (!thumbnail) return undefined;
      const blob =
        size === 'small' ? (thumbnail.smallBlob ?? thumbnail.blob) : thumbnail.blob;
      const entry: ResourceEntry = {
        url: URL.createObjectURL(blob),
        blob,
        size,
        references: 0,
        lastUsed: ++usageClock,
      };
      resources.set(key, entry);
      return entry;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export async function acquireThumbnailUrl(
  hash: string,
  size: ThumbnailResourceSize,
): Promise<ThumbnailResource | undefined> {
  const key = resourceKey(hash, size);
  const entry = await loadResource(hash, size);
  if (!entry) return undefined;
  entry.references += 1;
  entry.lastUsed = ++usageClock;
  let released = false;
  return {
    url: entry.url,
    release: () => {
      if (released) return;
      released = true;
      entry.references = Math.max(0, entry.references - 1);
      entry.lastUsed = ++usageClock;
      if (entry.references === 0 && size === 'full') removeResource(key, entry);
      else trimSmallCache();
    },
  };
}
