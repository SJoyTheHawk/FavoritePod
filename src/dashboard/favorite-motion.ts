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

interface FavoriteRevisionCache {
  collection?: string;
  originalOrder?: string;
  placeholderOrder?: { order: string; rank: number; revision: string };
  previewOrder: WeakMap<ReadonlyMap<string, number>, string>;
}

const favoriteRevisionCache = new WeakMap<readonly object[], FavoriteRevisionCache>();

function getRevisionCache(items: readonly object[]): FavoriteRevisionCache {
  let cache = favoriteRevisionCache.get(items);
  if (!cache) {
    cache = { previewOrder: new WeakMap() };
    favoriteRevisionCache.set(items, cache);
  }
  return cache;
}

export function getFavoriteCollectionRevision(
  items: readonly { id: string; groupId: string }[],
): string {
  const cache = getRevisionCache(items);
  if (cache.collection !== undefined) return cache.collection;
  cache.collection = JSON.stringify(
    [...items]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map(({ id, groupId }) => [id, groupId]),
  );
  return cache.collection;
}

/** A drag rank or persisted key changing is not itself a visible reorder. */
export function getFavoriteOrderRevision(
  items: readonly { id: string }[],
  previewRank: ReadonlyMap<string, number> | null,
  placeholderId?: string,
): string {
  const cache = getRevisionCache(items);
  if (placeholderId && previewRank?.has(placeholderId)) {
    const order = getFavoriteOrderRevision(items, previewRank);
    const rank = previewRank.get(placeholderId)!;
    const cached = cache.placeholderOrder;
    if (cached?.order === order && cached.rank === rank) return cached.revision;
    // A foreign dragged favorite is not a collection member yet, but its
    // placeholder still moves the existing cards. Include that position.
    const revision = JSON.stringify([order, rank]);
    cache.placeholderOrder = { order, rank, revision };
    return revision;
  }
  if (!previewRank) {
    if (cache.originalOrder === undefined) {
      cache.originalOrder = JSON.stringify(items.map((item) => item.id));
    }
    return cache.originalOrder;
  }
  const cached = cache.previewOrder.get(previewRank);
  if (cached !== undefined) return cached;

  const byId = new Map(items.map((item) => [item.id, item]));
  const orderedIds: string[] = [];
  let previousRank = -1;
  let orderedKeys = true;
  for (const id of previewRank.keys()) {
    const rank = previewRank.get(id)!;
    if (rank <= previousRank) orderedKeys = false;
    previousRank = rank;
    if (byId.delete(id)) orderedIds.push(id);
  }
  if (!orderedKeys) {
    orderedIds.splice(
      0,
      orderedIds.length,
      ...[...items]
        .sort(
          (left, right) =>
            (previewRank.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
            (previewRank.get(right.id) ?? Number.MAX_SAFE_INTEGER),
        )
        .map((item) => item.id),
    );
  } else {
    orderedIds.push(...byId.keys());
  }
  const revision = JSON.stringify(orderedIds);
  cache.previewOrder.set(previewRank, revision);
  return revision;
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
