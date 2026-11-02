import { useEffect, useMemo, useState } from 'react';
import {
  BookmarkIcon,
  Cog6ToothIcon,
  FolderIcon,
  FolderPlusIcon,
  ListBulletIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import {
  createGroup,
  createItem,
  deleteItem,
  getDefaultView,
  setDefaultView,
  updateItem,
  type LibraryView,
} from '../core/storage';
import { useLibrary } from '../core/use-library';
import type { Item } from '../core/types';
import { FavoriteCard } from './components/FavoriteCard';
import { FavoriteDialog } from './components/FavoriteDialog';
import { GroupDialog } from './components/GroupDialog';
import { SettingsDialog } from './components/SettingsDialog';

type DialogState =
  { type: 'favorite'; item?: Item; groupId?: string } | { type: 'group' } | null;

export function DashboardApp() {
  const { groups, items, loading, error } = useLibrary();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<LibraryView>('grid');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string>();
  const rootGroups = groups.filter((group) => group.parentId === null);
  const selectedGroup = rootGroups.find((group) => group.id === selectedGroupId);

  useEffect(() => {
    void getDefaultView().then((view) => {
      if (view) setLayout(view);
    });
  }, []);

  const saveDefaultView = async (view: LibraryView) => {
    await setDefaultView(view);
    setLayout(view);
  };

  const visibleItems = useMemo(() => {
    const searchTerm = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (selectedGroupId && item.groupId !== selectedGroupId) return false;
      if (!searchTerm) return true;
      return `${item.title} ${item.url}`.toLocaleLowerCase().includes(searchTerm);
    });
  }, [items, search, selectedGroupId]);

  const saveFavorite = async (value: {
    title: string;
    url: string;
    groupId?: string;
  }) => {
    if (dialog?.type !== 'favorite') return;
    if (dialog.item) {
      await updateItem(dialog.item.id, value);
      setNotice('Favorite updated.');
    } else {
      const item = await createItem(value);
      setSelectedGroupId(value.groupId ?? item.groupId);
      setNotice('Favorite added.');
    }
  };

  const saveGroup = async (title: string) => {
    const group = await createGroup({ title });
    setSelectedGroupId(group.id);
    setNotice('Group created.');
  };

  const removeFavorite = async (item: Item) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    await deleteItem(item.id);
    setNotice('Favorite deleted.');
  };

  return (
    <main className="min-h-screen bg-background text-text-primary">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 sm:px-7">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
            <BookmarkIcon aria-hidden="true" className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">FavoritePod</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            onClick={() => setSettingsOpen(true)}
            title="Settings"
            type="button"
          >
            <Cog6ToothIcon aria-hidden="true" className="h-5 w-5" />
          </button>
          <button
            aria-label="Add favorite"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-3.5 text-sm font-medium text-white transition hover:bg-primary-hover"
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
        <aside className="border-b border-border px-3 py-3 md:w-60 md:shrink-0 md:border-b-0 md:border-r md:px-4 md:py-6">
          <nav
            aria-label="Favorite groups"
            className="flex gap-2 overflow-x-auto md:flex-col"
          >
            <button
              aria-current={selectedGroupId === null ? 'page' : undefined}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm transition md:w-full ${
                selectedGroupId === null
                  ? 'bg-primary-light font-medium text-primary'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
              onClick={() => setSelectedGroupId(null)}
              type="button"
            >
              <BookmarkIcon aria-hidden="true" className="h-4 w-4" />
              <span>All favorites</span>
              <span className="ml-auto text-xs tabular-nums">{items.length}</span>
            </button>
            {rootGroups.map((group) => {
              const count = items.filter((item) => item.groupId === group.id).length;
              return (
                <button
                  aria-current={selectedGroupId === group.id ? 'page' : undefined}
                  className={`flex h-10 min-w-0 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm transition md:w-full ${
                    selectedGroupId === group.id
                      ? 'bg-primary-light font-medium text-primary'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  type="button"
                >
                  <FolderIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="max-w-40 truncate">{group.title}</span>
                  <span className="ml-auto text-xs tabular-nums">{count}</span>
                </button>
              );
            })}
            <button
              className="flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-left text-sm text-text-secondary transition hover:bg-surface-hover hover:text-text-primary md:w-full"
              onClick={() => setDialog({ type: 'group' })}
              type="button"
            >
              <FolderPlusIcon aria-hidden="true" className="h-4 w-4" />
              <span>New group</span>
            </button>
          </nav>
        </aside>

        <section className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">
                  {selectedGroup?.title ?? 'All favorites'}
                </h1>
                <p className="mt-1 text-sm text-text-secondary">
                  {visibleItems.length}{' '}
                  {visibleItems.length === 1 ? 'favorite' : 'favorites'}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
              <p
                aria-live="polite"
                className={`mb-4 rounded-md border px-3 py-2 text-sm ${error ? 'border-danger/30 bg-danger-light text-danger' : 'border-success/30 bg-success-light text-text-primary'}`}
                role={error ? 'alert' : 'status'}
              >
                {error ?? notice}
              </p>
            )}

            {loading ? (
              <div
                aria-label="Loading favorites"
                className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
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
                {visibleItems.map((item) => (
                  <FavoriteCard
                    item={item}
                    key={item.id}
                    layout={layout}
                    onDelete={(selected) => void removeFavorite(selected)}
                    onEdit={(selected) => setDialog({ type: 'favorite', item: selected })}
                    onOpenError={setNotice}
                  />
                ))}
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
          groups={rootGroups}
          initialGroupId={dialog.groupId}
          item={dialog.item}
          onClose={() => setDialog(null)}
          onSave={saveFavorite}
        />
      )}
      {dialog?.type === 'group' && (
        <GroupDialog onClose={() => setDialog(null)} onSave={saveGroup} />
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
