export const LIBRARY_DRAG_TYPE = 'application/x-favoritepod-record';

export type LibraryDragPayload =
  { type: 'item'; id: string } | { type: 'group'; id: string };

export function setLibraryDragData(
  dataTransfer: DataTransfer,
  payload: LibraryDragPayload,
): void {
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
