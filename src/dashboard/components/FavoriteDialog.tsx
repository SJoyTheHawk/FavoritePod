import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  DocumentIcon,
  GlobeAltIcon,
  PhotoIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Group, Item, ThumbnailInput } from '../../core/types';
import { getThumbnail } from '../../core/storage';
import { compressThumbnail } from '../../core/thumbnail';
import { getUrlLabel, isValidUrl, parseSafeUrl } from '../../core/validation';
import { FaviconImage } from '../../components/FaviconImage';
import { getGroupLabels } from '../group-labels';

interface FavoriteDialogProps {
  groups: Group[];
  item?: Item;
  initialGroupId?: string;
  onClose: () => void;
  onSave: (value: { title: string; url: string; groupId?: string }) => Promise<Item>;
  onDelete?: (item: Item) => Promise<boolean>;
  onUpdateThumbnail?: (item: Item, thumbnail: ThumbnailInput) => Promise<Item>;
}

export function FavoriteDialog({
  groups,
  item,
  initialGroupId,
  onClose,
  onSave,
  onDelete,
  onUpdateThumbnail,
}: FavoriteDialogProps) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [groupId, setGroupId] = useState(
    item?.groupId ?? initialGroupId ?? groups[0]?.id ?? '',
  );
  const [thumbnailUrl, setThumbnailUrl] = useState<string>();
  const [previewHash, setPreviewHash] = useState(item?.previewHash);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);
  const labels = useMemo(() => getGroupLabels(groups), [groups]);
  const isLocalFile = parseSafeUrl(url)?.protocol === 'file:';

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setThumbnailUrl(undefined);
    if (!previewHash) return () => undefined;

    void getThumbnail(previewHash)
      .then((thumbnail) => {
        if (!active || !thumbnail) return;
        objectUrl = URL.createObjectURL(thumbnail.blob);
        setThumbnailUrl(objectUrl);
      })
      .catch(() => {
        if (active) setThumbnailUrl(undefined);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewHash]);

  const updateThumbnail = async (file?: File) => {
    if (!item || !file || !onUpdateThumbnail) return;
    setBusy(true);
    setError(undefined);
    try {
      const thumbnail = await compressThumbnail(file);
      const updated = await onUpdateThumbnail(item, thumbnail);
      setPreviewHash(updated.previewHash);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update this preview.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    if (!isValidUrl(url)) {
      setError('Use an http, https, or file address.');
      setBusy(false);
      return;
    }
    try {
      await onSave({
        title,
        url: url.trim(),
        ...(!item ? { groupId: groupId || undefined } : {}),
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this favorite.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!item || !onDelete) return;
    setBusy(true);
    setError(undefined);
    try {
      const deleted = await onDelete(item);
      if (deleted) onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete this favorite.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog className="relative z-50" onClose={onClose} open>
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl sm:p-6">
          <DialogTitle className="text-lg font-semibold text-text-primary">
            {item ? 'Edit favorite' : 'Add favorite'}
          </DialogTitle>
          <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
            {item && (
              <div className="grid gap-2">
                <div className="aspect-[16/7] overflow-hidden rounded-md border border-border bg-surface">
                  {thumbnailUrl ? (
                    <img
                      alt={`Preview of ${item.title}`}
                      className="h-full w-full object-cover"
                      src={thumbnailUrl}
                    />
                  ) : (
                    <div className="flex h-full items-center gap-3 px-4 text-sm text-text-secondary">
                      <FaviconImage
                        className="h-8 w-8"
                        faviconUrl={item.faviconUrl}
                        fallback={
                          isLocalFile ? (
                            <DocumentIcon aria-hidden="true" className="h-7 w-7" />
                          ) : (
                            <GlobeAltIcon aria-hidden="true" className="h-7 w-7" />
                          )
                        }
                        url={item.url}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-text-primary">
                          {item.title}
                        </p>
                        <p className="truncate text-xs">{getUrlLabel(item.url)}</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  accept="image/*"
                  aria-label="Choose a thumbnail image"
                  className="sr-only"
                  onChange={(event) => void updateThumbnail(event.target.files?.[0])}
                  ref={fileInput}
                  type="file"
                />
                <button
                  className="inline-flex h-9 w-fit items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
                  disabled={busy || !onUpdateThumbnail}
                  onClick={() => fileInput.current?.click()}
                  type="button"
                >
                  <PhotoIcon aria-hidden="true" className="h-4 w-4" />
                  Update thumbnail
                </button>
              </div>
            )}
            <label className="grid gap-1.5 text-sm font-medium text-text-primary">
              Title
              <input
                autoFocus={!item}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition focus:border-primary"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Favorite title"
                value={title}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-text-primary">
              Web or file address
              <input
                autoComplete="url"
                className="h-10 rounded-md border border-border bg-background px-3 font-mono text-xs font-normal outline-none transition focus:border-primary"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com or file:///…"
                required
                type="text"
                value={url}
              />
            </label>
            {!item && (
              <label className="grid gap-1.5 text-sm font-medium text-text-primary">
                Group
                <select
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition focus:border-primary"
                  onChange={(event) => setGroupId(event.target.value)}
                  value={groupId}
                >
                  {groups.length === 0 && <option value="">Favorites</option>}
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {labels.get(group.id) ?? group.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              {item && onDelete ? (
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-danger transition hover:bg-danger-light disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void remove()}
                  type="button"
                >
                  <TrashIcon aria-hidden="true" className="h-4 w-4" />
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  className="min-h-10 rounded-md border border-border px-4 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? 'Saving…' : item ? 'Save changes' : 'Add favorite'}
                </button>
              </div>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
