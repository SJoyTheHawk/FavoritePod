import { useMemo, useRef, useState, type DragEvent } from 'react';
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { downloadZip, exportToZip } from '../../core/export';
import { importArchive, parseImportFile, type ImportMode } from '../../core/import';
import type { ArchiveProgress, ImportArchive, ImportResult } from '../../core/archive';
import type { Group } from '../../core/types';
import { getGroupLabels } from '../group-labels';

export type ArchiveDialogMode = 'export' | 'import';

interface ImportExportDialogProps {
  mode: ArchiveDialogMode;
  groups: Group[];
  onClose: () => void;
  onImported: (mode: ImportMode, result: ImportResult) => void;
}

interface GroupRow {
  group: Group;
  depth: number;
}

function groupRows(groups: Group[]): GroupRow[] {
  const childrenByParent = new Map<string | null, Group[]>();
  for (const group of groups) {
    const siblings = childrenByParent.get(group.parentId) ?? [];
    siblings.push(group);
    childrenByParent.set(group.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) {
    siblings.sort((left, right) =>
      left.orderKey === right.orderKey
        ? left.id.localeCompare(right.id)
        : left.orderKey < right.orderKey
          ? -1
          : 1,
    );
  }

  const rows: GroupRow[] = [];
  const visit = (siblings: Group[], depth: number) => {
    for (const group of siblings) {
      rows.push({ group, depth });
      visit(childrenByParent.get(group.id) ?? [], depth + 1);
    }
  };
  visit(childrenByParent.get(null) ?? [], 0);
  return rows;
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'The archive operation failed.';
}

function progressLabel(progress: ArchiveProgress | undefined): string | undefined {
  if (!progress) return undefined;
  if (progress.stage === 'validating') {
    return progress.total
      ? `Checking previews ${progress.current} of ${progress.total}`
      : 'Checking archive';
  }
  return progress.total
    ? `Importing records ${progress.current} of ${progress.total}`
    : 'Importing archive';
}

export function ImportExportDialog({
  mode,
  groups,
  onClose,
  onImported,
}: ImportExportDialogProps) {
  const [allGroupsSelected, setAllGroupsSelected] = useState(true);
  const [selectedGroupIds, setSelectedGroupIds] = useState(
    () => new Set(groups.map((group) => group.id)),
  );
  const [archive, setArchive] = useState<ImportArchive>();
  const [importMode, setImportMode] = useState<ImportMode>('copy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [progress, setProgress] = useState<ArchiveProgress>();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draggingFile, setDraggingFile] = useState(false);
  const labels = useMemo(() => getGroupLabels(groups), [groups]);
  const rows = useMemo(() => groupRows(groups), [groups]);
  const descendants = useMemo(() => {
    const byParent = new Map<string, string[]>();
    for (const group of groups) {
      if (!group.parentId) continue;
      const children = byParent.get(group.parentId) ?? [];
      children.push(group.id);
      byParent.set(group.parentId, children);
    }
    return (id: string): string[] => {
      const result = [id];
      for (const childId of byParent.get(id) ?? [])
        result.push(...descendantsFor(childId));
      return result;
    };
    function descendantsFor(id: string): string[] {
      const result = [id];
      for (const childId of byParent.get(id) ?? [])
        result.push(...descendantsFor(childId));
      return result;
    }
  }, [groups]);

  const toggleGroup = (id: string) => {
    const selected = allGroupsSelected
      ? new Set(groups.map((group) => group.id))
      : new Set(selectedGroupIds);
    const ids = descendants(id);
    if (selected.has(id)) {
      for (const groupId of ids) selected.delete(groupId);
    } else {
      for (const groupId of ids) selected.add(groupId);
    }
    setAllGroupsSelected(false);
    setSelectedGroupIds(selected);
  };

  const chooseFile = async (file?: File) => {
    if (!file || busy) return;
    setArchive(undefined);
    setError(undefined);
    setBusy(true);
    setProgress({ stage: 'validating', current: 0, total: 0 });
    try {
      setArchive(await parseImportFile(file, setProgress));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setProgress(undefined);
      setBusy(false);
    }
  };

  const exportLibrary = async () => {
    setBusy(true);
    setError(undefined);
    setProgress(undefined);
    try {
      const blob = await exportToZip({
        groupIds: allGroupsSelected ? undefined : [...selectedGroupIds],
        onProgress: (current, total) =>
          setProgress({ stage: 'validating', current, total }),
      });
      const date = new Date().toISOString().slice(0, 10);
      downloadZip(blob, `favoritepod-${date}.zip`);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  };

  const applyImport = async () => {
    if (!archive) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await importArchive(archive, importMode, setProgress);
      onImported(importMode, result);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  };

  const onFileDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingFile(false);
    if (busy) return;
    void chooseFile(event.dataTransfer.files[0]);
  };

  const currentProgress = progressLabel(progress);

  return (
    <Dialog className="relative z-50" onClose={busy ? () => {} : onClose} open>
      <DialogBackdrop className="fixed inset-0 bg-black/35" />
      <div className="fixed inset-0 flex items-center justify-center overflow-y-auto p-4">
        <DialogPanel className="max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-lg border border-border bg-background p-5 shadow-xl sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              {mode === 'export' ? (
                <ArrowDownTrayIcon aria-hidden="true" className="h-5 w-5 text-primary" />
              ) : (
                <ArrowUpTrayIcon aria-hidden="true" className="h-5 w-5 text-primary" />
              )}
              {mode === 'export' ? 'Export library' : 'Import library'}
            </DialogTitle>
            <button
              aria-label="Close archive dialog"
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:opacity-50"
              disabled={busy}
              onClick={onClose}
              title="Close"
              type="button"
            >
              <XMarkIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          {mode === 'export' ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-text-primary">Groups</h2>
                <div className="flex gap-1">
                  <button
                    className="min-h-8 rounded px-2 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    disabled={busy}
                    onClick={() => setAllGroupsSelected(true)}
                    type="button"
                  >
                    Select all
                  </button>
                  <button
                    className="min-h-8 rounded px-2 text-xs font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
                    disabled={busy}
                    onClick={() => {
                      setAllGroupsSelected(false);
                      setSelectedGroupIds(new Set());
                    }}
                    type="button"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="max-h-72 divide-y divide-border overflow-y-auto rounded-md border border-border">
                {rows.length ? (
                  rows.map(({ group, depth }) => (
                    <label
                      className="flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-hover"
                      key={group.id}
                      style={{ paddingLeft: `${12 + Math.min(depth, 6) * 16}px` }}
                    >
                      <input
                        checked={allGroupsSelected || selectedGroupIds.has(group.id)}
                        className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                        disabled={busy}
                        onChange={() => toggleGroup(group.id)}
                        type="checkbox"
                      />
                      <span className="min-w-0 truncate">
                        {labels.get(group.id) ?? group.title}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-3 py-4 text-sm text-text-secondary">No groups yet.</p>
                )}
              </div>
              {!allGroupsSelected && selectedGroupIds.size === 0 && (
                <p className="mt-2 text-xs text-warning">Select at least one group.</p>
              )}
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              <div
                className={`rounded-md border border-dashed p-5 text-center transition-colors ${draggingFile ? 'border-primary bg-primary-light/40' : 'border-border bg-surface'}`}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDraggingFile(true);
                }}
                onDragLeave={(event) => {
                  if (event.currentTarget === event.target) setDraggingFile(false);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={onFileDrop}
              >
                <input
                  accept=".zip,application/zip"
                  className="sr-only"
                  id="favoritepod-import-file"
                  onChange={(event) => {
                    void chooseFile(event.currentTarget.files?.[0]);
                    event.currentTarget.value = '';
                  }}
                  ref={inputRef}
                  type="file"
                />
                <ArrowUpTrayIcon
                  aria-hidden="true"
                  className="mx-auto h-7 w-7 text-text-secondary"
                />
                <p className="mt-2 text-sm font-medium text-text-primary">
                  Drop a ZIP file here
                </p>
                <button
                  className="mt-2 min-h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover disabled:opacity-50"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  Choose file
                </button>
              </div>

              {archive && (
                <div className="border-t border-border pt-3">
                  <div className="flex items-start gap-2">
                    <CheckCircleIcon
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-success"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">
                        {archive.filename}
                      </p>
                      <p className="mt-1 text-xs text-text-secondary">
                        {archive.data.groups.length}{' '}
                        {archive.data.groups.length === 1 ? 'group' : 'groups'}
                        {' · '}
                        {archive.data.items.length}{' '}
                        {archive.data.items.length === 1 ? 'favorite' : 'favorites'}
                        {' · '}
                        {archive.thumbnails.size}{' '}
                        {archive.thumbnails.size === 1 ? 'preview' : 'previews'}
                      </p>
                    </div>
                  </div>
                  <fieldset className="mt-4 grid gap-2">
                    <legend className="mb-1 text-sm font-medium text-text-primary">
                      Import mode
                    </legend>
                    {(
                      [
                        {
                          value: 'copy',
                          title: 'Merge as copy',
                          detail: 'Adds the archive under a new group.',
                        },
                        {
                          value: 'update',
                          title: 'Update from source',
                          detail: 'Updates matching IDs and keeps other local records.',
                        },
                        {
                          value: 'replace',
                          title: 'Replace library',
                          detail:
                            'Replaces groups and favorites after saving a snapshot.',
                        },
                      ] as const
                    ).map((option) => (
                      <label
                        className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2.5 transition ${importMode === option.value ? 'border-primary bg-primary-light/30' : 'border-border hover:bg-surface-hover'}`}
                        key={option.value}
                      >
                        <input
                          checked={importMode === option.value}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                          disabled={busy}
                          name="favoritepod-import-mode"
                          onChange={() => setImportMode(option.value)}
                          type="radio"
                          value={option.value}
                        />
                        <span className="grid min-w-0 gap-0.5">
                          <span className="text-sm font-medium text-text-primary">
                            {option.title}
                          </span>
                          <span className="text-xs leading-relaxed text-text-secondary">
                            {option.detail}
                          </span>
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </div>
              )}
            </div>
          )}

          {currentProgress && (
            <div className="mt-4" aria-live="polite">
              <div className="mb-1 flex justify-between gap-3 text-xs text-text-secondary">
                <span>{currentProgress}</span>
                {progress && progress.total > 0 && (
                  <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                )}
              </div>
              <div
                aria-label={currentProgress}
                aria-valuemax={progress?.total ?? 1}
                aria-valuemin={0}
                aria-valuenow={progress?.current ?? 0}
                className="h-1.5 overflow-hidden rounded-full bg-surface-hover"
                role="progressbar"
              >
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{
                    width: `${progress?.total ? (progress.current / progress.total) * 100 : 30}%`,
                  }}
                />
              </div>
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
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            {mode === 'export' ? (
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || (!allGroupsSelected && selectedGroupIds.size === 0)}
                onClick={() => void exportLibrary()}
                type="button"
              >
                <ArrowDownTrayIcon aria-hidden="true" className="h-4 w-4" />
                {busy ? 'Preparing...' : 'Download ZIP'}
              </button>
            ) : (
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy || !archive}
                onClick={() => void applyImport()}
                type="button"
              >
                <ArrowUpTrayIcon aria-hidden="true" className="h-4 w-4" />
                {busy ? 'Importing...' : 'Import'}
              </button>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
