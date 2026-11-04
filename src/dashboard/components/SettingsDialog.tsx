import { useEffect, useState } from 'react';
import {
  Description,
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react';
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
import type {
  DriveAccount,
  DriveConnectionResult,
  DriveConnectionState,
} from '../../core/drive-auth';
import type { GroupingMode, LibraryView, OpenBehavior } from '../../core/storage';
import type { ArchiveDialogMode } from './ImportExportDialog';

interface SettingsDialogProps {
  defaultView: LibraryView;
  groupingMode: GroupingMode;
  showPreview: boolean;
  openBehavior: OpenBehavior;
  driveAccount: DriveAccount | null;
  driveConnectionStatus: DriveConnectionState['status'];
  driveSyncing: boolean;
  driveSyncError?: string;
  driveSyncMessage?: string;
  homePageAvailable: boolean;
  pathOverrides: PathOverride[];
  onClose: () => void;
  onSaveDefaultView: (view: LibraryView) => Promise<void>;
  onSaveGroupingMode: (mode: GroupingMode) => Promise<void>;
  onSaveShowPreview: (showPreview: boolean) => Promise<void>;
  onSaveOpenBehavior: (behavior: OpenBehavior) => Promise<void>;
  onSavePathOverrides: (overrides: PathOverride[]) => Promise<void>;
  onConnectDrive: () => Promise<DriveConnectionResult>;
  onPrepareDriveConnection: () => Promise<DriveAccount>;
  onConfirmDriveConnection: (account: DriveAccount) => Promise<DriveConnectionResult>;
  onCancelDriveConnection: () => Promise<void>;
  onSwitchDriveAccount: (account: DriveAccount) => Promise<void>;
  onDisconnectDrive: () => Promise<void>;
  onSyncDrive: () => Promise<void>;
  onArchiveAction: (mode: ArchiveDialogMode) => void;
}

export function SettingsDialog({
  defaultView,
  groupingMode,
  showPreview,
  openBehavior,
  driveAccount,
  driveConnectionStatus,
  driveSyncing,
  driveSyncError,
  driveSyncMessage,
  homePageAvailable,
  pathOverrides,
  onClose,
  onSaveDefaultView,
  onSaveGroupingMode,
  onSaveShowPreview,
  onSaveOpenBehavior,
  onSavePathOverrides,
  onConnectDrive,
  onPrepareDriveConnection,
  onConfirmDriveConnection,
  onCancelDriveConnection,
  onSwitchDriveAccount,
  onDisconnectDrive,
  onSyncDrive,
  onArchiveAction,
}: SettingsDialogProps) {
  const [error, setError] = useState<string>();
  const [editedOverrides, setEditedOverrides] = useState(pathOverrides);
  const [driveError, setDriveError] = useState<string>();
  const [driveMessage, setDriveMessage] = useState<string>();
  const [driveBusy, setDriveBusy] = useState(false);
  const [connectCandidate, setConnectCandidate] = useState<DriveAccount>();
  const [pendingDriveAccount, setPendingDriveAccount] = useState<DriveAccount>();
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (driveConnectionStatus === 'disconnected') {
      setPendingDriveAccount(undefined);
      setConfirmDisconnect(false);
      setDriveError(undefined);
      setDriveMessage(undefined);
    }
  }, [driveConnectionStatus]);

  useEffect(() => {
    if (driveConnectionStatus !== 'disconnected') setConnectCandidate(undefined);
  }, [driveConnectionStatus]);

  const connectDrive = async () => {
    setDriveBusy(true);
    setDriveError(undefined);
    setDriveMessage(undefined);
    setPendingDriveAccount(undefined);
    try {
      const result = await onConnectDrive();
      if (result.status === 'account-switch-required') {
        setPendingDriveAccount(result.nextAccount);
      } else {
        setPendingDriveAccount(undefined);
      }
    } catch (cause) {
      setDriveError(
        cause instanceof Error ? cause.message : 'Could not connect to Google Drive.',
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const prepareDriveConnection = async () => {
    setDriveBusy(true);
    setDriveError(undefined);
    setDriveMessage(undefined);
    setConnectCandidate(undefined);
    try {
      setConnectCandidate(await onPrepareDriveConnection());
    } catch (cause) {
      setDriveError(
        cause instanceof Error ? cause.message : 'Could not connect to Google Drive.',
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const confirmDriveConnection = async () => {
    if (!connectCandidate) return;
    setDriveBusy(true);
    setDriveError(undefined);
    try {
      const result = await onConfirmDriveConnection(connectCandidate);
      setConnectCandidate(undefined);
      if (result.status === 'account-switch-required') {
        setPendingDriveAccount(result.nextAccount);
      }
    } catch (cause) {
      setConnectCandidate(undefined);
      setDriveError(
        cause instanceof Error ? cause.message : 'Could not connect to Google Drive.',
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const cancelPreparedDriveConnection = async () => {
    setDriveBusy(true);
    setDriveError(undefined);
    try {
      await onCancelDriveConnection();
    } catch (cause) {
      setDriveError(
        cause instanceof Error ? cause.message : 'Could not cancel the connection.',
      );
    } finally {
      setConnectCandidate(undefined);
      setDriveBusy(false);
    }
  };

  const confirmDriveAccountSwitch = async () => {
    if (!pendingDriveAccount) return;
    setDriveBusy(true);
    setDriveError(undefined);
    try {
      await onSwitchDriveAccount(pendingDriveAccount);
      setDriveMessage(`Switched to ${pendingDriveAccount.emailAddress}.`);
      setPendingDriveAccount(undefined);
    } catch (cause) {
      setDriveError(
        cause instanceof Error ? cause.message : 'Could not switch Google accounts.',
      );
    } finally {
      setDriveBusy(false);
    }
  };

  const dismissDisconnect = () => {
    if (driveBusy) return;
    setConfirmDisconnect(false);
    setDriveError(undefined);
  };

  const disconnectDrive = async () => {
    setDriveBusy(true);
    setDriveError(undefined);
    setDriveMessage(undefined);
    try {
      await onDisconnectDrive();
      setConfirmDisconnect(false);
      setPendingDriveAccount(undefined);
    } catch (cause) {
      setDriveError(
        cause instanceof Error ? cause.message : 'Could not disconnect Google Drive.',
      );
    } finally {
      setDriveBusy(false);
    }
  };

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
            <h3 className="text-sm font-medium text-text-primary">
              Google Drive
              {!driveAccount && (
                <span className="ml-2 font-normal text-text-secondary">
                  Not connected
                </span>
              )}
              {driveConnectionStatus === 'authorization-required' && (
                <span className="ml-2 font-normal text-warning">
                  Connection needs attention
                </span>
              )}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {driveConnectionStatus === 'authorization-required'
                ? 'Select Connect Google Drive to authorize this profile and resume syncing. Your local changes are saved.'
                : driveAccount
                  ? 'Sync your favorites across devices using Google Drive’s private app folder.'
                  : 'Connect your Google account to sync favorites using Drive’s private app folder.'}
            </p>
            <div className="mt-3 rounded-md border border-border bg-surface px-3 py-3">
              {driveAccount ? (
                <>
                  <p className="text-sm text-text-primary">
                    {driveConnectionStatus === 'connected' && (
                      <span aria-hidden="true" className="mr-1 text-success">
                        ✓
                      </span>
                    )}
                    {driveConnectionStatus === 'authorization-required'
                      ? 'Account: '
                      : 'Connected as '}
                    <span className="font-medium">{driveAccount.emailAddress}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                      disabled={driveBusy || driveSyncing}
                      onClick={() =>
                        void (driveConnectionStatus === 'authorization-required'
                          ? connectDrive()
                          : onSyncDrive())
                      }
                      type="button"
                    >
                      {driveSyncing
                        ? 'Syncing…'
                        : driveConnectionStatus === 'authorization-required'
                          ? 'Connect Google Drive'
                          : 'Sync now'}
                    </button>
                    <button
                      className="min-h-9 rounded-md px-3 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:cursor-wait disabled:opacity-60"
                      disabled={driveBusy || driveSyncing}
                      onClick={() => {
                        setDriveError(undefined);
                        setConfirmDisconnect(true);
                      }}
                      type="button"
                    >
                      Disconnect
                    </button>
                  </div>
                </>
              ) : connectCandidate ? (
                <div
                  aria-labelledby="drive-connect-confirm-title"
                  className="rounded-md border border-border bg-background p-3"
                  role="group"
                >
                  <p
                    className="text-sm font-medium text-text-primary"
                    id="drive-connect-confirm-title"
                  >
                    Connect Google Drive as {connectCandidate.emailAddress}?
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    FavoritePod uses the Google account signed in to this Chrome profile.
                    To use a different account, change this Chrome profile’s account
                    first.
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      className="min-h-9 rounded-md border border-border px-3 text-sm text-text-primary transition hover:bg-surface-hover disabled:opacity-60"
                      disabled={driveBusy}
                      onClick={() => void cancelPreparedDriveConnection()}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      autoFocus
                      className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                      disabled={driveBusy}
                      onClick={() => void confirmDriveConnection()}
                      type="button"
                    >
                      Connect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex justify-center">
                  <button
                    className="min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                    disabled={driveBusy}
                    onClick={() => void prepareDriveConnection()}
                    type="button"
                  >
                    Connect Google Drive
                  </button>
                </div>
              )}

              {pendingDriveAccount && (
                <div className="mt-3 rounded-md border border-warning/40 bg-background p-3">
                  <p className="text-sm text-text-primary" role="status">
                    Google returned {pendingDriveAccount.emailAddress}, while this device
                    is connected as {driveAccount?.emailAddress ?? 'another account'}.
                    Switching clears Drive file records for the previous account. Your
                    favorites and device identity stay on this device.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="min-h-9 rounded-md border border-border px-3 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-60"
                      disabled={driveBusy}
                      onClick={() => setPendingDriveAccount(undefined)}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-60"
                      disabled={driveBusy}
                      onClick={() => void confirmDriveAccountSwitch()}
                      type="button"
                    >
                      Switch account
                    </button>
                  </div>
                </div>
              )}

              {driveError && !confirmDisconnect && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {driveError}
                </p>
              )}
              {driveMessage && (
                <p className="mt-3 text-sm text-text-secondary" role="status">
                  {driveMessage}
                </p>
              )}
              {driveSyncError && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {driveSyncError}
                </p>
              )}
              {driveSyncMessage && (
                <p className="mt-3 text-sm text-text-secondary" role="status">
                  {driveSyncMessage}
                </p>
              )}
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
      {confirmDisconnect && (
        <Dialog className="relative z-[60]" onClose={dismissDisconnect} open>
          <DialogBackdrop className="fixed inset-0 bg-black/35" />
          <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
            <DialogPanel
              aria-busy={driveBusy}
              className="w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-xl"
            >
              <DialogTitle className="text-lg font-semibold text-text-primary">
                Disconnect Google Drive?
              </DialogTitle>
              <Description className="mt-2 text-sm text-text-secondary">
                Disconnecting from Google Drive will stop syncing your favorites. Your
                saved favorites will remain available locally.
              </Description>
              {driveError && (
                <p className="mt-3 text-sm text-danger" role="alert">
                  {driveError}
                </p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  className="min-h-10 rounded-md border border-border px-4 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-60"
                  data-autofocus
                  disabled={driveBusy}
                  onClick={dismissDisconnect}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="min-h-10 rounded-md bg-danger px-4 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
                  disabled={driveBusy}
                  onClick={() => void disconnectDrive()}
                  type="button"
                >
                  {driveBusy ? 'Disconnecting…' : 'Disconnect'}
                </button>
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </Dialog>
  );
}
