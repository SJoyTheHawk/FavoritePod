import { useEffect, useState } from 'react';
import {
  DocumentIcon,
  GlobeAltIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { getThumbnail } from '../../core/storage';
import { getUrlLabel, parseSafeUrl } from '../../core/validation';
import type { Item } from '../../core/types';

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
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onOpenError: (message: string) => void;
}

function toneFor(value: string): string {
  const hash = [...value].reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return tones[hash % tones.length];
}

export function FavoriteCard({
  item,
  layout,
  onEdit,
  onDelete,
  onOpenError,
}: FavoriteCardProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
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
    <img alt="" className="h-full w-full object-cover" src={thumbnailUrl} />
  ) : (
    <div
      className={`flex h-full w-full items-center justify-center ${toneFor(item.url)}`}
    >
      {isLocalFile ? (
        <DocumentIcon aria-hidden="true" className="h-8 w-8" />
      ) : (
        <GlobeAltIcon aria-hidden="true" className="h-8 w-8" />
      )}
    </div>
  );

  return (
    <article
      className={`group overflow-hidden rounded-lg border border-border bg-background transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        layout === 'list' ? 'flex items-stretch' : ''
      }`}
    >
      <button
        aria-label={`Open ${item.title}`}
        className={`relative block shrink-0 overflow-hidden text-left focus-visible:z-10 focus-visible:outline-offset-[-2px] ${
          layout === 'grid' ? 'aspect-[16/10] w-full' : 'aspect-[16/10] w-32 sm:w-40'
        }`}
        onClick={() => void openItem()}
        type="button"
      >
        {preview}
      </button>
      <div
        className={`flex min-w-0 flex-1 items-center justify-between gap-3 p-3 ${layout === 'grid' ? 'min-h-[68px]' : ''}`}
      >
        <button
          className="min-w-0 text-left"
          onClick={() => void openItem()}
          type="button"
        >
          <span className="block truncate text-sm font-medium text-text-primary transition-colors group-hover:text-primary">
            {item.title}
          </span>
          <span className="mt-1 block truncate text-xs text-text-tertiary">
            {getUrlLabel(item.url)}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button
            aria-label={`Edit ${item.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            onClick={() => onEdit(item)}
            title="Edit favorite"
            type="button"
          >
            <PencilSquareIcon aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label={`Delete ${item.title}`}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-danger-light hover:text-danger"
            onClick={() => onDelete(item)}
            title="Delete favorite"
            type="button"
          >
            <TrashIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
