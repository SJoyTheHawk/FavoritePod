import type { Group } from '../core/types';

function compareOrder(left: Group, right: Group): number {
  return left.orderKey === right.orderKey
    ? left.id.localeCompare(right.id)
    : left.orderKey < right.orderKey
      ? -1
      : 1;
}

export function getGroupsInTreeOrder(groups: readonly Group[]): Group[] {
  const childrenByParent = new Map<string | null, Group[]>();
  for (const group of groups) {
    const siblings = childrenByParent.get(group.parentId) ?? [];
    siblings.push(group);
    childrenByParent.set(group.parentId, siblings);
  }
  for (const siblings of childrenByParent.values()) siblings.sort(compareOrder);

  const ordered: Group[] = [];
  const visited = new Set<string>();
  const visit = (group: Group) => {
    if (visited.has(group.id)) return;
    visited.add(group.id);
    ordered.push(group);
    for (const child of childrenByParent.get(group.id) ?? []) visit(child);
  };

  for (const root of childrenByParent.get(null) ?? []) visit(root);
  for (const group of groups) visit(group);
  return ordered;
}

export function getGroupLabels(groups: readonly Group[]): Map<string, string> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const labels = new Map<string, string>();
  for (const group of groups) {
    const path: string[] = [];
    const visited = new Set<string>();
    let current: Group | undefined = group;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.push(current.title);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    labels.set(group.id, path.reverse().join(' » '));
  }
  return labels;
}
