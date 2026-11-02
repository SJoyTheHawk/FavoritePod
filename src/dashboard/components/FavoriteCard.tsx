import { useEffect, useState, type ReactNode } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  Bars3Icon,
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
import { hasLibraryDragData, readLibraryDragData, setLibraryDragData } from '../drag';

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
  onDropItem: (itemId: string, beforeItemId: string) => void;
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
  onDropItem,
}: FavoriteCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [dropActive, setDropActive] = useState(false);
  const isLocalFile = parseSafeUrl(item.url)?.protocol === 'file:';

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
      className={`group relative overflow-hidden rounded-lg border bg-background transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-primary ring-1 ring-primary/40' : dropActive ? 'border-primary ring-2 ring-primary/40' : 'border-border'} ${layout === 'list' ? 'flex items-stretch' : ''}`}
      onDragEnter={(event) => {
        if (!hasLibraryDragData(event.dataTransfer)) return;
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropActive(false);
      }}
      onDragOver={(event) => {
        if (!hasLibraryDragData(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDropActive(false);
        const payload = readLibraryDragData(event.dataTransfer);
        if (payload?.type === 'item' && payload.id !== item.id) {
          onDropItem(payload.id, item.id);
        }
      }}
    >
      <div
        className={`relative shrink-0 overflow-hidden ${layout === 'grid' ? 'aspect-[16/10] w-full' : 'aspect-[16/10] w-32 sm:w-40'}`}
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
        <button
          aria-label={`Drag ${item.title}`}
          className="absolute right-10 top-2 flex h-8 w-8 cursor-grab items-center justify-center rounded-md bg-background/90 text-text-secondary opacity-100 shadow-sm backdrop-blur-sm transition hover:text-text-primary active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            setLibraryDragData(event.dataTransfer, { type: 'item', id: item.id });
            const previewElement = event.currentTarget.closest('article');
            if (previewElement) event.dataTransfer.setDragImage(previewElement, 24, 24);
          }}
          title="Drag to reorder or move into a group"
          type="button"
        >
          <Bars3Icon aria-hidden="true" className="h-4 w-4" />
        </button>
        <Menu>
          <MenuButton
            aria-label={`Actions for ${item.title}`}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-md bg-background/90 text-text-secondary shadow-sm backdrop-blur-sm transition hover:text-text-primary sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 data-[open]:opacity-100"
            title="Favorite actions"
            type="button"
          >
            <EllipsisHorizontalIcon aria-hidden="true" className="h-4 w-4" />
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
        className={`flex min-w-0 flex-1 items-center justify-between gap-3 p-3 ${layout === 'grid' ? 'min-h-[68px]' : ''}`}
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
