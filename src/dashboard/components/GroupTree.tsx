import {
  cloneElement,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactElement,
} from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  EllipsisHorizontalIcon,
  FolderIcon,
  FolderPlusIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { Group, Item } from '../../core/types';
import {
  clearLibraryDragData,
  getActiveLibraryDragPayload,
  getGroupDropPlacement,
  hasLibraryDragData,
  readLibraryDragData,
  resolveGroupDrop,
  setLibraryDragData,
  type GroupDropPlacement,
} from '../drag';

interface GroupTreeProps {
  groups: Group[];
  items: Item[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  onEdit: (group: Group) => void;
  onDelete: (group: Group) => void;
  onCreateGroup: () => void;
  onCreateChild: (parentId: string) => void;
  onMoveGroup: (groupId: string, parentId: string | null, beforeId?: string) => void;
  onMoveItem: (itemId: string, groupId: string) => void;
}

interface BranchProps extends Omit<
  GroupTreeProps,
  'items' | 'selectedGroupId' | 'onSelect' | 'onCreateGroup'
> {
  siblings: Group[];
  selectedGroupId: string | null;
  onSelect: (groupId: string | null) => void;
  expanded: Set<string>;
  onToggle: (groupId: string) => void;
  counts: Map<string, number>;
  depth: number;
  dropTarget: { id: string; placement: GroupDropPlacement } | null;
  onDropTarget: (value: { id: string; placement: GroupDropPlacement } | null) => void;
  onExpand: (id: string) => void;
}

function compareOrder(left: Group, right: Group): number {
  return left.orderKey === right.orderKey
    ? left.id.localeCompare(right.id)
    : left.orderKey < right.orderKey
      ? -1
      : 1;
}

function GroupBranch({
  siblings,
  groups,
  selectedGroupId,
  onSelect,
  onEdit,
  onDelete,
  onCreateChild,
  onMoveGroup,
  onMoveItem,
  expanded,
  onToggle,
  counts,
  depth,
  dropTarget,
  onDropTarget,
  onExpand,
}: BranchProps) {
  const childrenByParent = useMemo(() => {
    const result = new Map<string, Group[]>();
    for (const group of groups) {
      if (!group.parentId) continue;
      const children = result.get(group.parentId) ?? [];
      children.push(group);
      result.set(group.parentId, children);
    }
    for (const children of result.values()) children.sort(compareOrder);
    return result;
  }, [groups]);

  return (
    <ul className="grid gap-0.5" role="group">
      {siblings.map((group) => {
        const children = childrenByParent.get(group.id) ?? [];
        const isExpanded = expanded.has(group.id);
        const isSelected = selectedGroupId === group.id;
        const siblingIndex = siblings.findIndex((candidate) => candidate.id === group.id);

        const placementFor = (event: DragEvent<HTMLElement>) => {
          const rect = event.currentTarget.getBoundingClientRect();
          return getGroupDropPlacement(event.clientY, rect.top, rect.height);
        };
        const activePlacement = dropTarget?.id === group.id ? dropTarget.placement : null;
        const handleDrop = (event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          event.stopPropagation();
          onDropTarget(null);
          const payload = readLibraryDragData(event.dataTransfer);
          clearLibraryDragData();
          if (!payload || payload.id === group.id) return;
          if (payload.type === 'item') {
            onMoveItem(payload.id, group.id);
            onExpand(group.id);
            return;
          }
          const placement = placementFor(event);
          const destination = resolveGroupDrop(groups, payload.id, group.id, placement);
          if (destination) {
            onMoveGroup(payload.id, destination.parentId, destination.beforeId);
            if (placement === 'inside') onExpand(group.id);
          }
        };

        return (
          <li key={group.id} className="relative">
            {activePlacement && activePlacement !== 'inside' && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1 z-10 h-0.5 bg-primary"
                style={{ [activePlacement === 'before' ? 'top' : 'bottom']: 0 }}
              >
                <span className="absolute -left-0.5 -top-[3px] h-2 w-2 rounded-full border-2 border-primary bg-background" />
              </div>
            )}
            <div
              className={`group/tree-row flex min-w-0 items-center gap-1 rounded-md border py-1 pr-1 transition-colors ${activePlacement === 'inside' ? 'border-primary bg-primary-light/60' : 'border-transparent'} ${isSelected ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
              data-group-row="true"
              draggable
              onDragStart={(event) => {
                event.stopPropagation();
                setLibraryDragData(event.dataTransfer, { type: 'group', id: group.id });
                event.dataTransfer.setDragImage(event.currentTarget, 24, 18);
              }}
              onDragEnd={() => {
                clearLibraryDragData();
                onDropTarget(null);
              }}
              onDragOver={(event) => {
                if (!hasLibraryDragData(event.dataTransfer)) return;
                event.preventDefault();
                event.stopPropagation();
                const payload = getActiveLibraryDragPayload();
                const placement =
                  payload?.type === 'item' ? 'inside' : placementFor(event);
                if (
                  !payload ||
                  (payload.type === 'group' &&
                    !resolveGroupDrop(groups, payload.id, group.id, placement))
                ) {
                  event.dataTransfer.dropEffect = 'none';
                  onDropTarget(null);
                  return;
                }
                event.dataTransfer.dropEffect = 'move';
                onDropTarget({ id: group.id, placement });
              }}
              onDrop={handleDrop}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  onDropTarget(null);
                }
              }}
              style={{ paddingLeft: '4px' }}
            >
              <button
                aria-label={
                  isExpanded ? `Collapse ${group.title}` : `Expand ${group.title}`
                }
                aria-expanded={isExpanded}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-tertiary transition hover:bg-background hover:text-text-primary ${children.length ? '' : 'invisible'}`}
                onClick={() => onToggle(group.id)}
                tabIndex={children.length ? 0 : -1}
                type="button"
              >
                {isExpanded ? (
                  <ChevronDownIcon aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRightIcon aria-hidden="true" className="h-3.5 w-3.5" />
                )}
              </button>
              <FolderIcon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <button
                aria-current={isSelected ? 'page' : undefined}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded px-1 text-left text-sm"
                onClick={() => onSelect(group.id)}
                type="button"
              >
                <span className="min-w-0 flex-1 truncate">{group.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-text-tertiary">
                  {counts.get(group.id) ?? 0}
                </span>
              </button>
              <Menu>
                <MenuButton
                  aria-label={`Actions for ${group.title}`}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-tertiary opacity-0 transition hover:bg-background hover:text-text-primary focus-visible:opacity-100 group-hover/tree-row:opacity-100 data-[open]:opacity-100"
                  title="Group actions"
                  type="button"
                >
                  <EllipsisHorizontalIcon aria-hidden="true" className="h-4 w-4" />
                </MenuButton>
                <MenuItems
                  anchor="bottom end"
                  className="z-40 min-w-44 rounded-md border border-border bg-background p-1 shadow-lg focus:outline-none"
                >
                  <GroupAction
                    icon={<PencilSquareIcon />}
                    label="Edit or move…"
                    onClick={() => onEdit(group)}
                  />
                  <GroupAction
                    icon={<FolderPlusIcon />}
                    label="New sub-group"
                    onClick={() => onCreateChild(group.id)}
                  />
                  <GroupAction
                    icon={<ChevronUpIcon />}
                    label="Move up"
                    onClick={() =>
                      void onMoveGroup(
                        group.id,
                        group.parentId,
                        siblings[siblingIndex - 1]?.id,
                      )
                    }
                    disabled={siblingIndex <= 0}
                  />
                  <GroupAction
                    icon={<ChevronDownIcon />}
                    label="Move down"
                    onClick={() =>
                      void onMoveGroup(
                        group.id,
                        group.parentId,
                        siblings[siblingIndex + 2]?.id,
                      )
                    }
                    disabled={siblingIndex < 0 || siblingIndex >= siblings.length - 1}
                  />
                  <GroupAction
                    icon={<TrashIcon />}
                    label="Delete group"
                    onClick={() => onDelete(group)}
                    danger
                  />
                </MenuItems>
              </Menu>
            </div>
            {children.length > 0 && (
              <div
                className={`grid transition-[grid-template-rows] duration-200 ${isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
              >
                <div
                  className="min-h-0 overflow-hidden border-l border-border"
                  style={{ marginLeft: '18px' }}
                >
                  <GroupBranch
                    {...{
                      groups,
                      dropTarget,
                      onDropTarget,
                      onExpand,
                      onEdit,
                      onDelete,
                      onCreateChild,
                      onMoveGroup,
                      onMoveItem,
                      expanded,
                      onToggle,
                      counts,
                      depth: depth + 1,
                      selectedGroupId,
                      onSelect,
                    }}
                    siblings={children}
                  />
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function GroupAction({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: ReactElement;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <MenuItem disabled={disabled}>
      {({ focus, disabled: itemDisabled }) => (
        <button
          className={`flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm ${danger ? 'text-danger' : 'text-text-primary'} ${focus ? 'bg-surface-hover' : ''} ${itemDisabled ? 'cursor-not-allowed opacity-40' : ''}`}
          onClick={onClick}
          disabled={itemDisabled}
          type="button"
        >
          {cloneElement(icon, { 'aria-hidden': true, className: 'h-4 w-4' })}
          {label}
        </button>
      )}
    </MenuItem>
  );
}

export function GroupTree(props: GroupTreeProps) {
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    placement: GroupDropPlacement;
  } | null>(null);
  const [expandedState, setExpandedState] = useState<Set<string> | null>(null);
  const expanded = expandedState ?? new Set(props.groups.map((group) => group.id));
  useEffect(() => {
    const clear = () => {
      clearLibraryDragData();
      setDropTarget(null);
    };
    window.addEventListener('dragend', clear);
    window.addEventListener('drop', clear);
    return () => {
      window.removeEventListener('dragend', clear);
      window.removeEventListener('drop', clear);
    };
  }, []);
  const groupsById = useMemo(
    () => new Map(props.groups.map((group) => [group.id, group])),
    [props.groups],
  );
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    for (const item of props.items) {
      let groupId: string | null = item.groupId;
      const visited = new Set<string>();
      while (groupId && !visited.has(groupId)) {
        visited.add(groupId);
        result.set(groupId, (result.get(groupId) ?? 0) + 1);
        groupId = groupsById.get(groupId)?.parentId ?? null;
      }
    }
    return result;
  }, [groupsById, props.items]);

  const toggle = (groupId: string) => {
    const next = new Set(expanded);
    if (next.has(groupId)) next.delete(groupId);
    else next.add(groupId);
    setExpandedState(next);
  };

  const rootGroups = useMemo(
    () => props.groups.filter((group) => group.parentId === null).sort(compareOrder),
    [props.groups],
  );

  return (
    <nav aria-label="Favorite groups" className="grid gap-1">
      <div
        className={`flex h-10 min-w-0 items-center rounded-md pr-1 text-sm transition ${props.selectedGroupId === null ? 'bg-primary-light font-medium text-primary' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'}`}
      >
        <button
          aria-current={props.selectedGroupId === null ? 'page' : undefined}
          className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-3 pr-2 text-left"
          onClick={() => props.onSelect(null)}
          type="button"
        >
          <span className="min-w-0 flex-1 truncate">All favorites</span>
          <span className="text-xs tabular-nums text-text-tertiary">
            {props.items.length}
          </span>
        </button>
        <button
          aria-label="New group"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-secondary transition hover:bg-surface-hover hover:text-text-primary"
          onClick={props.onCreateGroup}
          title="New group"
          type="button"
        >
          <FolderPlusIcon aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <GroupBranch
        {...props}
        dropTarget={dropTarget}
        onDropTarget={setDropTarget}
        onExpand={(id) => setExpandedState(new Set([...expanded, id]))}
        counts={counts}
        depth={0}
        expanded={expanded}
        onToggle={toggle}
        siblings={rootGroups}
      />
    </nav>
  );
}
