import { AnimatedDialog, useDialogTransition } from '../../components/AnimatedDialog';
import { useState } from 'react';
import { Description, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
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
    label: 'Combine bookmarks from both places',
    description:
      'Keep bookmarks from this computer and Google Drive. If a bookmark has changed in both places, use the most recent edits.',
  },
  {
    value: 'replace-local',
    label: 'Use bookmarks from Google Drive',
    description:
      'Replace all FavoritePod bookmarks and groups on this computer with those saved in Google Drive.',
  },
  {
    value: 'replace-drive',
    label: 'Use bookmarks from this computer',
    description:
      'Replace all FavoritePod bookmarks and groups in Google Drive with those saved on this computer.',
  },
];

export function DriveSyncChoiceDialog({
  preview,
  error,
  busy = false,
  onCancel: onClosed,
  onContinue,
}: DriveSyncChoiceDialogProps) {
  const dialogTransition = useDialogTransition(onClosed);
  const onCancel = dialogTransition.close;
  const [choice, setChoice] = useState<DriveSyncChoice>('merge');
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const requiresConfirmation = choice !== 'merge';
  const replacementTarget =
    choice === 'replace-local' ? 'on this computer' : 'in Google Drive';
  const replacementSource =
    choice === 'replace-local' ? 'in Google Drive' : 'on this computer';
  const dismissReplacement = () => {
    if (!busy) setConfirmReplacement(false);
  };

  return (
    <AnimatedDialog
      className="relative z-[60]"
      onClose={busy ? () => undefined : onCancel}
      open={dialogTransition.open}
      afterLeave={dialogTransition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          transition
          className="dialog-panel max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl"
        >
          <DialogTitle className="text-lg font-semibold text-text-primary">
            Sync with Google Drive
          </DialogTitle>
          <p className="mt-1 text-sm text-text-secondary">
            You have FavoritePod bookmarks on this computer and in Google Drive. Choose
            which bookmarks to keep.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-surface p-3 text-sm">
            <div>
              <p className="font-medium text-text-primary">This computer</p>
              <p className="mt-1 text-text-secondary">
                {preview.local.items}{' '}
                {preview.local.items === 1 ? 'bookmark' : 'bookmarks'} in{' '}
                {preview.local.groups} {preview.local.groups === 1 ? 'group' : 'groups'}
              </p>
            </div>
            <div>
              <p className="font-medium text-text-primary">Google Drive</p>
              <p className="mt-1 text-text-secondary">
                {preview.drive.items}{' '}
                {preview.drive.items === 1 ? 'bookmark' : 'bookmarks'} in{' '}
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

          {error && !confirmReplacement && (
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
              onClick={() => {
                if (busy) return;
                if (requiresConfirmation) setConfirmReplacement(true);
                else void onContinue(choice);
              }}
              type="button"
            >
              {busy ? 'Syncing…' : 'Continue'}
            </button>
          </div>
        </DialogPanel>
      </div>
      <AnimatedDialog
        className="relative z-[70]"
        onClose={dismissReplacement}
        open={confirmReplacement}
      >
        <DialogBackdrop
          transition
          className="dialog-backdrop fixed inset-0 bg-black/35"
        />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <DialogPanel
            transition
            aria-busy={busy}
            className="dialog-panel max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl"
          >
            <DialogTitle className="text-lg font-semibold text-text-primary">
              Replace bookmarks {replacementTarget}?
            </DialogTitle>
            <Description className="mt-2 text-sm text-text-secondary">
              Bookmarks and groups {replacementTarget} will be replaced with those{' '}
              {replacementSource}. Any that are not {replacementSource} will be lost. This
              cannot be undone.
            </Description>
            {error && (
              <p className="mt-3 text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="min-h-9 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-60"
                data-autofocus
                disabled={busy}
                onClick={dismissReplacement}
                type="button"
              >
                Cancel
              </button>
              <button
                className="min-h-9 rounded-md bg-danger px-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                disabled={busy}
                onClick={() => {
                  if (!busy && requiresConfirmation) void onContinue(choice);
                }}
                type="button"
              >
                {busy ? 'Syncing…' : 'Replace bookmarks'}
              </button>
            </div>
          </DialogPanel>
        </div>
      </AnimatedDialog>
    </AnimatedDialog>
  );
}
