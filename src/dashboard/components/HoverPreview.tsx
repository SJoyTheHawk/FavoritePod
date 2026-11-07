import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { Item } from '../../core/types';
import { getUrlLabel } from '../../core/validation';
import { FavoriteFallback } from './FavoriteFallback';
import { ThumbnailImage } from '../../components/ThumbnailImage';
import { observeElementResize } from '../resize-observer';

interface HoverPreviewProps {
  anchorRef: RefObject<HTMLElement | null>;
  positionRef?: RefObject<HTMLElement | null>;
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
  positionRef,
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
  const [copied, setCopied] = useState(false);
  const placePreview = useCallback(() => {
    const anchor = positionRef?.current ?? anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const gap = 8;
    const viewportPadding = 8;
    const canFitBelow =
      anchorRect.bottom + gap + panelRect.height <= window.innerHeight - viewportPadding;
    const canFitAbove = anchorRect.top - gap - panelRect.height >= viewportPadding;
    const top = canFitBelow
      ? anchorRect.bottom + gap
      : canFitAbove
        ? anchorRect.top - gap - panelRect.height
        : Math.max(
            viewportPadding,
            Math.min(
              anchorRect.bottom + gap,
              window.innerHeight - panelRect.height - viewportPadding,
            ),
          );
    const left = Math.max(
      viewportPadding,
      Math.min(anchorRect.left, window.innerWidth - panelRect.width - viewportPadding),
    );
    setPosition((current) =>
      current.top === top && current.left === left ? current : { top, left },
    );
  }, [anchorRef, positionRef]);

  useLayoutEffect(() => {
    if (!open) return;
    placePreview();
  }, [open, placePreview]);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    const reposition = () => {
      placePreview();
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, placePreview]);

  useEffect(() => {
    if (!open || !panelRef.current || typeof ResizeObserver === 'undefined') return;
    return observeElementResize([panelRef.current], placePreview);
  }, [open, placePreview]);

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
      className="fixed z-30 max-h-[calc(100vh-16px)] w-[min(320px,calc(100vw-16px))] overflow-y-auto overflow-x-hidden rounded-lg border border-border bg-background shadow-xl"
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
          event.preventDefault();
          event.stopPropagation();
          onClose();
          anchorRef.current?.focus();
        }
      }}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface">
        {/* Saved images also work for sites that prohibit embedding. */}
        <ThumbnailImage
          alt={`Preview of ${item.title}`}
          src={fullThumbnailUrl ?? thumbnailUrl}
          fallback={<FavoriteFallback item={item} />}
        />
        <button
          aria-label="Close preview"
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white transition hover:bg-black/75"
          onClick={() => {
            onClose();
            anchorRef.current?.focus();
          }}
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
