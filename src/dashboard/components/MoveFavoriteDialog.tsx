import { AnimatedDialog, useDialogTransition } from '../../components/AnimatedDialog';
import { useMemo, useState, type FormEvent } from 'react';
import { DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { Group, Item } from '../../core/types';
import { getGroupLabels } from '../group-labels';

interface MoveFavoriteDialogProps {
  groups: Group[];
  item: Item;
  onClose: () => void;
  onMove: (groupId: string) => Promise<void>;
}

export function MoveFavoriteDialog({
  groups,
  item,
  onClose: onClosed,
  onMove,
}: MoveFavoriteDialogProps) {
  const dialogTransition = useDialogTransition(onClosed);
  const onClose = dialogTransition.close;
  const [groupId, setGroupId] = useState(item.groupId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const labels = useMemo(() => getGroupLabels(groups), [groups]);
  const canMove =
    groupId !== item.groupId && groups.some((group) => group.id === groupId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !canMove) return;
    setBusy(true);
    setError(undefined);
    try {
      await onMove(groupId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not move this favorite.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatedDialog
      className="relative z-50"
      onClose={() => {
        if (!busy) onClose();
      }}
      open={dialogTransition.open}
      afterLeave={dialogTransition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          transition
          className="dialog-panel w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-xl sm:p-6"
        >
          <DialogTitle className="text-lg font-semibold text-text-primary">
            Move favorite
          </DialogTitle>
          <p className="mt-2 truncate text-sm text-text-secondary" title={item.title}>
            {item.title}
          </p>
          <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
            <label className="grid gap-1.5 text-sm font-medium text-text-primary">
              Move to group
              <select
                autoFocus
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition focus:border-primary"
                disabled={busy}
                onChange={(event) => setGroupId(event.target.value)}
                value={groupId}
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {labels.get(group.id) ?? group.title}
                    {group.id === item.groupId ? ' (current)' : ''}
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
                className="min-h-10 rounded-md border border-border px-4 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-60"
                disabled={busy}
                onClick={onClose}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                disabled={busy || !canMove}
                type="submit"
              >
                {busy ? 'Moving…' : 'Move'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </AnimatedDialog>
  );
}
