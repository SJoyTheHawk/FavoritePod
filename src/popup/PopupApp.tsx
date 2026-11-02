import { useEffect, useState } from 'react';
import {
  BookmarkIcon,
  CheckCircleIcon,
  DocumentIcon,
  FolderIcon,
  GlobeAltIcon,
} from '@heroicons/react/24/outline';
import { captureThumbnail } from '../core/thumbnail';
import { createItem, getLastUsedGroupId } from '../core/storage';
import { useLibrary, useRecentItems } from '../core/use-library';
import { getDefaultTitle, getUrlLabel, parseSafeUrl } from '../core/validation';
import type { ThumbnailInput } from '../core/types';

export function PopupApp() {
  const { groups } = useLibrary();
  const { items: recentItems } = useRecentItems(5);
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [groupId, setGroupId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string>();
  const [previewNotice, setPreviewNotice] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);

  useEffect(() => {
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([activeTab]) => setTab(activeTab));
    void getLastUsedGroupId().then((lastGroupId) => {
      if (lastGroupId) setGroupId(lastGroupId);
    });
  }, []);

  useEffect(() => {
    if (groups.length === 0) return;
    if (groups.some((group) => group.id === groupId)) return;
    void getLastUsedGroupId().then((lastGroupId) => {
      setGroupId(
        lastGroupId && groups.some((group) => group.id === lastGroupId)
          ? lastGroupId
          : groups[0].id,
      );
    });
  }, [groups, groupId]);

  const currentUrl = tab?.url ?? '';
  const parsedCurrentUrl = parseSafeUrl(currentUrl);
  const pageTitle = tab?.title?.trim() || getDefaultTitle(currentUrl) || 'Untitled page';

  useEffect(() => setFaviconFailed(false), [tab?.favIconUrl]);

  const saveCurrentPage = async () => {
    if (!parsedCurrentUrl) return;
    setSaving(true);
    setError(undefined);
    setSaved(false);
    setPreviewNotice(false);

    let thumbnail: ThumbnailInput | undefined;
    try {
      thumbnail = await captureThumbnail(tab?.windowId);
    } catch {
      setPreviewNotice(true);
    }

    try {
      const item = await createItem({
        url: currentUrl,
        title: pageTitle,
        groupId: groupId || undefined,
        thumbnail,
      });
      setGroupId(item.groupId);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this page.');
    } finally {
      setSaving(false);
    }
  };

  const openItem = async (url: string) => {
    try {
      await chrome.tabs.create({ url });
      window.close();
    } catch {
      setError(
        'Chrome could not open this address. Check file URL access in extension settings.',
      );
    }
  };

  return (
    <main className="flex h-[480px] w-80 flex-col overflow-hidden bg-background text-text-primary">
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary">
            <BookmarkIcon aria-hidden="true" className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">FavoritePod</h1>
            <p className="mt-0.5 text-xs text-text-secondary">Quick save</p>
          </div>
        </div>
      </header>

      <section className="border-b border-border px-4 py-4">
        <div className="mb-2 flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface text-text-secondary">
            {tab?.favIconUrl && !faviconFailed ? (
              <img
                alt=""
                className="h-5 w-5 object-contain"
                onError={() => setFaviconFailed(true)}
                src={tab.favIconUrl}
              />
            ) : parsedCurrentUrl?.protocol === 'file:' ? (
              <DocumentIcon aria-hidden="true" className="h-4 w-4" />
            ) : (
              <GlobeAltIcon aria-hidden="true" className="h-4 w-4" />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" title={pageTitle}>
              {tab ? pageTitle : 'Loading current page…'}
            </p>
            <p className="mt-0.5 truncate text-xs text-text-tertiary" title={currentUrl}>
              {currentUrl ? getUrlLabel(currentUrl) : ''}
            </p>
          </div>
        </div>

        {groups.length > 0 && (
          <label className="mb-3 flex h-9 items-center gap-2 rounded-md border border-border px-2.5 text-xs text-text-secondary">
            <FolderIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span className="shrink-0">Save to</span>
            <select
              aria-label="Save to group"
              className="min-w-0 flex-1 bg-transparent text-right text-xs text-text-primary outline-none"
              onChange={(event) => setGroupId(event.target.value)}
              value={groupId}
            >
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!parsedCurrentUrl || saving || saved}
          onClick={() => void saveCurrentPage()}
          type="button"
        >
          {saved ? (
            <>
              <CheckCircleIcon aria-hidden="true" className="h-4 w-4" />
              Saved
            </>
          ) : saving ? (
            'Saving…'
          ) : (
            <>
              <BookmarkIcon aria-hidden="true" className="h-4 w-4" />
              Save current page
            </>
          )}
        </button>
        {!parsedCurrentUrl && tab && (
          <p className="mt-2 text-xs text-text-secondary">
            This browser page can’t be saved.
          </p>
        )}
        {previewNotice && saved && (
          <p className="mt-2 text-xs text-text-secondary">
            Saved without a page preview.
          </p>
        )}
        {error && (
          <p className="mt-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase text-text-tertiary">
            Recently saved
          </h2>
          <span className="text-xs tabular-nums text-text-tertiary">
            {recentItems.length}
          </span>
        </div>
        {recentItems.length > 0 ? (
          <ul className="divide-y divide-border">
            {recentItems.map((item) => {
              const isLocal = parseSafeUrl(item.url)?.protocol === 'file:';
              return (
                <li key={item.id}>
                  <button
                    className="flex min-h-[54px] w-full items-center gap-3 py-2 text-left transition hover:bg-surface-hover"
                    onClick={() => void openItem(item.url)}
                    type="button"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-text-secondary">
                      {isLocal ? (
                        <DocumentIcon aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <GlobeAltIcon aria-hidden="true" className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-text-tertiary">
                        {getUrlLabel(item.url)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-md bg-surface px-3 py-3 text-sm text-text-secondary">
            No favorites yet
          </p>
        )}
      </section>

      <footer className="border-t border-border p-3">
        <button
          className="min-h-9 w-full rounded-md text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          onClick={() =>
            void chrome.tabs.create({
              url: chrome.runtime.getURL('src/dashboard/dashboard.html'),
            })
          }
          type="button"
        >
          Open launcher
        </button>
      </footer>
    </main>
  );
}
