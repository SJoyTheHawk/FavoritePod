import { useState, type FormEvent } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';

interface GroupDialogProps {
  onClose: () => void;
  onSave: (title: string) => Promise<void>;
}

export function GroupDialog({ onClose, onSave }: GroupDialogProps) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await onSave(title);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this group.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog className="relative z-50" onClose={onClose} open>
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-text-primary">
            New group
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
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
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
                {busy ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
