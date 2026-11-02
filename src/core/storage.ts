import { compareHLC, latestHLC, tickHLC } from './hlc';
import { isGroupDeleted, isItemDeleted } from './merge';
import { keyBetween, nextOrderKey } from './ordering';
import { hashBlob } from './thumbnail';
import { getDefaultTitle, isValidUrl } from './validation';
import { db } from './db';
import type {
  Group,
  GroupField,
  Item,
  ItemField,
  LibrarySnapshot,
  ThumbnailInput,
} from './types';

const DEFAULT_GROUP_TITLE = 'Favorites';
const SNAPSHOT_LIMIT = 3;
const DISMISSED_RECENT_ITEM_IDS = 'dismissedRecentItemIds';

export type LibraryView = 'grid' | 'list';
export type BookmarkSize = 'small' | 'medium' | 'large';

export async function getBookmarkSize(view: LibraryView): Promise<BookmarkSize> {
  const record = await db.settings.get(`bookmarkSize:${view}`);
  return record?.value === 'small' || record?.value === 'large' ? record.value : 'medium';
}

export async function setBookmarkSize(
  view: LibraryView,
  size: BookmarkSize,
): Promise<void> {
  await db.settings.put({ key: `bookmarkSize:${view}`, value: size });
}

function compareLexically(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

async function nextClock(): Promise<string> {
  const deviceRecord = await db.syncMeta.get('deviceId');
  const deviceId =
    typeof deviceRecord?.value === 'string' ? deviceRecord.value : crypto.randomUUID();
  if (!deviceRecord) await db.syncMeta.put({ key: 'deviceId', value: deviceId });

  const previousRecord = await db.syncMeta.get('lastHlc');
  const previous =
    typeof previousRecord?.value === 'string' ? previousRecord.value : undefined;
  const value = tickHLC(previous, deviceId);
  await db.syncMeta.put({ key: 'lastHlc', value });
  return value;
}

function ordered<T extends { id: string; orderKey: string }>(records: T[]): T[] {
  return records.sort(
    (a, b) => compareLexically(a.orderKey, b.orderKey) || compareLexically(a.id, b.id),
  );
}

async function rootGroups(): Promise<Group[]> {
  return ordered(
    (await db.groups.toArray()).filter(
      (group) => !isGroupDeleted(group) && !group.parentId,
    ),
  );
}

async function ensureDefaultGroup(clock: string): Promise<Group> {
  const groups = await rootGroups();
  if (groups[0]) return groups[0];

  const group: Group = {
    id: crypto.randomUUID(),
    parentId: null,
    orderKey: nextOrderKey([]),
    title: DEFAULT_GROUP_TITLE,
    clock: { parentId: clock, orderKey: clock, title: clock },
  };
  await db.groups.add(group);
  return group;
}

async function orderKeyForGroup(groupId: string): Promise<string> {
  const items = await db.items.where('groupId').equals(groupId).toArray();
  return nextOrderKey(
    items.filter((item) => !isItemDeleted(item)).map((item) => item.orderKey),
  );
}

function normalizedTitle(title: string, url: string): string {
  return title.trim() || getDefaultTitle(url) || 'Untitled favorite';
}

export async function listGroups(): Promise<Group[]> {
  return ordered((await db.groups.toArray()).filter((group) => !isGroupDeleted(group)));
}

export async function listItems(groupId?: string): Promise<Item[]> {
  const items = groupId
    ? await db.items.where('groupId').equals(groupId).toArray()
    : await db.items.toArray();
  return items
    .filter((item) => !isItemDeleted(item))
    .sort(
      (a, b) =>
        compareLexically(a.groupId, b.groupId) ||
        compareLexically(a.orderKey, b.orderKey) ||
        compareLexically(a.id, b.id),
    );
}

export async function getRecentItems(limit = 5): Promise<Item[]> {
  const dismissed = await getDismissedRecentItemIds();
  const items = (await db.items.toArray()).filter(
    (item) => !isItemDeleted(item) && !dismissed.has(item.id),
  );
  return items.sort((a, b) => compareLatestItemClock(b, a)).slice(0, limit);
}

async function getDismissedRecentItemIds(): Promise<Set<string>> {
  const record = await db.settings.get(DISMISSED_RECENT_ITEM_IDS);
  if (!Array.isArray(record?.value)) return new Set();
  return new Set(
    record.value.filter((value): value is string => typeof value === 'string'),
  );
}

export async function dismissRecentItem(id: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const dismissed = await getDismissedRecentItemIds();
    dismissed.add(id);
    await db.settings.put({
      key: DISMISSED_RECENT_ITEM_IDS,
      value: [...dismissed],
    });
  });
}

async function restoreRecentItem(id: string): Promise<void> {
  const dismissed = await getDismissedRecentItemIds();
  if (!dismissed.delete(id)) return;
  await db.settings.put({
    key: DISMISSED_RECENT_ITEM_IDS,
    value: [...dismissed],
  });
}

function compareLatestItemClock(left: Item, right: Item): number {
  return compareHLC(
    latestHLC(Object.values(left.clock)),
    latestHLC(Object.values(right.clock)),
  );
}

export async function getThumbnail(hash: string) {
  return db.thumbnails.get(hash);
}

export async function updateItemThumbnail(
  id: string,
  thumbnail: ThumbnailInput,
): Promise<Item> {
  const hash = await hashBlob(thumbnail.blob);
  return db.transaction('rw', db.items, db.thumbnails, db.syncMeta, async () => {
    const item = await db.items.get(id);
    if (!item || isItemDeleted(item)) throw new Error('Favorite not found.');
    const existing = await db.thumbnails.get(hash);
    if (!existing) {
      await db.thumbnails.put({
        hash,
        blob: thumbnail.blob,
        ...(thumbnail.smallBlob ? { smallBlob: thumbnail.smallBlob } : {}),
        size: thumbnail.blob.size,
        width: thumbnail.width,
        height: thumbnail.height,
        createdAt: Date.now(),
      });
    } else if (thumbnail.smallBlob && !existing.smallBlob) {
      await db.thumbnails.put({ ...existing, smallBlob: thumbnail.smallBlob });
    }
    if (item.previewHash === hash) return item;
    const clock = await nextClock();
    const next: Item = {
      ...item,
      previewHash: hash,
      clock: { ...item.clock, previewHash: clock },
    };
    await db.items.put(next);
    return next;
  });
}

export async function getLastUsedGroupId(): Promise<string | undefined> {
  const record = await db.settings.get('lastUsedGroupId');
  return typeof record?.value === 'string' ? record.value : undefined;
}

export async function setLastUsedGroupId(groupId: string): Promise<void> {
  await db.settings.put({ key: 'lastUsedGroupId', value: groupId });
}

export async function getDefaultView(): Promise<LibraryView | undefined> {
  const record = await db.settings.get('defaultView');
  return record?.value === 'grid' || record?.value === 'list' ? record.value : undefined;
}

export async function setDefaultView(view: LibraryView): Promise<void> {
  await db.settings.put({ key: 'defaultView', value: view });
}

export async function createGroup(data: {
  title: string;
  parentId?: string | null;
}): Promise<Group> {
  const title = data.title.trim();
  if (!title) throw new Error('Group name cannot be empty.');

  return db.transaction('rw', db.groups, db.syncMeta, async () => {
    const clock = await nextClock();
    const parentId = data.parentId ?? null;
    if (parentId) {
      const parent = await db.groups.get(parentId);
      if (!parent || isGroupDeleted(parent))
        throw new Error('The selected parent group is unavailable.');
    }
    const siblings = (await db.groups.toArray()).filter(
      (group) => !isGroupDeleted(group) && group.parentId === parentId,
    );
    const group: Group = {
      id: crypto.randomUUID(),
      parentId,
      orderKey: nextOrderKey(siblings.map((sibling) => sibling.orderKey)),
      title,
      clock: { parentId: clock, orderKey: clock, title: clock },
    };
    await db.groups.add(group);
    return group;
  });
}

export async function updateGroup(
  id: string,
  updates: Partial<Pick<Group, GroupField>>,
): Promise<Group> {
  return db.transaction('rw', db.groups, db.syncMeta, async () => {
    const group = await db.groups.get(id);
    if (!group || isGroupDeleted(group)) throw new Error('Group not found.');

    const parentId = updates.parentId === undefined ? group.parentId : updates.parentId;
    if (parentId === id || (parentId && (await isGroupDescendant(id, parentId)))) {
      throw new Error('A group cannot be moved into itself or one of its descendants.');
    }
    if (parentId) {
      const parent = await db.groups.get(parentId);
      if (!parent || isGroupDeleted(parent))
        throw new Error('The selected parent group is unavailable.');
    }

    const movedToParent = parentId !== group.parentId;
    const destinationOrderKey =
      movedToParent && updates.orderKey === undefined
        ? await nextOrderKeyForGroupParent(parentId, id)
        : (updates.orderKey ?? group.orderKey);
    const changes = { ...updates, parentId, orderKey: destinationOrderKey };

    const changedFields = (Object.keys(updates) as GroupField[]).filter(
      (field) => updates[field] !== undefined && updates[field] !== group[field],
    );
    if (movedToParent && !changedFields.includes('orderKey'))
      changedFields.push('orderKey');
    if (changedFields.length === 0) return group;

    const clock = await nextClock();
    const next = { ...group, ...changes, clock: { ...group.clock } };
    for (const field of changedFields) next.clock[field] = clock;
    await db.groups.put(next);
    return next;
  });
}

async function isGroupDescendant(
  ancestorId: string,
  candidateId: string,
): Promise<boolean> {
  const visited = new Set<string>();
  let currentId: string | null = candidateId;
  while (currentId && !visited.has(currentId)) {
    if (currentId === ancestorId) return true;
    visited.add(currentId);
    currentId = (await db.groups.get(currentId))?.parentId ?? null;
  }
  return false;
}

async function nextOrderKeyForGroupParent(
  parentId: string | null,
  excludeId?: string,
): Promise<string> {
  const siblings = (await db.groups.toArray()).filter(
    (group) =>
      !isGroupDeleted(group) && group.id !== excludeId && group.parentId === parentId,
  );
  return nextOrderKey(siblings.map((group) => group.orderKey));
}

export async function moveGroup(
  id: string,
  parentId: string | null,
  beforeGroupId?: string,
): Promise<Group> {
  return db.transaction('rw', db.groups, db.syncMeta, async () => {
    const group = await db.groups.get(id);
    if (!group || isGroupDeleted(group)) throw new Error('Group not found.');
    if (parentId === id || (parentId && (await isGroupDescendant(id, parentId)))) {
      throw new Error('A group cannot be moved into itself or one of its descendants.');
    }
    if (parentId) {
      const parent = await db.groups.get(parentId);
      if (!parent || isGroupDeleted(parent))
        throw new Error('The selected parent group is unavailable.');
    }

    const siblings = ordered(
      (await db.groups.toArray()).filter(
        (candidate) =>
          !isGroupDeleted(candidate) &&
          candidate.id !== id &&
          candidate.parentId === parentId,
      ),
    );
    const beforeIndex = beforeGroupId
      ? siblings.findIndex((sibling) => sibling.id === beforeGroupId)
      : -1;
    if (beforeGroupId && beforeIndex < 0)
      throw new Error('The destination group is unavailable.');
    const index = beforeIndex < 0 ? siblings.length : beforeIndex;
    const orderKey = keyBetween(
      siblings[index - 1]?.orderKey ?? null,
      siblings[index]?.orderKey ?? null,
    );
    if (group.parentId === parentId && group.orderKey === orderKey) return group;

    const clock = await nextClock();
    const next: Group = {
      ...group,
      parentId,
      orderKey,
      clock: { ...group.clock, parentId: clock, orderKey: clock },
    };
    await db.groups.put(next);
    return next;
  });
}

export async function deleteGroup(id: string): Promise<void> {
  await db.transaction('rw', db.groups, db.items, db.syncMeta, async () => {
    const group = await db.groups.get(id);
    if (!group || isGroupDeleted(group)) return;

    const [items, groups] = await Promise.all([
      db.items.where('groupId').equals(id).toArray(),
      db.groups.where('parentId').equals(id).toArray(),
    ]);
    if (
      items.some((item) => !isItemDeleted(item)) ||
      groups.some((child) => !isGroupDeleted(child))
    ) {
      throw new Error('Move favorites and child groups before deleting this group.');
    }

    const clock = await nextClock();
    await db.groups.put({ ...group, deleted: clock });
  });
}

export interface CreateItemInput {
  url: string;
  title?: string;
  groupId?: string;
  faviconUrl?: string;
  thumbnail?: ThumbnailInput;
}

export async function createItem(data: CreateItemInput): Promise<Item> {
  const url = data.url.trim();
  if (!isValidUrl(url)) throw new Error('Use a web address or a local file URL.');
  const title = normalizedTitle(data.title ?? '', url);
  const previewHash = data.thumbnail ? await hashBlob(data.thumbnail.blob) : undefined;

  return db.transaction(
    'rw',
    db.groups,
    db.items,
    db.thumbnails,
    db.syncMeta,
    db.settings,
    async () => {
      const clock = await nextClock();
      let group = data.groupId ? await db.groups.get(data.groupId) : undefined;
      if (!group || isGroupDeleted(group)) group = await ensureDefaultGroup(clock);

      const item: Item = {
        id: crypto.randomUUID(),
        groupId: group.id,
        orderKey: await orderKeyForGroup(group.id),
        url,
        title,
        faviconUrl: data.faviconUrl,
        previewHash,
        clock: {
          groupId: clock,
          orderKey: clock,
          url: clock,
          title: clock,
          previewHash: clock,
          faviconUrl: clock,
        },
      };

      if (data.thumbnail && previewHash) {
        const existing = await db.thumbnails.get(previewHash);
        if (!existing) {
          await db.thumbnails.put({
            hash: previewHash,
            blob: data.thumbnail.blob,
            ...(data.thumbnail.smallBlob ? { smallBlob: data.thumbnail.smallBlob } : {}),
            size: data.thumbnail.blob.size,
            width: data.thumbnail.width,
            height: data.thumbnail.height,
            createdAt: Date.now(),
          });
        } else if (data.thumbnail.smallBlob && !existing.smallBlob) {
          await db.thumbnails.put({
            ...existing,
            smallBlob: data.thumbnail.smallBlob,
          });
        }
      }
      await db.items.add(item);
      await db.settings.put({ key: 'lastUsedGroupId', value: group.id });
      return item;
    },
  );
}

export async function updateItem(
  id: string,
  updates: Partial<Pick<Item, ItemField>>,
): Promise<Item> {
  if (Object.hasOwn(updates, 'url') && updates.url && !isValidUrl(updates.url)) {
    throw new Error('Use a web address or a local file URL.');
  }

  return db.transaction('rw', db.items, db.groups, db.syncMeta, db.settings, async () => {
    const item = await db.items.get(id);
    if (!item || isItemDeleted(item)) throw new Error('Favorite not found.');

    if (updates.groupId) {
      const group = await db.groups.get(updates.groupId);
      if (!group || isGroupDeleted(group))
        throw new Error('The selected group is unavailable.');
    }

    const changedFields = (Object.keys(updates) as ItemField[]).filter(
      (field) => Object.hasOwn(updates, field) && updates[field] !== item[field],
    );
    const movedToGroup =
      updates.groupId !== undefined && updates.groupId !== item.groupId;
    if (movedToGroup && updates.orderKey === undefined) changedFields.push('orderKey');
    await restoreRecentItem(id);
    if (changedFields.length === 0) return item;

    const clock = await nextClock();
    const next: Item = { ...item, ...updates, clock: { ...item.clock } };
    if (movedToGroup && updates.orderKey === undefined) {
      next.orderKey = await orderKeyForGroup(next.groupId);
    }
    for (const field of changedFields) next.clock[field] = clock;
    if (updates.title !== undefined)
      next.title = normalizedTitle(updates.title, next.url);
    await db.items.put(next);
    return next;
  });
}

export async function moveItem(
  id: string,
  groupId: string,
  beforeItemId?: string,
): Promise<Item> {
  return db.transaction('rw', db.items, db.groups, db.syncMeta, db.settings, async () => {
    const item = await db.items.get(id);
    if (!item || isItemDeleted(item)) throw new Error('Favorite not found.');
    const group = await db.groups.get(groupId);
    if (!group || isGroupDeleted(group))
      throw new Error('The selected group is unavailable.');

    const siblings = ordered(
      (await db.items.where('groupId').equals(groupId).toArray()).filter(
        (candidate) => !isItemDeleted(candidate) && candidate.id !== id,
      ),
    );
    const beforeIndex = beforeItemId
      ? siblings.findIndex((sibling) => sibling.id === beforeItemId)
      : -1;
    if (beforeItemId && beforeIndex < 0)
      throw new Error('The destination favorite is unavailable.');
    const index = beforeIndex < 0 ? siblings.length : beforeIndex;
    const orderKey = keyBetween(
      siblings[index - 1]?.orderKey ?? null,
      siblings[index]?.orderKey ?? null,
    );
    if (item.groupId === groupId && item.orderKey === orderKey) return item;

    const clock = await nextClock();
    const next: Item = {
      ...item,
      groupId,
      orderKey,
      clock: { ...item.clock, groupId: clock, orderKey: clock },
    };
    await restoreRecentItem(id);
    await db.items.put(next);
    await db.settings.put({ key: 'lastUsedGroupId', value: groupId });
    return next;
  });
}

export async function moveItems(
  ids: readonly string[],
  groupId: string,
  beforeItemId?: string,
): Promise<Item[]> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return [];

  return db.transaction('rw', db.items, db.groups, db.syncMeta, db.settings, async () => {
    const group = await db.groups.get(groupId);
    if (!group || isGroupDeleted(group))
      throw new Error('The selected group is unavailable.');

    const selected = await Promise.all(uniqueIds.map((id) => db.items.get(id)));
    if (selected.some((item) => !item || isItemDeleted(item)))
      throw new Error('One or more selected favorites are unavailable.');
    const items = selected as Item[];
    const movingIds = new Set(uniqueIds);
    const destination = ordered(
      (await db.items.where('groupId').equals(groupId).toArray()).filter(
        (item) => !isItemDeleted(item) && !movingIds.has(item.id),
      ),
    );
    const index = beforeItemId
      ? destination.findIndex((item) => item.id === beforeItemId)
      : destination.length;
    if (index < 0) throw new Error('The destination favorite is unavailable.');
    let previousKey = destination[index - 1]?.orderKey ?? null;
    const nextKey = destination[index]?.orderKey ?? null;
    const moved: Item[] = [];
    for (const item of items) {
      const orderKey = keyBetween(previousKey, nextKey);
      previousKey = orderKey;
      const clock = await nextClock();
      const next: Item = {
        ...item,
        groupId,
        orderKey,
        clock: { ...item.clock, groupId: clock, orderKey: clock },
      };
      await restoreRecentItem(item.id);
      await db.items.put(next);
      moved.push(next);
    }
    await db.settings.put({ key: 'lastUsedGroupId', value: groupId });
    return moved;
  });
}

export interface ItemPosition {
  id: string;
  groupId: string;
  orderKey: string;
}

export async function restoreItemPositions(
  positions: readonly ItemPosition[],
): Promise<void> {
  await db.transaction('rw', db.items, db.groups, db.syncMeta, async () => {
    const records = await Promise.all(
      positions.map((position) => db.items.get(position.id)),
    );
    if (records.some((item) => !item || isItemDeleted(item)))
      throw new Error('One or more favorites are unavailable.');
    for (let index = 0; index < positions.length; index += 1) {
      const position = positions[index];
      const item = records[index] as Item;
      const group = await db.groups.get(position.groupId);
      if (!group || isGroupDeleted(group))
        throw new Error('The destination group is unavailable.');
      const clock = await nextClock();
      await db.items.put({
        ...item,
        groupId: position.groupId,
        orderKey: position.orderKey,
        clock: { ...item.clock, groupId: clock, orderKey: clock },
      });
    }
  });
}

export async function deleteItem(id: string): Promise<void> {
  await db.transaction('rw', db.items, db.syncMeta, async () => {
    const item = await db.items.get(id);
    if (!item || isItemDeleted(item)) return;
    const clock = await nextClock();
    await db.items.put({ ...item, deleted: clock });
  });
}

export async function deleteItems(ids: readonly string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return;
  await db.transaction('rw', db.items, db.syncMeta, async () => {
    const records = await Promise.all(uniqueIds.map((id) => db.items.get(id)));
    if (records.some((item) => !item || isItemDeleted(item)))
      throw new Error('One or more selected favorites are unavailable.');
    for (const item of records as Item[]) {
      const clock = await nextClock();
      await db.items.put({ ...item, deleted: clock });
    }
  });
}

export async function restoreItem(id: string): Promise<Item> {
  return db.transaction('rw', db.items, db.syncMeta, async () => {
    const item = await db.items.get(id);
    if (!item) throw new Error('Favorite not found.');
    if (!isItemDeleted(item)) return item;
    const clock = await nextClock();
    const next = { ...item, clock: { ...item.clock, title: clock } };
    delete next.deleted;
    await db.items.put(next);
    return next;
  });
}

export async function restoreItems(ids: readonly string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (!uniqueIds.length) return;
  await db.transaction('rw', db.items, db.syncMeta, async () => {
    const records = await Promise.all(uniqueIds.map((id) => db.items.get(id)));
    if (records.some((item) => !item))
      throw new Error('A favorite could not be restored.');
    for (const item of records as Item[]) {
      if (!isItemDeleted(item)) continue;
      const clock = await nextClock();
      const restored = { ...item, clock: { ...item.clock, title: clock } };
      delete restored.deleted;
      await db.items.put(restored);
    }
  });
}

export async function restoreGroup(id: string): Promise<Group> {
  return db.transaction('rw', db.groups, db.syncMeta, async () => {
    const group = await db.groups.get(id);
    if (!group) throw new Error('Group not found.');
    if (!isGroupDeleted(group)) return group;
    const clock = await nextClock();
    const next = { ...group, clock: { ...group.clock, title: clock } };
    delete next.deleted;
    await db.groups.put(next);
    return next;
  });
}

export async function createSnapshot(): Promise<LibrarySnapshot> {
  return db.transaction(
    'rw',
    db.groups,
    db.items,
    db.thumbnails,
    db.snapshots,
    async () => {
      const snapshot: LibrarySnapshot = {
        createdAt: Date.now(),
        groups: await db.groups.toArray(),
        items: await db.items.toArray(),
        thumbnails: await db.thumbnails.toArray(),
      };
      snapshot.id = await db.snapshots.add(snapshot);
      const oldSnapshots = await db.snapshots.orderBy('createdAt').reverse().toArray();
      const expiredIds = oldSnapshots
        .slice(SNAPSHOT_LIMIT)
        .flatMap((entry) => (entry.id ? [entry.id] : []));
      if (expiredIds.length) await db.snapshots.bulkDelete(expiredIds);
      return snapshot;
    },
  );
}

export async function listSnapshots(): Promise<LibrarySnapshot[]> {
  return db.snapshots.orderBy('createdAt').reverse().toArray();
}

export async function restoreSnapshot(id: number): Promise<void> {
  await db.transaction(
    'rw',
    db.groups,
    db.items,
    db.thumbnails,
    db.snapshots,
    db.syncMeta,
    async () => {
      const snapshot = await db.snapshots.get(id);
      if (!snapshot) throw new Error('Snapshot not found.');
      await db.groups.clear();
      await db.items.clear();
      await db.thumbnails.clear();
      await db.groups.bulkPut(snapshot.groups);
      await db.items.bulkPut(snapshot.items);
      await db.thumbnails.bulkPut(snapshot.thumbnails);
      await nextClock();
    },
  );
}
