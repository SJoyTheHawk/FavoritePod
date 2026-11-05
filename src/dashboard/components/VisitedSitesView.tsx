import {
  ArrowPathIcon,
  BookmarkIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { FaviconImage } from '../../components/FaviconImage';
import type { Group } from '../../core/types';
import type { VisitedSiteSuggestion } from '../../core/discovery';
import { getUrlLabel } from '../../core/validation';
import { getGroupLabels } from '../group-labels';

interface VisitedSitesViewProps {
  enabled: boolean;
  groups: Group[];
  suggestions: VisitedSiteSuggestion[];
  selectedGroupId: string;
  loading: boolean;
  error?: string;
  savingUrl?: string;
  onGroupChange: (groupId: string) => void;
  onSave: (suggestion: VisitedSiteSuggestion) => void;
  onHide: (suggestion: VisitedSiteSuggestion) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

export function VisitedSitesView({
  enabled,
  groups,
  suggestions,
  selectedGroupId,
  loading,
  error,
  savingUrl,
  onGroupChange,
  onSave,
  onHide,
  onRefresh,
  onOpenSettings,
}: VisitedSitesViewProps) {
  const labels = getGroupLabels(groups);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Frequently visited</h1>
          {enabled && (
            <p className="mt-1 text-sm text-text-secondary">
              Suggestions are based on Chrome top sites and recent history.
            </p>
          )}
        </div>
        {enabled && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 items-center gap-2 text-sm text-text-secondary">
              Save to
              <select
                aria-label="Save suggestions to group"
                className="h-10 min-w-0 max-w-56 rounded-md border border-border bg-background px-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onChange={(event) => onGroupChange(event.target.value)}
                value={selectedGroupId}
              >
                {!groups.length && <option value="">Favorites</option>}
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {labels.get(group.id) ?? group.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              aria-label="Refresh suggestions"
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:cursor-wait disabled:opacity-50"
              disabled={loading}
              onClick={onRefresh}
              title="Refresh suggestions"
              type="button"
            >
              <ArrowPathIcon
                aria-hidden="true"
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        )}
      </div>

      {!enabled ? (
        <div className="flex min-h-64 flex-col items-center justify-center border-t border-border px-6 text-center">
          <GlobeAltIcon aria-hidden="true" className="h-8 w-8 text-text-tertiary" />
          <h2 className="mt-3 text-base font-semibold">Discovery is off</h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-text-secondary">
            Allow access to your Chrome top sites and browsing history to find pages you
            might want to save.
          </p>
          <button
            className="mt-4 min-h-10 rounded-md bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-hover"
            onClick={onOpenSettings}
            type="button"
          >
            Enable in Settings
          </button>
        </div>
      ) : error ? (
        <div className="border-t border-border py-8 text-center">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          <button
            className="mt-3 min-h-9 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
            onClick={onRefresh}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div
          aria-busy="true"
          aria-label="Loading suggestions"
          className="divide-y divide-border border-y border-border"
        >
          {Array.from({ length: 6 }, (_, index) => (
            <div className="flex h-16 items-center gap-3" key={index}>
              <div className="h-9 w-9 animate-pulse rounded-md bg-surface-hover" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/3 animate-pulse rounded bg-surface-hover" />
                <div className="h-3 w-1/4 animate-pulse rounded bg-surface-hover" />
              </div>
            </div>
          ))}
        </div>
      ) : suggestions.length ? (
        <ul className="divide-y divide-border border-y border-border">
          {suggestions.map((suggestion) => (
            <li
              className="flex min-w-0 flex-wrap items-center gap-3 py-3 sm:flex-nowrap"
              key={suggestion.url}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
                <FaviconImage
                  className="h-6 w-6"
                  fallback={
                    <GlobeAltIcon
                      aria-hidden="true"
                      className="h-5 w-5 text-text-tertiary"
                    />
                  }
                  url={suggestion.url}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block truncate text-sm font-medium text-text-primary"
                  title={suggestion.title}
                >
                  {suggestion.title}
                </span>
                <span
                  className="mt-0.5 block truncate text-xs text-text-secondary"
                  title={suggestion.url}
                >
                  {getUrlLabel(suggestion.url)}
                </span>
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <button
                  aria-label={`Save ${suggestion.title}`}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition hover:bg-primary-light hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={savingUrl !== undefined}
                  onClick={() => onSave(suggestion)}
                  title="Save to group"
                  type="button"
                >
                  <PlusIcon aria-hidden="true" className="h-4 w-4" />
                </button>
                <button
                  aria-label={`Hide ${suggestion.title}`}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
                  onClick={() => onHide(suggestion)}
                  title="Hide suggestion"
                  type="button"
                >
                  <EyeSlashIcon aria-hidden="true" className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center border-t border-border px-6 text-center">
          <BookmarkIcon aria-hidden="true" className="h-8 w-8 text-text-tertiary" />
          <h2 className="mt-3 text-base font-semibold">No suggestions</h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-text-secondary">
            New suggestions will appear as Chrome records frequently visited pages.
          </p>
        </div>
      )}
    </div>
  );
}
