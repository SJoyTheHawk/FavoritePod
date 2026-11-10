import { liveQuery } from 'dexie';
import { db } from '../core/db';
import { isItemDeleted } from '../core/merge';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  Bars3Icon,
  BookmarkIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
  CloudIcon,
} from '@heroicons/react/24/outline';
import {
  createGroup,
  createItem,
  deleteGroup,
  deleteItem,
  deleteItems,
  getDefaultView,
  getBookmarkSize,
  getCollapsedGroups,
  getGroupingMode,
  getHomePageGroupId,
  getLastSelectedGroupId,
  getOpenBehavior,
  getSidebarCollapsed,
  getShowPreview,
  moveGroup,
  moveItem,
  moveItems,
  restoreGroup,
  restoreItem,
  restoreItems,
  restoreItemPositions,
  hideVisitedSiteUrl,
  setDefaultView,
  setCollapsedGroups,
  setGroupingMode,
  setHomePageGroupId,
  setLastSelectedGroupId,
  setOpenBehavior,
  setSidebarCollapsed,
  setShowPreview,
  setBookmarkSize,
  type BookmarkSize,
  type GroupingMode,
  type OpenBehavior,
  updateGroup,
  updateItem,
  updateItemThumbnail,
  type ItemPosition,
  type LibraryView,
} from '../core/storage';
import {
  getExtensionSettingsUrl,
  getPathOverrides,
  hasFileAccess,
  openSavedUrl,
  savePathOverrides as persistPathOverrides,
  type PathOverride,
} from '../core/file-links';
import {
  INVALID_URL_MESSAGE,
  isHiddenOnThisPlatform,
  parseSafeUrl,
} from '../core/validation';
import { normalizeVisitedSiteUrl } from '../core/discovery-url';
import type { VisitedSiteSuggestion } from '../core/discovery';
import { useOptionalFeatures } from './use-optional-features';
import { useVisitedSites } from './use-visited-sites';
import { useTheme } from './hooks/use-theme';
import { useLibrary } from '../core/use-library';
import type { Group, Item } from '../core/types';
import {
  DriveAuthError,
  cancelGoogleDriveConnection,
  confirmGoogleDriveConnection,
  connectGoogleDrive,
  disconnectGoogleDrive,
  getDriveConnectionState,
  prepareGoogleDriveConnection,
  type DriveConnectionResult,
  type DriveConnectionState,
  switchGoogleDriveAccount,
  type DriveAccount,
} from '../core/drive-auth';
import {
  DriveSyncOfflineError,
  DriveSyncChoiceRequired,
  getDriveSyncErrorCode,
  syncGoogleDrive,
  type DriveSyncChoice,
  type DriveSyncOptions,
  type DriveSyncProgress,
  type DriveSyncResult,
  type DriveSyncPreview,
  withGoogleDriveSyncLock,
} from '../core/drive-sync';
import {
  getDriveSyncHistory,
  getLastDriveSyncTime,
  type DriveSyncErrorCode,
  type DriveSyncHistoryEntry,
} from '../core/drive-sync-history';
import {
  DRIVE_LIBRARY_CHANGED_EVENT,
  DRIVE_LIBRARY_CHANGED_MESSAGE,
  installDriveSyncChangeHooks,
} from '../core/drive-sync-triggers';
import { FavoriteCard } from './components/FavoriteCard';
import { FavoriteCollection } from './components/FavoriteCollection';
import {
  getFavoriteCollectionRevision,
  getFavoriteOrderRevision,
} from './favorite-motion';
import {
  getFavoriteNavigationGeometry,
  type FavoriteCollectionMetrics,
} from './favorite-collection-layout';
import { BookmarkSizeControl } from './components/BookmarkSizeControl';
import { FavoriteDialog } from './components/FavoriteDialog';
import { MoveFavoriteDialog } from './components/MoveFavoriteDialog';
import { GroupDialog } from './components/GroupDialog';
import { GroupTree } from './components/GroupTree';
import { GroupSidebar } from './components/GroupSidebar';
import { GroupedFavoriteSection } from './components/GroupedFavoriteSection';
import { SettingsDialog } from './components/SettingsDialog';
import { FrequentlyVisitedSection } from './components/FrequentlyVisitedSection';
import { DriveSyncChoiceDialog } from './components/DriveSyncChoiceDialog';
import { GoogleDriveSignInDialog } from './components/GoogleDriveSignInDialog';
import {
  ImportExportDialog,
  type ArchiveDialogMode,
} from './components/ImportExportDialog';
import { ChromeBookmarksImportDialog } from './components/ChromeBookmarksImportDialog';
import type { ImportMode, ImportResult } from '../core/import';
import { FileAccessHint } from './components/FileAccessHint';
import {
  clearLibraryDragData,
  getActiveLibraryDragPayload,
  getItemDropTarget,
  listenForLibraryDragEnd,
  readLibraryDragData,
  previewItemOrder,
  resolveItemDropDestination,
  type ItemDropPlacement,
} from './drag';
import { getGroupLabels, getGroupsInTreeOrder } from './group-labels';
import { getGroupedFavoriteView, getItemsByGroupAndDescendants } from './grouped-view';
import { getNavigationTarget } from './keyboard-navigation';

installDriveSyncChangeHooks();

type DialogState =
  | {
      type: 'favorite';
      item?: Item;
      groupId?: string;
      initialUrl?: string;
      initialTitle?: string;
      keepCurrentView?: boolean;
    }
  | { type: 'move-favorite'; item: Item }
  | { type: 'group'; group?: Group; parentId?: string | null }
  | null;

type ArchiveDialogState = ArchiveDialogMode | null;

interface HistoryEntry {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface HistoryStack {
  past: HistoryEntry[];
  future: HistoryEntry[];
}

interface FavoriteDropDestination {
  itemId: string;
  itemIds: string[];
  groupId: string;
  beforeItemId?: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsExiting(true), 5000);
    return () => window.clearTimeout(timeout);
  }, [toast.id]);

  const isError = toast.type === 'error';

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-md border bg-background px-3 py-3 text-sm shadow-lg ${isError ? 'border-danger/30' : 'border-success/30'} ${isExiting ? 'toast-exit' : 'toast-enter'}`}
      onAnimationEnd={(event) => {
        if (
          isExiting &&
          event.animationName === 'toast-exit' &&
          event.target === event.currentTarget
        ) {
          onDismiss(toast.id);
        }
      }}
      role={isError ? 'alert' : 'status'}
    >
      {isError ? (
        <ExclamationCircleIcon
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-danger"
        />
      ) : (
        <CheckCircleIcon
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 shrink-0 text-success"
        />
      )}
      <span className="min-w-0 flex-1 break-words text-text-primary">
        {toast.message}
      </span>
      <button
        aria-label="Dismiss notification"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        onClick={() => setIsExiting(true)}
        type="button"
      >
        <XMarkIcon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

function DriveSyncStatusButton({
  connectionStatus,
  online,
  syncing,
  merged,
  error,
  progress,
  onClick,
}: {
  connectionStatus: DriveConnectionState['status'];
  online: boolean;
  syncing: boolean;
  merged: boolean;
  error?: string;
  progress?: DriveSyncProgress;
  onClick: () => void;
}) {
  const stageLabels: Record<DriveSyncProgress['stage'], string> = {
    checking: 'Checking Google Drive',
    downloading: 'Downloading favorites',
    merging: 'Combining changes',
    uploading: 'Saving favorites',
    'assets-downloading': 'Downloading previews',
    'assets-uploading': 'Saving previews',
    cleaning: 'Cleaning up',
    complete: 'Sync complete',
  };
  let label = 'Google Drive is not connected';
  let icon = <CloudIcon aria-hidden="true" className="h-5 w-5" />;
  let color = 'text-text-secondary';

  if (syncing) {
    label = progress?.stage ? `${stageLabels[progress.stage]}…` : 'Syncing favorites…';
    icon = <ArrowPathIcon aria-hidden="true" className="h-5 w-5 animate-spin" />;
    color = 'text-primary';
  } else if (connectionStatus !== 'disconnected' && !online) {
    label = 'Offline. Click to try syncing your favorites.';
    icon = <NoSymbolIcon aria-hidden="true" className="h-5 w-5" />;
    color = 'text-text-tertiary';
  } else if (connectionStatus === 'authorization-required') {
    label = 'Reconnect Google Drive';
    icon = <ExclamationTriangleIcon aria-hidden="true" className="h-5 w-5" />;
    color = 'text-warning';
  } else if (error) {
    label = 'Sync failed. Click to try again.';
    icon = <ExclamationCircleIcon aria-hidden="true" className="h-5 w-5" />;
    color = 'text-danger';
  } else if (merged) {
    label = 'Favorites synced, including changes from another device.';
    icon = <ExclamationTriangleIcon aria-hidden="true" className="h-5 w-5" />;
    color = 'text-warning';
  } else if (connectionStatus === 'connected') {
    label = 'Sync favorites with Google Drive';
    icon = <CheckCircleIcon aria-hidden="true" className="h-5 w-5" />;
    color = 'text-success';
  } else {
    label = 'Sign in to Google Drive';
  }

  return (
    <button
      aria-label={label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition hover:bg-surface-hover disabled:cursor-wait disabled:opacity-70 ${color}`}
      disabled={syncing}
      onClick={onClick}
      title={label}
      type="button"
    >
      {icon}
    </button>
  );
}

function compareOrder(
  left: { orderKey: string; id: string },
  right: { orderKey: string; id: string },
) {
  return left.orderKey === right.orderKey
    ? left.id.localeCompare(right.id)
    : left.orderKey < right.orderKey
      ? -1
      : 1;
}

function isFavoriteAtDestination(
  items: readonly Item[],
  destination: FavoriteDropDestination,
): boolean {
  const siblings = items
    .filter((item) => item.groupId === destination.groupId)
    .sort(compareOrder);
  const index = siblings.findIndex((item) => item.id === destination.itemIds[0]);
  if (index < 0) return false;
  if (!destination.itemIds.every((id, offset) => siblings[index + offset]?.id === id))
    return false;
  return destination.beforeItemId
    ? siblings[index + destination.itemIds.length]?.id === destination.beforeItemId
    : index + destination.itemIds.length === siblings.length;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The library could not be updated.';
}

export function DashboardApp() {
  const theme = useTheme();
  const { groups, items, loading, error } = useLibrary();
  const optionalFeatures = useOptionalFeatures();
  const visitedSites = useVisitedSites(
    optionalFeatures.ready &&
      (optionalFeatures.showFrequentlyVisited ||
        optionalFeatures.showFrequentlyVisitedOnHome) &&
      optionalFeatures.discoveryEnabled,
  );
  const savedVisitedUrls = useMemo(
    () =>
      new Set(
        items
          .map((item) => normalizeVisitedSiteUrl(item.url))
          .filter((url): url is string => !!url),
      ),
    [items],
  );
  const contextMenuEditorHandled = useRef(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const closeMobileSidebar = useCallback(() => {
    mobileMenuButtonRef.current?.focus();
    setMobileSidebarOpen(false);
  }, []);
  const [homePageGroupId, setHomePageGroupIdState] = useState<string>();
  const [showPreview, setShowPreviewState] = useState(true);
  const [openBehavior, setOpenBehaviorState] = useState<OpenBehavior>('all');
  const [pathOverrides, setPathOverridesState] = useState<PathOverride[]>([]);
  const [fileAccessAllowed, setFileAccessAllowed] = useState<boolean>();
  const [fileAccessHintDismissed, setFileAccessHintDismissed] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [driveConnection, setDriveConnection] = useState<DriveConnectionState>({
    status: 'disconnected',
    account: null,
  });
  const driveAccount = driveConnection.account;
  const syncInProgress = useRef(false);
  const [driveSyncing, setDriveSyncing] = useState(false);
  const [driveSyncError, setDriveSyncError] = useState<string>();
  const [driveSyncErrorCode, setDriveSyncErrorCode] = useState<DriveSyncErrorCode>();
  const [driveSyncMessage, setDriveSyncMessage] = useState<string>();
  const [driveSyncProgress, setDriveSyncProgress] = useState<DriveSyncProgress>();
  const [driveSyncHistory, setDriveSyncHistory] = useState<DriveSyncHistoryEntry[]>([]);
  const [driveSyncMerged, setDriveSyncMerged] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [driveSyncChoicePreview, setDriveSyncChoicePreview] =
    useState<DriveSyncPreview>();
  const [driveSyncChoiceManual, setDriveSyncChoiceManual] = useState(false);
  const [driveSyncChoiceError, setDriveSyncChoiceError] = useState<string>();
  const startupSelectionApplied = useRef(false);
  const initialLastGroupId = useRef<string | null | undefined>(undefined);
  const initialDriveSyncAccount = useRef<string>();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const deselectFavorites = (ids: readonly string[]) => {
    if (ids.length === 0) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next.size === current.size ? current : next;
    });
  };
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [layout, setLayout] = useState<LibraryView>('grid');
  const [groupingMode, setGroupingModeState] = useState<GroupingMode>('hierarchical');
  const [collapsedGroups, setCollapsedGroupsState] = useState(getCollapsedGroups);
  const [bookmarkSizes, setBookmarkSizes] = useState<Record<LibraryView, BookmarkSize>>({
    grid: 'medium',
    list: 'medium',
  });
  const [sizesReady, setSizesReady] = useState(false);
  const sizeSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const bookmarkSize = bookmarkSizes[layout];
  const [dialog, setDialog] = useState<DialogState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'discovery'>();
  const [driveSignInOpen, setDriveSignInOpen] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState<ArchiveDialogState>(null);
  const [chromeImportOpen, setChromeImportOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragPreviewOrder, setDragPreviewOrder] = useState<string[] | null>(null);
  const [draggingFavoriteId, setDraggingFavoriteId] = useState<string | null>(null);
  const [focusedFavoriteId, setFocusedFavoriteId] = useState<string | null>(null);
  const [dragPlaceholderHeight, setDragPlaceholderHeight] = useState(0);
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const dragIdsRef = useRef<string[]>([]);
  const dragCancellationRevision = useRef(0);
  const slotRef = useRef<HTMLDivElement>(null);
  const [dropOrigin, setDropOrigin] = useState<{ left: number; top: number } | null>(
    null,
  );
  const nextToastId = useRef(0);
  const favoriteDropPending = useRef<FavoriteDropDestination | null>(null);
  const favoritePreviewDestination = useRef<FavoriteDropDestination | null>(null);
  const history = useRef<HistoryStack>({ past: [], future: [] });
  const favoriteCollections = useRef(
    new Map<
      HTMLDivElement,
      { items: readonly Item[]; metrics: FavoriteCollectionMetrics }
    >(),
  );
  const [historyVersion, setHistoryVersion] = useState(0);
  const groupLabels = useMemo(() => getGroupLabels(groups), [groups]);
  const groupsInTreeOrder = useMemo(() => getGroupsInTreeOrder(groups), [groups]);
  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  // Drag feedback rerenders the cards without changing their saved sibling order.
  // Build menu availability once per library update, not once per card/render.
  const favoriteMoveAvailability = useMemo(() => {
    const siblingsByGroup = new Map<string, Item[]>();
    for (const item of items) {
      const siblings = siblingsByGroup.get(item.groupId);
      if (siblings) siblings.push(item);
      else siblingsByGroup.set(item.groupId, [item]);
    }
    const result = new Map<string, { canMoveUp: boolean; canMoveDown: boolean }>();
    for (const siblings of siblingsByGroup.values()) {
      siblings.sort(compareOrder);
      siblings.forEach((item, index) => {
        result.set(item.id, {
          canMoveUp: index > 0,
          canMoveDown: index < siblings.length - 1,
        });
      });
    }
    return result;
  }, [items]);
  const selectedGroup = selectedGroupId ? groupsById.get(selectedGroupId) : undefined;
  const hasLocalFiles = useMemo(
    () => items.some((item) => parseSafeUrl(item.url)?.protocol === 'file:'),
    [items],
  );

  const notify = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++nextToastId.current;
    setToasts((current) => [...current, { id, message, type }]);
  }, []);
  const notifyError = useCallback(
    (message: string) => notify(message, 'error'),
    [notify],
  );
  const registerFavoriteCollection = useCallback(
    (
      node: HTMLDivElement,
      collectionItems: readonly Item[],
      metrics: FavoriteCollectionMetrics,
    ) => {
      favoriteCollections.current.set(node, { items: collectionItems, metrics });
      return () => favoriteCollections.current.delete(node);
    },
    [],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useLayoutEffect(() => {
    if (!focusedFavoriteId) return;
    const trigger = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[data-favorite-open]'),
    ).find(
      (button) =>
        button.closest<HTMLElement>('[data-favorite-id]')?.dataset.favoriteId ===
        focusedFavoriteId,
    );
    trigger?.focus();
  }, [focusedFavoriteId]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [debouncedSearch, groupingMode, layout, selectedGroupId]);
  const runDriveSync = useCallback(
    async (
      choice?: DriveSyncChoice,
      options: DriveSyncOptions & { manual?: boolean } = {},
    ) => {
      const manual = options.manual === true;
      if (syncInProgress.current) return;
      syncInProgress.current = true;
      setDriveSyncing(true);
      setDriveSyncError(undefined);
      setDriveSyncErrorCode(undefined);
      setDriveSyncChoiceError(undefined);
      try {
        const result: DriveSyncResult = await syncGoogleDrive(
          choice,
          (progress) => {
            setDriveSyncProgress(progress.stage === 'complete' ? undefined : progress);
            void chrome.runtime
              .sendMessage({ type: 'favoritepod.sync.progress', progress })
              .catch(() => undefined);
          },
          options,
        );
        setDriveSyncProgress(undefined);
        setDriveSyncChoicePreview(undefined);
        setDriveSyncChoiceManual(false);
        setDriveSyncMessage(
          result.status === 'skipped'
            ? 'Another FavoritePod window is already syncing.'
            : result.mergedRemoteChanges
              ? 'Remote changes were merged automatically.'
              : `Last synced at ${new Date(result.syncedAt).toLocaleTimeString()}.`,
        );
        if (manual && result.status === 'synced') notify('Favorites synced.');
      } catch (cause) {
        const message = errorMessage(cause);
        if (manual && cause instanceof DriveSyncOfflineError) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
        }
        if (
          cause instanceof DriveAuthError &&
          (cause.code === 'disconnected' || cause.code === 'authorization-required')
        ) {
          setDriveConnection(await getDriveConnectionState());
          setDriveSyncChoicePreview(undefined);
          setDriveSyncChoiceManual(false);
          setDriveSyncChoiceError(undefined);
          setDriveSyncMessage(undefined);
        } else if (cause instanceof DriveSyncChoiceRequired) {
          setDriveSyncChoicePreview(cause.preview);
          setDriveSyncChoiceManual(manual);
          setDriveSyncChoiceError(undefined);
        } else if (choice) {
          setDriveSyncChoiceError(message);
        } else {
          setDriveSyncError(message);
          setDriveSyncErrorCode(getDriveSyncErrorCode(cause));
        }
        if (manual && !(cause instanceof DriveSyncChoiceRequired)) {
          notify('Failed to sync favorites.', 'error');
        }
      } finally {
        syncInProgress.current = false;
        setDriveSyncing(false);
        setDriveSyncProgress(undefined);
      }
    },
    [notify],
  );
  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);
  const completeImport = (mode: ImportMode, result: ImportResult) => {
    history.current = { past: [], future: [] };
    setHistoryVersion((version) => version + 1);
    setSelectedIds(new Set());
    if (mode === 'replace') setSelectedGroupId(null);
    notify(
      `Imported ${result.importedItems} ${result.importedItems === 1 ? 'favorite' : 'favorites'} and ${result.importedGroups} ${result.importedGroups === 1 ? 'group' : 'groups'}.`,
    );
  };
  const clearFavoriteDrag = useCallback(() => {
    favoriteDropPending.current = null;
    favoritePreviewDestination.current = null;
    dragIdsRef.current = [];
    setDraggedIds([]);
    setDragPreviewOrder(null);
    setDraggingFavoriteId(null);
    setDragPlaceholderHeight(0);
  }, []);

  const cancelFavoriteDrag = useCallback(() => {
    if (!dragIdsRef.current.length || favoriteDropPending.current) return;
    dragCancellationRevision.current += 1;
    clearLibraryDragData();
    clearFavoriteDrag();
  }, [clearFavoriteDrag]);

  useEffect(() => listenForLibraryDragEnd(cancelFavoriteDrag), [cancelFavoriteDrag]);

  useEffect(() => {
    if (error) notifyError(error);
  }, [error, notifyError]);

  useEffect(() => {
    if (optionalFeatures.error) notifyError(optionalFeatures.error);
  }, [notifyError, optionalFeatures.error]);

  useEffect(() => {
    if (loading || contextMenuEditorHandled.current) return;
    contextMenuEditorHandled.current = true;
    const location = new URL(window.location.href);
    const urlValue = location.searchParams.get('addFavoriteUrl');
    if (!urlValue) return;
    const parsed = parseSafeUrl(urlValue);
    const title = location.searchParams.get('addFavoriteTitle') ?? undefined;
    const groupId = location.searchParams.get('addFavoriteGroupId') ?? undefined;
    for (const key of ['addFavoriteUrl', 'addFavoriteTitle', 'addFavoriteGroupId']) {
      location.searchParams.delete(key);
    }
    window.history.replaceState(null, '', location);
    if (!parsed) {
      notifyError(INVALID_URL_MESSAGE);
      return;
    }
    const existing = items.find((item) => parseSafeUrl(item.url)?.href === parsed.href);
    setDialog({
      type: 'favorite',
      item: existing,
      initialUrl: parsed.href,
      initialTitle: title,
      groupId: groupId && groupsById.has(groupId) ? groupId : undefined,
    });
  }, [groupsById, items, loading, notifyError]);

  useEffect(() => {
    if (!hasLocalFiles) {
      setFileAccessAllowed(undefined);
      return;
    }
    let active = true;
    const refreshAccess = () => {
      void hasFileAccess().then((allowed) => {
        if (active) setFileAccessAllowed(allowed);
      });
    };
    refreshAccess();
    window.addEventListener('focus', refreshAccess);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshAccess);
    };
  }, [hasLocalFiles]);

  useEffect(() => {
    void Promise.all([
      getDefaultView(),
      getOpenBehavior(),
      getHomePageGroupId(),
      getLastSelectedGroupId(),
      getSidebarCollapsed(),
      getShowPreview(),
      getPathOverrides(),
      getGroupingMode(),
    ])
      .then(
        ([
          view,
          behavior,
          homeGroupId,
          lastGroupId,
          collapsed,
          preview,
          overrides,
          grouping,
        ]) => {
          if (view) setLayout(view);
          setOpenBehaviorState(behavior);
          setHomePageGroupIdState(homeGroupId);
          setSidebarCollapsedState(collapsed);
          setShowPreviewState(preview);
          setPathOverridesState(overrides);
          setGroupingModeState(grouping);
          initialLastGroupId.current = lastGroupId;
          setSettingsLoaded(true);
        },
      )
      .catch((cause: unknown) => notifyError(errorMessage(cause)));
  }, [notifyError]);

  useEffect(() => {
    const subscription = liveQuery(async () => ({
      entries: await getDriveSyncHistory(),
      lastSyncedAt: await getLastDriveSyncTime(),
    })).subscribe({
      next: ({ entries, lastSyncedAt }) => {
        setDriveSyncHistory(entries);
        const latest = entries[0];
        if (latest?.status === 'synced' || latest?.status === 'merged') {
          setDriveSyncError(undefined);
          setDriveSyncErrorCode(undefined);
          const recentMerge =
            latest.status === 'merged' &&
            Date.now() - Date.parse(latest.completedAt) < 6000;
          setDriveSyncMerged(recentMerge);
          setDriveSyncMessage(
            recentMerge
              ? latest.message
              : `Last synced at ${new Date(latest.completedAt).toLocaleTimeString()}.`,
          );
        } else if (latest?.status === 'failed') {
          setDriveSyncMerged(false);
          setDriveSyncError(
            latest.errorCode === 'authorization-required' ? undefined : latest.message,
          );
          setDriveSyncErrorCode(
            latest.errorCode === 'authorization-required' ? undefined : latest.errorCode,
          );
          setDriveSyncMessage(undefined);
        } else {
          setDriveSyncMerged(false);
          setDriveSyncMessage(
            lastSyncedAt
              ? `Last synced at ${new Date(lastSyncedAt).toLocaleTimeString()}.`
              : undefined,
          );
        }
      },
      error: (cause: unknown) => notifyError(errorMessage(cause)),
    });
    return () => subscription.unsubscribe();
  }, [notifyError]);

  useEffect(() => {
    if (!driveSyncMerged) return;
    const timeout = window.setTimeout(() => setDriveSyncMerged(false), 6000);
    return () => window.clearTimeout(timeout);
  }, [driveSyncMerged]);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);
    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  useEffect(() => {
    const subscription = liveQuery(getDriveConnectionState).subscribe({
      next: (connection) => {
        const applyConnection = (current: DriveConnectionState) => {
          setDriveConnection((previous) =>
            JSON.stringify(previous) === JSON.stringify(current) ? previous : current,
          );
          if (current.status !== 'connected') {
            setDriveSyncChoicePreview(undefined);
            setDriveSyncChoiceManual(false);
            setDriveSyncChoiceError(undefined);
            setDriveSyncMessage(undefined);
            setDriveSyncError(undefined);
            setDriveSyncErrorCode(undefined);
            setDriveSyncProgress(undefined);
          }
        };

        if (connection.status === 'connected') {
          applyConnection(connection);
          return;
        }

        // IndexedDB observers can deliver the old disconnected state while a
        // connection transaction is settling. Re-read the persisted state
        // before clearing a pending first-sync choice dialog.
        void getDriveConnectionState()
          .then((current) => {
            if (current.status === 'connected') return;
            applyConnection(current);
          })
          .catch((cause: unknown) => notifyError(errorMessage(cause)));
      },
      error: (cause: unknown) => notifyError(errorMessage(cause)),
    });
    return () => subscription.unsubscribe();
  }, [notifyError]);

  useEffect(() => {
    if (driveConnection.status !== 'connected' || !driveAccount) {
      initialDriveSyncAccount.current = undefined;
      return;
    }
    if (!settingsLoaded || loading) return;
    if (initialDriveSyncAccount.current === driveAccount.emailAddress) return;
    initialDriveSyncAccount.current = driveAccount.emailAddress;
    void runDriveSync();
  }, [driveAccount, driveConnection.status, loading, runDriveSync, settingsLoaded]);

  useEffect(() => {
    if (driveConnection.status !== 'connected') return;
    let debounce: number | undefined;
    const scheduleSync = () => {
      if (debounce !== undefined) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = undefined;
        void runDriveSync();
      }, 10_000);
    };
    const handleOnline = () => void runDriveSync();
    const handleRuntimeMessage = (message: unknown) => {
      if (typeof message !== 'object' || message === null || !('type' in message)) {
        return;
      }
      if (message.type === DRIVE_LIBRARY_CHANGED_MESSAGE) scheduleSync();
      if (
        message.type === 'favoritepod.sync.progress' &&
        'progress' in message &&
        typeof message.progress === 'object' &&
        message.progress !== null &&
        'stage' in message.progress
      ) {
        const progress = message.progress as DriveSyncProgress;
        setDriveSyncProgress(progress.stage === 'complete' ? undefined : progress);
        setDriveSyncing(progress.stage !== 'complete');
      }
      if (
        message.type === 'favoritepod.sync.choice-required' &&
        'preview' in message &&
        typeof message.preview === 'object' &&
        message.preview !== null
      ) {
        setDriveSyncChoicePreview(message.preview as DriveSyncPreview);
        setDriveSyncProgress(undefined);
        setDriveSyncing(false);
      }
      if (message.type === 'favoritepod.sync.completed') {
        setDriveSyncError(undefined);
        setDriveSyncErrorCode(undefined);
        setDriveSyncProgress(undefined);
        setDriveSyncing(false);
      }
      if (
        message.type === 'favoritepod.sync.failed' &&
        'message' in message &&
        typeof message.message === 'string'
      ) {
        const errorCode =
          'code' in message && typeof message.code === 'string'
            ? (message.code as DriveSyncErrorCode)
            : 'sync-error';
        if (errorCode === 'authorization-required') {
          void getDriveConnectionState().then(setDriveConnection);
          setDriveSyncError(undefined);
          setDriveSyncErrorCode(undefined);
        } else {
          setDriveSyncError(message.message);
          setDriveSyncErrorCode(errorCode);
        }
        setDriveSyncProgress(undefined);
        setDriveSyncing(false);
      }
    };
    window.addEventListener(DRIVE_LIBRARY_CHANGED_EVENT, scheduleSync);
    window.addEventListener('online', handleOnline);
    chrome.runtime.onMessage.addListener(handleRuntimeMessage);
    return () => {
      if (debounce !== undefined) window.clearTimeout(debounce);
      window.removeEventListener(DRIVE_LIBRARY_CHANGED_EVENT, scheduleSync);
      window.removeEventListener('online', handleOnline);
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [driveConnection.status, runDriveSync]);

  useEffect(() => {
    if (!settingsLoaded || loading || startupSelectionApplied.current) return;
    startupSelectionApplied.current = true;
    let initialGroupId: string | null = null;
    if (openBehavior === 'home') {
      initialGroupId =
        homePageGroupId && groupsById.has(homePageGroupId) ? homePageGroupId : null;
    } else if (openBehavior === 'last') {
      const lastGroupId = initialLastGroupId.current;
      initialGroupId = lastGroupId && groupsById.has(lastGroupId) ? lastGroupId : null;
    }
    setSelectedGroupId(initialGroupId);
  }, [groupsById, homePageGroupId, loading, openBehavior, settingsLoaded]);

  useEffect(() => {
    const destination = favoriteDropPending.current;
    if (destination && isFavoriteAtDestination(items, destination)) {
      clearFavoriteDrag();
    }
  }, [clearFavoriteDrag, items]);

  useEffect(() => {
    let active = true;
    void Promise.all([getBookmarkSize('grid'), getBookmarkSize('list')])
      .then(([grid, list]) => {
        if (active) setBookmarkSizes({ grid, list });
      })
      .catch(() => {
        if (active) notifyError('Could not load bookmark sizes.');
      })
      .finally(() => {
        if (active) setSizesReady(true);
      });
    return () => {
      active = false;
    };
  }, [notifyError]);

  const changeBookmarkSize = (size: BookmarkSize) => {
    setBookmarkSizes((current) => ({ ...current, [layout]: size }));
    sizeSaveQueue.current = sizeSaveQueue.current
      .then(() => setBookmarkSize(layout, size))
      .catch(() =>
        notifyError('Could not save bookmark size. Choose a size again to retry.'),
      );
  };

  const registerHistory = (entry: HistoryEntry) => {
    history.current.past.push(entry);
    history.current.future = [];
    setHistoryVersion((version) => version + 1);
  };

  const undo = useCallback(async () => {
    const entry = history.current.past.at(-1);
    if (!entry) return;
    try {
      await entry.undo();
      history.current.past.pop();
      history.current.future.push(entry);
      setHistoryVersion((version) => version + 1);
      notify(`Undid ${entry.label}.`);
    } catch (cause) {
      notifyError(errorMessage(cause));
    }
  }, [notify, notifyError]);

  const redo = useCallback(async () => {
    const entry = history.current.future.at(-1);
    if (!entry) return;
    try {
      await entry.redo();
      history.current.future.pop();
      history.current.past.push(entry);
      setHistoryVersion((version) => version + 1);
      notify(`Redid ${entry.label}.`);
    } catch (cause) {
      notifyError(errorMessage(cause));
    }
  }, [notify, notifyError]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.altKey) return;
      if (
        document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]') ||
        draggingFavoriteId
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) void redo();
      else void undo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [draggingFavoriteId, redo, undo]);

  const saveDefaultView = async (view: LibraryView) => {
    await setDefaultView(view);
    setLayout(view);
  };

  const saveGroupingMode = async (mode: GroupingMode) => {
    await setGroupingMode(mode);
    setGroupingModeState(mode);
    clearFavoriteDrag();
  };

  const toggleGroupCollapse = (groupId: string) => {
    const next = new Set(collapsedGroups);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setCollapsedGroupsState(next);
    setCollapsedGroups(next);
  };

  const selectGroup = (groupId: string | null) => {
    setSelectedGroupId(groupId);
    void setLastSelectedGroupId(groupId).catch((cause: unknown) =>
      notifyError(errorMessage(cause)),
    );
  };

  const savePreviewVisibility = async (show: boolean) => {
    await setShowPreview(show);
    setShowPreviewState(show);
  };

  const editVisitedSite = (site: VisitedSiteSuggestion) => {
    const item = items.find(
      (favorite) => normalizeVisitedSiteUrl(favorite.url) === site.url,
    );
    setDialog({
      type: 'favorite',
      item,
      initialUrl: site.url,
      initialTitle: site.title,
      keepCurrentView: true,
    });
  };

  const saveSidebarCollapsed = async (collapsed: boolean) => {
    await setSidebarCollapsed(collapsed);
    setSidebarCollapsedState(collapsed);
  };

  const saveOpenBehavior = async (behavior: OpenBehavior) => {
    await setOpenBehavior(behavior);
    setOpenBehaviorState(behavior);
  };

  const saveLocalPathOverrides = async (overrides: PathOverride[]) => {
    await persistPathOverrides(overrides);
    setPathOverridesState(await getPathOverrides());
    notify('File locations saved for this device.');
  };

  const applyDriveConnectionResult = async (result: DriveConnectionResult) => {
    if (result.status === 'connected') {
      initialDriveSyncAccount.current = result.account.emailAddress;
      setDriveConnection({ status: 'connected', account: result.account });
      await runDriveSync(undefined, { waitForLock: true });
    }
    return result;
  };

  const handleConnectDrive = async () => {
    const result = await withGoogleDriveSyncLock(() => connectGoogleDrive());
    if (result === null) {
      throw new Error('Google Drive is syncing. Wait for sync to finish, then connect.');
    }
    return applyDriveConnectionResult(result);
  };

  const handlePrepareDriveConnection = () => prepareGoogleDriveConnection();

  const handleConfirmDriveConnection = async (account: DriveAccount) => {
    const result = await withGoogleDriveSyncLock(() =>
      confirmGoogleDriveConnection(account),
    );
    if (result === null) {
      throw new Error('Google Drive is syncing. Wait for sync to finish, then connect.');
    }
    return applyDriveConnectionResult(result);
  };

  const handleCancelDriveConnection = () => cancelGoogleDriveConnection();

  const handleSwitchDriveAccount = async (account: DriveAccount) => {
    const switched = await withGoogleDriveSyncLock(() =>
      switchGoogleDriveAccount(account),
    );
    if (switched === null) {
      throw new Error(
        'Google Drive is syncing. Wait for sync to finish, then switch accounts.',
      );
    }
    initialDriveSyncAccount.current = account.emailAddress;
    setDriveConnection({ status: 'connected', account });
    await runDriveSync(undefined, { waitForLock: true });
  };

  const handleDisconnectDrive = async () => {
    const result = await withGoogleDriveSyncLock(() => disconnectGoogleDrive());
    if (result === null) {
      throw new Error(
        'Google Drive is syncing. Wait for sync to finish, then disconnect.',
      );
    }
    setDriveConnection({ status: 'disconnected', account: null });
  };

  const handleDriveStatusClick = () => {
    if (driveSyncing) return;
    if (
      driveConnection.status === 'disconnected' ||
      driveConnection.status === 'authorization-required'
    ) {
      setDriveSignInOpen(true);
      return;
    }
    void runDriveSync(undefined, { manual: true });
  };

  const handleFileAccessDenied = () => {
    setFileAccessAllowed(false);
    setFileAccessHintDismissed(false);
  };

  const selectHomePage = async (groupId?: string) => {
    await setHomePageGroupId(groupId);
    setHomePageGroupIdState(groupId);
    if (groupId) {
      setOpenBehaviorState('home');
      notify('Home page group updated.');
    } else {
      if (openBehavior === 'home') setOpenBehaviorState('all');
      notify('Home page group removed.');
    }
  };

  const visibleItems = useMemo(() => {
    const scope = new Set<string>();
    if (selectedGroupId) {
      scope.add(selectedGroupId);
      let changed = true;
      while (changed) {
        changed = false;
        for (const group of groups) {
          if (group.parentId && scope.has(group.parentId) && !scope.has(group.id)) {
            scope.add(group.id);
            changed = true;
          }
        }
      }
    }
    const searchTerm = debouncedSearch.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (!optionalFeatures.showHiddenBookmarks && isHiddenOnThisPlatform(item.url))
        return false;
      if (selectedGroupId && !scope.has(item.groupId)) return false;
      if (!searchTerm) return true;
      return `${item.title} ${item.url}`.toLocaleLowerCase().includes(searchTerm);
    });
  }, [
    debouncedSearch,
    groups,
    items,
    selectedGroupId,
    optionalFeatures.showHiddenBookmarks,
  ]);

  const groupedView = useMemo(
    () => getGroupedFavoriteView(groups, visibleItems, selectedGroupId, groupingMode),
    [groups, visibleItems, selectedGroupId, groupingMode],
  );
  const selectedDragIds = useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)).map((item) => item.id),
    [selectedIds, visibleItems],
  );
  const itemsByGroup = useMemo(
    () => getItemsByGroupAndDescendants(groups, visibleItems),
    [groups, visibleItems],
  );
  const searching = debouncedSearch.trim().length > 0;
  const sectionGroups =
    groupedView.mode === 'hierarchical'
      ? groupedView.groups.filter(
          (group) => !searching || (itemsByGroup.get(group.id)?.length ?? 0) > 0,
        )
      : [];
  const orderedVisibleItems =
    groupedView.mode === 'labeled' ? groupedView.items : visibleItems;
  const dragOrderItems = useMemo(
    () =>
      groupedView.mode === 'labeled'
        ? [...items].sort(
            (left, right) =>
              (groupLabels.get(left.groupId) ?? '').localeCompare(
                groupLabels.get(right.groupId) ?? '',
              ) || compareOrder(left, right),
          )
        : items,
    [groupLabels, groupedView.mode, items],
  );

  const dragPreviewRank = useMemo(() => {
    if (!dragPreviewOrder) return null;
    return new Map(dragPreviewOrder.map((id, index) => [id, index]));
  }, [dragPreviewOrder]);

  const previewFavoriteDrop = (
    itemId: string,
    targetItemId: string,
    placement: ItemDropPlacement,
  ) => {
    const next = previewItemOrder(
      dragOrderItems.map((item) => item.id),
      itemId,
      targetItemId,
      placement,
      dragIdsRef.current,
    );
    if (!next) return;
    const destination = resolveItemDropDestination(
      items,
      itemId,
      targetItemId,
      placement,
      dragIdsRef.current,
    );
    if (!destination) return;
    favoritePreviewDestination.current = {
      itemId,
      itemIds: dragIdsRef.current,
      ...destination,
    };
    setDragPreviewOrder((current) =>
      current?.length === next.length && current.every((id, index) => id === next[index])
        ? current
        : next,
    );
  };

  const startFavoriteDrag = (itemId: string, height: number) => {
    const ids = orderedVisibleItems
      .filter((item) =>
        selectedIds.has(itemId) ? selectedIds.has(item.id) : item.id === itemId,
      )
      .map((item) => item.id);
    // Move focus before React hides any selected card, including focused siblings.
    const focusedOwner = document.activeElement?.closest<HTMLElement>(
      '[data-favorite-id], [data-favorite-menu]',
    );
    const focusedId =
      focusedOwner?.dataset.favoriteId ?? focusedOwner?.dataset.favoriteMenu;
    if (focusedId && ids.includes(focusedId)) {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    }
    dragIdsRef.current = ids;
    setDraggedIds(ids);
    setDropOrigin(null);
    favoriteDropPending.current = null;
    const first = items.find((item) => item.id === ids[0])!;
    const originalIndex = dragOrderItems.findIndex((item) => item.id === first.id);
    const remaining = dragOrderItems.filter((item) => !ids.includes(item.id));
    const next = dragOrderItems
      .slice(originalIndex)
      .find((item) => !ids.includes(item.id));
    const index = next
      ? remaining.findIndex((item) => item.id === next.id)
      : remaining.length;
    const order = remaining.map((item) => item.id);
    order.splice(index, 0, ...ids);
    favoritePreviewDestination.current = {
      itemId,
      itemIds: ids,
      groupId: first.groupId,
      beforeItemId: dragOrderItems
        .slice(originalIndex)
        .find((item) => item.groupId === first.groupId && !ids.includes(item.id))?.id,
    };
    setDraggingFavoriteId(itemId);
    setDragPlaceholderHeight(height);
    setDragPreviewOrder(order);
  };

  const moveDraggedFavorites = async (
    ids: string[],
    groupId: string,
    beforeItemId?: string,
  ) => {
    const before = ids
      .map((id) => items.find((item) => item.id === id)!)
      .map(({ id, groupId, orderKey }) => ({ id, groupId, orderKey }));
    const moved = await moveItems(ids, groupId, beforeItemId);
    deselectFavorites(ids);
    const after = moved.map(({ id, groupId, orderKey }) => ({ id, groupId, orderKey }));
    registerHistory({
      label: `${ids.length} favorites moved`,
      undo: () => restoreItemPositions(before),
      redo: () => restoreItemPositions(after),
    });
  };

  const dropFavorite = async (itemId: string) => {
    if (favoriteDropPending.current) return;
    // Commit the destination that produced the visible preview. Re-hit-testing
    // a moving tile on release can select a different insertion point.
    const pendingDestination = favoritePreviewDestination.current;
    if (!pendingDestination || pendingDestination.itemId !== itemId) {
      clearFavoriteDrag();
      return;
    }
    favoriteDropPending.current = pendingDestination;
    const rect = slotRef.current?.getBoundingClientRect();
    setDropOrigin(rect ? { left: rect.left, top: rect.top } : null);
    try {
      await moveDraggedFavorites(
        pendingDestination.itemIds,
        pendingDestination.groupId,
        pendingDestination.beforeItemId,
      );
      if (isFavoriteAtDestination(items, pendingDestination)) clearFavoriteDrag();
    } catch (cause) {
      clearFavoriteDrag();
      notifyError(errorMessage(cause));
    }
  };

  const dropIntoGroup = (groupId: string) => {
    const payload = getActiveLibraryDragPayload();
    if (payload?.type !== 'item') return;
    const ids = dragIdsRef.current.length ? [...dragIdsRef.current] : [payload.id];
    const destination = { itemId: payload.id, itemIds: ids, groupId };
    favoriteDropPending.current = destination;
    favoritePreviewDestination.current = destination;
    setDropOrigin(null);
    setDragPreviewOrder(null);
    clearLibraryDragData();
    void moveDraggedFavorites(ids, groupId)
      .then(() => {
        if (isFavoriteAtDestination(items, destination)) clearFavoriteDrag();
        notify(
          `Moved ${ids.length} ${ids.length === 1 ? 'favorite' : 'favorites'} to ${groupLabels.get(groupId) ?? 'the selected group'}.`,
        );
      })
      .catch((cause) => {
        clearFavoriteDrag();
        notifyError(errorMessage(cause));
      });
  };

  const selectedVisibleItems = useMemo(
    () => visibleItems.filter((item) => selectedIds.has(item.id)),
    [selectedIds, visibleItems],
  );
  const allVisibleSelected =
    visibleItems.length > 0 && selectedVisibleItems.length === visibleItems.length;
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;
  void historyVersion;

  useEffect(() => {
    const visibleIds = new Set(visibleItems.map((item) => item.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleItems]);

  const saveFavorite = async (value: {
    title: string;
    url: string;
    groupId?: string;
  }): Promise<Item> => {
    if (dialog?.type !== 'favorite') throw new Error('The favorite editor is closed.');
    if (dialog.item) {
      const previous = dialog.item;
      const saved = await updateItem(previous.id, value);
      const before: ItemPosition & Pick<Item, 'title' | 'url'> = {
        id: previous.id,
        title: previous.title,
        url: previous.url,
        groupId: previous.groupId,
        orderKey: previous.orderKey,
      };
      const after: ItemPosition & Pick<Item, 'title' | 'url'> = {
        id: saved.id,
        title: saved.title,
        url: saved.url,
        groupId: saved.groupId,
        orderKey: saved.orderKey,
      };
      if (
        before.title !== after.title ||
        before.url !== after.url ||
        before.groupId !== after.groupId ||
        before.orderKey !== after.orderKey
      ) {
        registerHistory({
          label: 'favorite edit',
          undo: async () => {
            await updateItem(previous.id, before);
          },
          redo: async () => {
            await updateItem(saved.id, after);
          },
        });
      }
      notify('Favorite updated.');
      return saved;
    }

    const created = await createItem(value);
    if (!dialog.keepCurrentView) setSelectedGroupId(value.groupId ?? created.groupId);
    notify('Favorite added.');
    registerHistory({
      label: 'favorite added',
      undo: async () => deleteItem(created.id),
      redo: async () => {
        await restoreItem(created.id);
      },
    });
    return created;
  };

  const saveGroup = async (value: { title: string; parentId: string | null }) => {
    if (dialog?.type !== 'group') throw new Error('The group editor is closed.');
    if (dialog.group) {
      const previous = dialog.group;
      const saved = await updateGroup(previous.id, value);
      const before = {
        title: previous.title,
        parentId: previous.parentId,
        orderKey: previous.orderKey,
      };
      const after = {
        title: saved.title,
        parentId: saved.parentId,
        orderKey: saved.orderKey,
      };
      if (
        before.title !== after.title ||
        before.parentId !== after.parentId ||
        before.orderKey !== after.orderKey
      ) {
        registerHistory({
          label: 'group edit',
          undo: async () => {
            await updateGroup(previous.id, before);
          },
          redo: async () => {
            await updateGroup(saved.id, after);
          },
        });
      }
      notify('Group updated.');
      return;
    }

    const created = await createGroup(value);
    setSelectedGroupId(created.id);
    notify('Group created.');
    registerHistory({
      label: 'group created',
      undo: async () => deleteGroup(created.id),
      redo: async () => {
        await restoreGroup(created.id);
      },
    });
  };

  const deleteFavorite = async (item: Item): Promise<boolean> => {
    if (!window.confirm(`Delete “${item.title}”?`)) return false;
    await deleteItem(item.id);
    registerHistory({
      label: 'favorite deleted',
      undo: async () => {
        await restoreItem(item.id);
      },
      redo: async () => deleteItem(item.id),
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    notify('Favorite deleted.');
    return true;
  };

  const updateFavoriteThumbnail = async (
    item: Item,
    thumbnail: Parameters<typeof updateItemThumbnail>[1],
  ) => {
    const previous = await db.items.get(item.id);
    if (!previous || isItemDeleted(previous)) throw new Error('Favorite not found.');
    const previousHash = previous.previewHash;
    const updated = await updateItemThumbnail(item.id, thumbnail, previous);
    if (updated.previewHash !== previousHash) {
      registerHistory({
        label: 'thumbnail update',
        undo: async () => {
          await updateItem(item.id, { previewHash: previousHash });
        },
        redo: async () => {
          await updateItemThumbnail(item.id, thumbnail);
        },
      });
    }
    notify(thumbnail ? 'Thumbnail updated.' : 'Image removed.');
    return updated;
  };

  const removeGroup = async (group: Group): Promise<boolean> => {
    if (!window.confirm(`Delete group “${group.title}” and all its subgroups?`))
      return false;
    const deletedGroupIds = new Set([group.id]);
    const pending = [group.id];
    while (pending.length > 0) {
      const parentId = pending.pop()!;
      for (const child of groups) {
        if (child.parentId === parentId && !deletedGroupIds.has(child.id)) {
          deletedGroupIds.add(child.id);
          pending.push(child.id);
        }
      }
    }

    await deleteGroup(group.id);
    registerHistory({
      label: 'group deleted',
      undo: async () => {
        await restoreGroup(group.id);
      },
      redo: async () => deleteGroup(group.id),
    });
    if (selectedGroupId && deletedGroupIds.has(selectedGroupId))
      selectGroup(group.parentId);
    if (homePageGroupId && deletedGroupIds.has(homePageGroupId)) {
      await setHomePageGroupId();
      setHomePageGroupIdState(undefined);
      if (openBehavior === 'home') setOpenBehaviorState('all');
    }
    notify('Group deleted.');
    return true;
  };

  const moveFavorite = async (itemId: string, groupId: string, beforeItemId?: string) => {
    const previous = items.find((item) => item.id === itemId);
    if (!previous) return;
    const saved = await moveItem(itemId, groupId, beforeItemId);
    if (previous.groupId === saved.groupId && previous.orderKey === saved.orderKey)
      return;
    const before: ItemPosition = {
      id: previous.id,
      groupId: previous.groupId,
      orderKey: previous.orderKey,
    };
    const after: ItemPosition = {
      id: saved.id,
      groupId: saved.groupId,
      orderKey: saved.orderKey,
    };
    registerHistory({
      label: previous.groupId === groupId ? 'favorite reordered' : 'favorite moved',
      undo: () => restoreItemPositions([before]),
      redo: () => restoreItemPositions([after]),
    });
    deselectFavorites([itemId]);
    notify(previous.groupId === groupId ? 'Favorite reordered.' : 'Favorite moved.');
  };

  const handleMoveFavorite = async (
    itemId: string,
    groupId: string,
    beforeItemId?: string,
  ): Promise<boolean> => {
    try {
      await moveFavorite(itemId, groupId, beforeItemId);
      return true;
    } catch (cause) {
      notifyError(errorMessage(cause));
      return false;
    }
  };

  const handleMoveGroup = async (
    groupId: string,
    parentId: string | null,
    beforeId?: string,
  ) => {
    const previous = groups.find((group) => group.id === groupId);
    if (!previous) return;
    try {
      const saved = await moveGroup(groupId, parentId, beforeId);
      if (saved.parentId === previous.parentId && saved.orderKey === previous.orderKey)
        return;
      const before = {
        title: previous.title,
        parentId: previous.parentId,
        orderKey: previous.orderKey,
      };
      const after = {
        title: saved.title,
        parentId: saved.parentId,
        orderKey: saved.orderKey,
      };
      registerHistory({
        label: previous.parentId === saved.parentId ? 'group reordered' : 'group moved',
        undo: async () => {
          await updateGroup(previous.id, before);
        },
        redo: async () => {
          await updateGroup(saved.id, after);
        },
      });
      notify(previous.parentId === saved.parentId ? 'Group reordered.' : 'Group moved.');
    } catch (cause) {
      notifyError(errorMessage(cause));
    }
  };

  const moveSelected = async (groupId: string) => {
    const selected = visibleItems.filter((item) => selectedIds.has(item.id));
    if (!selected.length) return;
    const changing = selected.filter((item) => item.groupId !== groupId);
    if (!changing.length) {
      setSelectedIds(new Set());
      return;
    }
    const before: ItemPosition[] = selected.map((item) => ({
      id: item.id,
      groupId: item.groupId,
      orderKey: item.orderKey,
    }));
    try {
      const moved = await moveItems(
        changing.map((item) => item.id),
        groupId,
      );
      registerHistory({
        label: `${moved.length} favorites moved`,
        undo: () => restoreItemPositions(before),
        redo: async () => {
          await moveItems(
            moved.map((item) => item.id),
            groupId,
          );
        },
      });
      setSelectedIds(new Set());
      notify(
        `Moved ${moved.length} favorites to ${groupLabels.get(groupId) ?? 'the selected group'}.`,
      );
    } catch (cause) {
      notifyError(errorMessage(cause));
    }
  };

  const deleteSelected = async () => {
    const selected = visibleItems.filter((item) => selectedIds.has(item.id));
    if (!selected.length) return;
    const label = selected.length === 1 ? 'favorite' : `${selected.length} favorites`;
    if (!window.confirm(`Delete ${label}?`)) return;
    const ids = selected.map((item) => item.id);
    try {
      await deleteItems(ids);
      registerHistory({
        label: `${selected.length} favorites deleted`,
        undo: () => restoreItems(ids),
        redo: () => deleteItems(ids),
      });
      setSelectedIds(new Set());
      notify(`Deleted ${label}.`);
    } catch (cause) {
      notifyError(errorMessage(cause));
    }
  };

  const reorderFavorite = (item: Item, direction: -1 | 1) => {
    const siblings = items
      .filter((candidate) => candidate.groupId === item.groupId)
      .sort(compareOrder);
    const index = siblings.findIndex((candidate) => candidate.id === item.id);
    if (index < 0) return;
    const beforeItemId =
      direction < 0 ? siblings[index - 1]?.id : siblings[index + 2]?.id;
    void handleMoveFavorite(item.id, item.groupId, beforeItemId);
  };

  const toggleSelected = (item: Item) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const item of visibleItems) next.delete(item.id);
        return next;
      });
      return;
    }
    setSelectedIds(
      (current) => new Set([...current, ...visibleItems.map((item) => item.id)]),
    );
  };

  const renderFavoriteCollection = (collectionItems: readonly Item[]) => {
    const collectionRevision = getFavoriteCollectionRevision(collectionItems);
    const showPlaceholder =
      !!draggingFavoriteId &&
      !!dragPreviewRank?.has(draggedIds[0]) &&
      (groupedView.mode !== 'hierarchical' ||
        favoritePreviewDestination.current?.groupId === collectionItems[0]?.groupId);
    const orderRevision = getFavoriteOrderRevision(
      collectionItems,
      dragPreviewRank,
      showPlaceholder ? draggedIds[0] : undefined,
    );
    return (
      <FavoriteCollection
        items={collectionItems}
        layout={layout}
        size={bookmarkSize}
        hasGroupLabels={groupedView.mode === 'labeled'}
        draggedIds={draggingFavoriteId ? draggedIds : []}
        draggingFavoriteId={draggingFavoriteId}
        focusedFavoriteId={focusedFavoriteId}
        dragPreviewRank={dragPreviewRank}
        showPlaceholder={showPlaceholder}
        placeholder={
          showPlaceholder ? (
            <div
              ref={slotRef}
              aria-hidden="true"
              className="pointer-events-none min-w-0 rounded-lg border-2 border-dashed border-primary/70 bg-primary-light/35 shadow-sm"
              style={{ height: dragPlaceholderHeight }}
            />
          ) : null
        }
        onRegister={registerFavoriteCollection}
        onDragOver={(event) => {
          const payload = getActiveLibraryDragPayload();
          if (payload?.type !== 'item') return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          const collection = event.currentTarget;
          const rect = collection.getBoundingClientRect();
          const slots = Array.from(
            collection.querySelectorAll<HTMLElement>('[data-favorite-id]'),
          )
            .filter((card) => !dragIdsRef.current.includes(card.dataset.favoriteId!))
            .map((card) => {
              const slot =
                card.closest<HTMLElement>('.bookmark-virtual-slot, .favorite-entry') ??
                card;
              const bounds = slot.getBoundingClientRect();
              return {
                id: card.dataset.favoriteId!,
                left: bounds.left - rect.left,
                top: bounds.top - rect.top,
                width: bounds.width,
                height: bounds.height,
              };
            });
          const target = getItemDropTarget(
            event.clientX - rect.left,
            event.clientY - rect.top,
            slots,
            layout,
          );
          // Keep the previous destination over a gap or the stack placeholder.
          if (target) previewFavoriteDrop(payload.id, target.targetId, target.placement);
        }}
        renderItem={(item) => {
          const moveAvailability = favoriteMoveAvailability.get(item.id)!;
          return (
            <FavoriteCard
              orderRevision={orderRevision}
              collectionRevision={collectionRevision}
              animateReorder
              cancellationRevision={dragCancellationRevision.current}
              canMoveDown={moveAvailability.canMoveDown}
              canMoveUp={moveAvailability.canMoveUp}
              item={item}
              key={item.id}
              groupLabel={
                groupedView.mode === 'labeled' ? groupLabels.get(item.groupId) : undefined
              }
              layout={layout}
              size={bookmarkSize}
              showPreview={showPreview && !dialog && !draggingFavoriteId}
              pathOverrides={pathOverrides}
              sortOrder={
                dragPreviewRank
                  ? (dragPreviewRank.get(item.id) ?? dragPreviewOrder?.length)
                  : undefined
              }
              isDragging={!!draggingFavoriteId && draggedIds.includes(item.id)}
              dropOrigin={dropOrigin}
              dragItemIds={selectedIds.has(item.id) ? selectedDragIds : [item.id]}
              onDragStart={startFavoriteDrag}
              onDragEnd={cancelFavoriteDrag}
              onDelete={(selected) =>
                void deleteFavorite(selected).catch((cause) =>
                  notifyError(errorMessage(cause)),
                )
              }
              onEdit={(selected) => setDialog({ type: 'favorite', item: selected })}
              onMove={(selected) => setDialog({ type: 'move-favorite', item: selected })}
              onMoveDown={(selected) => reorderFavorite(selected, 1)}
              onMoveUp={(selected) => reorderFavorite(selected, -1)}
              onOpenError={notifyError}
              onFileAccessDenied={handleFileAccessDenied}
              onToggleSelected={toggleSelected}
              selected={selectedIds.has(item.id)}
            />
          );
        }}
      />
    );
  };

  return (
    <main className="flex min-h-screen flex-col bg-background text-text-primary">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:p-3 focus:text-primary focus:shadow-lg"
        href="#main-content"
      >
        Skip to favorites
      </a>
      <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 sm:px-7">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            aria-controls="favorite-group-sidebar"
            aria-expanded={mobileSidebarOpen}
            aria-label="Open favorite groups"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            ref={mobileMenuButtonRef}
            title="Open favorite groups"
            type="button"
          >
            <Bars3Icon aria-hidden="true" className="h-6 w-6" />
          </button>
          <img
            alt=""
            aria-hidden="true"
            className="h-9 w-9 rounded-lg object-cover"
            src={
              theme.appliedTheme === 'dark'
                ? '/icons/icon_dark.jpg'
                : '/icons/icon_light.jpg'
            }
          />
          <span className="hidden text-lg font-semibold md:inline">FavoritePod</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <button
            aria-label="Undo"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canUndo}
            onClick={() => void undo()}
            title="Undo"
            type="button"
          >
            <ArrowUturnLeftIcon aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label="Redo"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canRedo}
            onClick={() => void redo()}
            title="Redo"
            type="button"
          >
            <ArrowUturnRightIcon aria-hidden="true" className="h-4 w-4" />
          </button>
          <DriveSyncStatusButton
            connectionStatus={driveConnection.status}
            error={driveSyncError}
            merged={driveSyncMerged}
            online={online}
            onClick={handleDriveStatusClick}
            progress={driveSyncProgress}
            syncing={driveSyncing}
          />
          <button
            aria-label="Settings"
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary md:flex"
            onClick={() => {
              setSettingsSection(undefined);
              setSettingsOpen(true);
            }}
            title="Settings"
            type="button"
          >
            <Cog6ToothIcon aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            aria-label="Add favorite"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover"
            onClick={() =>
              setDialog({ type: 'favorite', groupId: selectedGroupId ?? undefined })
            }
            type="button"
          >
            <PlusIcon aria-hidden="true" className="h-4 w-4" />
            <span className="hidden sm:inline">Add favorite</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:flex-row">
        <GroupSidebar
          collapsed={sidebarCollapsed}
          disabled={!settingsLoaded}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={closeMobileSidebar}
          onOpenSettings={() => {
            closeMobileSidebar();
            setSettingsSection(undefined);
            setSettingsOpen(true);
          }}
          onError={notifyError}
          onToggle={() =>
            void saveSidebarCollapsed(!sidebarCollapsed).catch((cause) =>
              notifyError(errorMessage(cause)),
            )
          }
        >
          <GroupTree
            groups={groups}
            items={items}
            homePageGroupId={homePageGroupId}
            onCreateGroup={() => setDialog({ type: 'group', parentId: null })}
            onCreateChild={(parentId) => setDialog({ type: 'group', parentId })}
            onDelete={(group) =>
              void removeGroup(group).catch((cause) => notifyError(errorMessage(cause)))
            }
            onEdit={(group) => setDialog({ type: 'group', group })}
            onSetHomePage={(groupId) => {
              void selectHomePage(groupId).catch((cause: unknown) =>
                notifyError(errorMessage(cause)),
              );
            }}
            onMoveGroup={(groupId, parentId, beforeId) => {
              void handleMoveGroup(groupId, parentId, beforeId);
            }}
            onMoveItem={(itemId, groupId) => {
              if (dragIdsRef.current.length > 1) {
                const ids = [...dragIdsRef.current];
                clearFavoriteDrag();
                void moveDraggedFavorites(ids, groupId).catch((cause) =>
                  notifyError(errorMessage(cause)),
                );
              } else {
                void handleMoveFavorite(itemId, groupId);
              }
            }}
            onSelect={(groupId) => {
              selectGroup(groupId);
              closeMobileSidebar();
            }}
            selectedGroupId={selectedGroupId}
          />
        </GroupSidebar>

        <section
          className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8"
          id="main-content"
          tabIndex={-1}
          onKeyDownCapture={(event) => {
            if (
              event.key !== 'Escape' ||
              event.defaultPrevented ||
              event.nativeEvent.isComposing ||
              selectedVisibleItems.length === 0 ||
              document.querySelector('[role="dialog"], [role="menu"]')
            )
              return;
            event.preventDefault();
            event.stopPropagation();
            setSelectedIds(new Set());
          }}
          onKeyDown={(event) => {
            if (
              event.defaultPrevented ||
              event.nativeEvent.isComposing ||
              event.altKey ||
              event.ctrlKey ||
              event.metaKey ||
              event.shiftKey ||
              draggingFavoriteId ||
              ![
                'ArrowLeft',
                'ArrowRight',
                'ArrowUp',
                'ArrowDown',
                'Home',
                'End',
              ].includes(event.key)
            )
              return;
            const target = event.target;
            if (
              !(target instanceof HTMLElement) ||
              !target.matches('[data-favorite-open]')
            )
              return;
            const collections = [...favoriteCollections.current.entries()]
              .filter(
                ([node]) =>
                  node.isConnected &&
                  node.getClientRects().length > 0 &&
                  !node.closest('[inert]'),
              )
              .sort(([left], [right]) => {
                const position = left.compareDocumentPosition(right);
                if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
                if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
                return 0;
              });
            const navigationIds: string[] = [];
            const navigationGeometry: ReturnType<typeof getFavoriteNavigationGeometry> =
              [];
            for (const [collection, registered] of collections) {
              const bounds = collection.getBoundingClientRect();
              navigationIds.push(...registered.items.map((item) => item.id));
              navigationGeometry.push(
                ...getFavoriteNavigationGeometry(
                  registered.items.length,
                  registered.metrics,
                  bounds,
                ),
              );
            }
            const currentId =
              target.closest<HTMLElement>('[data-favorite-id]')?.dataset.favoriteId;
            const index = currentId ? navigationIds.indexOf(currentId) : -1;
            const next = getNavigationTarget(navigationGeometry, index, event.key);
            event.preventDefault();
            if (next === undefined) return;
            const nextId = navigationIds[next];
            if (!nextId) return;
            setFocusedFavoriteId(nextId);
            const nextTrigger = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[data-favorite-open]',
              ),
            ).find(
              (button) =>
                button.closest<HTMLElement>('[data-favorite-id]')?.dataset.favoriteId ===
                nextId,
            );
            nextTrigger?.focus();
          }}
          onDragOver={(event) => {
            if (getActiveLibraryDragPayload()?.type !== 'item') return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            const payload = readLibraryDragData(event.dataTransfer);
            if (payload?.type !== 'item') return;
            event.preventDefault();
            event.stopPropagation();
            void dropFavorite(payload.id);
            clearLibraryDragData();
          }}
        >
          <div className="mx-auto max-w-7xl">
            {hasLocalFiles && fileAccessAllowed === false && !fileAccessHintDismissed && (
              <FileAccessHint
                onDismiss={() => setFileAccessHintDismissed(true)}
                settingsUrl={getExtensionSettingsUrl()}
              />
            )}
            {!searching &&
              (selectedGroupId === null
                ? optionalFeatures.showFrequentlyVisited
                : selectedGroupId === homePageGroupId &&
                  optionalFeatures.showFrequentlyVisitedOnHome) && (
                <FrequentlyVisitedSection
                  enabled={optionalFeatures.discoveryEnabled}
                  sites={visitedSites.suggestions}
                  savedUrls={savedVisitedUrls}
                  loading={!optionalFeatures.ready || visitedSites.loading}
                  error={optionalFeatures.error ?? visitedSites.error}
                  onOpen={(site, background) => {
                    void openSavedUrl(site.url, { active: !background }).catch(() =>
                      notifyError('Chrome could not open this site. Try again.'),
                    );
                  }}
                  onSave={editVisitedSite}
                  onHide={(site) => {
                    void hideVisitedSiteUrl(site.url).catch((cause: unknown) =>
                      notifyError(errorMessage(cause)),
                    );
                  }}
                  onHideSection={() => {
                    const saveVisibility =
                      selectedGroupId === null
                        ? optionalFeatures.saveShowFrequentlyVisited
                        : optionalFeatures.saveShowFrequentlyVisitedOnHome;
                    void saveVisibility(false)
                      .then(() =>
                        notify('Frequently visited hidden. Show it again in Settings.'),
                      )
                      .catch((cause: unknown) => notifyError(errorMessage(cause)));
                  }}
                  onRefresh={visitedSites.refresh}
                  onOpenSettings={() => {
                    setSettingsSection('discovery');
                    setSettingsOpen(true);
                  }}
                />
              )}

            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-xl font-semibold">
                  {selectedGroup ? groupLabels.get(selectedGroup.id) : 'All favorites'}
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {visibleItems.length}{' '}
                  {visibleItems.length === 1 ? 'favorite' : 'favorites'}
                </p>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <label className="relative block w-full sm:w-[min(19rem,35vw)]">
                  <MagnifyingGlassIcon
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
                  />
                  <input
                    aria-label="Search favorites"
                    ref={searchRef}
                    aria-keyshortcuts="Meta+k Control+k"
                    className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                    onChange={(event) => setSearch(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape' && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        setSearch('');
                      }
                    }}
                    placeholder="Search favorites"
                    title="Search favorites (⌘K / Ctrl+K)"
                    type="search"
                    value={search}
                  />
                </label>
                <div
                  aria-label="View mode"
                  className="flex h-10 items-center rounded-md border border-border p-1"
                >
                  <button
                    aria-label="Grid view"
                    aria-pressed={layout === 'grid'}
                    className={`flex h-8 w-8 items-center justify-center rounded ${layout === 'grid' ? 'bg-surface-hover text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
                    onClick={() => setLayout('grid')}
                    title="Grid view"
                    type="button"
                  >
                    <Squares2X2Icon aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    aria-label="List view"
                    aria-pressed={layout === 'list'}
                    className={`flex h-8 w-8 items-center justify-center rounded ${layout === 'list' ? 'bg-surface-hover text-text-primary' : 'text-text-tertiary hover:text-text-primary'}`}
                    onClick={() => setLayout('list')}
                    title="List view"
                    type="button"
                  >
                    <ListBulletIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
                <BookmarkSizeControl
                  view={layout}
                  size={bookmarkSize}
                  disabled={!sizesReady || !!draggingFavoriteId}
                  onChange={changeBookmarkSize}
                />
              </div>
            </div>

            {visibleItems.length > 0 && (
              <div
                className={`${selectedVisibleItems.length > 0 ? 'sticky top-0 z-20 ' : ''}mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2`}
              >
                <label className="flex h-8 items-center gap-2 text-sm text-text-primary">
                  <input
                    aria-label="Select all visible favorites"
                    checked={allVisibleSelected}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    onChange={toggleSelectAll}
                    type="checkbox"
                  />
                  <span>{selectedVisibleItems.length} selected</span>
                </label>
                {selectedVisibleItems.length > 0 && (
                  <>
                    <select
                      aria-label="Move selected favorites to group"
                      className="h-9 min-w-40 rounded-md border border-border bg-background px-2 text-sm"
                      onChange={(event) => {
                        if (event.target.value) void moveSelected(event.target.value);
                        event.currentTarget.value = '';
                      }}
                      value=""
                    >
                      <option value="">Move to group…</option>
                      {groupsInTreeOrder.map((group) => (
                        <option key={group.id} value={group.id}>
                          {groupLabels.get(group.id) ?? group.title}
                        </option>
                      ))}
                    </select>
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-danger transition hover:bg-danger-light"
                      onClick={() => void deleteSelected()}
                      type="button"
                    >
                      <TrashIcon aria-hidden="true" className="h-4 w-4" />
                      Delete
                    </button>
                  </>
                )}
                {selectedVisibleItems.length > 0 && (
                  <button
                    aria-label="Clear selection"
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-background hover:text-text-primary"
                    onClick={() => setSelectedIds(new Set())}
                    title="Clear selection"
                    type="button"
                  >
                    <XMarkIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            {loading || !sizesReady ? (
              <div
                className="bookmark-collection"
                data-layout={layout}
                data-size={bookmarkSize}
                aria-label="Loading favorites"
                aria-busy="true"
                role="status"
              >
                <span className="sr-only">Loading favorites…</span>
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    aria-hidden="true"
                    className="bookmark-card flex min-w-0 overflow-hidden rounded-lg border border-border"
                    data-layout={layout}
                    data-size={bookmarkSize}
                    key={index}
                  >
                    {(bookmarkSize !== 'compact' || layout === 'grid') && (
                      <div className="bookmark-preview shrink-0 animate-pulse bg-surface-hover" />
                    )}
                    <div className="bookmark-details flex min-w-0 flex-col justify-center gap-2">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-surface-hover" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-surface-hover" />
                    </div>
                  </div>
                ))}
              </div>
            ) : groupedView.mode === 'hierarchical' &&
              (sectionGroups.length > 0 || groupedView.directItems.length > 0) ? (
              <div className="space-y-6">
                {groupedView.directItems.length > 0 &&
                  renderFavoriteCollection(groupedView.directItems)}
                {sectionGroups.map((group) => (
                  <GroupedFavoriteSection
                    collapsedGroups={collapsedGroups}
                    group={group}
                    groups={groups}
                    itemsByGroup={itemsByGroup}
                    key={group.id}
                    onDropIntoGroup={dropIntoGroup}
                    onToggleCollapse={toggleGroupCollapse}
                    renderItems={renderFavoriteCollection}
                    searching={searching}
                  />
                ))}
              </div>
            ) : visibleItems.length > 0 ? (
              renderFavoriteCollection(
                groupedView.mode === 'hierarchical' ? visibleItems : groupedView.items,
              )
            ) : (
              <div className="flex min-h-[min(60vh,32rem)] flex-col items-center justify-center px-6 text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-surface text-text-tertiary">
                  {search ? (
                    <MagnifyingGlassIcon aria-hidden="true" className="h-7 w-7" />
                  ) : (
                    <BookmarkIcon aria-hidden="true" className="h-7 w-7" />
                  )}
                </div>
                <h2 className="text-lg font-semibold">
                  {search
                    ? 'No matches'
                    : selectedGroup
                      ? 'No favorites in this group'
                      : 'No favorites yet'}
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
                  {search
                    ? 'Try a different title or address.'
                    : 'Your saved pages and local tools will appear here.'}
                </p>
                {search ? (
                  <button
                    className="mt-5 min-h-10 rounded-md border border-border px-4 text-sm font-medium transition hover:bg-surface-hover"
                    onClick={() => setSearch('')}
                    type="button"
                  >
                    Clear search
                  </button>
                ) : (
                  <button
                    className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover"
                    onClick={() =>
                      setDialog({
                        type: 'favorite',
                        groupId: selectedGroupId ?? undefined,
                      })
                    }
                    type="button"
                  >
                    <PlusIcon aria-hidden="true" className="h-4 w-4" />
                    Add favorite
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {dialog?.type === 'favorite' && (
        <FavoriteDialog
          groups={groups}
          initialGroupId={dialog.groupId}
          initialUrl={dialog.initialUrl}
          initialTitle={dialog.initialTitle}
          item={dialog.item}
          key={dialog.item?.id ?? 'new-favorite'}
          onClose={() => setDialog(null)}
          onDelete={deleteFavorite}
          onSave={saveFavorite}
          onUpdateThumbnail={updateFavoriteThumbnail}
        />
      )}
      {dialog?.type === 'move-favorite' && (
        <MoveFavoriteDialog
          groups={groups}
          item={dialog.item}
          key={dialog.item.id}
          onClose={() => setDialog(null)}
          onMove={(groupId) => moveFavorite(dialog.item.id, groupId)}
        />
      )}
      {dialog?.type === 'group' && (
        <GroupDialog
          group={dialog.group}
          groups={groups}
          initialParentId={dialog.parentId}
          key={dialog.group?.id ?? 'new-group'}
          onClose={() => setDialog(null)}
          onDelete={removeGroup}
          onSave={saveGroup}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          initialSection={settingsSection}
          theme={theme.theme}
          themeReady={theme.ready}
          themeSaving={theme.saving}
          themeError={theme.error}
          onSaveTheme={theme.setTheme}
          defaultView={layout}
          driveAccount={driveAccount}
          driveConnectionStatus={driveConnection.status}
          driveSyncing={driveSyncing}
          driveSyncError={driveSyncError}
          driveSyncErrorCode={driveSyncErrorCode}
          driveSyncHistory={driveSyncHistory}
          driveSyncMessage={driveSyncMessage}
          driveSyncProgress={driveSyncProgress}
          online={online}
          groupingMode={groupingMode}
          homePageAvailable={!!homePageGroupId && groupsById.has(homePageGroupId)}
          openBehavior={openBehavior}
          showPreview={showPreview}
          showHiddenBookmarks={optionalFeatures.showHiddenBookmarks}
          onSaveShowHiddenBookmarks={optionalFeatures.saveShowHiddenBookmarks}
          showFrequentlyVisited={optionalFeatures.showFrequentlyVisited}
          showFrequentlyVisitedOnHome={optionalFeatures.showFrequentlyVisitedOnHome}
          onSaveShowFrequentlyVisitedOnHome={
            optionalFeatures.saveShowFrequentlyVisitedOnHome
          }
          onSaveShowFrequentlyVisited={optionalFeatures.saveShowFrequentlyVisited}
          siteDiscoveryEnabled={optionalFeatures.discoveryEnabled}
          siteDiscoveryPermissionGranted={optionalFeatures.discoveryPermissionGranted}
          contextMenuEnabled={optionalFeatures.contextMenuEnabled}
          contextMenuPermissionGranted={optionalFeatures.contextMenuPermissionGranted}
          optionalFeaturesReady={optionalFeatures.ready}
          pathOverrides={pathOverrides}
          onClose={() => setSettingsOpen(false)}
          onSaveDefaultView={saveDefaultView}
          onSaveGroupingMode={saveGroupingMode}
          onSaveOpenBehavior={saveOpenBehavior}
          onSaveShowPreview={savePreviewVisibility}
          onSaveSiteDiscoveryEnabled={optionalFeatures.saveSiteDiscoveryEnabled}
          onSaveContextMenuEnabled={optionalFeatures.saveContextMenuEnabled}
          onSavePathOverrides={saveLocalPathOverrides}
          onOpenDriveSignIn={() => setDriveSignInOpen(true)}
          onDisconnectDrive={handleDisconnectDrive}
          onSyncDrive={() => runDriveSync(undefined, { manual: true })}
          onArchiveAction={(mode) => {
            setSettingsOpen(false);
            setArchiveDialog(mode);
          }}
          onImportChromeBookmarks={() => {
            setSettingsOpen(false);
            setChromeImportOpen(true);
          }}
        />
      )}
      {driveSignInOpen && (
        <GoogleDriveSignInDialog
          driveAccount={driveAccount}
          driveConnectionStatus={driveConnection.status}
          online={online}
          onCancelDriveConnection={handleCancelDriveConnection}
          onClose={() => setDriveSignInOpen(false)}
          onConfirmDriveConnection={handleConfirmDriveConnection}
          onConnectDrive={handleConnectDrive}
          onPrepareDriveConnection={handlePrepareDriveConnection}
          onSwitchDriveAccount={handleSwitchDriveAccount}
        />
      )}
      {driveSyncChoicePreview && (
        <DriveSyncChoiceDialog
          busy={driveSyncing}
          error={driveSyncChoiceError}
          onCancel={() => {
            setDriveSyncChoicePreview(undefined);
            setDriveSyncChoiceManual(false);
            setDriveSyncChoiceError(undefined);
          }}
          onContinue={(choice) => runDriveSync(choice, { manual: driveSyncChoiceManual })}
          preview={driveSyncChoicePreview}
        />
      )}
      {archiveDialog && (
        <ImportExportDialog
          key={archiveDialog}
          groups={groups}
          items={items}
          mode={archiveDialog}
          onClose={() => setArchiveDialog(null)}
          onImported={completeImport}
        />
      )}
      {chromeImportOpen && (
        <ChromeBookmarksImportDialog
          onClose={() => setChromeImportOpen(false)}
          onImported={(result) => completeImport('copy', result)}
        />
      )}
      <div
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 flex-col-reverse gap-2 overflow-y-auto sm:left-auto sm:right-4 sm:w-full sm:max-w-sm sm:translate-x-0"
      >
        {[...toasts].reverse().map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </main>
  );
}
