import type { ReactNode } from 'react';
import type { Group, Item } from '../../core/types';
import { GroupHeader } from './GroupHeader';

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
  const descendants = itemsByGroup.get(group.id) ?? [];
  const directItems = descendants.filter((item) => item.groupId === group.id);
  const childGroups = groups.filter((child) => child.parentId === group.id);
  const visibleChildGroups = searching
    ? childGroups.filter((child) => (itemsByGroup.get(child.id)?.length ?? 0) > 0)
    : childGroups;

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
          <div className="min-w-0 space-y-8 pt-0.5">
            {directItems.length > 0 && renderItems(directItems)}
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
        </div>
      </div>
    </section>
  );
}
