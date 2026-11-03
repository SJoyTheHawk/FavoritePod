import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BookmarkIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  ExclamationCircleIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  createGroup,
  createItem,
  deleteGroup,
  deleteItem,
  deleteItems,
  getDefaultView,
  getBookmarkSize,
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
  setDefaultView,
  setHomePageGroupId,
  setLastSelectedGroupId,
  setOpenBehavior,
  setSidebarCollapsed,
  setShowPreview,
  setBookmarkSize,
  type BookmarkSize,
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
  savePathOverrides as persistPathOverrides,
  type PathOverride,
} from '../core/file-links';
import { parseSafeUrl } from '../core/validation';
import { useLibrary } from '../core/use-library';
import type { Group, Item } from '../core/types';
import { FavoriteCard } from './components/FavoriteCard';
import { BookmarkSizeControl } from './components/BookmarkSizeControl';
import { FavoriteDialog } from './components/FavoriteDialog';
import { MoveFavoriteDialog } from './components/MoveFavoriteDialog';
import { GroupDialog } from './components/GroupDialog';
import { GroupTree } from './components/GroupTree';
import { SettingsDialog } from './components/SettingsDialog';
import { ImportExportDialog } from './components/ImportExportDialog';
import type { ImportMode, ImportResult } from '../core/import';
import { FileAccessHint } from './components/FileAccessHint';
import {
  clearLibraryDragData,
  getActiveLibraryDragPayload,
  getItemDropTarget,
  readLibraryDragData,
  previewItemOrder,
  resolveItemDropDestination,
  type ItemDropPlacement,
} from './drag';
import { getGroupLabels } from './group-labels';

type DialogState =
  | { type: 'favorite'; item?: Item; groupId?: string }
  | { type: 'move-favorite'; item: Item }
  | { type: 'group'; group?: Group; parentId?: string | null }
  | null;

type ArchiveDialogState = 'export' | 'import' | null;

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
  const { groups, items, loading, error } = useLibrary();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [homePageGroupId, setHomePageGroupIdState] = useState<string>();
  const [showPreview, setShowPreviewState] = useState(true);
  const [openBehavior, setOpenBehaviorState] = useState<OpenBehavior>('all');
  const [pathOverrides, setPathOverridesState] = useState<PathOverride[]>([]);
  const [fileAccessAllowed, setFileAccessAllowed] = useState<boolean>();
  const [fileAccessHintDismissed, setFileAccessHintDismissed] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const startupSelectionApplied = useRef(false);
  const initialLastGroupId = useRef<string | null | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<LibraryView>('grid');
  const [bookmarkSizes, setBookmarkSizes] = useState<Record<LibraryView, BookmarkSize>>({
    grid: 'medium',
    list: 'medium',
  });
  const [sizesReady, setSizesReady] = useState(false);
  const sizeSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const bookmarkSize = bookmarkSizes[layout];
  const [dialog, setDialog] = useState<DialogState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [archiveDialog, setArchiveDialog] = useState<ArchiveDialogState>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dragPreviewOrder, setDragPreviewOrder] = useState<string[] | null>(null);
  const [draggingFavoriteId, setDraggingFavoriteId] = useState<string | null>(null);
  const [dragPlaceholderHeight, setDragPlaceholderHeight] = useState(0);
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const dragIdsRef = useRef<string[]>([]);
  const slotRef = useRef<HTMLDivElement>(null);
  const [dropOrigin, setDropOrigin] = useState<{ left: number; top: number } | null>(
    null,
  );
  const nextToastId = useRef(0);
  const favoriteDropPending = useRef<FavoriteDropDestination | null>(null);
  const favoritePreviewDestination = useRef<FavoriteDropDestination | null>(null);
  const history = useRef<HistoryStack>({ past: [], future: [] });
  const [historyVersion, setHistoryVersion] = useState(0);
  const groupLabels = useMemo(() => getGroupLabels(groups), [groups]);
  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
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

  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        !dragIdsRef.current.length ||
        favoriteDropPending.current
      )
        return;
      clearLibraryDragData();
      clearFavoriteDrag();
    };
    window.addEventListener('keydown', cancel, true);
    return () => window.removeEventListener('keydown', cancel, true);
  }, [clearFavoriteDrag]);

  useEffect(() => {
    if (error) notifyError(error);
  }, [error, notifyError]);

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
    ])
      .then(
        ([view, behavior, homeGroupId, lastGroupId, collapsed, preview, overrides]) => {
          if (view) setLayout(view);
          setOpenBehaviorState(behavior);
          setHomePageGroupIdState(homeGroupId);
          setSidebarCollapsedState(collapsed);
          setShowPreviewState(preview);
          setPathOverridesState(overrides);
          initialLastGroupId.current = lastGroupId;
          setSettingsLoaded(true);
        },
      )
      .catch((cause: unknown) => notifyError(errorMessage(cause)));
  }, [notifyError]);

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
  }, [redo, undo]);

  const saveDefaultView = async (view: LibraryView) => {
    await setDefaultView(view);
    setLayout(view);
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
    const searchTerm = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (selectedGroupId && !scope.has(item.groupId)) return false;
      if (!searchTerm) return true;
      return `${item.title} ${item.url}`.toLocaleLowerCase().includes(searchTerm);
    });
  }, [groups, items, search, selectedGroupId]);

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
      items.map((item) => item.id),
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

  const finishFavoriteDrag = () => {
    if (favoriteDropPending.current) return;
    clearFavoriteDrag();
  };

  const startFavoriteDrag = (itemId: string, height: number) => {
    const ids = visibleItems
      .filter((item) =>
        selectedIds.has(itemId) ? selectedIds.has(item.id) : item.id === itemId,
      )
      .map((item) => item.id);
    dragIdsRef.current = ids;
    setDraggedIds(ids);
    setDropOrigin(null);
    favoriteDropPending.current = null;
    const first = items.find((item) => item.id === ids[0])!;
    const originalIndex = items.findIndex((item) => item.id === first.id);
    const remaining = items.filter((item) => !ids.includes(item.id));
    const next = items.slice(originalIndex).find((item) => !ids.includes(item.id));
    const index = next
      ? remaining.findIndex((item) => item.id === next.id)
      : remaining.length;
    const order = remaining.map((item) => item.id);
    order.splice(index, 0, ...ids);
    favoritePreviewDestination.current = {
      itemId,
      itemIds: ids,
      groupId: first.groupId,
      beforeItemId: items
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
    setDraggingFavoriteId(null);
    setDragPlaceholderHeight(0);
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

  const selectedVisibleItems = visibleItems.filter((item) => selectedIds.has(item.id));
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
    setSelectedGroupId(value.groupId ?? created.groupId);
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
    const previousHash = item.previewHash;
    const updated = await updateItemThumbnail(item.id, thumbnail);
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
    notify('Thumbnail updated.');
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

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2 sm:px-7">
        <div className="flex items-center gap-3">
          <picture className="block h-9 w-9 shrink-0">
            <source srcSet="/icons/icon_dark.jpg" media="(prefers-color-scheme: dark)" />
            <img
              alt=""
              aria-hidden="true"
              className="h-full w-full rounded-lg object-cover"
              src="/icons/icon_light.jpg"
            />
          </picture>
          <span className="text-lg font-semibold">FavoritePod</span>
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
          <button
            aria-label="Settings"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            type="button"
          >
            <Cog6ToothIcon aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            aria-label="Add favorite"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-white transition hover:bg-primary-hover"
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

      <div className="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
        <aside
          className={`border-b border-border py-3 md:shrink-0 md:border-b-0 md:border-r md:transition-[width] md:duration-200 ${sidebarCollapsed ? 'px-3 md:w-14 md:px-2' : 'px-3 md:w-64 md:px-4 md:py-6'}`}
        >
          <div
            className={`flex min-h-9 items-center ${sidebarCollapsed ? 'justify-center' : 'mb-3 justify-end'}`}
          >
            <button
              aria-controls="favorite-group-sidebar"
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              disabled={!settingsLoaded}
              onClick={() =>
                void saveSidebarCollapsed(!sidebarCollapsed).catch((cause) =>
                  notifyError(errorMessage(cause)),
                )
              }
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              type="button"
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.25}
                />
              ) : (
                <ChevronLeftIcon
                  aria-hidden="true"
                  className="h-4 w-4"
                  strokeWidth={2.25}
                />
              )}
            </button>
          </div>
          <div
            className={
              sidebarCollapsed ? 'hidden' : 'max-h-64 overflow-y-auto md:max-h-none'
            }
            id="favorite-group-sidebar"
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
              onSelect={selectGroup}
              selectedGroupId={selectedGroupId}
            />
          </div>
        </aside>

        <section
          className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8"
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
                    className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary"
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search favorites"
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
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
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
                      {groups.map((group) => (
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
              >
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    className="bookmark-card flex min-w-0 overflow-hidden rounded-lg border border-border"
                    data-layout={layout}
                    data-size={bookmarkSize}
                    key={index}
                  >
                    {bookmarkSize !== 'compact' && (
                      <div className="bookmark-preview shrink-0 animate-pulse bg-surface-hover" />
                    )}
                    <div className="bookmark-details flex min-w-0 flex-col justify-center gap-2">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-surface-hover" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-surface-hover" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleItems.length > 0 ? (
              <div
                className="bookmark-collection relative"
                data-layout={layout}
                data-size={bookmarkSize}
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
                    .filter(
                      (card) => !dragIdsRef.current.includes(card.dataset.favoriteId!),
                    )
                    .map((card) => ({
                      id: card.dataset.favoriteId!,
                      left: card.offsetLeft,
                      top: card.offsetTop,
                      width: card.offsetWidth,
                      height: card.offsetHeight,
                    }));
                  const target = getItemDropTarget(
                    event.clientX - rect.left + collection.scrollLeft,
                    event.clientY - rect.top + collection.scrollTop,
                    slots,
                    layout,
                  );
                  // Keep the previous destination over a gap or the stack placeholder.
                  if (target)
                    previewFavoriteDrop(payload.id, target.targetId, target.placement);
                }}
              >
                {visibleItems.map((item) => {
                  const siblings = items
                    .filter((candidate) => candidate.groupId === item.groupId)
                    .sort(compareOrder);
                  const index = siblings.findIndex(
                    (candidate) => candidate.id === item.id,
                  );
                  return (
                    <FavoriteCard
                      canMoveDown={index >= 0 && index < siblings.length - 1}
                      canMoveUp={index > 0}
                      item={item}
                      key={item.id}
                      layout={layout}
                      size={bookmarkSize}
                      showPreview={showPreview}
                      pathOverrides={pathOverrides}
                      sortOrder={
                        dragPreviewRank
                          ? (dragPreviewRank.get(item.id) ?? dragPreviewOrder?.length)
                          : undefined
                      }
                      isDragging={!!draggingFavoriteId && draggedIds.includes(item.id)}
                      dropOrigin={dropOrigin}
                      dragItemIds={
                        selectedIds.has(item.id)
                          ? visibleItems
                              .filter((candidate) => selectedIds.has(candidate.id))
                              .map((candidate) => candidate.id)
                          : [item.id]
                      }
                      onDragStart={startFavoriteDrag}
                      onDragEnd={finishFavoriteDrag}
                      onDelete={(selected) =>
                        void deleteFavorite(selected).catch((cause) =>
                          notifyError(errorMessage(cause)),
                        )
                      }
                      onEdit={(selected) =>
                        setDialog({ type: 'favorite', item: selected })
                      }
                      onMove={(selected) =>
                        setDialog({ type: 'move-favorite', item: selected })
                      }
                      onMoveDown={(selected) => reorderFavorite(selected, 1)}
                      onMoveUp={(selected) => reorderFavorite(selected, -1)}
                      onOpenError={notifyError}
                      onFileAccessDenied={handleFileAccessDenied}
                      onToggleSelected={toggleSelected}
                      selected={selectedIds.has(item.id)}
                    />
                  );
                })}
                {draggingFavoriteId && dragPreviewRank?.has(draggedIds[0]) && (
                  <div
                    ref={slotRef}
                    aria-hidden="true"
                    className="pointer-events-none min-w-0 rounded-lg border border-dashed border-primary/50 bg-primary-light/20"
                    style={{
                      order: dragPreviewRank.get(draggedIds[0]),
                      height: dragPlaceholderHeight,
                    }}
                  />
                )}
              </div>
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
          defaultView={layout}
          homePageAvailable={!!homePageGroupId && groupsById.has(homePageGroupId)}
          openBehavior={openBehavior}
          showPreview={showPreview}
          pathOverrides={pathOverrides}
          onClose={() => setSettingsOpen(false)}
          onSaveDefaultView={saveDefaultView}
          onSaveOpenBehavior={saveOpenBehavior}
          onSaveShowPreview={savePreviewVisibility}
          onSavePathOverrides={saveLocalPathOverrides}
          onArchiveAction={(mode) => {
            setSettingsOpen(false);
            setArchiveDialog(mode);
          }}
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
