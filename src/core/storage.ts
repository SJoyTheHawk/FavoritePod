import { compareHLC, latestHLC, tickHLC } from './hlc';
import { isGroupDeleted, isItemDeleted } from './merge';
import { nextOrderKey } from './ordering';
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

export type LibraryView = 'grid' | 'list';

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
  const items = (await db.items.toArray()).filter((item) => !isItemDeleted(item));
  return items.sort((a, b) => compareLatestItemClock(b, a)).slice(0, limit);
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

    const changedFields = (Object.keys(updates) as GroupField[]).filter(
      (field) => updates[field] !== undefined && updates[field] !== group[field],
    );
    if (changedFields.length === 0) return group;

    const clock = await nextClock();
    const next = { ...group, ...updates, clock: { ...group.clock } };
    for (const field of changedFields) next.clock[field] = clock;
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
        previewHash,
        clock: {
          groupId: clock,
          orderKey: clock,
          url: clock,
          title: clock,
          previewHash: clock,
        },
      };

      if (data.thumbnail && previewHash) {
        await db.thumbnails.put({
          hash: previewHash,
          blob: data.thumbnail.blob,
          size: data.thumbnail.blob.size,
          width: data.thumbnail.width,
          height: data.thumbnail.height,
          createdAt: Date.now(),
        });
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

  return db.transaction('rw', db.items, db.groups, db.syncMeta, async () => {
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
    if (changedFields.length === 0) return item;

    const clock = await nextClock();
    const next: Item = { ...item, ...updates, clock: { ...item.clock } };
    for (const field of changedFields) next.clock[field] = clock;
    if (updates.title !== undefined)
      next.title = normalizedTitle(updates.title, next.url);
    await db.items.put(next);
    return next;
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
