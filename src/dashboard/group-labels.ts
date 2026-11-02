import type { Group } from '../core/types';

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
