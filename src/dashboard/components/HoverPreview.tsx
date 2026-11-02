import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  PhotoIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { Item } from '../../core/types';
import { getUrlLabel, parseSafeUrl } from '../../core/validation';
import { FavoriteFallback } from './FavoriteFallback';

interface HoverPreviewProps {
  anchorRef: RefObject<HTMLElement | null>;
  item: Item;
  open: boolean;
  thumbnailUrl?: string;
  fullThumbnailUrl?: string;
  onEdit: () => void;
  onOpen: () => void;
  onPanelEnter: () => void;
  onPanelLeave: () => void;
  onClose: () => void;
}

export function HoverPreview({
  anchorRef,
  item,
  open,
  thumbnailUrl,
  fullThumbnailUrl,
  onEdit,
  onOpen,
  onPanelEnter,
  onPanelLeave,
  onClose,
}: HoverPreviewProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 12, left: 12 });
  const [livePreview, setLivePreview] = useState(false);
  const [liveState, setLiveState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [copied, setCopied] = useState(false);
  const canLivePreview = ['http:', 'https:'].includes(
    parseSafeUrl(item.url)?.protocol ?? '',
  );

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const height = 390;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const below = rect.bottom + 8;
    const top =
      below + height <= window.innerHeight - 8
        ? below
        : Math.max(8, rect.top - height - 8);
    setPosition({ top, left });
  }, [anchorRef, open]);

  useEffect(() => {
    if (!open) {
      setLivePreview(false);
      setLiveState('loading');
      setCopied(false);
      return;
    }
    const reposition = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 16);
      const height = 390;
      setPosition({
        left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        top:
          rect.bottom + 8 + height <= window.innerHeight - 8
            ? rect.bottom + 8
            : Math.max(8, rect.top - height - 8),
      });
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [anchorRef, open]);

  useEffect(() => {
    if (!livePreview) return;
    setLiveState('loading');
    const timeout = window.setTimeout(() => setLiveState('failed'), 2000);
    return () => window.clearTimeout(timeout);
  }, [item.url, livePreview]);

  if (!open) return null;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The URL remains available as selectable text when clipboard access is denied.
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      id={`favorite-preview-${item.id}`}
      aria-label={`Preview of ${item.title}`}
      className="fixed z-50 max-h-[calc(100vh-16px)] w-[min(320px,calc(100vw-16px))] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-background shadow-xl"
      onMouseEnter={onPanelEnter}
      onMouseLeave={onPanelLeave}
      role="dialog"
      style={{ left: position.left, top: position.top }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (
          next instanceof Node &&
          (event.currentTarget.contains(next) || anchorRef.current?.contains(next))
        ) {
          return;
        }
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          onClose();
          anchorRef.current?.focus();
        }
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface">
        {livePreview && liveState !== 'failed' ? (
          <>
            <iframe
              className={`absolute inset-0 h-full w-full border-0 bg-white ${liveState === 'ready' ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setLiveState('ready')}
              sandbox="allow-scripts"
              src={item.url}
              title={`Live preview of ${item.title}`}
            />
            {liveState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface text-xs text-text-secondary">
                <PhotoIcon
                  aria-hidden="true"
                  className="h-6 w-6 animate-pulse text-primary"
                />
                Loading live preview…
              </div>
            )}
          </>
        ) : fullThumbnailUrl || thumbnailUrl ? (
          <img
            alt={`Preview of ${item.title}`}
            className="h-full w-full object-cover"
            src={fullThumbnailUrl ?? thumbnailUrl}
          />
        ) : (
          <FavoriteFallback item={item} />
        )}
        <button
          aria-label="Close preview"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white transition hover:bg-black/75"
          onClick={onClose}
          type="button"
        >
          <XMarkIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-1.5 p-3">
        <p className="truncate text-sm font-semibold text-text-primary">{item.title}</p>
        <p className="truncate text-xs text-text-secondary" title={item.url}>
          {getUrlLabel(item.url)}
        </p>
        <p className="max-h-9 overflow-hidden break-all text-[11px] leading-4 text-text-tertiary">
          {item.url}
        </p>
        {livePreview && liveState === 'failed' && (
          <p className="text-xs text-text-tertiary">
            Live preview unavailable. Showing saved preview.
          </p>
        )}
        <div className="mt-1 flex flex-wrap gap-1.5">
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-medium text-white transition hover:bg-primary-hover"
            onClick={onOpen}
            type="button"
          >
            <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-3.5 w-3.5" />
            Open
          </button>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-text-primary transition hover:bg-surface-hover"
            onClick={onEdit}
            type="button"
          >
            <PencilSquareIcon aria-hidden="true" className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            aria-label="Copy URL"
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-text-primary transition hover:bg-surface-hover"
            onClick={() => void copyUrl()}
            type="button"
          >
            <ClipboardDocumentIcon aria-hidden="true" className="h-3.5 w-3.5" />
            {copied ? 'Copied' : 'Copy URL'}
          </button>
          {canLivePreview && (
            <button
              className="h-8 rounded-md px-2.5 text-xs font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              onClick={() => {
                setLivePreview((active) => !active);
                setLiveState('loading');
              }}
              type="button"
            >
              {livePreview ? 'Saved preview' : 'Preview page'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
