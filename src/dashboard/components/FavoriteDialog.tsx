import { useState, type FormEvent } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { Group, Item } from '../../core/types';

interface FavoriteDialogProps {
  groups: Group[];
  item?: Item;
  initialGroupId?: string;
  onClose: () => void;
  onSave: (value: { title: string; url: string; groupId?: string }) => Promise<void>;
}

export function FavoriteDialog({
  groups,
  item,
  initialGroupId,
  onClose,
  onSave,
}: FavoriteDialogProps) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [groupId, setGroupId] = useState(
    item?.groupId ?? initialGroupId ?? groups[0]?.id ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onSave({ title, url, groupId: groupId || undefined });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this favorite.');
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
            <label className="grid gap-1.5 text-sm font-medium text-text-primary">
              Title
              <input
                autoFocus
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition focus:border-primary"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Favorite title"
                value={title}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-text-primary">
              Web or file address
              <input
                className="h-10 rounded-md border border-border bg-background px-3 font-mono text-xs font-normal outline-none transition focus:border-primary"
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com or file:///..."
                required
                type="url"
                value={url}
              />
            </label>
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
                    {group.title}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-1 flex justify-end gap-2">
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
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
