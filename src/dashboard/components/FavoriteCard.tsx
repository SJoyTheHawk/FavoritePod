import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  DocumentIcon,
  EllipsisHorizontalIcon,
  GlobeAltIcon,
  PencilSquareIcon,
  TrashIcon,
  ArrowsRightLeftIcon,
  ChevronUpIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { FaviconImage } from '../../components/FaviconImage';
import { ThumbnailImage } from '../../components/ThumbnailImage';
import { getThumbnail, type BookmarkSize } from '../../core/storage';
import { getUrlLabel, parseSafeUrl } from '../../core/validation';
import {
  checkFileAvailability,
  FILE_ACCESS_DENIED,
  openSavedUrl,
  type FileAvailability,
  type PathOverride,
} from '../../core/file-links';
import type { Item } from '../../core/types';
import { FavoriteFallback } from './FavoriteFallback';
import { HoverPreview } from './HoverPreview';
import { clearLibraryDragData, setLibraryDragData } from '../drag';
import { getFavoriteReorderOffset, type FavoriteLayout } from '../favorite-motion';

interface FavoriteCardProps {
  item: Item;
  layout: 'grid' | 'list';
  size: BookmarkSize;
  showPreview: boolean;
  pathOverrides: PathOverride[];
  groupLabel?: string;
  sortOrder?: number;
  orderRevision: string;
  collectionRevision: string;
  animateReorder: boolean;
  isDragging: boolean;
  dragItemIds: string[];
  dropOrigin: { left: number; top: number } | null;
  selected: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleSelected: (item: Item) => void;
  onEdit: (item: Item) => void;
  onMove: (item: Item) => void;
  onMoveUp: (item: Item) => void;
  onMoveDown: (item: Item) => void;
  onDelete: (item: Item) => void;
  onOpenError: (message: string) => void;
  onFileAccessDenied: () => void;
  onDragStart: (itemId: string, height: number) => void;
  onDragEnd: () => void;
}

function MenuAction({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <MenuItem disabled={disabled}>
      {({ focus, disabled: itemDisabled }) => (
        <button
          className={`flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm ${danger ? 'text-danger' : 'text-text-primary'} ${focus ? 'bg-surface-hover' : ''} ${itemDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
          disabled={itemDisabled}
          onClick={onClick}
          type="button"
        >
          {icon}
          {label}
        </button>
      )}
    </MenuItem>
  );
}

function CloseMenuOnDrag({ dragging, close }: { dragging: boolean; close: () => void }) {
  // Close the portal without removing its button, which can be the drag source.
  useLayoutEffect(() => {
    if (dragging) close();
  }, [dragging, close]);
  return null;
}

export function FavoriteCard({
  item,
  layout,
  size,
  showPreview,
  pathOverrides,
  groupLabel,
  sortOrder,
  orderRevision,
  collectionRevision,
  animateReorder,
  isDragging,
  dragItemIds,
  dropOrigin,
  selected,
  canMoveUp,
  canMoveDown,
  onToggleSelected,
  onEdit,
  onMove,
  onMoveUp,
  onMoveDown,
  onDelete,
  onOpenError,
  onFileAccessDenied,
  onDragStart,
  onDragEnd,
}: FavoriteCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [loadingPreviewHash, setLoadingPreviewHash] = useState<string | null>(null);
  const [fullThumbnailUrl, setFullThumbnailUrl] = useState<string>();
  const [hoverPreviewOpen, setHoverPreviewOpen] = useState(false);
  const [fileAvailability, setFileAvailability] = useState<FileAvailability>('unknown');
  const previewTimer = useRef<number>();
  const previewHideTimer = useRef<number>();
  const [dragSize, setDragSize] = useState<{ width: number; height: number }>();
  const [dragEntrySize, setDragEntrySize] = useState<{
    width: number;
    height: number;
  }>();
  const cardRef = useRef<HTMLElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);
  const dragImageRef = useRef<HTMLElement | null>(null);
  const nativeDragImageRef = useRef<HTMLCanvasElement | null>(null);
  const dragImageCleanup = useRef<(() => void) | null>(null);
  const previousLayout = useRef<FavoriteLayout>();
  const motion = useRef<Animation>();
  const wasDragging = useRef(false);
  const isLocalFile = parseSafeUrl(item.url)?.protocol === 'file:';
  const isMissingFile = isLocalFile && fileAvailability === 'missing';

  useEffect(() => {
    if (!isLocalFile) {
      setFileAvailability('unknown');
      return;
    }
    let active = true;
    setFileAvailability('unknown');
    void checkFileAvailability(item.url, pathOverrides)
      .then((availability) => {
        if (active) setFileAvailability(availability);
      })
      .catch(() => {
        if (active) setFileAvailability('unknown');
      });
    return () => {
      active = false;
    };
  }, [isLocalFile, item.url, pathOverrides]);

  const removeDragImage = () => {
    dragImageCleanup.current?.();
    dragImageCleanup.current = null;
    dragImageRef.current?.remove();
    dragImageRef.current = null;
    nativeDragImageRef.current?.remove();
    nativeDragImageRef.current = null;
  };

  useEffect(() => removeDragImage, []);
  useEffect(() => () => motion.current?.cancel(), []);

  useEffect(() => {
    return () => {
      if (previewTimer.current) window.clearTimeout(previewTimer.current);
      if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (showPreview) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
    previewTimer.current = undefined;
    previewHideTimer.current = undefined;
    setHoverPreviewOpen(false);
  }, [showPreview]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.inert = isDragging;

    const entry = card.closest<HTMLElement>('.favorite-entry') ?? card;
    const currentLayout = {
      left: entry.offsetLeft,
      top: entry.offsetTop,
      width: entry.offsetWidth,
      height: entry.offsetHeight,
      orderRevision,
      collectionRevision,
      animateReorder,
      layout,
      size,
    };
    const priorLayout = previousLayout.current;
    previousLayout.current = currentLayout;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (
      reducedMotion ||
      isDragging ||
      !animateReorder ||
      priorLayout?.collectionRevision !== collectionRevision ||
      priorLayout.layout !== layout ||
      priorLayout.size !== size ||
      priorLayout.width !== currentLayout.width ||
      priorLayout.height !== currentLayout.height
    ) {
      motion.current?.cancel();
    }
    if (isDragging) {
      wasDragging.current = true;
      return;
    }
    if (wasDragging.current) {
      wasDragging.current = false;
      if (!reducedMotion) {
        const rect = card.getBoundingClientRect();
        const translate = dropOrigin
          ? `${dropOrigin.left - rect.left}px ${dropOrigin.top - rect.top}px`
          : '0px 0px';
        motion.current?.cancel();
        motion.current = card.animate(
          [
            { opacity: 0.65, scale: '0.97', translate },
            { opacity: 1, scale: '1', translate: '0px 0px' },
          ],
          { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
      }
      return;
    }
    const offset = getFavoriteReorderOffset(priorLayout, currentLayout);
    if (reducedMotion || !offset) return;
    // Continue from the visible position when a fast drag retargets mid-animation.
    const translate = getComputedStyle(card).translate.split(' ').map(parseFloat);
    const x = offset.x + (Number.isFinite(translate[0]) ? translate[0] : 0);
    const y = offset.y + (Number.isFinite(translate[1]) ? translate[1] : 0);
    motion.current?.cancel();
    motion.current = card.animate(
      [{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }],
      {
        duration: 220,
        easing: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    );
  });

  useEffect(() => {
    let currentUrl: string | undefined;
    let fullUrl: string | undefined;
    let active = true;
    setThumbnailUrl(undefined);
    setFullThumbnailUrl(undefined);
    setLoadingPreviewHash(item.previewHash ?? null);
    if (!item.previewHash) return () => undefined;

    void getThumbnail(item.previewHash)
      .then((thumbnail) => {
        if (!active || !thumbnail) return;
        currentUrl = URL.createObjectURL(thumbnail.smallBlob ?? thumbnail.blob);
        fullUrl = URL.createObjectURL(thumbnail.blob);
        setThumbnailUrl(currentUrl);
        setFullThumbnailUrl(fullUrl);
      })
      .catch(() => {
        if (active) setThumbnailUrl(undefined);
      })
      .finally(() => {
        if (active) setLoadingPreviewHash(null);
      });

    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      if (fullUrl) URL.revokeObjectURL(fullUrl);
    };
  }, [item.previewHash]);

  const cancelPreviewHide = () => {
    if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
  };

  const editItem = () => {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    if (previewHideTimer.current) window.clearTimeout(previewHideTimer.current);
    previewTimer.current = undefined;
    previewHideTimer.current = undefined;
    setHoverPreviewOpen(false);
    onEdit(item);
  };

  const schedulePreview = () => {
    if (!showPreview || isDragging) return;
    cancelPreviewHide();
    if (hoverPreviewOpen || previewTimer.current) return;
    previewTimer.current = window.setTimeout(() => {
      previewTimer.current = undefined;
      setHoverPreviewOpen(true);
    }, 400);
  };

  const hidePreview = () => {
    if (previewTimer.current) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = undefined;
    }
    previewHideTimer.current = window.setTimeout(() => {
      setHoverPreviewOpen(false);
      previewHideTimer.current = undefined;
    }, 150);
  };

  const openItem = async () => {
    if (!parseSafeUrl(item.url)) {
      onOpenError('This favorite has an invalid address and cannot be opened.');
      return;
    }
    try {
      await openSavedUrl(item.url);
    } catch (cause) {
      if (cause instanceof Error && cause.message === FILE_ACCESS_DENIED) {
        onFileAccessDenied();
        onOpenError(
          'File access is turned off. Enable "Allow access to file URLs" in Chrome extension settings.',
        );
      } else {
        onOpenError('Chrome could not open this address. Check the URL and try again.');
      }
    }
  };

  const preview = (
    <ThumbnailImage
      loading={!!item.previewHash && loadingPreviewHash === item.previewHash}
      src={thumbnailUrl}
      fallback={
        <FavoriteFallback item={item} compact={layout === 'list' || size !== 'large'} />
      }
    />
  );
  const isCompactGrid = layout === 'grid' && size === 'compact';

  const card = (
    <article
      ref={cardRef}
      data-favorite-id={item.id}
      draggable
      onMouseEnter={schedulePreview}
      onMouseLeave={hidePreview}
      onFocusCapture={schedulePreview}
      onBlurCapture={(event) => {
        const next = event.relatedTarget;
        if (
          next instanceof Node &&
          (event.currentTarget.contains(next) ||
            document.getElementById(`favorite-preview-${item.id}`)?.contains(next))
        ) {
          return;
        }
        hidePreview();
      }}
      onKeyDown={(event) => {
        if (
          ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(
            event.key,
          )
        ) {
          if (previewTimer.current) window.clearTimeout(previewTimer.current);
          previewTimer.current = undefined;
          setHoverPreviewOpen(false);
        }
        if (event.key === 'Escape' && hoverPreviewOpen) {
          event.preventDefault();
          event.stopPropagation();
          setHoverPreviewOpen(false);
          previewTriggerRef.current?.focus();
        }
      }}
      onDragStart={(event) => {
        event.stopPropagation();
        setHoverPreviewOpen(false);
        if (previewTimer.current) window.clearTimeout(previewTimer.current);
        const { width, height, left, top } = event.currentTarget.getBoundingClientRect();
        const entry = event.currentTarget.closest<HTMLElement>('.favorite-entry');
        const entryBounds = entry?.getBoundingClientRect();
        removeDragImage();
        // A live overlay can animate; the native drag image is a static snapshot.
        const dragImage = document.createElement('div');
        const collection = event.currentTarget.closest('.bookmark-collection');
        const cards = Array.from(
          (
            collection ?? event.currentTarget.parentElement!
          ).querySelectorAll<HTMLElement>('[data-favorite-id]'),
        );
        dragItemIds.slice(0, 3).forEach((id, index) => {
          const source = cards.find((card) => card.dataset.favoriteId === id);
          if (!source) return;
          const clone = source.cloneNode(true) as HTMLElement;
          clone.removeAttribute('data-favorite-id');
          clone.removeAttribute('id');
          clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
          Object.assign(clone.style, {
            position: 'absolute',
            left: `${index * 9}px`,
            top: `${index * 9}px`,
            width: `${width}px`,
            height: `${height}px`,
            margin: '0',
            opacity: '1',
            transform: `rotate(${index * 3}deg)`,
            translate: 'none',
            scale: 'none',
            zIndex: `${3 - index}`,
            boxShadow: '0 4px 14px #0004',
          });
          dragImage.appendChild(clone);
        });
        if (dragItemIds.length > 1) {
          const badge = document.createElement('span');
          badge.textContent = String(dragItemIds.length);
          Object.assign(badge.style, {
            position: 'absolute',
            left: '4px',
            top: '4px',
            zIndex: '4',
            minWidth: '32px',
            height: '32px',
            padding: '0 8px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '999px',
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '700',
            border: '2px solid white',
          });
          dragImage.appendChild(badge);
        }
        // Cloned controls are visual only and must never receive keyboard focus.
        dragImage.inert = true;
        dragImage.setAttribute('aria-hidden', 'true');
        dragImage.removeAttribute('id');
        dragImage.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
        Object.assign(dragImage.style, {
          position: 'fixed',
          left: `${event.clientX}px`,
          top: `${event.clientY}px`,
          width: `${width + (dragItemIds.length > 1 ? 36 : 0)}px`,
          height: `${height + (dragItemIds.length > 1 ? 36 : 0)}px`,
          margin: '0',
          opacity: '1',
          transform: 'none',
          translate: '16px 16px',
          scale: 'none',
          transition: 'none',
          pointerEvents: 'none',
          zIndex: '9999',
        });
        (collection ?? event.currentTarget.parentElement)?.appendChild(dragImage);
        dragImageRef.current = dragImage;
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          dragImage.animate(
            [
              { translate: `${left - event.clientX}px ${top - event.clientY}px` },
              { translate: '16px 16px' },
            ],
            { duration: 240, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
          );
        }
        const followCursor = (dragEvent: DragEvent) => {
          dragImage.style.left = `${dragEvent.clientX}px`;
          dragImage.style.top = `${dragEvent.clientY}px`;
          dragImage.style.visibility = 'visible';
        };
        const hideOutside = (dragEvent: DragEvent) => {
          if (!dragEvent.relatedTarget) dragImage.style.visibility = 'hidden';
        };
        const cancelPreview = (keyEvent: KeyboardEvent) => {
          if (keyEvent.key === 'Escape') removeDragImage();
        };
        document.addEventListener('dragover', followCursor, true);
        document.addEventListener('dragleave', hideOutside, true);
        document.addEventListener('drop', removeDragImage, true);
        document.addEventListener('dragend', removeDragImage, true);
        window.addEventListener('keydown', cancelPreview, true);
        dragImageCleanup.current = () => {
          document.removeEventListener('dragover', followCursor, true);
          document.removeEventListener('dragleave', hideOutside, true);
          document.removeEventListener('drop', removeDragImage, true);
          document.removeEventListener('dragend', removeDragImage, true);
          window.removeEventListener('keydown', cancelPreview, true);
        };
        setDragSize({ width, height });
        if (groupLabel && entryBounds) {
          setDragEntrySize({ width: entryBounds.width, height: entryBounds.height });
        }
        setLibraryDragData(event.dataTransfer, { type: 'item', id: item.id });
        const emptyImage = document.createElement('canvas');
        emptyImage.width = emptyImage.height = 1;
        // Keep the transparent replacement rendered and alive until dragend.
        // A detached canvas can fall back to the browser's source-card image.
        Object.assign(emptyImage.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          width: '1px',
          height: '1px',
          pointerEvents: 'none',
        });
        emptyImage.setAttribute('aria-hidden', 'true');
        document.body.appendChild(emptyImage);
        nativeDragImageRef.current = emptyImage;
        event.dataTransfer.setDragImage(emptyImage, 0, 0);
        onDragStart(item.id, entryBounds?.height ?? height);
      }}
      onDragEnd={() => {
        removeDragImage();
        clearLibraryDragData();
        setDragSize(undefined);
        setDragEntrySize(undefined);
        onDragEnd();
      }}
      data-layout={layout}
      data-size={size}
      data-dragging={isDragging || undefined}
      className={`bookmark-card group relative flex min-w-0 self-start overflow-hidden rounded-lg border bg-background transition-shadow duration-200 hover:shadow-md ${groupLabel ? 'w-full' : ''} ${selected ? 'border-primary ring-1 ring-primary/40' : 'border-border'}`}
      style={{
        ...(!groupLabel && sortOrder !== undefined ? { order: sortOrder } : {}),
        ...(isDragging && !groupLabel
          ? {
              position: 'absolute',
              left: '-10000px',
              top: 0,
              opacity: 0,
              visibility: 'hidden',
              pointerEvents: 'none',
              width: dragSize?.width,
              height: dragSize?.height,
            }
          : {}),
      }}
    >
      {size !== 'compact' || isCompactGrid ? (
        <div className="bookmark-preview relative min-w-0 shrink-0 overflow-hidden">
          <button
            ref={previewTriggerRef}
            data-favorite-open
            aria-label={`Open ${item.title}`}
            aria-expanded={hoverPreviewOpen}
            aria-haspopup="dialog"
            className={`absolute inset-0 h-full w-full focus-visible:z-10 focus-visible:outline-offset-[-2px] ${isCompactGrid ? 'flex items-center justify-center' : 'text-left'}`}
            onClick={() => void openItem()}
            type="button"
          >
            {isCompactGrid ? (
              <span className="flex h-9 w-9 items-center justify-center">
                <FaviconImage
                  url={item.url}
                  faviconUrl={item.faviconUrl}
                  fallback={
                    isLocalFile ? (
                      <DocumentIcon aria-hidden="true" className="h-7 w-7" />
                    ) : (
                      <GlobeAltIcon aria-hidden="true" className="h-7 w-7" />
                    )
                  }
                  className="h-7 w-7"
                />
              </span>
            ) : (
              <>
                {preview}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-black/65 px-3 py-2 text-left text-xs font-medium text-white opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
                  <span className="block truncate">{item.title}</span>
                </span>
              </>
            )}
          </button>
        </div>
      ) : null}
      <label className="bookmark-select absolute left-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-background/90 shadow-sm backdrop-blur-sm">
        <input
          aria-label={`Select ${item.title}`}
          checked={selected}
          className="h-4 w-4 accent-[var(--color-primary)]"
          onChange={() => onToggleSelected(item)}
          type="checkbox"
        />
      </label>
      <Menu>
        {({ close }) => (
          <>
            <CloseMenuOnDrag dragging={isDragging} close={close} />
            <MenuButton
              aria-label={`Actions for ${item.title}`}
              className="bookmark-actions absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-text-primary opacity-0 shadow-md transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-surface-hover hover:text-primary data-[open]:bg-surface-hover data-[open]:opacity-100"
              title="Favorite actions"
              type="button"
            >
              <EllipsisHorizontalIcon
                aria-hidden="true"
                className="h-5 w-5"
                strokeWidth={2}
              />
            </MenuButton>
            <MenuItems
              data-favorite-menu={item.id}
              anchor="bottom end"
              className="z-40 min-w-44 rounded-md border border-border bg-background p-1 shadow-lg focus:outline-none"
            >
              <MenuAction
                icon={<PencilSquareIcon className="h-4 w-4" />}
                label="Edit"
                onClick={editItem}
              />
              <MenuAction
                icon={<ArrowsRightLeftIcon className="h-4 w-4" />}
                label="Move to…"
                onClick={() => onMove(item)}
              />
              <MenuAction
                icon={<ChevronUpIcon className="h-4 w-4" />}
                label="Move up"
                onClick={() => onMoveUp(item)}
                disabled={!canMoveUp}
              />
              <MenuAction
                icon={<ChevronDownIcon className="h-4 w-4" />}
                label="Move down"
                onClick={() => onMoveDown(item)}
                disabled={!canMoveDown}
              />
              <MenuAction
                icon={<TrashIcon className="h-4 w-4" />}
                label="Delete"
                onClick={() => onDelete(item)}
                danger
              />
            </MenuItems>
          </>
        )}
      </Menu>
      <div
        className={`bookmark-details flex min-w-0 items-center justify-between gap-3 ${isMissingFile ? 'opacity-60' : ''}`}
      >
        <button
          ref={size === 'compact' && !isCompactGrid ? previewTriggerRef : undefined}
          data-favorite-open={size === 'compact' && !isCompactGrid ? '' : undefined}
          aria-label={`Open ${item.title}`}
          title={
            size === 'compact' ? `${item.title} — ${getUrlLabel(item.url)}` : undefined
          }
          className={`min-w-0 ${isCompactGrid ? 'w-full text-center' : 'text-left'}`}
          onClick={() => void openItem()}
          type="button"
        >
          <span
            className={`${isCompactGrid ? 'block truncate text-center text-xs' : 'flex items-center gap-2 text-sm'} min-w-0 font-medium text-text-primary transition-colors group-hover:text-primary`}
          >
            {!isCompactGrid && (
              <FaviconImage
                url={item.url}
                faviconUrl={item.faviconUrl}
                fallback={
                  isLocalFile ? (
                    <DocumentIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  ) : (
                    <GlobeAltIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  )
                }
              />
            )}
            <span className="truncate">{item.title}</span>
          </span>
          {!isCompactGrid && (
            <span className="bookmark-domain mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-text-tertiary">
              {isLocalFile && fileAvailability !== 'available' && (
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${fileAvailability === 'missing' ? 'bg-danger' : 'bg-text-tertiary'}`}
                />
              )}
              <span className="truncate">
                {isLocalFile
                  ? fileAvailability === 'available'
                    ? 'Local file'
                    : `Local file: ${fileAvailability[0].toUpperCase()}${fileAvailability.slice(1)}`
                  : getUrlLabel(item.url)}
              </span>
            </span>
          )}
        </button>
      </div>
      {isMissingFile && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-text-secondary opacity-10"
        />
      )}
      <HoverPreview
        anchorRef={previewTriggerRef}
        fullThumbnailUrl={fullThumbnailUrl}
        item={item}
        onClose={() => {
          setHoverPreviewOpen(false);
        }}
        onEdit={editItem}
        onOpen={() => {
          setHoverPreviewOpen(false);
          void openItem();
        }}
        onPanelEnter={cancelPreviewHide}
        onPanelLeave={hidePreview}
        open={showPreview && hoverPreviewOpen}
        positionRef={cardRef}
        thumbnailUrl={thumbnailUrl}
      />
    </article>
  );

  if (!groupLabel) return card;

  return (
    <div
      className="favorite-entry flex min-w-0 flex-col gap-1"
      style={{
        ...(sortOrder === undefined ? {} : { order: sortOrder }),
        ...(isDragging
          ? {
              position: 'absolute' as const,
              left: '-10000px',
              top: 0,
              visibility: 'hidden' as const,
              width: dragEntrySize?.width,
              height: dragEntrySize?.height,
            }
          : {}),
      }}
    >
      <span
        className="block max-w-full truncate rounded bg-surface-hover/90 px-2 py-1 text-xs font-medium text-text-secondary"
        title={groupLabel}
      >
        {groupLabel}
      </span>
      {card}
    </div>
  );
}
