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
import { getThumbnail } from '../../core/storage';
import { getUrlLabel, parseSafeUrl } from '../../core/validation';
import type { Item } from '../../core/types';
import {
  clearLibraryDragData,
  getActiveLibraryDragPayload,
  getItemDropPlacement,
  hasLibraryDragData,
  setLibraryDragData,
  type ItemDropPlacement,
} from '../drag';

const tones = [
  'bg-primary-light text-primary',
  'bg-success-light text-success',
  'bg-warning-light text-warning',
  'bg-danger-light text-danger',
  'bg-surface-hover text-text-secondary',
  'bg-[#d9f0ee] text-[#14746f]',
];

interface FavoriteCardProps {
  item: Item;
  layout: 'grid' | 'list';
  sortOrder?: number;
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
  onPreviewDrop: (
    itemId: string,
    targetItemId: string,
    placement: ItemDropPlacement,
  ) => void;
  onDragStart: (itemId: string, height: number) => void;
  onDragEnd: () => void;
}

function toneFor(value: string): string {
  const hash = [...value].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return tones[hash % tones.length];
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

export function FavoriteCard({
  item,
  layout,
  sortOrder,
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
  onPreviewDrop,
  onDragStart,
  onDragEnd,
}: FavoriteCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [dragSize, setDragSize] = useState<{ width: number; height: number }>();
  const cardRef = useRef<HTMLElement>(null);
  const dragImageRef = useRef<HTMLElement | null>(null);
  const nativeDragImageRef = useRef<HTMLCanvasElement | null>(null);
  const dragImageCleanup = useRef<(() => void) | null>(null);
  const previousPosition = useRef<{ left: number; top: number }>();
  const wasDragging = useRef(false);
  const isLocalFile = parseSafeUrl(item.url)?.protocol === 'file:';

  const removeDragImage = () => {
    dragImageCleanup.current?.();
    dragImageCleanup.current = null;
    dragImageRef.current?.remove();
    dragImageRef.current = null;
    nativeDragImageRef.current?.remove();
    nativeDragImageRef.current = null;
  };

  useEffect(() => removeDragImage, []);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    card.inert = isDragging;

    const position = { left: card.offsetLeft, top: card.offsetTop };
    const previous = previousPosition.current;
    previousPosition.current = position;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        card.animate(
          [
            { opacity: 0.65, scale: '0.97', translate },
            { opacity: 1, scale: '1', translate: '0px 0px' },
          ],
          { duration: 300, easing: 'cubic-bezier(0.2, 0, 0, 1)' },
        );
      }
      return;
    }
    if (!previous || reducedMotion) {
      return;
    }

    const x = previous.left - position.left;
    const y = previous.top - position.top;
    if (x === 0 && y === 0) return;

    card.animate([{ translate: `${x}px ${y}px` }, { translate: '0px 0px' }], {
      duration: 220,
      easing: 'cubic-bezier(0.2, 0, 0, 1)',
    });
  });

  useEffect(() => {
    let currentUrl: string | undefined;
    let active = true;
    setThumbnailUrl(undefined);
    if (!item.previewHash) return () => undefined;

    void getThumbnail(item.previewHash)
      .then((thumbnail) => {
        if (!active || !thumbnail) return;
        currentUrl = URL.createObjectURL(thumbnail.blob);
        setThumbnailUrl(currentUrl);
      })
      .catch(() => {
        if (active) setThumbnailUrl(undefined);
      });

    return () => {
      active = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [item.previewHash]);

  const openItem = async () => {
    if (!parseSafeUrl(item.url)) {
      onOpenError('This favorite has an invalid address and cannot be opened.');
      return;
    }
    try {
      await chrome.tabs.create({ url: item.url });
    } catch {
      onOpenError(
        'Chrome could not open this address. Check file URL access in extension settings.',
      );
    }
  };

  const preview = thumbnailUrl ? (
    <img
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      draggable={false}
      src={thumbnailUrl}
    />
  ) : (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-2 ${toneFor(item.url)}`}
    >
      <FaviconImage
        className="h-9 w-9"
        faviconUrl={item.faviconUrl}
        fallback={
          isLocalFile ? (
            <DocumentIcon aria-hidden="true" className="h-8 w-8" />
          ) : (
            <GlobeAltIcon aria-hidden="true" className="h-8 w-8" />
          )
        }
        url={item.url}
      />
      <span className="max-w-[85%] truncate text-xs opacity-80">
        {getUrlLabel(item.url)}
      </span>
    </div>
  );

  return (
    <article
      ref={cardRef}
      data-favorite-id={item.id}
      draggable
      onDragStart={(event) => {
        event.stopPropagation();
        const { width, height, left, top } = event.currentTarget.getBoundingClientRect();
        removeDragImage();
        // A live overlay can animate; the native drag image is a static snapshot.
        const dragImage = document.createElement('div');
        const cards = Array.from(
          event.currentTarget.parentElement!.querySelectorAll<HTMLElement>(
            '[data-favorite-id]',
          ),
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
        event.currentTarget.parentElement?.appendChild(dragImage);
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
        onDragStart(item.id, height);
      }}
      onDragEnd={() => {
        removeDragImage();
        clearLibraryDragData();
        setDragSize(undefined);
        onDragEnd();
      }}
      className={`group relative flex min-w-0 self-start overflow-hidden rounded-lg border bg-background transition-shadow duration-200 hover:shadow-md ${selected ? 'border-primary ring-1 ring-primary/40' : 'border-border'} ${layout === 'list' ? 'h-[102px] items-stretch' : 'flex-col'}`}
      aria-hidden={isDragging || undefined}
      style={{
        ...(sortOrder === undefined ? {} : { order: sortOrder }),
        ...(isDragging
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
      onDragOver={(event) => {
        if (!hasLibraryDragData(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const payload = getActiveLibraryDragPayload();
        if (payload?.type === 'item' && payload.id !== item.id) {
          onPreviewDrop(
            payload.id,
            item.id,
            getItemDropPlacement(
              event.clientX,
              event.clientY,
              event.currentTarget.getBoundingClientRect(),
              layout,
            ),
          );
        }
      }}
    >
      <div
        className={`relative min-w-0 shrink-0 overflow-hidden ${layout === 'grid' ? 'aspect-[16/10] w-full' : 'h-full w-32 sm:w-40'}`}
      >
        <button
          aria-label={`Open ${item.title}`}
          className="absolute inset-0 h-full w-full text-left focus-visible:z-10 focus-visible:outline-offset-[-2px]"
          onClick={() => void openItem()}
          type="button"
        >
          {preview}
          <span className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full bg-black/65 px-3 py-2 text-left text-xs font-medium text-white opacity-0 transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            <span className="block truncate">{item.title}</span>
          </span>
        </button>
        <label className="absolute left-2 top-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-md bg-background/90 shadow-sm backdrop-blur-sm">
          <input
            aria-label={`Select ${item.title}`}
            checked={selected}
            className="h-4 w-4 accent-[var(--color-primary)]"
            onChange={() => onToggleSelected(item)}
            type="checkbox"
          />
        </label>
        <Menu>
          <MenuButton
            aria-label={`Actions for ${item.title}`}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-text-primary opacity-0 shadow-md transition group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-surface-hover hover:text-primary data-[open]:bg-surface-hover data-[open]:opacity-100"
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
            anchor="bottom end"
            className="z-40 min-w-44 rounded-md border border-border bg-background p-1 shadow-lg focus:outline-none"
          >
            <MenuAction
              icon={<PencilSquareIcon className="h-4 w-4" />}
              label="Edit"
              onClick={() => onEdit(item)}
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
        </Menu>
      </div>
      <div
        className={`flex min-w-0 items-center justify-between gap-3 p-3 ${layout === 'grid' ? 'h-[68px] shrink-0' : 'flex-1'}`}
      >
        <button
          className="min-w-0 text-left"
          onClick={() => void openItem()}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-text-primary transition-colors group-hover:text-primary">
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
            <span className="truncate">{item.title}</span>
          </span>
          <span className="mt-1 block truncate text-xs text-text-tertiary">
            {getUrlLabel(item.url)}
          </span>
        </button>
      </div>
    </article>
  );
}
