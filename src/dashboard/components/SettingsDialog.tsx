import { useState } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChevronRightIcon,
  FolderPlusIcon,
  ListBulletIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { normalizePathOverrides, type PathOverride } from '../../core/file-links';
import type { GroupingMode, LibraryView, OpenBehavior } from '../../core/storage';
import type { ArchiveDialogMode } from './ImportExportDialog';

interface SettingsDialogProps {
  defaultView: LibraryView;
  groupingMode: GroupingMode;
  showPreview: boolean;
  openBehavior: OpenBehavior;
  homePageAvailable: boolean;
  pathOverrides: PathOverride[];
  onClose: () => void;
  onSaveDefaultView: (view: LibraryView) => Promise<void>;
  onSaveGroupingMode: (mode: GroupingMode) => Promise<void>;
  onSaveShowPreview: (showPreview: boolean) => Promise<void>;
  onSaveOpenBehavior: (behavior: OpenBehavior) => Promise<void>;
  onSavePathOverrides: (overrides: PathOverride[]) => Promise<void>;
  onArchiveAction: (mode: ArchiveDialogMode) => void;
}

export function SettingsDialog({
  defaultView,
  groupingMode,
  showPreview,
  openBehavior,
  homePageAvailable,
  pathOverrides,
  onClose,
  onSaveDefaultView,
  onSaveGroupingMode,
  onSaveShowPreview,
  onSaveOpenBehavior,
  onSavePathOverrides,
  onArchiveAction,
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

  const saveGroupingMode = async (mode: GroupingMode) => {
    setError(undefined);
    try {
      await onSaveGroupingMode(mode);
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
      setError(cause instanceof Error ? cause.message : 'Could not save file locations.');
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
              Favorites grouping
            </legend>
            <div className="mt-2 grid gap-1">
              {(
                [
                  { value: 'hierarchical', label: 'Grouped' },
                  { value: 'labeled', label: 'Flat with labels' },
                  { value: 'flat', label: 'Flat' },
                ] as const
              ).map(({ value, label }) => (
                <label
                  className="flex min-h-9 cursor-pointer items-center gap-2 rounded px-2 text-sm text-text-primary hover:bg-surface-hover"
                  key={value}
                >
                  <input
                    checked={groupingMode === value}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    name="groupingMode"
                    onChange={() => void saveGroupingMode(value)}
                    type="radio"
                    value={value}
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-text-tertiary">
              Applies to All favorites and groups with sub-groups.
            </p>
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
            <h3 className="text-sm font-medium text-text-primary">Import and export</h3>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                onClick={() => onArchiveAction('import')}
                type="button"
              >
                <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />
                Import library
              </button>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                onClick={() => onArchiveAction('export')}
                type="button"
              >
                <ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />
                Export library
              </button>
            </div>
          </section>

          <section className="mt-6 border-t border-border pt-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-text-primary">
                  File Locations Remap
                </h3>
                <p className="mt-1 text-xs text-text-secondary">
                  Files in a different folder on this device? Tell FavoritePod where to
                  find them when opening your favorites. This does not move your files.
                </p>
              </div>
              <span className="shrink-0 text-xs text-text-tertiary">
                This device only
              </span>
            </div>
            <div className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)_2rem] items-center gap-2 bg-surface px-3 py-2 text-xs font-medium text-text-secondary">
                <span>Original folder</span>
                <span className="col-start-3">Folder on this device</span>
              </div>
              {editedOverrides.map((override, index) => (
                <div
                  className="grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)_2rem] items-center gap-2 px-3 py-2"
                  key={index}
                >
                  <label className="min-w-0 text-xs font-medium text-text-secondary">
                    <span className="sr-only">Original folder {index + 1}</span>
                    <input
                      autoCapitalize="off"
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs font-normal text-text-primary outline-none focus:border-primary"
                      onChange={(event) =>
                        setEditedOverrides((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, from: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder="file:///Users/Alex/Documents/"
                      spellCheck={false}
                      type="text"
                      value={override.from}
                    />
                  </label>
                  <ChevronRightIcon
                    aria-hidden="true"
                    className="h-4 w-4 text-text-tertiary"
                  />
                  <label className="min-w-0 text-xs font-medium text-text-secondary">
                    <span className="sr-only">Folder on this device {index + 1}</span>
                    <input
                      autoCapitalize="off"
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-xs font-normal text-text-primary outline-none focus:border-primary"
                      onChange={(event) =>
                        setEditedOverrides((current) =>
                          current.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, to: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      placeholder="file:///Users/Sam/Documents/"
                      spellCheck={false}
                      type="text"
                      value={override.to}
                    />
                  </label>
                  <button
                    aria-label={`Remove folder location ${index + 1}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-danger"
                    onClick={() =>
                      setEditedOverrides((current) =>
                        current.filter((_, entryIndex) => entryIndex !== index),
                      )
                    }
                    title="Remove folder location"
                    type="button"
                  >
                    <TrashIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            {editedOverrides.length > 0 && (
              <p className="mt-2 text-xs text-text-secondary">
                Use folder addresses beginning with file:///. The original folder is the
                one in your saved favorites.
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
                onClick={() =>
                  setEditedOverrides((current) => [...current, { from: '', to: '' }])
                }
                type="button"
              >
                <FolderPlusIcon aria-hidden="true" className="h-4 w-4" />
                Add folder location
              </button>
              <button
                className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover"
                onClick={() => void saveOverrides()}
                type="button"
              >
                Save locations
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
