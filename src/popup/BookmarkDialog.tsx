import { useEffect, useRef, useState } from 'react';
import {
  BookmarkIcon,
  CheckCircleIcon,
  DocumentIcon,
  GlobeAltIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { captureFavicon } from '../core/favicon';
import { captureThumbnail } from '../core/thumbnail';
import {
  createItem,
  deleteItem,
  getLastUsedGroupId,
  getThumbnail,
  setLastUsedGroupId,
  updateItem,
} from '../core/storage';
import { getDefaultTitle, getUrlLabel, parseSafeUrl } from '../core/validation';
import type { Group, Item, ThumbnailInput } from '../core/types';
import { FaviconImage } from '../components/FaviconImage';

type DialogStatus = 'loading' | 'saving' | 'ready' | 'unavailable' | 'error';

interface BookmarkDialogProps {
  groups: Group[];
  items: Item[];
  libraryLoading: boolean;
  tab: chrome.tabs.Tab;
  onClose: () => void;
}

export function BookmarkDialog({
  groups,
  items,
  libraryLoading,
  tab,
  onClose,
}: BookmarkDialogProps) {
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const attemptedUrl = useRef<string>();
  const [status, setStatus] = useState<DialogStatus>('loading');
  const [favorite, setFavorite] = useState<Item>();
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isExisting, setIsExisting] = useState(false);

  const currentUrl = tab.url ?? '';
  const parsedCurrentUrl = parseSafeUrl(currentUrl);
  const pageTitle = tab.title?.trim() || getDefaultTitle(currentUrl) || 'Untitled page';

  useEffect(() => {
    if (libraryLoading) return;
    if (!parseSafeUrl(currentUrl)) {
      setStatus('unavailable');
      return;
    }
    if (attemptedUrl.current === currentUrl) return;
    attemptedUrl.current = currentUrl;

    let active = true;
    const prepareFavorite = async () => {
      setError(undefined);
      setPreviewUnavailable(false);
      try {
        let item = itemsRef.current.find((candidate) => candidate.url === currentUrl);
        const faviconUrl = await captureFavicon(currentUrl, tab.favIconUrl);
        if (item) {
          if (faviconUrl) item = await updateItem(item.id, { faviconUrl });
          setIsExisting(true);
        } else {
          setIsExisting(false);
          setStatus('saving');
          let thumbnail: ThumbnailInput | undefined;
          try {
            thumbnail = await captureThumbnail(tab.windowId);
          } catch {
            if (active) setPreviewUnavailable(true);
          }
          const lastGroupId = await getLastUsedGroupId();
          item = await createItem({
            url: currentUrl,
            title: pageTitle,
            groupId: lastGroupId,
            faviconUrl: faviconUrl ?? tab.favIconUrl,
            thumbnail,
          });
        }
        if (!active) return;
        setFavorite(item);
        setName(item.title);
        setGroupId(item.groupId);
        setStatus('ready');
      } catch (cause) {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Could not add this page.');
        setStatus('error');
      }
    };

    void prepareFavorite();
    return () => {
      active = false;
    };
  }, [currentUrl, libraryLoading, pageTitle, retryCount, tab]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setThumbnailUrl(undefined);
    setPreviewUnavailable(!favorite?.previewHash);

    if (favorite?.previewHash) {
      void getThumbnail(favorite.previewHash)
        .then((thumbnail) => {
          if (!active) return;
          if (!thumbnail) {
            setPreviewUnavailable(true);
            return;
          }
          objectUrl = URL.createObjectURL(thumbnail.blob);
          setPreviewUnavailable(false);
          setThumbnailUrl(objectUrl);
        })
        .catch(() => {
          if (active) setPreviewUnavailable(true);
        });
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [favorite?.previewHash]);

  const confirmChanges = async () => {
    if (!favorite) return;
    setBusy(true);
    setError(undefined);
    try {
      await updateItem(favorite.id, { title: name, groupId });
      await setLastUsedGroupId(groupId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this page.');
    } finally {
      setBusy(false);
    }
  };

  const removeFavorite = async () => {
    if (!favorite) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteItem(favorite.id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove this page.');
      setBusy(false);
    }
  };

  const retry = () => {
    attemptedUrl.current = undefined;
    setError(undefined);
    setPreviewUnavailable(false);
    setRetryCount((count) => count + 1);
    setStatus('loading');
  };

  return (
    <Dialog className="relative z-50" onClose={onClose} open>
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center p-3">
        <DialogPanel className="flex max-h-[calc(100vh-24px)] w-full min-w-0 max-w-72 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <DialogTitle className="text-sm font-semibold text-text-primary">
              Add bookmark
            </DialogTitle>
            <button
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              onClick={onClose}
              title="Close dialog"
              type="button"
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>

          {status === 'ready' && favorite ? (
            <>
              <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
                <div className="flex h-6 shrink-0 items-center gap-1.5 text-xs font-medium text-success">
                  <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
                  {isExisting ? 'Already in Favorites' : 'Added to Favorites'}
                </div>

                <div className="shrink-0 overflow-hidden rounded-md border border-border">
                  {thumbnailUrl ? (
                    <img
                      alt=""
                      className="h-[80px] w-full bg-surface object-cover object-top"
                      src={thumbnailUrl}
                    />
                  ) : (
                    <div className="flex h-[80px] items-center justify-center bg-surface text-text-tertiary">
                      {parsedCurrentUrl?.protocol === 'file:' ? (
                        <DocumentIcon aria-hidden="true" className="h-6 w-6" />
                      ) : (
                        <GlobeAltIcon aria-hidden="true" className="h-6 w-6" />
                      )}
                    </div>
                  )}
                  <div className="flex h-11 min-w-0 items-center gap-2.5 border-t border-border px-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-surface text-text-secondary">
                      <FaviconImage
                        fallback={
                          parsedCurrentUrl?.protocol === 'file:' ? (
                            <DocumentIcon aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : (
                            <GlobeAltIcon aria-hidden="true" className="h-3.5 w-3.5" />
                          )
                        }
                        faviconUrl={favorite.faviconUrl ?? tab.favIconUrl}
                        url={currentUrl}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {getUrlLabel(currentUrl)}
                      </span>
                      <span
                        className="block truncate text-[11px] text-text-tertiary"
                        title={currentUrl}
                      >
                        {currentUrl}
                      </span>
                    </span>
                  </div>
                </div>

                <label className="grid min-w-0 shrink-0 gap-1 text-xs font-medium text-text-secondary">
                  Name
                  <input
                    autoFocus
                    className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-sm font-normal text-text-primary outline-none transition focus:border-primary"
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </label>

                <label className="grid min-w-0 shrink-0 gap-1 text-xs font-medium text-text-secondary">
                  Folder
                  <select
                    className="h-9 w-full min-w-0 max-w-full truncate rounded-md border border-border bg-background px-2.5 text-sm font-normal text-text-primary outline-none transition focus:border-primary disabled:opacity-60"
                    disabled={groups.length === 0}
                    onChange={(event) => setGroupId(event.target.value)}
                    value={groupId}
                  >
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.title}
                      </option>
                    ))}
                  </select>
                </label>

                {previewUnavailable && (
                  <p className="text-xs text-text-tertiary">Page preview unavailable.</p>
                )}
                {error && (
                  <p className="min-w-0 break-words text-xs text-danger" role="alert">
                    {error}
                  </p>
                )}
              </section>

              <footer className="flex h-[60px] shrink-0 items-center justify-between border-t border-border px-4">
                <button
                  className="inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-danger transition hover:bg-danger-light disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void removeFavorite()}
                  type="button"
                >
                  <TrashIcon aria-hidden="true" className="h-4 w-4" />
                  Remove
                </button>
                <button
                  className="min-h-9 min-w-20 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                  disabled={busy}
                  onClick={() => void confirmChanges()}
                  type="button"
                >
                  {busy ? 'Saving…' : 'Done'}
                </button>
              </footer>
            </>
          ) : (
            <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              {status === 'loading' || status === 'saving' ? (
                <>
                  <BookmarkIcon aria-hidden="true" className="h-6 w-6 text-primary" />
                  <p className="text-sm font-medium">
                    {status === 'saving'
                      ? 'Adding to Favorites…'
                      : 'Loading current page…'}
                  </p>
                </>
              ) : status === 'unavailable' ? (
                <>
                  <GlobeAltIcon
                    aria-hidden="true"
                    className="h-6 w-6 text-text-tertiary"
                  />
                  <p className="text-sm font-medium">This page can’t be saved.</p>
                  <p className="text-xs text-text-secondary">
                    Open a website or local file to add it to Favorites.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">Could not add this page.</p>
                  <p className="max-w-full break-words text-xs text-danger" role="alert">
                    {error}
                  </p>
                  <button
                    className="min-h-9 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                    onClick={retry}
                    type="button"
                  >
                    Try again
                  </button>
                </>
              )}
            </section>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
