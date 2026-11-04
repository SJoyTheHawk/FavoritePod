import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type { Group } from '../../core/types';
import { getActiveLibraryDragPayload, readLibraryDragData } from '../drag';

interface GroupHeaderProps {
  group: Group;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onDrop: (groupId: string) => void;
}

export function GroupHeader({
  group,
  count,
  collapsed,
  onToggle,
  onDrop,
}: GroupHeaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <button
      aria-label={`${group.title}, ${count} ${count === 1 ? 'favorite' : 'favorites'}`}
      aria-controls={`group-section-${group.id}`}
      aria-expanded={!collapsed}
      className={`group flex h-9 w-full min-w-0 items-center justify-start gap-2 rounded-md px-1 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isDragOver ? 'bg-primary-light/30 ring-1 ring-inset ring-primary/60' : 'hover:bg-surface-hover/60'}`}
      onClick={onToggle}
      onDragOver={(event) => {
        const payload =
          getActiveLibraryDragPayload() ?? readLibraryDragData(event.dataTransfer);
        if (payload?.type !== 'item') return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsDragOver(false);
        }
      }}
      onDrop={(event) => {
        const payload =
          getActiveLibraryDragPayload() ?? readLibraryDragData(event.dataTransfer);
        if (payload?.type !== 'item') return;
        event.preventDefault();
        event.stopPropagation();
        setIsDragOver(false);
        onDrop(group.id);
      }}
      onDragEnd={() => setIsDragOver(false)}
      type="button"
    >
      <span className="flex min-w-0 max-w-[calc(100%-2.5rem)] items-center gap-2">
        <span className="truncate text-base font-semibold text-text-primary">
          {group.title}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-sm tabular-nums text-text-tertiary"
        >
          {count === 0 ? '(0 favorites)' : `(${count})`}
        </span>
      </span>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-primary transition-colors group-hover:bg-border">
        {collapsed ? (
          <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
        ) : (
          <ChevronDownIcon aria-hidden="true" className="h-4 w-4" />
        )}
      </span>
    </button>
  );
}
