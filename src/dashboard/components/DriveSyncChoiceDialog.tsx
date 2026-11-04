import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { DriveSyncChoice, DriveSyncPreview } from '../../core/drive-sync';

interface DriveSyncChoiceDialogProps {
  preview: DriveSyncPreview;
  error?: string;
  busy?: boolean;
  onCancel: () => void;
  onContinue: (choice: DriveSyncChoice) => Promise<void>;
}

const choices: { value: DriveSyncChoice; label: string; description: string }[] = [
  {
    value: 'merge',
    label: 'Merge local and Drive data',
    description:
      'Keep favorites from both places and resolve edits by their field timestamps.',
  },
  {
    value: 'replace-local',
    label: 'Replace local with Drive',
    description:
      'Use the Drive library on this device. A snapshot of the current local library is saved first.',
  },
  {
    value: 'replace-drive',
    label: 'Replace Drive with local',
    description:
      'Use this device’s library on Drive. A snapshot of the current local library is saved first.',
  },
];

export function DriveSyncChoiceDialog({
  preview,
  error,
  busy = false,
  onCancel,
  onContinue,
}: DriveSyncChoiceDialogProps) {
  const [choice, setChoice] = useState<DriveSyncChoice>('merge');

  return (
    <Dialog className="relative z-[60]" onClose={busy ? () => undefined : onCancel} open>
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="w-full max-w-lg rounded-lg border border-border bg-background p-5 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-text-primary">
            Sync with Google Drive
          </DialogTitle>
          <p className="mt-1 text-sm text-text-secondary">
            Both libraries contain data. Choose how FavoritePod should combine them.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-surface p-3 text-sm">
            <div>
              <p className="font-medium text-text-primary">Local</p>
              <p className="mt-1 text-text-secondary">
                {preview.local.items}{' '}
                {preview.local.items === 1 ? 'favorite' : 'favorites'} in{' '}
                {preview.local.groups} {preview.local.groups === 1 ? 'group' : 'groups'}
              </p>
            </div>
            <div>
              <p className="font-medium text-text-primary">Drive</p>
              <p className="mt-1 text-text-secondary">
                {preview.drive.items}{' '}
                {preview.drive.items === 1 ? 'favorite' : 'favorites'} in{' '}
                {preview.drive.groups} {preview.drive.groups === 1 ? 'group' : 'groups'}
              </p>
            </div>
          </div>

          <fieldset className="mt-4 grid gap-2">
            <legend className="mb-2 text-sm font-medium text-text-primary">
              Choose how to sync
            </legend>
            {choices.map((option) => (
              <label
                className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${choice === option.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-hover'}`}
                key={option.value}
              >
                <input
                  checked={choice === option.value}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                  disabled={busy}
                  name="driveSyncChoice"
                  onChange={() => setChoice(option.value)}
                  type="radio"
                  value={option.value}
                />
                <span>
                  <span className="block text-sm font-medium text-text-primary">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-text-secondary">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          {error && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              className="min-h-9 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-60"
              disabled={busy}
              onClick={onCancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
              disabled={busy}
              onClick={() => void onContinue(choice)}
              type="button"
            >
              {busy ? 'Syncing…' : 'Continue'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
