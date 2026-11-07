import type { BookmarkSize } from '../core/storage';
import type { LibraryView } from '../core/storage';

export interface FavoriteNavigationGeometry {
  left: number;
  top: number;
  width: number;
}

export interface FavoriteCollectionMetrics {
  columns: number;
  rowHeight: number;
  columnGap: number;
}

function collectionGap(layout: LibraryView, size: BookmarkSize): number {
  if (layout === 'list') {
    if (size === 'large') return 12;
    if (size === 'small' || size === 'compact') return 6;
    return 8;
  }
  if (size === 'large') return 20;
  if (size === 'small') return 12;
  if (size === 'extra-small' || size === 'compact') return 8;
  return 16;
}

function minimumCardWidth(layout: LibraryView, size: BookmarkSize): number {
  if (layout === 'list') return 1;
  if (size === 'large') return 240;
  if (size === 'small') return 136;
  if (size === 'extra-small') return 112;
  if (size === 'compact') return 104;
  return 176;
}

export function getFavoriteCollectionMetrics(
  width: number,
  layout: LibraryView,
  size: BookmarkSize,
  hasGroupLabels: boolean,
): FavoriteCollectionMetrics {
  const columnGap = collectionGap(layout, size);
  const columns =
    layout === 'list'
      ? 1
      : Math.max(
          1,
          Math.floor((width + columnGap) / (minimumCardWidth(layout, size) + columnGap)),
        );
  const cardWidth = (width - columnGap * (columns - 1)) / columns;
  let cardHeight: number;

  if (layout === 'list') {
    cardHeight =
      size === 'large' ? 102 : size === 'small' ? 60 : size === 'extra-small' ? 52 : 76;
    if (size === 'compact') cardHeight = 44;
  } else if (size === 'compact') {
    cardHeight = 92;
  } else {
    const detailsHeight = size === 'extra-small' ? 52 : 68;
    cardHeight = (Math.max(0, cardWidth - 2) * 10) / 16 + detailsHeight + 2;
  }

  return {
    columns,
    columnGap,
    rowHeight: cardHeight + (hasGroupLabels ? 28 : 0) + columnGap,
  };
}

export function getFavoriteNavigationGeometry(
  itemCount: number,
  metrics: FavoriteCollectionMetrics,
  bounds: { left: number; top: number; width: number },
): FavoriteNavigationGeometry[] {
  const itemWidth =
    (bounds.width - metrics.columnGap * (metrics.columns - 1)) / metrics.columns;
  return Array.from({ length: itemCount }, (_, index) => {
    const column = index % metrics.columns;
    const row = Math.floor(index / metrics.columns);
    return {
      left: bounds.left + column * (itemWidth + metrics.columnGap),
      top: bounds.top + row * metrics.rowHeight,
      width: itemWidth,
    };
  });
}
