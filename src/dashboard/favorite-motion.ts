export interface FavoriteLayout {
  left: number;
  top: number;
  width: number;
  height: number;
  layout: string;
  size: string;
  orderRevision: string;
  collectionRevision: string;
  animateReorder: boolean;
  cancellationRevision: number;
}

/** A drag rank or persisted key changing is not itself a visible reorder. */
export function getFavoriteOrderRevision(
  items: readonly { id: string }[],
  previewRank: ReadonlyMap<string, number> | null,
): string {
  const ordered = previewRank
    ? [...items].sort(
        (left, right) =>
          (previewRank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
          (previewRank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
      )
    : items;
  return JSON.stringify(ordered.map((item) => item.id));
}

/** Animate reordering the same cards, never collection membership or size changes. */
export function getFavoriteReorderOffset(
  previous: FavoriteLayout | undefined,
  current: FavoriteLayout,
): { x: number; y: number } | null {
  if (
    !previous ||
    !previous.animateReorder ||
    !current.animateReorder ||
    previous.cancellationRevision !== current.cancellationRevision ||
    previous.orderRevision === current.orderRevision ||
    previous.collectionRevision !== current.collectionRevision ||
    previous.layout !== current.layout ||
    previous.size !== current.size ||
    previous.width !== current.width ||
    previous.height !== current.height
  ) {
    return null;
  }
  const x = previous.left - current.left;
  const y = previous.top - current.top;
  return x === 0 && y === 0 ? null : { x, y };
}
