import { getThumbnail } from '../core/storage';
import { getCardThumbnailBlob } from '../core/card-thumbnail';

export type ThumbnailResourceSize = 'small' | 'full';
export interface ThumbnailResource {
  url: string;
  release: () => void;
}
interface ResourceEntry {
  references: number;
  ready: Promise<void>;
  url?: string;
  lastOpened?: number;
  encodedBytes?: number;
  fullImagePixels?: number;
}
const resources = new Map<string, ResourceEntry>();
const recentHoverImages = new Map<string, ResourceEntry>();
const HOVER_IMAGE_CACHE_LIMIT = 10;
let openingSequence = 0;
const jobs: Array<() => void> = [];
let running = 0;
let urlsCreated = 0;
let urlsRevoked = 0;

/** Numeric snapshot only: diagnostics never retain extra image objects. */
export function getThumbnailResourceStats() {
  const summarize = (size: ThumbnailResourceSize) => {
    const entries = [...resources].filter(([key]) => key.endsWith(':' + size));
    return {
      entries: entries.length,
      urls: entries.filter(([, entry]) => !!entry.url).length,
      consumers: entries.reduce((sum, [, entry]) => sum + entry.references, 0),
      encodedBytes: entries.reduce(
        (sum, [, entry]) => sum + (entry.url ? (entry.encodedBytes ?? 0) : 0),
        0,
      ),
      fullImageRgbaBytesEstimate:
        size === 'full'
          ? entries.reduce(
              (sum, [, entry]) =>
                sum + (entry.url ? (entry.fullImagePixels ?? 0) * 4 : 0),
              0,
            )
          : undefined,
    };
  };
  return {
    small: summarize('small'),
    full: summarize('full'),
    cachedHoverImages: recentHoverImages.size,
    runningJobs: running,
    queuedJobs: jobs.length,
    urlsCreated,
    urlsRevoked,
  };
}

function revokeUnusedEntry(key: string, entry: ResourceEntry): void {
  if (entry.references === 0 && entry.url && recentHoverImages.get(key) !== entry) {
    URL.revokeObjectURL(entry.url);
    urlsRevoked += 1;
    entry.url = undefined;
    if (resources.get(key) === entry) resources.delete(key);
  }
}

function releaseEntry(key: string, entry: ResourceEntry): void {
  entry.references -= 1;
  revokeUnusedEntry(key, entry);
}

function rememberHoverImage(key: string, entry: ResourceEntry, opened: number): void {
  // Preserve opening order even when storage requests finish out of order.
  entry.lastOpened = Math.max(entry.lastOpened ?? 0, opened);
  recentHoverImages.set(key, entry);
  if (recentHoverImages.size <= HOVER_IMAGE_CACHE_LIMIT) return;
  const [oldestKey, oldest] = [...recentHoverImages].reduce((first, next) =>
    first[1].lastOpened! < next[1].lastOpened! ? first : next,
  );
  recentHoverImages.delete(oldestKey);
  // A still-open preview owns its resource until it closes, even if evicted.
  revokeUnusedEntry(oldestKey, oldest);
}

/** An imperative drag clone owns its image independently of the hidden source. */
export function retainThumbnailUrl(url: string): (() => void) | undefined {
  for (const [key, entry] of resources) {
    if (entry.url !== url) continue;
    entry.references += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      releaseEntry(key, entry);
    };
  }
  return undefined;
}

function runNext(): void {
  while (running < 4 && jobs.length) jobs.shift()!();
}

/** Limit storage reads and decodes, including obsolete requests during fast scrolling. */
function schedule(load: () => Promise<void>): Promise<void> {
  return new Promise((resolve, reject) => {
    jobs.push(() => {
      running += 1;
      void Promise.resolve()
        .then(load)
        .then(resolve, reject)
        .finally(() => {
          running -= 1;
          runNext();
        });
    });
    runNext();
  });
}

export async function acquireThumbnailUrl(
  hash: string,
  size: ThumbnailResourceSize,
  signal?: AbortSignal,
): Promise<ThumbnailResource | undefined> {
  if (signal?.aborted) return undefined;
  const opened = size === 'full' ? ++openingSequence : 0;
  const key = hash + ':' + size;
  let entry = resources.get(key);
  if (!entry) {
    const created: ResourceEntry = { references: 0, ready: Promise.resolve() };
    entry = created;
    resources.set(key, created);
    created.ready = schedule(async () => {
      if (!created.references) return;
      const full = size === 'full' ? await getThumbnail(hash) : undefined;
      const blob =
        size === 'small'
          ? await getCardThumbnailBlob(hash, () => created.references > 0)
          : full?.blob;
      if (blob && created.references > 0) {
        created.encodedBytes = blob.size;
        created.fullImagePixels = full ? full.width * full.height : undefined;
        created.url = URL.createObjectURL(blob);
        urlsCreated += 1;
      }
    }).finally(() => {
      if (!created.references && resources.get(key) === created) resources.delete(key);
    });
  }
  // Reserve ownership before awaiting loading: a release cannot revoke a URL
  // another concurrent caller has acquired but not yet received.
  const owned = entry;
  owned.references += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    signal?.removeEventListener('abort', release);
    releaseEntry(key, owned);
  };
  signal?.addEventListener('abort', release, { once: true });
  try {
    await owned.ready;
    if (released || !owned.url) {
      release();
      if (!owned.references && resources.get(key) === owned) resources.delete(key);
      return undefined;
    }
    if (size === 'full') rememberHoverImage(key, owned, opened);
    return { url: owned.url, release };
  } catch (cause) {
    release();
    if (!owned.references && resources.get(key) === owned) resources.delete(key);
    throw cause;
  }
}
