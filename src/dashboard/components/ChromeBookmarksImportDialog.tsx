import { useMemo, useRef, useState, type DragEvent } from 'react';
import { DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  ArrowUpTrayIcon,
  BookmarkIcon,
  FolderIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { AnimatedDialog, useDialogTransition } from '../../components/AnimatedDialog';
import { ProgressBar } from '../../components/ProgressBar';
import type { ArchiveProgress, ImportResult } from '../../core/archive';
import { getChromeImportTitle, importBookmarks } from '../../core/import-chrome';
import {
  parseBookmarksHtml,
  type ChromeFolder,
  type ParsedBookmarksFile,
} from '../../core/parse-chrome-bookmarks';
import { isHiddenOnThisPlatform } from '../../core/validation';

interface ChromeBookmarksImportDialogProps {
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}

const PREVIEW_LIMIT = 200;
const PROTOCOL_LABELS: Record<string, string> = {
  'http:': 'HTTP',
  'https:': 'HTTPS',
  'file:': 'Local files',
  'chrome:': 'Chrome shortcuts',
  'chrome-extension:': 'Chrome extensions',
  'ftp:': 'FTP',
  'mailto:': 'Email',
  'tel:': 'Phone',
  'sms:': 'SMS',
};

function previewRows(folders: ChromeFolder[]) {
  const rows: Array<{ title: string; url?: string; depth: number }> = [];
  const pending = folders
    .slice()
    .reverse()
    .map((entry) => ({ entry: entry as ChromeFolder['children'][number], depth: 0 }));
  let hiddenCount = 0;
  while (pending.length) {
    const { entry, depth } = pending.pop()!;
    if ('url' in entry) {
      if (isHiddenOnThisPlatform(entry.url)) hiddenCount += 1;
      if (rows.length < PREVIEW_LIMIT)
        rows.push({ title: entry.title, url: entry.url, depth });
    } else {
      if (entry.title && rows.length < PREVIEW_LIMIT)
        rows.push({ title: entry.title, depth });
      for (const child of entry.children.slice().reverse())
        pending.push({ entry: child, depth: entry.title ? depth + 1 : depth });
    }
  }
  return { rows, hiddenCount };
}

export function ChromeBookmarksImportDialog({
  onClose: onClosed,
  onImported,
}: ChromeBookmarksImportDialogProps) {
  const transition = useDialogTransition(onClosed);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [draggingFile, setDraggingFile] = useState(false);
  const [parsed, setParsed] = useState<ParsedBookmarksFile>();
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<ArchiveProgress>();
  const preview = useMemo(() => previewRows(parsed?.folders ?? []), [parsed]);

  const chooseFile = async (file?: File) => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setParsed(undefined);
    setError(undefined);
    setProgress({ stage: 'validating', current: 0, total: 0 });
    try {
      setParsed(await parseBookmarksHtml(file));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not read the bookmarks file.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress(undefined);
    }
  };

  const applyImport = async () => {
    if (!parsed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(undefined);
    setProgress({
      stage: 'writing',
      current: 0,
      total: parsed.folderCount + parsed.bookmarkCount + 1,
    });
    try {
      const result = await importBookmarks(parsed, setProgress);
      onImported(result);
      transition.close();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not import the bookmarks.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
      setProgress(undefined);
    }
  };

  const onFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingFile(false);
    if (event.dataTransfer.files.length !== 1) {
      if (!busyRef.current) setError('Choose one bookmarks HTML file at a time.');
      return;
    }
    void chooseFile(event.dataTransfer.files[0]);
  };
  const progressLabel =
    progress?.stage === 'writing'
      ? `Importing records ${progress.current} of ${progress.total}`
      : 'Reading bookmarks';

  return (
    <AnimatedDialog
      className="relative z-50"
      onClose={() => {
        if (!busyRef.current) transition.close();
      }}
      open={transition.open}
      afterLeave={transition.afterLeave}
    >
      <DialogBackdrop transition className="dialog-backdrop fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel
          transition
          aria-busy={busy}
          className="dialog-panel max-h-[calc(100vh-2rem)] w-full min-w-0 max-w-xl overflow-x-hidden overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <ArrowUpTrayIcon
                aria-hidden="true"
                className="h-5 w-5 shrink-0 text-primary"
              />
              {parsed ? 'Review Chrome bookmarks' : 'Import Chrome bookmarks'}
            </DialogTitle>
            <button
              aria-label="Close bookmarks import dialog"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
              disabled={busy}
              onClick={transition.close}
              type="button"
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <input
            accept=".html,.htm,text/html"
            aria-label="Choose Chrome bookmarks HTML file"
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              void chooseFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
            ref={inputRef}
            tabIndex={-1}
            type="file"
          />
          {parsed ? (
            <div className="mt-5 grid min-w-0 gap-4">
              <div className="min-w-0">
                <p
                  className="truncate text-xs text-text-secondary"
                  title={parsed.filename}
                >
                  {parsed.filename}
                </p>
                <p className="mt-2 text-sm font-medium text-text-primary">
                  {parsed.bookmarkCount.toLocaleString()}{' '}
                  {parsed.bookmarkCount === 1 ? 'bookmark' : 'bookmarks'} ·{' '}
                  {parsed.folderCount.toLocaleString()}{' '}
                  {parsed.folderCount === 1 ? 'folder' : 'folders'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-text-secondary">
                  {Object.entries(parsed.protocolCounts)
                    .map(
                      ([protocol, count]) =>
                        `${PROTOCOL_LABELS[protocol] ?? protocol}: ${count.toLocaleString()}`,
                    )
                    .join(' · ')}
                </p>
              </div>
              <p className="break-words rounded-md border border-border bg-surface p-3 text-sm text-text-primary">
                Bookmarks will be added in a new folder “
                {getChromeImportTitle(parsed.filename)}”.
              </p>
              <section className="min-w-0">
                <h2 className="text-sm font-medium text-text-primary">
                  Folder and bookmark preview
                </h2>
                <ul
                  aria-label="Bookmarks to import"
                  className="mt-2 max-h-60 min-w-0 divide-y divide-border overflow-y-auto rounded-md border border-border"
                >
                  {preview.rows.map((row, index) => (
                    <li
                      className="flex min-w-0 items-center gap-2 px-3 py-2"
                      key={index}
                      style={{ paddingLeft: 12 + Math.min(row.depth, 8) * 16 }}
                    >
                      {row.url ? (
                        <BookmarkIcon
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-text-secondary"
                        />
                      ) : (
                        <FolderIcon
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-primary"
                        />
                      )}
                      <span className="min-w-0" title={row.url ?? row.title}>
                        <span className="block truncate text-sm text-text-primary">
                          {row.title}
                        </span>
                        {row.url && (
                          <span className="block truncate text-xs text-text-secondary">
                            {row.url}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {parsed.bookmarkCount + parsed.folderCount > PREVIEW_LIMIT && (
                  <p className="mt-1 text-xs text-text-secondary">
                    Showing the first {PREVIEW_LIMIT} entries. All entries will be
                    imported.
                  </p>
                )}
              </section>
              {preview.hiddenCount > 0 && (
                <p className="text-xs leading-relaxed text-text-secondary">
                  {preview.hiddenCount}{' '}
                  {preview.hiddenCount === 1 ? 'bookmark is' : 'bookmarks are'} hidden by
                  default on this device. Enable “Show hidden bookmarks” in Settings to
                  manage them.
                </p>
              )}
              {parsed.skipped.length > 0 && (
                <details className="min-w-0 rounded-md border border-warning/40 bg-warning-light/40 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-text-primary">
                    Skipped entries ({parsed.skipped.length.toLocaleString()})
                  </summary>
                  <ul className="mt-2 max-h-40 min-w-0 space-y-2 overflow-y-auto">
                    {parsed.skipped.slice(0, 100).map((entry, index) => (
                      <li className="min-w-0 text-xs" key={index}>
                        <p className="truncate text-text-primary" title={entry.url}>
                          {entry.title || entry.url || 'Untitled bookmark'}
                        </p>
                        {entry.url && (
                          <p className="truncate text-text-secondary">{entry.url}</p>
                        )}
                        <p className="text-text-secondary">{entry.reason}</p>
                      </li>
                    ))}
                  </ul>
                  {parsed.skipped.length > 100 && (
                    <p className="mt-2 text-xs text-text-secondary">
                      Showing the first 100 skipped entries.
                    </p>
                  )}
                </details>
              )}
            </div>
          ) : (
            <div className="mt-5">
              <div
                className={`rounded-md border border-dashed p-5 text-center transition-colors ${draggingFile ? 'border-primary bg-primary-light/40' : 'border-border bg-surface'}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (!busyRef.current) setDraggingFile(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null))
                    setDraggingFile(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onFileDrop}
              >
                <ArrowUpTrayIcon
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-text-secondary"
                />
                <p className="mt-2 text-sm font-medium text-text-primary">
                  Drop Chrome bookmarks HTML here
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  HTML or HTM · Up to 20 MB
                </p>
                <button
                  className="mt-3 min-h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
                  data-autofocus
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  Choose file
                </button>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-text-secondary">
                In Chrome, open Bookmark Manager → ⋮ → Export Bookmarks, then choose the
                exported HTML file here.
              </p>
            </div>
          )}
          {busy && (
            <div className="mt-4" aria-live="polite">
              <p className="mb-1 text-xs text-text-secondary">{progressLabel}</p>
              <ProgressBar
                label={progressLabel}
                current={progress?.current}
                total={progress?.total}
              />
            </div>
          )}
          {error && (
            <p
              className="mt-4 rounded-md border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger"
              role="alert"
            >
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <button
              className="min-h-10 rounded-md border border-border px-4 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
              disabled={busy}
              onClick={transition.close}
              type="button"
            >
              Cancel
            </button>
            {parsed && (
              <>
                <button
                  className="min-h-10 rounded-md border border-border px-4 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    setParsed(undefined);
                    setError(undefined);
                  }}
                  type="button"
                >
                  Back
                </button>
                <button
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void applyImport()}
                  type="button"
                >
                  <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />
                  {busy ? 'Importing…' : 'Import bookmarks'}
                </button>
              </>
            )}
          </div>
        </DialogPanel>
      </div>
    </AnimatedDialog>
  );
}
