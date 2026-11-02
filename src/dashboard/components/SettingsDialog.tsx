import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { ListBulletIcon, Squares2X2Icon, XMarkIcon } from '@heroicons/react/24/outline';
import type { LibraryView } from '../../core/storage';

interface SettingsDialogProps {
  defaultView: LibraryView;
  onClose: () => void;
  onSaveDefaultView: (view: LibraryView) => Promise<void>;
}

export function SettingsDialog({
  defaultView,
  onClose,
  onSaveDefaultView,
}: SettingsDialogProps) {
  const [error, setError] = useState<string>();

  const saveDefaultView = async (view: LibraryView) => {
    setError(undefined);
    try {
      await onSaveDefaultView(view);
    } catch {
      setError('Could not save this preference.');
    }
  };

  return (
    <Dialog className="relative z-50" onClose={onClose} open>
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-text-primary">
              Settings
            </DialogTitle>
            <button
              aria-label="Close settings"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              onClick={onClose}
              title="Close settings"
              type="button"
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-text-primary">
              Default launcher view
            </legend>
            <div
              aria-label="Default launcher view"
              className="mt-2 grid grid-cols-2 rounded-md border border-border p-1"
              role="group"
            >
              <button
                aria-pressed={defaultView === 'grid'}
                className={`flex h-9 items-center justify-center gap-2 rounded text-sm transition ${defaultView === 'grid' ? 'bg-surface-hover font-medium text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                onClick={() => void saveDefaultView('grid')}
                type="button"
              >
                <Squares2X2Icon aria-hidden="true" className="h-4 w-4" />
                Grid
              </button>
              <button
                aria-pressed={defaultView === 'list'}
                className={`flex h-9 items-center justify-center gap-2 rounded text-sm transition ${defaultView === 'list' ? 'bg-surface-hover font-medium text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
                onClick={() => void saveDefaultView('list')}
                type="button"
              >
                <ListBulletIcon aria-hidden="true" className="h-4 w-4" />
                List
              </button>
            </div>
          </fieldset>
          {error && (
            <p className="mt-3 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
