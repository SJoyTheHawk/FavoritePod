import { flushSync } from 'react-dom';
import type { Group } from '../core/types';

export const LIBRARY_DRAG_TYPE = 'application/x-favoritepod-record';
export type GroupDropPlacement = 'before' | 'inside' | 'after';
export type ItemDropPlacement = 'before' | 'after';
let activePayload: LibraryDragPayload | null = null;

export function getActiveLibraryDragPayload(): LibraryDragPayload | null {
  return activePayload;
}

export function clearLibraryDragData(): void {
  activePayload = null;
}

const dragEndSubscriptions = new WeakMap<
  EventTarget,
  { callbacks: Set<() => void>; dispose: () => void }
>();

/** Reset all drag feedback in one commit before the native event returns. */
export function listenForLibraryDragEnd(
  onEnd: () => void,
  target: EventTarget = window,
): () => void {
  let subscription = dragEndSubscriptions.get(target);
  if (!subscription) {
    const callbacks = new Set<() => void>();
    const finish = () => {
      // Native drag feedback is removed imperatively. Flush the React layout and
      // destination highlights together so they cannot paint in separate frames.
      flushSync(() => [...callbacks].forEach((callback) => callback()));
    };
    const onKeyDown = (event: Event) => {
      if ((event as KeyboardEvent).key === 'Escape') finish();
    };
    const options = { capture: true };
    target.addEventListener('dragend', finish, options);
    target.addEventListener('keydown', onKeyDown, options);
    subscription = {
      callbacks,
      dispose: () => {
        target.removeEventListener('dragend', finish, options);
        target.removeEventListener('keydown', onKeyDown, options);
      },
    };
    dragEndSubscriptions.set(target, subscription);
  }
  const callback = () => onEnd();
  subscription.callbacks.add(callback);
  return () => {
    subscription.callbacks.delete(callback);
    if (subscription.callbacks.size === 0) {
      subscription.dispose();
      dragEndSubscriptions.delete(target);
    }
  };
}

export function getItemDropPlacement(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  layout: 'grid' | 'list',
): ItemDropPlacement {
  if (layout === 'list') {
    return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }
  return clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}

/** Hit-test layout slots, excluding animation transforms and the dragged stack. */
export function getItemDropTarget(
  x: number,
  y: number,
  slots: readonly {
    id: string;
    left: number;
    top: number;
    width: number;
    height: number;
  }[],
  layout: 'grid' | 'list',
): { targetId: string; placement: ItemDropPlacement } | null {
  const slot = slots.find(
    (candidate) =>
      x >= candidate.left &&
      x < candidate.left + candidate.width &&
      y >= candidate.top &&
      y < candidate.top + candidate.height,
  );
  return slot
    ? { targetId: slot.id, placement: getItemDropPlacement(x, y, slot, layout) }
    : null;
}

export function previewItemOrder(
  itemIds: readonly string[],
  draggedId: string,
  targetId: string,
  placement: ItemDropPlacement,
  draggedIds: readonly string[] = [draggedId],
): string[] | null {
  const moving = itemIds.filter((id) => draggedIds.includes(id));
  if (
    moving.includes(targetId) ||
    !moving.includes(draggedId) ||
    !itemIds.includes(targetId)
  ) {
    return null;
  }

  const next = itemIds.filter((id) => !moving.includes(id));
  const targetIndex = next.indexOf(targetId);
  next.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, ...moving);
  return next;
}

export function resolveItemDropDestination(
  items: readonly { id: string; groupId: string; orderKey: string }[],
  draggedId: string,
  targetId: string,
  placement: ItemDropPlacement,
  draggedIds: readonly string[] = [draggedId],
): { groupId: string; beforeItemId?: string } | null {
  const target = items.find((item) => item.id === targetId);
  if (
    !target ||
    draggedIds.includes(targetId) ||
    !items.some((item) => item.id === draggedId)
  ) {
    return null;
  }

  const siblings = items
    .filter((item) => item.groupId === target.groupId && !draggedIds.includes(item.id))
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
  const targetIndex = siblings.findIndex((item) => item.id === targetId);
  if (targetIndex < 0) return null;

  return {
    groupId: target.groupId,
    beforeItemId: placement === 'before' ? target.id : siblings[targetIndex + 1]?.id,
  };
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
