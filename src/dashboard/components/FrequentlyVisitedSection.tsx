import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  ArrowPathIcon,
  Cog6ToothIcon,
  EllipsisHorizontalIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  PencilSquareIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { FaviconImage } from '../../components/FaviconImage';
import type { VisitedSiteSuggestion } from '../../core/discovery';
import { getUrlLabel } from '../../core/validation';

interface FrequentlyVisitedSectionProps {
  enabled: boolean;
  sites: VisitedSiteSuggestion[];
  savedUrls: ReadonlySet<string>;
  loading: boolean;
  error?: string;
  onOpen: (site: VisitedSiteSuggestion) => void;
  onSave: (site: VisitedSiteSuggestion) => void;
  onHide: (site: VisitedSiteSuggestion) => void;
  onHideSection: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}

function ShortcutMenuAction({
  icon,
  children,
  onClick,
  disabled = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <MenuItem disabled={disabled}>
      <button
        className="flex min-h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-text-primary data-[focus]:bg-surface-hover disabled:opacity-40"
        disabled={disabled}
        onClick={onClick}
        type="button"
      >
        {icon}
        {children}
      </button>
    </MenuItem>
  );
}

const menuClassName =
  'z-40 min-w-44 rounded-md border border-border bg-background p-1 shadow-lg focus:outline-none';

export function FrequentlyVisitedSection({
  enabled,
  sites,
  savedUrls,
  loading,
  error,
  onOpen,
  onSave,
  onHide,
  onHideSection,
  onRefresh,
  onOpenSettings,
}: FrequentlyVisitedSectionProps) {
  return (
    <section
      aria-labelledby="frequently-visited-heading"
      className="mb-5 border-b border-border pb-5"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2
          className="text-sm font-medium text-text-secondary"
          id="frequently-visited-heading"
        >
          Frequently visited
        </h2>
        <Menu>
          <MenuButton
            aria-label="Frequently visited options"
            className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            title="Frequently visited options"
          >
            <EllipsisHorizontalIcon aria-hidden="true" className="h-4 w-4" />
          </MenuButton>
          <MenuItems anchor="bottom end" className={menuClassName}>
            {enabled && (
              <ShortcutMenuAction
                disabled={loading}
                icon={<ArrowPathIcon aria-hidden="true" className="h-4 w-4" />}
                onClick={onRefresh}
              >
                Refresh
              </ShortcutMenuAction>
            )}
            <ShortcutMenuAction
              icon={<Cog6ToothIcon aria-hidden="true" className="h-4 w-4" />}
              onClick={onOpenSettings}
            >
              Settings
            </ShortcutMenuAction>
            <ShortcutMenuAction
              icon={<EyeSlashIcon aria-hidden="true" className="h-4 w-4" />}
              onClick={onHideSection}
            >
              Hide frequently visited
            </ShortcutMenuAction>
          </MenuItems>
        </Menu>
      </div>
      {error ? (
        <div className="flex flex-wrap items-center gap-3 py-2">
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
          <button
            className="min-h-9 rounded-md border border-border px-3 text-sm font-medium transition hover:bg-surface-hover"
            onClick={onRefresh}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : loading ? (
        <div
          aria-busy="true"
          aria-label="Loading frequently visited sites"
          className="flex flex-wrap justify-center gap-2"
          role="status"
        >
          <span className="sr-only">Loading frequently visited sites…</span>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              aria-hidden="true"
              className="flex h-24 w-[6.5rem] shrink-0 flex-col items-center justify-center gap-3"
              key={index}
            >
              <div className="h-12 w-12 animate-pulse rounded-full bg-surface-hover" />
              <div className="h-3 w-16 animate-pulse rounded bg-surface-hover" />
            </div>
          ))}
        </div>
      ) : !enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3 py-2">
          <p className="max-w-lg text-sm leading-relaxed text-text-secondary">
            Open your most-visited sites in one click. Allow Chrome top sites access to
            show your shortcuts.
          </p>
          <button
            className="min-h-9 shrink-0 rounded-md border border-border px-3 text-sm font-medium text-text-primary transition hover:bg-surface-hover"
            onClick={onOpenSettings}
            type="button"
          >
            Enable in Settings
          </button>
        </div>
      ) : sites.length ? (
        <ul className="flex flex-wrap justify-center gap-2">
          {sites.map((site) => {
            const saved = savedUrls.has(site.url);
            return (
              <li
                className="group relative w-[6.5rem] min-w-0 shrink-0 rounded-lg transition hover:bg-surface-hover focus-within:bg-surface-hover"
                key={site.url}
              >
                <button
                  aria-label={'Open ' + site.title}
                  className="flex h-24 w-full min-w-0 flex-col items-center justify-center gap-3 rounded-lg px-2 focus-visible:outline-offset-[-2px]"
                  onClick={() => onOpen(site)}
                  title={site.title + ' — ' + getUrlLabel(site.url)}
                  type="button"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center">
                    <FaviconImage
                      className="h-6 w-6"
                      fallback={
                        <GlobeAltIcon
                          aria-hidden="true"
                          className="h-6 w-6 text-text-secondary"
                        />
                      }
                      url={site.url}
                    />
                  </span>
                  <span className="block w-full truncate text-center text-xs font-medium text-text-primary">
                    {site.title}
                  </span>
                </button>
                <Menu>
                  <MenuButton
                    aria-label={'Actions for ' + site.title}
                    className="bookmark-actions absolute right-0.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-text-secondary opacity-0 transition hover:bg-background hover:text-text-primary focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 data-[open]:opacity-100"
                    title={'Actions for ' + site.title}
                  >
                    <EllipsisHorizontalIcon aria-hidden="true" className="h-4 w-4" />
                  </MenuButton>
                  <MenuItems anchor="bottom end" className={menuClassName}>
                    <ShortcutMenuAction
                      icon={
                        saved ? (
                          <PencilSquareIcon aria-hidden="true" className="h-4 w-4" />
                        ) : (
                          <PlusIcon aria-hidden="true" className="h-4 w-4" />
                        )
                      }
                      onClick={() => onSave(site)}
                    >
                      {saved ? 'Edit favorite' : 'Add to favorites'}
                    </ShortcutMenuAction>
                    <ShortcutMenuAction
                      icon={<EyeSlashIcon aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => onHide(site)}
                    >
                      Hide shortcut
                    </ShortcutMenuAction>
                  </MenuItems>
                </Menu>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="py-2 text-sm text-text-secondary">
          Your frequently visited sites will appear here as you browse.
        </p>
      )}
    </section>
  );
}
