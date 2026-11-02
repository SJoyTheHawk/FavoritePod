import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  BookmarkIcon,
  Cog6ToothIcon,
  FolderPlusIcon,
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
  moveGroup,
  moveItem,
  moveItems,
  restoreGroup,
  restoreItem,
  restoreItems,
  restoreItemPositions,
  setDefaultView,
  updateGroup,
  updateItem,
  updateItemThumbnail,
  type ItemPosition,
  type LibraryView,
} from '../core/storage';
import { useLibrary } from '../core/use-library';
import type { Group, Item } from '../core/types';
import { FavoriteCard } from './components/FavoriteCard';
import { FavoriteDialog } from './components/FavoriteDialog';
import { GroupDialog } from './components/GroupDialog';
import { GroupTree } from './components/GroupTree';
import { SettingsDialog } from './components/SettingsDialog';
import { getGroupLabels } from './group-labels';

type DialogState =
  | { type: 'favorite'; item?: Item; groupId?: string }
  | { type: 'group'; group?: Group; parentId?: string | null }
  | null;

interface HistoryEntry {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

interface HistoryStack {
  past: HistoryEntry[];
  future: HistoryEntry[];
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

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The library could not be updated.';
}

export function DashboardApp() {
  const { groups, items, loading, error } = useLibrary();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<LibraryView>('grid');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const history = useRef<HistoryStack>({ past: [], future: [] });
  const [historyVersion, setHistoryVersion] = useState(0);
  const groupLabels = useMemo(() => getGroupLabels(groups), [groups]);
  const groupsById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );
  const selectedGroup = selectedGroupId ? groupsById.get(selectedGroupId) : undefined;

  useEffect(() => {
    void getDefaultView()
      .then((view) => {
        if (view) setLayout(view);
      })
      .catch((cause: unknown) => setNotice(errorMessage(cause)));
  }, []);

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
      setNotice(`Undid ${entry.label}.`);
    } catch (cause) {
      setNotice(errorMessage(cause));
    }
  }, []);

  const redo = useCallback(async () => {
    const entry = history.current.future.at(-1);
    if (!entry) return;
    try {
      await entry.redo();
      history.current.future.pop();
      history.current.past.push(entry);
      setHistoryVersion((version) => version + 1);
      setNotice(`Redid ${entry.label}.`);
    } catch (cause) {
      setNotice(errorMessage(cause));
    }
  }, []);

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
      setNotice('Favorite updated.');
      return saved;
    }

    const created = await createItem(value);
    setSelectedGroupId(value.groupId ?? created.groupId);
    setNotice('Favorite added.');
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
      setNotice('Group updated.');
      return;
    }

    const created = await createGroup(value);
    setSelectedGroupId(created.id);
    setNotice('Group created.');
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
    setNotice('Favorite deleted.');
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
    setNotice('Thumbnail updated.');
    return updated;
  };

  const removeGroup = async (group: Group): Promise<boolean> => {
    if (!window.confirm(`Delete group “${group.title}”?`)) return false;
    await deleteGroup(group.id);
    registerHistory({
      label: 'group deleted',
      undo: async () => {
        await restoreGroup(group.id);
      },
      redo: async () => deleteGroup(group.id),
    });
    if (selectedGroupId === group.id) setSelectedGroupId(group.parentId);
    setNotice('Group deleted.');
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
    setNotice(previous.groupId === groupId ? 'Favorite reordered.' : 'Favorite moved.');
  };

  const handleMoveFavorite = async (
    itemId: string,
    groupId: string,
    beforeItemId?: string,
  ) => {
    try {
      await moveFavorite(itemId, groupId, beforeItemId);
    } catch (cause) {
      setNotice(errorMessage(cause));
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
      setNotice(
        previous.parentId === saved.parentId ? 'Group reordered.' : 'Group moved.',
      );
    } catch (cause) {
      setNotice(errorMessage(cause));
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
      setNotice(
        `Moved ${moved.length} favorites to ${groupLabels.get(groupId) ?? 'the selected group'}.`,
      );
    } catch (cause) {
      setNotice(errorMessage(cause));
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
      setNotice(`Deleted ${label}.`);
    } catch (cause) {
      setNotice(errorMessage(cause));
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
      <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4 py-2 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
            <BookmarkIcon aria-hidden="true" className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">FavoritePod</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            aria-label="Undo"
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canUndo}
            onClick={() => void undo()}
            title="Undo"
            type="button"
          >
            <ArrowUturnLeftIcon aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label="Redo"
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canRedo}
            onClick={() => void redo()}
            title="Redo"
            type="button"
          >
            <ArrowUturnRightIcon aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
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
        <aside className="border-b border-border px-3 py-3 md:w-64 md:shrink-0 md:border-b-0 md:border-r md:px-4 md:py-6">
          <div className="max-h-64 overflow-y-auto md:max-h-none">
            <GroupTree
              groups={groups}
              items={items}
              onCreateChild={(parentId) => setDialog({ type: 'group', parentId })}
              onDelete={(group) =>
                void removeGroup(group).catch((cause) => setNotice(errorMessage(cause)))
              }
              onEdit={(group) => setDialog({ type: 'group', group })}
              onMoveGroup={(groupId, parentId, beforeId) => {
                void handleMoveGroup(groupId, parentId, beforeId);
              }}
              onMoveItem={(itemId, groupId) => {
                void handleMoveFavorite(itemId, groupId);
              }}
              onSelect={setSelectedGroupId}
              selectedGroupId={selectedGroupId}
            />
          </div>
          <button
            className="mt-2 flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            onClick={() => setDialog({ type: 'group', parentId: selectedGroupId })}
            type="button"
          >
            <FolderPlusIcon aria-hidden="true" className="h-4 w-4" />
            <span>New group</span>
          </button>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">
          <div className="mx-auto max-w-7xl">
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
              <div className="flex min-w-0 items-center gap-2">
                <label className="relative block w-[min(19rem,58vw)]">
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
              </div>
            </div>

            {(notice || error) && (
              <div
                aria-live="polite"
                className={`mb-4 flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${error ? 'border-danger/30 bg-danger-light text-danger' : 'border-success/30 bg-success-light text-text-primary'}`}
                role={error ? 'alert' : 'status'}
              >
                <span>{error ?? notice}</span>
                {!error && (
                  <button
                    aria-label="Dismiss notification"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-secondary hover:bg-background"
                    onClick={() => setNotice(undefined)}
                    type="button"
                  >
                    <XMarkIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

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

            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    className="overflow-hidden rounded-lg border border-border"
                    key={index}
                  >
                    <div className="aspect-[16/10] animate-pulse bg-surface-hover" />
                    <div className="space-y-2 p-3">
                      <div className="h-3 w-3/4 animate-pulse rounded bg-surface-hover" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-surface-hover" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleItems.length > 0 ? (
              <div
                className={
                  layout === 'grid'
                    ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'grid gap-3'
                }
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
                      onDelete={(selected) =>
                        void deleteFavorite(selected).catch((cause) =>
                          setNotice(errorMessage(cause)),
                        )
                      }
                      onDropItem={(itemId, beforeId) => {
                        const target = items.find(
                          (candidate) => candidate.id === beforeId,
                        );
                        if (target)
                          void handleMoveFavorite(itemId, target.groupId, beforeId);
                      }}
                      onEdit={(selected) =>
                        setDialog({ type: 'favorite', item: selected })
                      }
                      onMove={(selected) =>
                        setDialog({ type: 'favorite', item: selected })
                      }
                      onMoveDown={(selected) => reorderFavorite(selected, 1)}
                      onMoveUp={(selected) => reorderFavorite(selected, -1)}
                      onOpenError={setNotice}
                      onToggleSelected={toggleSelected}
                      selected={selectedIds.has(item.id)}
                    />
                  );
                })}
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
          onClose={() => setSettingsOpen(false)}
          onSaveDefaultView={saveDefaultView}
        />
      )}
    </main>
  );
}
