import { AnimatedDialog, useDialogTransition } from '../../components/AnimatedDialog';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Description,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Tab,
  TabGroup,
  TabList,
  TabPanel,
  TabPanels,
} from '@headlessui/react';
import {
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpTrayIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  FolderPlusIcon,
  ListBulletIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { normalizePathOverrides, type PathOverride } from '../../core/file-links';
import type { DriveAccount, DriveConnectionState } from '../../core/drive-auth';
import type { DriveSyncProgress } from '../../core/drive-sync';
import type {
  DriveSyncErrorCode,
  DriveSyncHistoryEntry,
} from '../../core/drive-sync-history';
import type { GroupingMode, LibraryView, OpenBehavior } from '../../core/storage';
import type { Theme } from '../hooks/use-theme';
import type { ArchiveDialogMode } from './ImportExportDialog';
import { ProgressBar } from '../../components/ProgressBar';

interface SettingsDialogProps {
  initialSection?: 'discovery';
  theme: Theme;
  themeReady: boolean;
  themeSaving: boolean;
  themeError?: string;
  onSaveTheme: (theme: Theme) => Promise<void>;
  defaultView: LibraryView;
  groupingMode: GroupingMode;
  showPreview: boolean;
  showHiddenBookmarks: boolean;
  showFrequentlyVisited: boolean;
  showFrequentlyVisitedOnHome: boolean;
  siteDiscoveryEnabled: boolean;
  siteDiscoveryPermissionGranted: boolean;
  contextMenuEnabled: boolean;
  contextMenuPermissionGranted: boolean;
  optionalFeaturesReady: boolean;
  openBehavior: OpenBehavior;
  driveAccount: DriveAccount | null;
  driveConnectionStatus: DriveConnectionState['status'];
  driveSyncing: boolean;
  driveSyncError?: string;
  driveSyncErrorCode?: DriveSyncErrorCode;
  driveSyncMessage?: string;
  driveSyncProgress?: DriveSyncProgress;
  driveSyncHistory: DriveSyncHistoryEntry[];
  online: boolean;
  homePageAvailable: boolean;
  pathOverrides: PathOverride[];
  onClose: () => void;
  onSaveDefaultView: (view: LibraryView) => Promise<void>;
  onSaveGroupingMode: (mode: GroupingMode) => Promise<void>;
  onSaveShowPreview: (showPreview: boolean) => Promise<void>;
  onSaveShowHiddenBookmarks: (show: boolean) => Promise<void>;
  onSaveShowFrequentlyVisited: (show: boolean) => Promise<void>;
  onSaveShowFrequentlyVisitedOnHome: (show: boolean) => Promise<void>;
  onSaveSiteDiscoveryEnabled: (enabled: boolean) => Promise<void>;
  onSaveContextMenuEnabled: (enabled: boolean) => Promise<void>;
  onSaveOpenBehavior: (behavior: OpenBehavior) => Promise<void>;
  onSavePathOverrides: (overrides: PathOverride[]) => Promise<void>;
  onOpenDriveSignIn: () => void;
  onDisconnectDrive: () => Promise<void>;
  onSyncDrive: () => Promise<void>;
  onArchiveAction: (mode: ArchiveDialogMode) => void;
  onImportChromeBookmarks: () => void;
}

function syncStageLabel(progress?: DriveSyncProgress): string | undefined {
  if (!progress) return undefined;
  const labels: Record<DriveSyncProgress['stage'], string> = {
    checking: 'Checking Google Drive',
    downloading: 'Downloading library updates',
    merging: 'Merging changes',
    uploading: 'Uploading library updates',
    'assets-downloading': 'Downloading previews',
    'assets-uploading': 'Uploading previews',
    cleaning: 'Cleaning up old previews',
    complete: 'Sync complete',
  };
  return labels[progress.stage];
}

export function SettingsDialog({
  initialSection,
  theme,
  themeReady,
  themeSaving,
  themeError,
  onSaveTheme,
  defaultView,
  groupingMode,
  showPreview,
  showHiddenBookmarks,
  showFrequentlyVisited,
  showFrequentlyVisitedOnHome,
  siteDiscoveryEnabled,
  siteDiscoveryPermissionGranted,
  contextMenuEnabled,
  contextMenuPermissionGranted,
  optionalFeaturesReady,
  openBehavior,
  driveAccount,
  driveConnectionStatus,
  driveSyncing,
  driveSyncError,
  driveSyncErrorCode,
  driveSyncMessage,
  driveSyncProgress,
  driveSyncHistory,
  online,
  homePageAvailable,
  pathOverrides,
  onClose: onClosed,
  onSaveDefaultView,
  onSaveGroupingMode,
  onSaveShowPreview,
  onSaveShowHiddenBookmarks,
  onSaveShowFrequentlyVisited,
  onSaveShowFrequentlyVisitedOnHome,
  onSaveSiteDiscoveryEnabled,
  onSaveContextMenuEnabled,
  onSaveOpenBehavior,
  onSavePathOverrides,
  onOpenDriveSignIn,
  onDisconnectDrive,
  onSyncDrive,
  onArchiveAction,
  onImportChromeBookmarks,
}: SettingsDialogProps) {
  const dialogTransition = useDialogTransition(onClosed);
  const onClose = dialogTransition.close;
  const [selectedTab, setSelectedTab] = useState(initialSection === 'discovery' ? 1 : 0);
  const panelsRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();
  const [editedOverrides, setEditedOverrides] = useState(pathOverrides);
  const [driveError, setDriveError] = useState<string>();
  const [driveBusy, setDriveBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [featureBusy, setFeatureBusy] = useState<'discovery' | 'contextMenus' | null>(
    null,
  );
  const [featureError, setFeatureError] = useState<string>();
  const discoverySectionRef = useRef<HTMLDivElement>(null);
  const discoverySwitchRef = useRef<HTMLButtonElement>(null);
  const discoveryFocused = useRef(false);

  useLayoutEffect(() => {
    // Reset within the commit so the outgoing panel never paints at the top again.
    if (panelsRef.current) panelsRef.current.scrollTop = 0;
  }, [selectedTab]);

  useEffect(() => {
    if (
      initialSection !== 'discovery' ||
      selectedTab !== 1 ||
      !optionalFeaturesReady ||
      discoveryFocused.current
    )
      return;
    const frame = requestAnimationFrame(() => {
      discoveryFocused.current = true;
      discoverySectionRef.current?.scrollIntoView({ block: 'center' });
      if (optionalFeaturesReady) {
        discoverySwitchRef.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [initialSection, optionalFeaturesReady, selectedTab]);
  const showDriveStorageWarning =
    driveConnectionStatus === 'connected' &&
    online &&
    !driveSyncing &&
    Boolean(driveSyncError) &&
    driveSyncErrorCode === 'quota-exceeded';

  const dismissDisconnect = () => {
    if (driveBusy) return;
    setConfirmDisconnect(false);
    setDriveError(undefined);
  };

  const disconnectDrive = async () => {
    setDriveBusy(true);
    setDriveError(undefined);
    try {
      await onDisconnectDrive();
      setConfirmDisconnect(false);
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

  const saveTheme = async (value: Theme) => {
    setError(undefined);
    try {
      await onSaveTheme(value);
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

  const saveShowHiddenBookmarks = async (value: boolean) => {
    setError(undefined);
    try {
      await onSaveShowHiddenBookmarks(value);
    } catch {
      setError('Could not save this preference.');
    }
  };

  const saveFrequentlyVisitedVisibility = async (show: boolean, onHome = false) => {
    setError(undefined);
    try {
      await (onHome ? onSaveShowFrequentlyVisitedOnHome : onSaveShowFrequentlyVisited)(
        show,
      );
    } catch {
      setError('Could not save this preference.');
    }
  };

  const saveOptionalFeature = async (
    feature: 'discovery' | 'contextMenus',
    enabled: boolean,
  ) => {
    setFeatureBusy(feature);
    setFeatureError(undefined);
    try {
      if (feature === 'discovery') await onSaveSiteDiscoveryEnabled(enabled);
      else await onSaveContextMenuEnabled(enabled);
    } catch (cause) {
      setFeatureError(
        cause instanceof Error ? cause.message : 'Could not update this setting.',
      );
    } finally {
      setFeatureBusy(null);
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
    <AnimatedDialog
      className="relative z-50"
      initialFocus={initialSection === 'discovery' ? discoverySwitchRef : undefined}
      onClose={onClose}
      open={dialogTransition.open}
      afterLeave={dialogTransition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden p-4">
        <DialogPanel
          transition
          className="dialog-panel flex h-[640px] max-h-[calc(100dvh-2rem)] w-full min-w-0 max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-background p-5 shadow-xl"
        >
          <div className="flex shrink-0 items-center justify-between">
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

          <TabGroup
            className="mt-4 flex min-h-0 flex-1 flex-col"
            selectedIndex={selectedTab}
            onChange={setSelectedTab}
          >
            <TabList
              aria-label="Settings categories"
              className="flex shrink-0 flex-wrap gap-1 border-b border-border pb-3"
            >
              {[
                'Appearance',
                'Behavior',
                'Import & export',
                'Google Drive',
                'Local files',
              ].map((label) => (
                <Tab
                  key={label}
                  className="min-h-9 rounded-md px-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary data-[selected]:bg-primary-light data-[selected]:text-primary"
                >
                  {label}
                </Tab>
              ))}
            </TabList>
            <TabPanels
              ref={panelsRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-4 pr-1 [scrollbar-gutter:stable]"
            >
              <TabPanel className="focus:outline-none" unmount={false}>
                <fieldset>
                  <legend className="text-sm font-medium text-text-primary">
                    Appearance
                  </legend>
                  <div
                    aria-label="Theme"
                    className="mt-2 grid grid-cols-3 gap-1 rounded-md border border-border bg-surface p-1"
                  >
                    {(
                      [
                        { value: 'auto', label: 'System' },
                        { value: 'light', label: 'Light' },
                        { value: 'dark', label: 'Dark' },
                      ] as const
                    ).map(({ value, label }) => (
                      <label
                        className={`flex min-h-9 cursor-pointer items-center justify-center rounded px-2 text-sm transition ${theme === value ? 'bg-background font-medium text-text-primary shadow-sm' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'} ${!themeReady || themeSaving ? 'cursor-wait opacity-60' : ''}`}
                        key={value}
                      >
                        <input
                          checked={theme === value}
                          className="peer sr-only"
                          disabled={!themeReady || themeSaving}
                          name="theme"
                          onChange={() => void saveTheme(value)}
                          type="radio"
                          value={value}
                        />
                        <span className="rounded px-1 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-primary peer-focus-visible:outline-offset-2">
                          {label}
                        </span>
                      </label>
                    ))}
                  </div>
                  {themeError && (
                    <p className="mt-2 text-xs text-danger" role="alert">
                      {themeError}
                    </p>
                  )}
                </fieldset>

                <div className="mt-5 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-text-primary">
                    Show Preview
                  </span>
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
              </TabPanel>
              <TabPanel className="focus:outline-none" unmount={false}>
                <fieldset>
                  <legend className="text-sm font-medium text-text-primary">
                    On open
                  </legend>
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

                <div className="mt-4 flex items-start justify-between gap-4">
                  <div>
                    <span className="text-sm font-medium text-text-primary">
                      Show hidden bookmarks
                    </span>
                    <p
                      className="mt-1 text-xs leading-relaxed text-text-secondary"
                      id="hidden-bookmarks-description"
                    >
                      Show legacy FTP links and email or phone links hidden on this device
                      so you can manage them.
                    </p>
                  </div>
                  <button
                    aria-checked={showHiddenBookmarks}
                    aria-label="Show hidden bookmarks"
                    aria-describedby="hidden-bookmarks-description"
                    className={`relative mt-1 flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${showHiddenBookmarks ? 'bg-primary' : 'bg-border'}`}
                    disabled={!optionalFeaturesReady}
                    onClick={() => void saveShowHiddenBookmarks(!showHiddenBookmarks)}
                    role="switch"
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${showHiddenBookmarks ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                </div>

                <div
                  aria-labelledby="frequently-visited-visibility-label"
                  className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4"
                  role="group"
                >
                  <span
                    className="pt-1 text-sm font-medium text-text-primary"
                    id="frequently-visited-visibility-label"
                  >
                    Show frequently visited
                  </span>
                  <div className="grid gap-3">
                    {[
                      {
                        label: 'All favorites',
                        enabled: showFrequentlyVisited,
                        onHome: false,
                      },
                      {
                        label: 'Home page',
                        enabled: showFrequentlyVisitedOnHome,
                        onHome: true,
                      },
                    ].map(({ label, enabled, onHome }) => (
                      <label
                        className="flex min-h-8 items-center justify-between gap-3 text-sm text-text-secondary"
                        key={label}
                      >
                        <span>{label}</span>
                        <button
                          aria-checked={enabled}
                          aria-label={
                            onHome
                              ? 'Show frequently visited on Home page'
                              : 'Show frequently visited in All favorites'
                          }
                          className={
                            'relative flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ' +
                            (enabled ? 'bg-primary' : 'bg-border')
                          }
                          disabled={!optionalFeaturesReady}
                          onClick={() =>
                            void saveFrequentlyVisitedVisibility(!enabled, onHome)
                          }
                          role="switch"
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            className={
                              'h-4 w-4 rounded-full bg-white shadow transition-transform ' +
                              (enabled ? 'translate-x-6' : 'translate-x-1')
                            }
                          />
                        </button>
                      </label>
                    ))}
                  </div>
                </div>

                <section className="mt-6 border-t border-border pt-5">
                  <h3 className="text-sm font-medium text-text-primary">
                    Permission control
                  </h3>
                  <div className="mt-3 divide-y divide-border rounded-md border border-border">
                    <div
                      className="flex items-center justify-between gap-4 px-3 py-3"
                      id="visited-site-discovery-setting"
                      ref={discoverySectionRef}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          Frequently visited access
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                          Show the sites selected by Chrome. Hidden shortcuts stay on this
                          device.
                          {!siteDiscoveryPermissionGranted && (
                            <span className="block text-text-tertiary">
                              Chrome will ask for Top sites access when enabled.
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        aria-checked={siteDiscoveryEnabled}
                        aria-label="Frequently visited access"
                        className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-wait disabled:opacity-60 ${siteDiscoveryEnabled ? 'bg-primary' : 'bg-border'}`}
                        disabled={!optionalFeaturesReady || featureBusy !== null}
                        onClick={() =>
                          void saveOptionalFeature('discovery', !siteDiscoveryEnabled)
                        }
                        role="switch"
                        ref={discoverySwitchRef}
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${siteDiscoveryEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-4 px-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary">
                          Right-click save menu
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                          Add “Save to FavoritePod” to Chrome’s right-click menu.
                          {!contextMenuPermissionGranted && (
                            <span className="block text-text-tertiary">
                              Chrome will ask for context menu access when enabled.
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        aria-checked={contextMenuEnabled}
                        aria-label="Right-click save menu"
                        className={`relative flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:cursor-wait disabled:opacity-60 ${contextMenuEnabled ? 'bg-primary' : 'bg-border'}`}
                        disabled={!optionalFeaturesReady || featureBusy !== null}
                        onClick={() =>
                          void saveOptionalFeature('contextMenus', !contextMenuEnabled)
                        }
                        role="switch"
                        type="button"
                      >
                        <span
                          aria-hidden="true"
                          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${contextMenuEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </div>
                  </div>
                  {featureError && (
                    <p className="mt-2 text-sm text-danger" role="alert">
                      {featureError}
                    </p>
                  )}
                </section>
              </TabPanel>
              <TabPanel className="focus:outline-none" unmount={false}>
                <section>
                  <h3 className="text-sm font-medium text-text-primary">
                    FavoritePod library
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    Back up or restore your library, including preview images, using a
                    FavoritePod ZIP file.
                  </p>
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
                    Chrome bookmarks
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                    Move folders and bookmarks between FavoritePod and Chrome using an
                    HTML file.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                      onClick={onImportChromeBookmarks}
                      type="button"
                    >
                      <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />
                      Import Chrome bookmarks
                    </button>
                    <button
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
                      onClick={() => onArchiveAction('export-chrome')}
                      type="button"
                    >
                      <ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />
                      Export Chrome bookmarks
                    </button>
                  </div>
                </section>
              </TabPanel>
              <TabPanel className="focus:outline-none" unmount={false}>
                <section>
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
                      ? 'Reconnect Google Drive to resume syncing. Your local changes are saved.'
                      : driveAccount
                        ? 'Sync your favorites across devices using Google Drive’s private app folder.'
                        : 'Sign in to sync your favorites across devices.'}
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
                        <div className="mt-3 border-t border-border pt-3">
                          {!online ? (
                            <p className="text-sm text-text-secondary" role="status">
                              Offline. Your changes are saved locally and will sync when
                              you’re back online.
                            </p>
                          ) : driveSyncing ? (
                            <div aria-live="polite" className="space-y-2" role="status">
                              <div className="flex items-center gap-2 text-sm text-text-primary">
                                <ArrowPathIcon
                                  aria-hidden="true"
                                  className="h-4 w-4 animate-spin text-primary"
                                />
                                <span>
                                  {syncStageLabel(driveSyncProgress) ??
                                    'Syncing Google Drive'}
                                </span>
                                {typeof driveSyncProgress?.current === 'number' &&
                                  typeof driveSyncProgress.total === 'number' &&
                                  driveSyncProgress.total > 0 && (
                                    <span className="ml-auto text-xs text-text-secondary">
                                      {driveSyncProgress.current} /{' '}
                                      {driveSyncProgress.total}
                                    </span>
                                  )}
                              </div>
                              <ProgressBar
                                label="Google Drive sync progress"
                                current={driveSyncProgress?.current}
                                total={driveSyncProgress?.total}
                              />
                            </div>
                          ) : showDriveStorageWarning ? (
                            <div className="flex items-start gap-2.5" role="alert">
                              <ExclamationTriangleIcon
                                aria-hidden="true"
                                className="mt-0.5 h-5 w-5 shrink-0 text-warning"
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-text-primary">
                                  Google Drive storage is full
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                                  Free up space in Google Drive to continue syncing.
                                </p>
                              </div>
                            </div>
                          ) : driveSyncError ? (
                            <p className="text-sm text-danger" role="alert">
                              {driveSyncErrorCode === 'network-error'
                                ? 'Could not reach Google Drive. Your changes are saved locally.'
                                : driveSyncError}
                            </p>
                          ) : driveSyncMessage ? (
                            <p className="text-sm text-text-secondary" role="status">
                              {driveSyncMessage}
                            </p>
                          ) : (
                            <p className="text-sm text-text-secondary" role="status">
                              Ready to sync.
                            </p>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {showDriveStorageWarning && (
                            <a
                              className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                              href="https://drive.google.com/drive/quota"
                              rel="noreferrer"
                              target="_blank"
                            >
                              Manage storage
                              <ArrowTopRightOnSquareIcon
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0"
                              />
                              <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                          )}
                          {driveConnectionStatus === 'authorization-required' && (
                            <button
                              className="min-h-9 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                              disabled={driveBusy || driveSyncing || !online}
                              onClick={onOpenDriveSignIn}
                              type="button"
                            >
                              Reconnect Google Drive
                            </button>
                          )}
                          {driveConnectionStatus === 'connected' && (
                            <button
                              className={`min-h-9 rounded-md px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-wait disabled:opacity-60 ${showDriveStorageWarning ? 'border border-border text-text-primary hover:bg-surface-hover' : 'bg-primary text-white hover:bg-primary-hover'}`}
                              disabled={driveBusy || driveSyncing || !online}
                              onClick={() => void onSyncDrive()}
                              type="button"
                            >
                              {driveSyncing
                                ? 'Syncing…'
                                : driveSyncError &&
                                    driveSyncErrorCode !== 'offline' &&
                                    driveSyncErrorCode !== 'quota-exceeded'
                                  ? 'Try again'
                                  : 'Sync now'}
                            </button>
                          )}
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
                    ) : (
                      <div className="flex justify-center">
                        <button
                          className="min-h-10 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
                          disabled={!online}
                          onClick={onOpenDriveSignIn}
                          type="button"
                        >
                          Connect Google Drive
                        </button>
                      </div>
                    )}

                    {driveError && !confirmDisconnect && (
                      <p className="mt-3 shrink-0 text-sm text-danger" role="alert">
                        {driveError}
                      </p>
                    )}
                  </div>
                  {driveAccount && (
                    <>
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-text-primary hover:text-primary">
                          Sync history ({driveSyncHistory.length})
                        </summary>
                        {driveSyncHistory.length ? (
                          <ol className="mt-2 divide-y divide-border">
                            {driveSyncHistory.map((entry) => (
                              <li className="py-2" key={entry.id}>
                                <div className="flex items-baseline justify-between gap-3 text-xs">
                                  <span
                                    className={
                                      entry.status === 'failed'
                                        ? 'font-medium text-danger'
                                        : entry.status === 'needs-choice'
                                          ? 'font-medium text-warning'
                                          : 'font-medium text-success'
                                    }
                                  >
                                    {entry.status === 'synced'
                                      ? 'Synced'
                                      : entry.status === 'merged'
                                        ? 'Changes merged'
                                        : entry.status === 'needs-choice'
                                          ? 'Waiting for your choice'
                                          : 'Failed'}
                                  </span>
                                  <time className="text-text-tertiary">
                                    {new Date(entry.completedAt).toLocaleString()}
                                  </time>
                                </div>
                                <p className="mt-1 break-words text-xs text-text-secondary">
                                  {entry.message}
                                </p>
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="mt-2 text-xs text-text-secondary">
                            No sync activity yet.
                          </p>
                        )}
                      </details>
                    </>
                  )}
                </section>
              </TabPanel>
              <TabPanel className="focus:outline-none" unmount={false}>
                <section>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-medium text-text-primary">
                        File Locations Remap
                      </h3>
                      <p className="mt-1 text-xs text-text-secondary">
                        Files in a different folder on this device? Tell FavoritePod where
                        to find them when opening your favorites. This does not move your
                        files.
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
                          <span className="sr-only">
                            Folder on this device {index + 1}
                          </span>
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
                      Use folder addresses beginning with file:///. The original folder is
                      the one in your saved favorites.
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md px-2 text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
                      onClick={() =>
                        setEditedOverrides((current) => [
                          ...current,
                          { from: '', to: '' },
                        ])
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
              </TabPanel>
            </TabPanels>
          </TabGroup>
          {error && (
            <p className="mt-3 shrink-0 text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </DialogPanel>
      </div>
      <AnimatedDialog
        className="relative z-[60]"
        onClose={dismissDisconnect}
        open={confirmDisconnect}
      >
        <DialogBackdrop
          transition
          className="dialog-backdrop fixed inset-0 bg-black/35"
        />
        <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
          <DialogPanel
            transition
            aria-busy={driveBusy}
            className="dialog-panel w-full max-w-sm rounded-lg border border-border bg-background p-5 shadow-xl"
          >
            <DialogTitle className="text-lg font-semibold text-text-primary">
              Disconnect Google Drive?
            </DialogTitle>
            <Description className="mt-2 text-sm text-text-secondary">
              Disconnecting from Google Drive will stop syncing your favorites. Your saved
              favorites will remain available locally.
            </Description>
            {driveError && (
              <p className="mt-3 shrink-0 text-sm text-danger" role="alert">
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
      </AnimatedDialog>
    </AnimatedDialog>
  );
}
