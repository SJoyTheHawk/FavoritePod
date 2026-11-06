import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowPathIcon,
  BookmarkIcon,
  CheckCircleIcon,
  DocumentIcon,
  GlobeAltIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { AnimatedDialog, useDialogTransition } from '../components/AnimatedDialog';
import { captureFavicon } from '../core/favicon';
import { capturePopupThumbnail } from '../core/popup-thumbnail';
import { applyPathOverride, getPathOverrides } from '../core/file-links';
import type { PopupSaveRequest } from '../core/popup-save-request';
import { getGroupLabels } from '../dashboard/group-labels';
import {
  createItem,
  deleteItem,
  getLastUsedGroupId,
  getThumbnail,
  setLastUsedGroupId,
  updateItem,
  updateItemThumbnail,
} from '../core/storage';
import { getDefaultTitle, getUrlLabel, parseSafeUrl } from '../core/validation';
import type { Group, Item, ThumbnailInput } from '../core/types';
import { FaviconImage } from '../components/FaviconImage';

type DialogStatus = 'loading' | 'ready' | 'unavailable' | 'error';

interface BookmarkDialogProps {
  groups: Group[];
  items: Item[];
  libraryLoading: boolean;
  tab: chrome.tabs.Tab;
  saveRequest?: PopupSaveRequest;
  onClose: () => void;
}

export function BookmarkDialog({
  groups,
  items,
  libraryLoading,
  tab,
  saveRequest,
  onClose: onClosed,
}: BookmarkDialogProps) {
  const dialogTransition = useDialogTransition(onClosed);
  const onClose = dialogTransition.close;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const [status, setStatus] = useState<DialogStatus>('loading');
  const [favorite, setFavorite] = useState<Item>();
  const [isExisting, setIsExisting] = useState(false);
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState('');
  // undefined preserves the saved image; null explicitly removes it.
  const [thumbnail, setThumbnail] = useState<ThumbnailInput | null>();
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [previewError, setPreviewError] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const captureController = useRef<AbortController>();
  const saving = useRef(false);
  const [retryCount, setRetryCount] = useState(0);

  const currentUrl = tab.url ?? '';
  const parsedCurrentUrl = parseSafeUrl(currentUrl);
  const pageTitle = tab.title?.trim() || getDefaultTitle(currentUrl) || 'Untitled page';
  const groupLabels = getGroupLabels(groups);
  const captureRequest = useMemo<PopupSaveRequest>(
    () =>
      saveRequest ?? {
        url: currentUrl,
        title: pageTitle,
        sourceTabId: tab.id ?? -1,
        sourceWindowId: tab.windowId,
        capturePage: tab.id !== undefined,
      },
    [currentUrl, pageTitle, saveRequest, tab.id, tab.windowId],
  );

  const refreshThumbnail = useCallback(
    async (initialFavorite?: Item) => {
      if (captureController.current || saving.current) return;
      const controller = new AbortController();
      captureController.current = controller;
      setRefreshing(true);
      setPreviewError(undefined);
      try {
        const next = await capturePopupThumbnail(captureRequest, controller.signal);
        if (initialFavorite) {
          // The first preview belongs to the bookmark saved by Add bookmark.
          const updated = await updateItemThumbnail(
            initialFavorite.id,
            next,
            initialFavorite,
            controller.signal,
          );
          if (!controller.signal.aborted) setFavorite(updated);
        } else if (!controller.signal.aborted) {
          setThumbnail(next);
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setPreviewError(
            cause instanceof Error
              ? cause.message
              : 'Could not capture this page. You can save without a thumbnail.',
          );
      } finally {
        if (captureController.current === controller)
          captureController.current = undefined;
        if (!controller.signal.aborted) setRefreshing(false);
      }
    },
    [captureRequest],
  );

  const removeThumbnail = () => {
    captureController.current?.abort();
    captureController.current = undefined;
    setRefreshing(false);
    setThumbnail(null);
    setPreviewError(undefined);
  };

  const close = () => {
    if (saving.current) return;
    captureController.current?.abort();
    onClose();
  };

  useEffect(() => {
    if (libraryLoading) return;
    if (!parseSafeUrl(currentUrl)) {
      setStatus('unavailable');
      return;
    }
    let active = true;
    const prepareFavorite = async () => {
      setError(undefined);
      setStatus('loading');
      setThumbnail(undefined);
      try {
        const overrides = currentUrl.startsWith('file:') ? await getPathOverrides() : [];
        if (!active) return;
        let item =
          itemsRef.current.find((candidate) => candidate.url === currentUrl) ??
          itemsRef.current.find(
            (candidate) => applyPathOverride(candidate.url, overrides) === currentUrl,
          );
        const lastGroupId = await getLastUsedGroupId();
        if (!active) return;
        const defaultGroup =
          groupsRef.current.find((group) => group.id === lastGroupId) ??
          groupsRef.current[0];
        const existing = Boolean(item);
        // Match Chrome's bookmark behavior: Add saves by default. Save below
        // confirms edits; closing this dialog must not undo the addition.
        if (!item && !saveRequest) {
          item = await createItem({
            url: currentUrl,
            title: pageTitle,
            groupId: defaultGroup?.id,
            faviconUrl: tab.favIconUrl,
          });
        }
        if (!active) return;
        setIsExisting(existing);
        setFavorite(item);
        setName(item?.title ?? pageTitle);
        setGroupId(item?.groupId ?? defaultGroup?.id ?? '');
        setStatus('ready');
        if (!existing && captureRequest.capturePage) {
          await refreshThumbnail(saveRequest ? undefined : item);
        }
      } catch (cause) {
        if (!active) return;
        setError(
          cause instanceof Error ? cause.message : 'Could not prepare this bookmark.',
        );
        setStatus('error');
      }
    };
    void prepareFavorite();
    return () => {
      active = false;
      captureController.current?.abort();
      captureController.current = undefined;
    };
  }, [
    currentUrl,
    libraryLoading,
    pageTitle,
    retryCount,
    captureRequest,
    refreshThumbnail,
    saveRequest,
    tab.favIconUrl,
  ]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setThumbnailUrl(undefined);
    const show = (blob: Blob) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setThumbnailUrl(objectUrl);
    };
    if (thumbnail) show(thumbnail.blob);
    else if (thumbnail === undefined && favorite?.previewHash) {
      void getThumbnail(favorite.previewHash)
        .then((stored) => {
          if (stored) show(stored.blob);
        })
        .catch(() => {
          if (active) setPreviewError('Could not load the saved thumbnail. Try Refresh.');
        });
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [favorite?.previewHash, thumbnail]);

  const confirmChanges = async () => {
    if (status !== 'ready' || saving.current || captureController.current) return;
    saving.current = true;
    setBusy(true);
    setError(undefined);
    try {
      // Do not overwrite a bookmark that appeared while this new draft was open.
      if (!favorite && itemsRef.current.some((item) => item.url === currentUrl))
        throw new Error(
          'This page was just saved elsewhere. Reopen Add bookmark to review it.',
        );
      let saved: Item;
      if (favorite) {
        saved = await updateItem(
          favorite.id,
          { title: name, ...(groupId ? { groupId } : {}) },
          { thumbnail, expected: favorite },
        );
      } else {
        const faviconUrl = await captureFavicon(currentUrl, tab.favIconUrl);
        saved = await createItem({
          url: currentUrl,
          title: name,
          groupId: groupId || undefined,
          faviconUrl: faviconUrl ?? tab.favIconUrl,
          thumbnail: thumbnail ?? undefined,
        });
      }
      await setLastUsedGroupId(saved.groupId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this bookmark.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  const removeFavorite = async () => {
    if (saving.current) return;
    captureController.current?.abort();
    captureController.current = undefined;
    setRefreshing(false);
    // Right-click save requests may still be unsaved drafts.
    if (!favorite) {
      onClose();
      return;
    }
    saving.current = true;
    setBusy(true);
    setDeleting(true);
    setError(undefined);
    try {
      await deleteItem(favorite.id);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete this bookmark.',
      );
    } finally {
      saving.current = false;
      setBusy(false);
      setDeleting(false);
    }
  };

  const retry = () => {
    setError(undefined);
    setRetryCount((count) => count + 1);
  };

  return (
    <AnimatedDialog
      className="relative z-50"
      onClose={close}
      open={dialogTransition.open}
      afterLeave={dialogTransition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center p-3">
        <DialogPanel
          transition
          className="dialog-panel flex max-h-[calc(100vh-24px)] w-full min-w-0 max-w-72 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
        >
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
            <DialogTitle className="text-sm font-semibold text-text-primary">
              {saveRequest ? 'Save to FavoritePod' : 'Add bookmark'}
            </DialogTitle>
            <button
              aria-label="Close dialog"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              disabled={busy}
              onClick={close}
              title="Close dialog"
              type="button"
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>

          {status === 'ready' ? (
            <>
              <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
                <div className="flex h-6 shrink-0 items-center gap-1.5 text-xs font-medium text-success">
                  {favorite ? (
                    <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <BookmarkIcon aria-hidden="true" className="h-4 w-4" />
                  )}
                  {isExisting
                    ? 'Already in Favorites'
                    : favorite
                      ? 'Added to Favorites'
                      : 'Review before saving'}
                </div>

                <div className="shrink-0 overflow-hidden rounded-md border border-border">
                  {thumbnailUrl ? (
                    <img
                      alt="Thumbnail to save"
                      className="aspect-[8/5] w-full bg-surface object-contain"
                      src={thumbnailUrl}
                    />
                  ) : (
                    <div className="flex aspect-[8/5] items-center justify-center bg-surface text-text-tertiary">
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
                        faviconUrl={favorite?.faviconUrl ?? tab.favIconUrl}
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

                <div className="flex shrink-0 justify-center gap-2">
                  <button
                    aria-label="Refresh thumbnail"
                    aria-busy={refreshing}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
                    disabled={busy || refreshing || !captureRequest.capturePage}
                    onClick={() => void refreshThumbnail()}
                    type="button"
                  >
                    <ArrowPathIcon
                      aria-hidden="true"
                      className={refreshing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'}
                    />
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                  </button>
                  <button
                    aria-label="Remove thumbnail"
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-text-secondary transition hover:bg-surface-hover disabled:opacity-50"
                    disabled={
                      busy ||
                      (!refreshing &&
                        !thumbnail &&
                        (thumbnail === null || !favorite?.previewHash))
                    }
                    onClick={removeThumbnail}
                    type="button"
                  >
                    <TrashIcon aria-hidden="true" className="h-4 w-4" />
                    Remove
                  </button>
                </div>
                {previewError && (
                  <p className="text-xs text-text-secondary" role="alert">
                    {previewError}
                  </p>
                )}

                <label className="grid min-w-0 shrink-0 gap-1 text-xs font-medium text-text-secondary">
                  Name
                  <input
                    disabled={busy}
                    className="h-9 w-full min-w-0 rounded-md border border-border bg-background px-2.5 text-sm font-normal text-text-primary outline-none transition focus:border-primary"
                    onChange={(event) => setName(event.target.value)}
                    value={name}
                  />
                </label>

                <label className="grid min-w-0 shrink-0 gap-1 text-xs font-medium text-text-secondary">
                  Folder
                  <select
                    className="h-9 w-full min-w-0 max-w-full truncate rounded-md border border-border bg-background px-2.5 text-sm font-normal text-text-primary outline-none transition focus:border-primary disabled:opacity-60"
                    disabled={busy || groups.length === 0}
                    onChange={(event) => setGroupId(event.target.value)}
                    value={groupId}
                  >
                    {groups.length === 0 && <option value="">Favorites</option>}
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {groupLabels.get(group.id) ?? group.title}
                      </option>
                    ))}
                  </select>
                </label>

                {error && (
                  <p className="min-w-0 break-words text-xs text-danger" role="alert">
                    {error}
                  </p>
                )}
              </section>

              <footer className="flex h-[60px] shrink-0 items-center justify-between border-t border-border px-4">
                <button
                  aria-label={saveRequest ? 'Cancel' : 'Delete bookmark'}
                  className={
                    saveRequest
                      ? 'inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-text-secondary transition hover:bg-surface-hover disabled:opacity-60'
                      : 'inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-danger transition hover:bg-danger-light disabled:opacity-60'
                  }
                  disabled={busy}
                  onClick={() => (saveRequest ? close() : void removeFavorite())}
                  type="button"
                >
                  {!saveRequest && <TrashIcon aria-hidden="true" className="h-4 w-4" />}
                  {saveRequest ? 'Cancel' : deleting ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  className="min-h-9 min-w-20 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                  disabled={busy || refreshing}
                  onClick={() => void confirmChanges()}
                  type="button"
                >
                  {busy && !deleting ? 'Saving…' : 'Save'}
                </button>
              </footer>
            </>
          ) : (
            <section className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
              {status === 'loading' ? (
                <>
                  <BookmarkIcon aria-hidden="true" className="h-6 w-6 text-primary" />
                  <p className="text-sm font-medium">Loading current page…</p>
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
    </AnimatedDialog>
  );
}
