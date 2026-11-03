import type { Group, Item } from '../core/types';
import type { GroupingMode } from '../core/storage';
import { getGroupLabels } from './group-labels';

export type GroupedFavoriteView =
  | { mode: 'flat'; items: Item[] }
  | { mode: 'labeled'; items: Item[] }
  | { mode: 'hierarchical'; groups: Group[]; directItems: Item[] };

function compareOrder(left: Item, right: Item): number {
  if (left.orderKey !== right.orderKey) return left.orderKey < right.orderKey ? -1 : 1;
  return left.id.localeCompare(right.id);
}

export function getGroupedFavoriteView(
  groups: readonly Group[],
  items: readonly Item[],
  selectedGroupId: string | null,
  groupingMode: GroupingMode,
): GroupedFavoriteView {
  const sectionGroups = groups.filter((group) =>
    selectedGroupId ? group.parentId === selectedGroupId : group.parentId === null,
  );
  const canGroup = selectedGroupId === null || sectionGroups.length > 0;

  if (!canGroup || groupingMode === 'flat') {
    return { mode: 'flat', items: [...items] };
  }

  if (groupingMode === 'labeled') {
    const labels = getGroupLabels(groups);
    return {
      mode: 'labeled',
      items: [...items].sort(
        (left, right) =>
          (labels.get(left.groupId) ?? '').localeCompare(
            labels.get(right.groupId) ?? '',
          ) || compareOrder(left, right),
      ),
    };
  }

  return {
    mode: 'hierarchical',
    groups: sectionGroups,
    directItems: selectedGroupId
      ? items.filter((item) => item.groupId === selectedGroupId).sort(compareOrder)
      : [],
  };
}

export function getItemsByGroupAndDescendants(
  groups: readonly Group[],
  items: readonly Item[],
): Map<string, Item[]> {
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const result = new Map(groups.map((group) => [group.id, [] as Item[]]));

  for (const item of items) {
    const visited = new Set<string>();
    let group = groupsById.get(item.groupId);
    while (group && !visited.has(group.id)) {
      visited.add(group.id);
      result.get(group.id)?.push(item);
      group = group.parentId ? groupsById.get(group.parentId) : undefined;
    }
  }

  return result;
}
