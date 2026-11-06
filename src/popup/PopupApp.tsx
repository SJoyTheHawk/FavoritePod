import { useEffect, useState } from 'react';
import {
  DocumentIcon,
  GlobeAltIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { dismissRecentItem } from '../core/storage';
import { useLibrary, useRecentItems } from '../core/use-library';
import { getUrlLabel, parseSafeUrl } from '../core/validation';
import { FILE_ACCESS_DENIED, openSavedUrl } from '../core/file-links';
import { BookmarkDialog } from './BookmarkDialog';
import { POPUP_PATH, readPopupSaveRequest } from '../core/popup-save-request';
import { FaviconImage } from '../components/FaviconImage';
import { installDriveSyncChangeHooks } from '../core/drive-sync-triggers';

installDriveSyncChangeHooks();

export function PopupApp() {
  const { groups, items, loading: libraryLoading, error: libraryError } = useLibrary();
  const { items: recentItems, loading: recentLoading } = useRecentItems(5);
  const [tab, setTab] = useState<chrome.tabs.Tab>();
  const [tabLoading, setTabLoading] = useState(true);
  const [saveRequest] = useState(() => readPopupSaveRequest(window.location.href));
  const [dialogOpen, setDialogOpen] = useState(Boolean(saveRequest));
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!dialogOpen) return;
    const previous = document.documentElement.style.overflow;
    const previousBody = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
      document.body.style.overflow = previousBody;
    };
  }, [dialogOpen]);

  useEffect(() => {
    let active = true;
    if (saveRequest) {
      // Consume this invocation so reloading/opening the toolbar never repeats it.
      window.history.replaceState(null, '', window.location.pathname);
      void chrome.action
        .setPopup({ tabId: saveRequest.sourceTabId, popup: POPUP_PATH })
        .catch(() => undefined);
      setTab({
        id: saveRequest.sourceTabId,
        windowId: saveRequest.sourceWindowId,
        url: saveRequest.url,
        title: saveRequest.title,
      } as chrome.tabs.Tab);
      setTabLoading(false);
      return;
    }
    void chrome.tabs
      .query({ active: true, currentWindow: true })
      .then(([activeTab]) => {
        if (active) setTab(activeTab);
      })
      .catch(() => {
        if (active) setError('Could not read the current browser tab.');
      })
      .finally(() => {
        if (active) setTabLoading(false);
      });
    return () => {
      active = false;
    };
  }, [saveRequest]);

  const currentUrl = tab?.url ?? '';
  const parsedCurrentUrl = parseSafeUrl(currentUrl);
  const canAddCurrentPage = !tabLoading && !libraryLoading && Boolean(parsedCurrentUrl);

  const openItem = async (url: string) => {
    setError(undefined);
    try {
      await openSavedUrl(url);
      window.close();
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message === FILE_ACCESS_DENIED
          ? 'File access is turned off. Enable "Allow access to file URLs" in Chrome extension settings.'
          : 'Chrome could not open this address. Check the URL and try again.',
      );
    }
  };

  const openLauncher = async () => {
    setError(undefined);
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('src/dashboard/dashboard.html'),
      });
      window.close();
    } catch {
      setError('Chrome could not open the launcher.');
    }
  };

  const openBookmarkDialog = () => {
    setError(undefined);
    setDialogOpen(true);
  };

  const dismissPage = async (id: string) => {
    try {
      await dismissRecentItem(id);
    } catch {
      setError('Could not remove this page from recents. Please try again.');
    }
  };

  return (
    <main
      className={
        saveRequest || dialogOpen
          ? 'flex h-[600px] w-80 flex-col overflow-hidden bg-background text-text-primary'
          : 'flex h-fit w-80 flex-col bg-background text-text-primary'
      }
    >
      {!saveRequest && (
        <>
          <header className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4">
            <img
              alt=""
              aria-hidden="true"
              className="h-8 w-8 rounded-md object-cover"
              src="/icons/icon_light.jpg"
            />
            <h1 className="text-sm font-semibold">FavoritePod</h1>
          </header>

          <section className="shrink-0 border-b border-border px-4 py-3">
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canAddCurrentPage}
              onClick={openBookmarkDialog}
              type="button"
            >
              <PlusIcon aria-hidden="true" className="h-4 w-4" />
              Add bookmark
            </button>
            {!tabLoading && tab && !parsedCurrentUrl && (
              <p className="mt-2 text-xs text-text-secondary">
                This browser page can’t be saved.
              </p>
            )}
          </section>

          <section className="shrink-0 px-4 py-3">
            <div className="mb-2 flex h-5 items-center justify-between">
              <h2 className="text-xs font-semibold uppercase text-text-tertiary">
                Recent pages (up to 5)
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
                      <div className="flex min-h-10 items-center gap-2">
                        <button
                          className="flex min-w-0 flex-1 items-center gap-3 py-0.5 text-left transition hover:bg-surface-hover"
                          onClick={() => void openItem(item.url)}
                          type="button"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface text-text-secondary">
                            <FaviconImage
                              fallback={
                                isLocal ? (
                                  <DocumentIcon aria-hidden="true" className="h-4 w-4" />
                                ) : (
                                  <GlobeAltIcon aria-hidden="true" className="h-4 w-4" />
                                )
                              }
                              faviconUrl={item.faviconUrl}
                              url={item.url}
                            />
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
                        <button
                          aria-label={`Remove ${item.title} from recent pages`}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition hover:bg-surface-hover hover:text-text-primary"
                          onClick={() => void dismissPage(item.id)}
                          title="Remove from recent pages"
                          type="button"
                        >
                          <XMarkIcon aria-hidden="true" className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : recentLoading || libraryLoading ? (
              <p className="py-3 text-sm text-text-secondary">Loading recent pages…</p>
            ) : (
              <p className="rounded-md bg-surface px-3 py-3 text-sm text-text-secondary">
                No recent pages
              </p>
            )}
            {(error || libraryError) && (
              <p className="mt-2 text-xs text-danger" role="alert">
                {error ?? libraryError}
              </p>
            )}
          </section>

          <footer className="flex h-[52px] shrink-0 items-center border-t border-border px-3">
            <button
              className="h-9 w-full rounded-md text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
              onClick={() => void openLauncher()}
              type="button"
            >
              Open launcher
            </button>
          </footer>
        </>
      )}

      {dialogOpen && tab && (
        <BookmarkDialog
          groups={groups}
          items={items}
          libraryLoading={libraryLoading}
          onClose={() => (saveRequest ? window.close() : setDialogOpen(false))}
          saveRequest={saveRequest}
          tab={tab}
        />
      )}
    </main>
  );
}
