import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';
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
      aria-controls={`group-section-${group.id}`}
      aria-expanded={!collapsed}
      className={`flex h-12 w-full min-w-0 items-center justify-between gap-3 rounded-lg border px-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isDragOver ? 'border-primary bg-primary-light/30' : 'border-border bg-surface hover:bg-surface-hover'}`}
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
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <FolderIcon aria-hidden="true" className="h-5 w-5 shrink-0 text-text-secondary" />
        <span className="truncate text-sm font-medium text-text-primary">
          {group.title}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="rounded bg-surface-hover px-2 py-0.5 text-xs tabular-nums text-text-tertiary">
          {count === 0 ? '0 favorites' : count}
        </span>
        {collapsed ? (
          <ChevronRightIcon aria-hidden="true" className="h-4 w-4 text-text-tertiary" />
        ) : (
          <ChevronDownIcon aria-hidden="true" className="h-4 w-4 text-text-tertiary" />
        )}
      </span>
    </button>
  );
}
