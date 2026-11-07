import {
  defaultRangeExtractor,
  useWindowVirtualizer,
  type Range,
} from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEventHandler,
  type ReactNode,
} from 'react';
import type { BookmarkSize, LibraryView } from '../../core/storage';
import type { Item } from '../../core/types';
import { observeNearViewport } from '../thumbnail-visibility';
import { getViewportOverscanRows } from '../viewport-buffer';
import { observeElementResize } from '../resize-observer';
import {
  getFavoriteCollectionMetrics,
  type FavoriteCollectionMetrics,
} from '../favorite-collection-layout';

interface FavoriteCollectionProps {
  items: readonly Item[];
  layout: LibraryView;
  size: BookmarkSize;
  hasGroupLabels: boolean;
  draggedIds: readonly string[];
  draggingFavoriteId: string | null;
  focusedFavoriteId: string | null;
  dragPreviewRank: ReadonlyMap<string, number> | null;
  showPlaceholder: boolean;
  placeholder: ReactNode;
  onRegister: (
    node: HTMLDivElement,
    items: readonly Item[],
    metrics: FavoriteCollectionMetrics,
  ) => () => void;
  onDragOver: DragEventHandler<HTMLDivElement>;
  renderItem: (item: Item) => ReactNode;
}

interface CollectionEntry {
  key: string;
  item?: Item;
  placeholder?: ReactNode;
}

function FavoriteCollectionSlot({
  rowIndex,
  style,
  onMeasure,
  children,
}: {
  rowIndex: number;
  style: CSSProperties;
  onMeasure: (index: number, height: number) => void;
  children: ReactNode;
}) {
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = slotRef.current;
    // The hidden native source stays mounted but occupies no layout slot.
    if (!node || rowIndex < 0) return;
    return observeElementResize([node], ([entry]) => {
      const height = entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height;
      if (height > 0) onMeasure(rowIndex, height);
    });
  }, [onMeasure, rowIndex]);

  return (
    <div className="bookmark-virtual-slot" ref={slotRef} style={style}>
      {children}
    </div>
  );
}

export function FavoriteCollection({
  items,
  layout,
  size,
  hasGroupLabels,
  draggedIds,
  draggingFavoriteId,
  focusedFavoriteId,
  dragPreviewRank,
  showPlaceholder,
  placeholder,
  onRegister,
  onDragOver,
  renderItem,
}: FavoriteCollectionProps) {
  const collectionRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const node = collectionRef.current;
    if (node) return observeNearViewport(node, setNearViewport);
  }, []);
  const metrics = useMemo(
    () => getFavoriteCollectionMetrics(width, layout, size, hasGroupLabels),
    [hasGroupLabels, layout, size, width],
  );
  const orderedItems = useMemo(() => {
    if (!dragPreviewRank) return items;
    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered: Item[] = [];
    for (const id of dragPreviewRank.keys()) {
      const item = byId.get(id);
      if (item) ordered.push(item);
    }
    for (const item of items) {
      if (!dragPreviewRank.has(item.id)) ordered.push(item);
    }
    return ordered;
  }, [dragPreviewRank, items]);
  const entries = useMemo(() => {
    const dragged = new Set(draggedIds);
    const firstDraggedId = draggedIds[0];
    const firstDraggedRank = firstDraggedId
      ? dragPreviewRank?.get(firstDraggedId)
      : undefined;
    const next: CollectionEntry[] = [];
    let placeholderAdded = false;

    for (const item of orderedItems) {
      if (dragged.has(item.id)) continue;
      const itemRank = dragPreviewRank?.get(item.id);
      if (
        showPlaceholder &&
        !placeholderAdded &&
        firstDraggedRank !== undefined &&
        (itemRank === undefined || itemRank > firstDraggedRank)
      ) {
        next.push({ key: 'drag-placeholder', placeholder });
        placeholderAdded = true;
      }
      next.push({ key: item.id, item });
    }
    if (showPlaceholder && !placeholderAdded) {
      next.push({ key: 'drag-placeholder', placeholder });
    }
    return next;
  }, [dragPreviewRank, draggedIds, orderedItems, placeholder, showPlaceholder]);
  const rowCount = Math.ceil(entries.length / metrics.columns);
  const source = draggingFavoriteId
    ? items.find((item) => item.id === draggingFavoriteId)
    : undefined;
  const focusedItemIndex = entries.findIndex(
    (entry) => entry.item?.id === focusedFavoriteId,
  );
  const rangeExtractor = useCallback(
    (range: Range) => {
      // Window virtualizers clamp an offscreen collection to its first/last
      // rows. Exclude those rows instead of keeping cards for every past group.
      const indexes = new Set(nearViewport ? defaultRangeExtractor(range) : []);
      if (focusedItemIndex >= 0)
        indexes.add(Math.floor(focusedItemIndex / metrics.columns));
      return [...indexes]
        .filter((index) => index >= 0 && index < rowCount)
        .sort((a, b) => a - b);
    },
    [focusedItemIndex, metrics.columns, nearViewport, rowCount],
  );
  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    enabled: nearViewport || focusedItemIndex >= 0 || !!source,
    count: rowCount,
    estimateSize: () => metrics.rowHeight,
    overscan: getViewportOverscanRows(viewportHeight, metrics.rowHeight),
    scrollMargin,
    rangeExtractor,
  });
  const layoutRevision = [rowCount, metrics.columns, metrics.rowHeight].join(':');
  const lastMeasuredLayout = useRef({ revision: '', height: 0 });
  const live = nearViewport || focusedItemIndex >= 0 || !!source;
  const collectionHeight = live
    ? virtualizer.getTotalSize()
    : lastMeasuredLayout.current.revision === layoutRevision
      ? lastMeasuredLayout.current.height
      : rowCount * metrics.rowHeight;
  useLayoutEffect(() => {
    if (live)
      lastMeasuredLayout.current = { revision: layoutRevision, height: collectionHeight };
  }, [collectionHeight, layoutRevision, live]);
  const measureRow = useCallback(
    (index: number, height: number) =>
      virtualizer.resizeItem(index, height + metrics.columnGap),
    [metrics.columnGap, virtualizer],
  );

  useLayoutEffect(() => {
    const node = collectionRef.current;
    if (!node) return;
    const measure = () => {
      setViewportHeight(window.innerHeight);
      setWidth((current) => {
        const next = node.getBoundingClientRect().width;
        return Math.abs(current - next) < 0.5 ? current : next;
      });
      const nextMargin = node.getBoundingClientRect().top + window.scrollY;
      setScrollMargin((current) =>
        Math.abs(current - nextMargin) < 0.5 ? current : nextMargin,
      );
    };
    measure();
    // Offscreen collections only need their own size. Document-height changes
    // otherwise trigger thousands of redundant reads and React updates.
    const stopObserving = observeElementResize(
      live ? [node, document.documentElement] : [node],
      measure,
    );
    window.addEventListener('resize', measure);
    return () => {
      stopObserving();
      window.removeEventListener('resize', measure);
    };
  }, [live]);

  useEffect(() => {
    virtualizer.measure();
  }, [metrics.columns, metrics.rowHeight, virtualizer]);

  useLayoutEffect(() => {
    const node = collectionRef.current;
    if (!node) return;
    return onRegister(node, items, metrics);
  }, [items, metrics, onRegister]);

  const slots = virtualizer.getVirtualItems().flatMap((row) =>
    entries
      .slice(row.index * metrics.columns, (row.index + 1) * metrics.columns)
      .map((entry, column) => ({
        entry,
        rowIndex: row.index,
        column,
        top: row.start - scrollMargin,
      })),
  );
  if (source) {
    // Keep the exact source element under the same parent through every preview
    // reorder and scroll. Reparenting it between virtual rows loses native
    // dragend when Chrome consumes Escape instead of delivering a keydown.
    slots.push({
      entry: { key: source.id, item: source },
      rowIndex: -1,
      column: 0,
      top: 0,
    });
  }
  const cardWidth = (width - metrics.columnGap * (metrics.columns - 1)) / metrics.columns;

  return (
    <div
      className="bookmark-collection relative"
      data-layout={layout}
      data-size={size}
      data-virtualized="true"
      data-virtual-active={live ? 'true' : 'false'}
      data-virtual-columns={metrics.columns}
      onDragOver={onDragOver}
      ref={collectionRef}
      style={{ height: collectionHeight }}
    >
      {slots.map(({ entry, rowIndex, column, top }) => (
        <FavoriteCollectionSlot
          key={entry.key}
          rowIndex={rowIndex}
          onMeasure={measureRow}
          style={{
            left: column * (cardWidth + metrics.columnGap),
            top,
            width: Math.max(0, cardWidth),
          }}
        >
          {entry.item ? renderItem(entry.item) : entry.placeholder}
        </FavoriteCollectionSlot>
      ))}
    </div>
  );
}
