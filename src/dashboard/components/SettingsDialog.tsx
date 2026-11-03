import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  FolderPlusIcon,
  ListBulletIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { normalizePathOverrides, type PathOverride } from '../../core/file-links';
import type { LibraryView, OpenBehavior } from '../../core/storage';

interface SettingsDialogProps {
  defaultView: LibraryView;
  showPreview: boolean;
  openBehavior: OpenBehavior;
  homePageAvailable: boolean;
  pathOverrides: PathOverride[];
  onClose: () => void;
  onSaveDefaultView: (view: LibraryView) => Promise<void>;
  onSaveShowPreview: (showPreview: boolean) => Promise<void>;
  onSaveOpenBehavior: (behavior: OpenBehavior) => Promise<void>;
  onSavePathOverrides: (overrides: PathOverride[]) => Promise<void>;
}

export function SettingsDialog({
  defaultView,
  showPreview,
  openBehavior,
  homePageAvailable,
  pathOverrides,
  onClose,
  onSaveDefaultView,
  onSaveShowPreview,
  onSaveOpenBehavior,
  onSavePathOverrides,
}: SettingsDialogProps) {
  const [error, setError] = useState<string>();
  const [editedOverrides, setEditedOverrides] = useState(pathOverrides);

  const saveDefaultView = async (view: LibraryView) => {
    setError(undefined);
    try {
      await onSaveDefaultView(view);
    } catch {
      setError('Could not save this preference.');
    }
  };

  const saveShowPreview = async (value: boolean) => {
    setError(undefined);
    try {
      await onSaveShowPreview(value);
    } catch {
      setError('Could not save this preference.');
    }
  };

  const saveOpenBehavior = async (value: OpenBehavior) => {
    setError(undefined);
    try {
      await onSaveOpenBehavior(value);
    } catch {
      setError('Could not save this preference.');
    }
  };

  const saveOverrides = async () => {
    setError(undefined);
    try {
      const normalized = normalizePathOverrides(editedOverrides);
      await onSavePathOverrides(normalized);
      setEditedOverrides(normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save path overrides.');
    }
  };

  return (
    <Dialog className="relative z-50" onClose={onClose} open>
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl">
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

          <div className="mt-5 flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-text-primary">Show Preview</span>
            <button
              aria-checked={showPreview}
              aria-label="Show Preview"
              className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition ${showPreview ? 'bg-primary' : 'bg-border'}`}
              onClick={() => void saveShowPreview(!showPreview)}
              role="switch"
              type="button"
            >
              <span
                aria-hidden="true"
                className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${showPreview ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-text-primary">On open</legend>
            <div className="mt-2 grid gap-1">
              {(
                [
                  { value: 'last', label: 'Open last tab' },
                  { value: 'all', label: 'Open All favorites' },
                  { value: 'home', label: 'Open home page tab' },
                ] as const
              ).map(({ value, label }) => (
                <label
                  className={`flex min-h-9 items-center gap-2 rounded px-2 text-sm ${value === 'home' && !homePageAvailable ? 'cursor-not-allowed text-text-tertiary' : 'cursor-pointer text-text-primary hover:bg-surface-hover'}`}
                  key={value}
                >
                  <input
                    checked={openBehavior === value}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    disabled={value === 'home' && !homePageAvailable}
                    name="openBehavior"
                    onChange={() => void saveOpenBehavior(value)}
                    type="radio"
                    value={value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

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

          <section className="mt-6 border-t border-border pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  Local file path overrides
                </h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Map saved folders to their locations on this device.
                </p>
              </div>
              <span className="shrink-0 text-xs text-text-tertiary">This device</span>
            </div>
            <div className="mt-3 space-y-2">
              {editedOverrides.map((override, index) => (
                <div
                  className="grid gap-2 rounded-md bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2rem]"
                  key={`${index}-${override.from}`}
                >
                  <label className="min-w-0 text-xs font-medium text-text-secondary">
                    Saved folder
                    <input
                      autoCapitalize="off"
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs font-normal text-text-primary outline-none focus:border-primary"
                      onChange={(event) =>
                        setEditedOverrides((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, from: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder="file:///original/folder/"
                      spellCheck={false}
                      type="text"
                      value={override.from}
                    />
                  </label>
                  <label className="min-w-0 text-xs font-medium text-text-secondary">
                    This device
                    <input
                      autoCapitalize="off"
                      className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-xs font-normal text-text-primary outline-none focus:border-primary"
                      onChange={(event) =>
                        setEditedOverrides((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, to: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder="file:///local/folder/"
                      spellCheck={false}
                      type="text"
                      value={override.to}
                    />
                  </label>
                  <button
                    aria-label={`Remove path override ${index + 1}`}
                    className="mt-4 flex h-8 w-8 items-center justify-center self-end rounded-md text-text-secondary hover:bg-surface-hover hover:text-danger sm:mt-0"
                    onClick={() =>
                      setEditedOverrides((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                    title="Remove path override"
                    type="button"
                  >
                    <TrashIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
                onClick={() =>
                  setEditedOverrides((current) => [...current, { from: '', to: '' }])
                }
                type="button"
              >
                <FolderPlusIcon aria-hidden="true" className="h-4 w-4" />
                Add override
              </button>
              <button
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover"
                onClick={() => void saveOverrides()}
                type="button"
              >
                Save path overrides
              </button>
            </div>
          </section>
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
