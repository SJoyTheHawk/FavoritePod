import { compareHLC, latestHLC } from './hlc';
import type { Group, GroupField, Item, ItemField, LibraryState } from './types';

type ClockedRecord = {
  id: string;
  clock: Record<string, string>;
  deleted?: string;
};

function compareValue(left: unknown, right: unknown): number {
  const leftValue = left === undefined ? '' : JSON.stringify(left);
  const rightValue = right === undefined ? '' : JSON.stringify(right);
  return leftValue === rightValue ? 0 : leftValue < rightValue ? -1 : 1;
}

function mergeRecord<T extends ClockedRecord>(
  left: T,
  right: T,
  fields: readonly string[],
): T {
  const result = { ...left, clock: { ...left.clock } } as T;
  const target = result as unknown as Record<string, unknown>;
  const leftValues = left as unknown as Record<string, unknown>;
  const rightValues = right as unknown as Record<string, unknown>;

  for (const field of fields) {
    const leftClock = left.clock[field] ?? left.clock.url;
    const rightClock = right.clock[field] ?? right.clock.url;
    const comparison = compareHLC(leftClock, rightClock);
    const takeRight =
      comparison < 0 ||
      (comparison === 0 && compareValue(leftValues[field], rightValues[field]) < 0);
    const source = takeRight ? right : left;
    target[field] = (takeRight ? rightValues : leftValues)[field];
    result.clock[field] = source.clock[field] ?? source.clock.url;
  }

  if (left.deleted && right.deleted) {
    result.deleted =
      compareHLC(left.deleted, right.deleted) >= 0 ? left.deleted : right.deleted;
  } else {
    result.deleted = left.deleted ?? right.deleted;
  }
  if (!result.deleted) delete result.deleted;
  return result;
}

export function isGroupDeleted(group: Group): boolean {
  return Boolean(
    group.deleted &&
    compareHLC(group.deleted, latestHLC(Object.values(group.clock))) >= 0,
  );
}

export function isItemDeleted(item: Item): boolean {
  return Boolean(
    item.deleted && compareHLC(item.deleted, latestHLC(Object.values(item.clock))) >= 0,
  );
}

function mergeGroups(left: Group[], right: Group[]): Group[] {
  const byId = new Map(left.map((group) => [group.id, group]));
  for (const group of right) {
    const current = byId.get(group.id);
    byId.set(
      group.id,
      current
        ? mergeRecord(current, group, [
            'parentId',
            'orderKey',
            'title',
          ] satisfies GroupField[])
        : group,
    );
  }
  return repairGroupTree([...byId.values()]);
}

function mergeItems(left: Item[], right: Item[]): Item[] {
  const byId = new Map(left.map((item) => [item.id, item]));
  for (const item of right) {
    const current = byId.get(item.id);
    byId.set(
      item.id,
      current
        ? mergeRecord(current, item, [
            'groupId',
            'orderKey',
            'url',
            'title',
            'previewHash',
            'faviconUrl',
          ] satisfies ItemField[])
        : item,
    );
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function repairGroupTree(groups: Group[]): Group[] {
  const result = groups.map((group) => ({ ...group, clock: { ...group.clock } }));
  const active = new Map(
    result.filter((group) => !isGroupDeleted(group)).map((group) => [group.id, group]),
  );

  for (const group of active.values()) {
    if (group.parentId && !active.has(group.parentId)) group.parentId = null;
  }

  while (true) {
    let cycle: string[] | undefined;
    const complete = new Set<string>();

    for (const startId of [...active.keys()].sort()) {
      const path: string[] = [];
      const indexById = new Map<string, number>();
      let currentId: string | null = startId;

      while (currentId && active.has(currentId) && !complete.has(currentId)) {
        const existingIndex = indexById.get(currentId);
        if (existingIndex !== undefined) {
          cycle = path.slice(existingIndex);
          break;
        }
        indexById.set(currentId, path.length);
        path.push(currentId);
        currentId = active.get(currentId)!.parentId;
      }

      for (const id of path) complete.add(id);
      if (cycle) break;
    }

    if (!cycle) return result.sort((a, b) => a.id.localeCompare(b.id));
    const rootId = [...cycle].sort().at(-1)!;
    active.get(rootId)!.parentId = null;
  }
}

export function mergeLibrary(left: LibraryState, right: LibraryState): LibraryState {
  return {
    groups: mergeGroups(left.groups, right.groups),
    items: mergeItems(left.items, right.items),
  };
}
