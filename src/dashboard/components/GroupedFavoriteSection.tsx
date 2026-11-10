import { useMemo, type ReactNode } from 'react';
import type { Group, Item } from '../../core/types';
import { GroupHeader } from './GroupHeader';

const noItems: readonly Item[] = [];

interface GroupedFavoriteSectionProps {
  group: Group;
  groups: readonly Group[];
  itemsByGroup: ReadonlyMap<string, readonly Item[]>;
  collapsedGroups: ReadonlySet<string>;
  searching: boolean;
  onToggleCollapse: (groupId: string) => void;
  onDropIntoGroup: (groupId: string) => void;
  renderItems: (items: readonly Item[]) => ReactNode;
  nested?: boolean;
}

export function GroupedFavoriteSection({
  group,
  groups,
  itemsByGroup,
  collapsedGroups,
  searching,
  onToggleCollapse,
  onDropIntoGroup,
  renderItems,
  nested = false,
}: GroupedFavoriteSectionProps) {
  const collapsed = collapsedGroups.has(group.id);
  const descendants = itemsByGroup.get(group.id) ?? noItems;
  const directItems = useMemo(
    () => descendants.filter((item) => item.groupId === group.id),
    [descendants, group.id],
  );
  const childGroups = useMemo(
    () => groups.filter((child) => child.parentId === group.id),
    [group.id, groups],
  );
  const visibleChildGroups = useMemo(
    () =>
      searching
        ? childGroups.filter((child) => (itemsByGroup.get(child.id)?.length ?? 0) > 0)
        : childGroups,
    [childGroups, itemsByGroup, searching],
  );

  return (
    <section
      className={`min-w-0 ${collapsed ? 'space-y-0' : 'space-y-3'} ${nested ? 'border-l border-border pl-3 sm:pl-4' : ''}`}
    >
      <GroupHeader
        collapsed={collapsed}
        count={descendants.length}
        group={group}
        onDrop={onDropIntoGroup}
        onToggle={() => onToggleCollapse(group.id)}
      />
      <div
        aria-hidden={collapsed}
        className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
        id={`group-section-${group.id}`}
        ref={(element) => element?.toggleAttribute('inert', collapsed)}
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="min-w-0 pt-0.5">
            {directItems.length > 0 && renderItems(directItems)}
            {visibleChildGroups.length > 0 && (
              <div className={`space-y-3 ${directItems.length > 0 ? 'mt-8' : ''}`}>
                {visibleChildGroups.map((child) => (
                  <GroupedFavoriteSection
                    collapsedGroups={collapsedGroups}
                    group={child}
                    groups={groups}
                    itemsByGroup={itemsByGroup}
                    key={child.id}
                    nested
                    onDropIntoGroup={onDropIntoGroup}
                    onToggleCollapse={onToggleCollapse}
                    renderItems={renderItems}
                    searching={searching}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
