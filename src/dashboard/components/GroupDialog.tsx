import { AnimatedDialog, useDialogTransition } from '../../components/AnimatedDialog';
import { useMemo, useState, type FormEvent } from 'react';
import { DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { TrashIcon } from '@heroicons/react/24/outline';
import type { Group } from '../../core/types';
import { getGroupLabels, getGroupsInTreeOrder } from '../group-labels';

interface GroupDialogProps {
  groups: Group[];
  group?: Group;
  initialParentId?: string | null;
  onClose: () => void;
  onSave: (value: { title: string; parentId: string | null }) => Promise<void>;
  onDelete?: (group: Group) => Promise<boolean>;
}

export function GroupDialog({
  groups,
  group,
  initialParentId,
  onClose: onClosed,
  onSave,
  onDelete,
}: GroupDialogProps) {
  const dialogTransition = useDialogTransition(onClosed);
  const onClose = dialogTransition.close;
  const [title, setTitle] = useState(group?.title ?? '');
  const [parentId, setParentId] = useState(group?.parentId ?? initialParentId ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const labels = useMemo(() => getGroupLabels(groups), [groups]);

  const availableParents = useMemo(() => {
    if (!group) return getGroupsInTreeOrder(groups);
    const descendants = new Set<string>([group.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of groups) {
        if (
          candidate.parentId &&
          descendants.has(candidate.parentId) &&
          !descendants.has(candidate.id)
        ) {
          descendants.add(candidate.id);
          changed = true;
        }
      }
    }
    return getGroupsInTreeOrder(
      groups.filter((candidate) => !descendants.has(candidate.id)),
    );
  }, [group, groups]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onSave({ title, parentId: parentId || null });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this group.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!group || !onDelete) return;
    setBusy(true);
    setError(undefined);
    try {
      const deleted = await onDelete(group);
      if (deleted) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this group.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatedDialog
      className="relative z-50"
      onClose={onClose}
      open={dialogTransition.open}
      afterLeave={dialogTransition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          transition
          className="dialog-panel w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-xl sm:p-6"
        >
          <DialogTitle className="text-lg font-semibold text-text-primary">
            {group ? 'Edit group' : 'New group'}
          </DialogTitle>
          <form className="mt-5 grid gap-4" onSubmit={(event) => void submit(event)}>
            <label className="grid gap-1.5 text-sm font-medium text-text-primary">
              Group name
              <input
                autoFocus
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition focus:border-primary"
                onChange={(event) => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-text-primary">
              Parent group
              <select
                className="h-10 rounded-md border border-border bg-background px-3 text-sm font-normal outline-none transition focus:border-primary"
                onChange={(event) => setParentId(event.target.value)}
                value={parentId}
              >
                <option value="">No parent group</option>
                {availableParents.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {labels.get(candidate.id) ?? candidate.title}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              {group && onDelete ? (
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
                  className="min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:opacity-60"
                  disabled={busy}
                  type="submit"
                >
                  {busy ? 'Saving…' : group ? 'Save changes' : 'Create group'}
                </button>
              </div>
            </div>
          </form>
        </DialogPanel>
      </div>
    </AnimatedDialog>
  );
}
