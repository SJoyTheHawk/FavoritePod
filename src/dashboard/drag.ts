import type { Group } from '../core/types';

export const LIBRARY_DRAG_TYPE = 'application/x-favoritepod-record';
export type GroupDropPlacement = 'before' | 'inside' | 'after';
let activePayload: LibraryDragPayload | null = null;

export function getActiveLibraryDragPayload(): LibraryDragPayload | null {
  return activePayload;
}

export function clearLibraryDragData(): void {
  activePayload = null;
}

export function getGroupDropPlacement(
  clientY: number,
  top: number,
  height: number,
): GroupDropPlacement {
  const edge = Math.min(10, height / 4);
  if (clientY < top + edge) return 'before';
  if (clientY > top + height - edge) return 'after';
  return 'inside';
}

/** Resolve the same destination for the indicator and the eventual drop. */
export function resolveGroupDrop(
  groups: readonly Group[],
  draggedId: string,
  targetId: string,
  placement: GroupDropPlacement,
): { parentId: string | null; beforeId?: string } | null {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const target = byId.get(targetId);
  if (!target || !byId.has(draggedId) || draggedId === targetId) return null;
  const parentId = placement === 'inside' ? target.id : target.parentId;
  const visited = new Set<string>();
  let ancestor = parentId;
  while (ancestor) {
    if (ancestor === draggedId || visited.has(ancestor)) return null;
    visited.add(ancestor);
    ancestor = byId.get(ancestor)?.parentId ?? null;
  }
  if (placement === 'inside') return { parentId };
  if (placement === 'before') return { parentId, beforeId: target.id };
  const siblings = groups
    .filter((group) => group.parentId === parentId && group.id !== draggedId)
    .sort((a, b) =>
      a.orderKey === b.orderKey
        ? a.id < b.id
          ? -1
          : a.id === b.id
            ? 0
            : 1
        : a.orderKey < b.orderKey
          ? -1
          : 1,
    );
  const index = siblings.findIndex((group) => group.id === targetId);
  return { parentId, beforeId: siblings[index + 1]?.id };
}

export type LibraryDragPayload =
  { type: 'item'; id: string } | { type: 'group'; id: string };

export function setLibraryDragData(
  dataTransfer: DataTransfer,
  payload: LibraryDragPayload,
): void {
  activePayload = payload;
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(LIBRARY_DRAG_TYPE, JSON.stringify(payload));
}

export function hasLibraryDragData(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(LIBRARY_DRAG_TYPE);
}

export function readLibraryDragData(
  dataTransfer: DataTransfer,
): LibraryDragPayload | null {
  try {
    const value: unknown = JSON.parse(dataTransfer.getData(LIBRARY_DRAG_TYPE));
    if (
      value &&
      typeof value === 'object' &&
      'id' in value &&
      typeof value.id === 'string' &&
      'type' in value &&
      (value.type === 'group' || value.type === 'item')
    ) {
      return value as LibraryDragPayload;
    }
  } catch {
    return null;
  }
  return null;
}
