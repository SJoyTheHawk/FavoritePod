import { db } from '../core/db';
import { getFileAvailabilityStats } from '../core/file-links';
import { getThumbnailResourceStats } from './thumbnail-resources';

/** Read-only, on-demand aggregates. No titles, paths, URLs, or image blobs. */
export async function getMemoryReport() {
  const images = {
    card: { elements: 0, loaded: 0, rgbaBytesEstimate: 0 },
    hover: { elements: 0, loaded: 0, rgbaBytesEstimate: 0 },
    favicon: { elements: 0, loaded: 0, rgbaBytesEstimate: 0 },
    other: { elements: 0, loaded: 0, rgbaBytesEstimate: 0 },
  };
  for (const image of document.images) {
    const category = image.closest('[id^="favorite-preview-"]')
      ? 'hover'
      : image.closest('.bookmark-preview') && image.src.startsWith('blob:')
        ? 'card'
        : image.alt === '' && image.closest('.bookmark-card')
          ? 'favicon'
          : 'other';
    images[category].elements += 1;
    if (image.naturalWidth && image.naturalHeight) {
      images[category].loaded += 1;
      images[category].rgbaBytesEstimate += image.naturalWidth * image.naturalHeight * 4;
    }
  }
  const resources = getThumbnailResourceStats();
  const mountedCards = document.querySelectorAll('[data-favorite-id]').length;
  const mountedElements = document.querySelectorAll('*').length;
  const memory = (
    performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }
  ).memory;
  const javascriptHeap = memory
    ? {
        usedBytes: memory.usedJSHeapSize,
        allocatedBytes: memory.totalJSHeapSize,
        limitBytes: memory.jsHeapSizeLimit,
      }
    : null;
  const library = {
    items: 0,
    groups: 0,
    itemJsonCharacters: 0,
    groupJsonCharacters: 0,
    faviconCharacters: 0,
    embeddedFavicons: 0,
    largestFaviconCharacters: 0,
  };
  // Scan only record metadata one row at a time, never the thumbnail table.
  await db.transaction('r', db.items, db.groups, async () => {
    await db.items.each((item) => {
      library.items += 1;
      library.itemJsonCharacters += JSON.stringify(item).length;
      const length = item.faviconUrl?.length ?? 0;
      library.faviconCharacters += length;
      library.largestFaviconCharacters = Math.max(
        library.largestFaviconCharacters,
        length,
      );
      if (item.faviconUrl?.startsWith('data:')) library.embeddedFavicons += 1;
    });
    await db.groups.each((group) => {
      library.groups += 1;
      library.groupJsonCharacters += JSON.stringify(group).length;
    });
  });
  return {
    capturedAt: new Date().toISOString(),
    viewportHeight: window.innerHeight,
    mountedCards,
    mountedElements,
    virtualCollections: document.querySelectorAll('[data-virtualized="true"]').length,
    activeVirtualCollections: document.querySelectorAll('[data-virtual-active="true"]')
      .length,
    fileAvailability: getFileAvailabilityStats(),
    javascriptHeap,
    images,
    resources,
    library,
    limitations:
      'Not total process RAM. RGBA estimates assume 4 bytes/pixel and are not measured allocations; DOM estimates can double-count shared images. Metadata character counts are serialized sizes, not retained heap. Heap is sampled before the metadata scan. Browser image/GPU caches and detached objects require Chrome profiling.',
  };
}
