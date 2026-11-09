import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import {
  DEFAULT_SIDEBAR_WIDTH,
  getSidebarWidth,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  setSidebarWidth,
} from '../../core/storage';

interface GroupSidebarProps {
  children: ReactNode;
  collapsed: boolean;
  disabled: boolean;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onOpenSettings: () => void;
  onToggle: () => void;
  onError: (message: string) => void;
}

interface SidebarDrag {
  pointerId: number;
  startX: number;
  startWidth: number;
  preferredWidth: number;
}

export function GroupSidebar({
  children,
  collapsed,
  disabled,
  mobileOpen,
  onMobileClose,
  onOpenSettings,
  onToggle,
  onError,
}: GroupSidebarProps) {
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [ready, setReady] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    () => document.documentElement.clientWidth,
  );
  const drag = useRef<SidebarDrag>();
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const maxWidth = Math.max(
    MIN_SIDEBAR_WIDTH,
    Math.min(MAX_SIDEBAR_WIDTH, viewportWidth - 320),
  );
  const clampWidth = (value: number) =>
    Math.min(maxWidth, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)));
  const displayedWidth = clampWidth(width);

  useEffect(() => {
    let active = true;
    void getSidebarWidth()
      .then((savedWidth) => {
        if (active) setWidth(savedWidth);
      })
      .catch(() => {
        if (active) onError('The saved sidebar width could not be loaded.');
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [onError]);

  useEffect(() => {
    const updateViewport = () => setViewportWidth(document.documentElement.clientWidth);
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    document.documentElement.classList.add('sidebar-resizing');
    return () => document.documentElement.classList.remove('sidebar-resizing');
  }, [resizing]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileClose();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen, onMobileClose]);

  const saveWidth = (nextWidth: number) => {
    setWidth(nextWidth);
    saveQueue.current = saveQueue.current
      .then(() => setSidebarWidth(nextWidth))
      .catch(() => onError('The sidebar width could not be saved.'));
  };

  const cancelResize = () => {
    const current = drag.current;
    if (!current) return;
    drag.current = undefined;
    setWidth(current.preferredWidth);
    setResizing(false);
  };

  const widthForPointer = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current;
    return current && current.pointerId === event.pointerId
      ? clampWidth(current.startWidth + event.clientX - current.startX)
      : undefined;
  };

  return (
    <>
      <button
        aria-hidden={!mobileOpen}
        aria-label="Close favorite groups"
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ease-out motion-reduce:transition-none md:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onMobileClose}
        tabIndex={mobileOpen ? 0 : -1}
        type="button"
      />
      <aside
        aria-label="Favorite groups"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(85vw,22rem)] flex-col border-r border-border bg-background shadow-xl transition-transform duration-300 ease-out motion-reduce:transition-none md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:self-start md:shrink-0 md:border-b-0 md:border-r md:shadow-none md:pointer-events-auto md:translate-x-0 ${mobileOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full'} ${resizing ? 'md:transition-none' : 'md:transition-[width]'} ${collapsed ? 'md:w-14' : 'md:w-[var(--sidebar-width)]'}`}
        style={{ '--sidebar-width': `${displayedWidth}px` } as CSSProperties}
      >
        <div
          className={`flex shrink-0 items-center justify-between border-b border-border px-4 py-4 md:min-h-9 md:border-b-0 md:pt-6 ${collapsed ? 'md:justify-center md:px-2 md:pb-3' : 'md:mb-3 md:justify-end md:px-4'}`}
        >
          <span className="text-sm font-semibold md:hidden">Favorite groups</span>
          <button
            aria-controls="favorite-group-sidebar"
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 md:flex"
            disabled={disabled}
            onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {collapsed ? (
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
          <button
            aria-label="Close favorite groups"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary md:hidden"
            onClick={onMobileClose}
            type="button"
          >
            <XMarkIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div
          className={
            collapsed
              ? 'md:hidden'
              : 'min-h-0 flex-1 overflow-y-auto overscroll-contain md:max-h-none'
          }
          id="favorite-group-sidebar"
        >
          <div className="px-3 py-3 md:px-4 md:pb-6">{children}</div>
        </div>
        <div className="border-t border-border p-3 md:hidden">
          <button
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
            onClick={onOpenSettings}
            type="button"
          >
            <Cog6ToothIcon aria-hidden="true" className="h-5 w-5" />
            Settings
          </button>
        </div>
        {!collapsed && !disabled && ready && (
          <div
            aria-controls="favorite-group-sidebar"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuemax={maxWidth}
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuenow={displayedWidth}
            aria-valuetext={`${displayedWidth} pixels`}
            className="group absolute inset-y-0 left-full z-30 hidden w-2 touch-none cursor-col-resize select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:block"
            onDoubleClick={() => saveWidth(DEFAULT_SIDEBAR_WIDTH)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && drag.current) {
                const pointerId = drag.current.pointerId;
                cancelResize();
                event.currentTarget.releasePointerCapture(pointerId);
                event.preventDefault();
                return;
              }
              if (drag.current) return;
              const step = event.shiftKey ? 64 : 16;
              const nextWidth =
                event.key === 'ArrowLeft'
                  ? displayedWidth - step
                  : event.key === 'ArrowRight'
                    ? displayedWidth + step
                    : event.key === 'Home'
                      ? MIN_SIDEBAR_WIDTH
                      : event.key === 'End'
                        ? maxWidth
                        : undefined;
              if (nextWidth === undefined) return;
              event.preventDefault();
              saveWidth(clampWidth(nextWidth));
            }}
            onLostPointerCapture={cancelResize}
            onPointerCancel={cancelResize}
            onPointerDown={(event) => {
              if (event.button !== 0 || !event.isPrimary || drag.current) return;
              event.preventDefault();
              event.currentTarget.focus({ preventScroll: true });
              event.currentTarget.setPointerCapture(event.pointerId);
              drag.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startWidth:
                  event.currentTarget.parentElement!.getBoundingClientRect().width,
                preferredWidth: width,
              };
              setResizing(true);
            }}
            onPointerMove={(event) => {
              const nextWidth = widthForPointer(event);
              if (nextWidth !== undefined) setWidth(nextWidth);
            }}
            onPointerUp={(event) => {
              const nextWidth = widthForPointer(event);
              if (nextWidth === undefined) return;
              drag.current = undefined;
              setResizing(false);
              saveWidth(nextWidth);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            role="separator"
            tabIndex={0}
            title="Drag to resize sidebar. Double-click to reset."
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-px transition-colors group-hover:bg-primary group-focus-visible:bg-primary ${resizing ? 'bg-primary' : 'bg-transparent'}`}
            />
          </div>
        )}
      </aside>
    </>
  );
}
