import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import Dexie from 'dexie';
import { compareHLC } from '../hlc';
import {
  createItem,
  createGroup,
  createSnapshot,
  dismissRecentItem,
  deleteGroup,
  deleteItem,
  deleteItems,
  getDefaultView,
  getCollapsedGroups,
  getGroupingMode,
  getHomePageGroupId,
  getLastSelectedGroupId,
  getOpenBehavior,
  getBookmarkSize,
  getLastUsedGroupId,
  getRecentItems,
  getSidebarCollapsed,
  getShowPreview,
  listGroups,
  listItems,
  listSnapshots,
  moveGroup,
  moveItem,
  moveItems,
  restoreGroup,
  restoreItem,
  restoreItems,
  restoreItemPositions,
  restoreSnapshot,
  setDefaultView,
  setCollapsedGroups,
  setGroupingMode,
  setHomePageGroupId,
  setLastSelectedGroupId,
  setOpenBehavior,
  setSidebarCollapsed,
  setBookmarkSize,
  setShowPreview,
  updateGroup,
  updateItem,
  updateItemThumbnail,
} from '../storage';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await db.delete();
});

describe('local library storage', () => {
  it('defaults grouping to hierarchical and persists the selected mode', async () => {
    expect(await getGroupingMode()).toBe('hierarchical');
    await setGroupingMode('labeled');
    db.close();
    await db.open();
    expect(await getGroupingMode()).toBe('labeled');
    await db.settings.put({ key: 'groupingMode', value: 'unknown' });
    expect(await getGroupingMode()).toBe('hierarchical');
  });

  it('persists collapsed group ids in local storage and ignores malformed data', () => {
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    try {
      expect(getCollapsedGroups()).toEqual(new Set());
      setCollapsedGroups(new Set(['work', 'personal']));
      expect(getCollapsedGroups()).toEqual(new Set(['work', 'personal']));
      values.set('favoritepod:collapsedGroups', '{');
      expect(getCollapsedGroups()).toEqual(new Set());
    } finally {
      if (originalStorage) {
        Object.defineProperty(globalThis, 'localStorage', originalStorage);
      } else {
        Reflect.deleteProperty(globalThis, 'localStorage');
      }
    }
  });

  it('persists sidebar collapse state across launcher reopen', async () => {
    expect(await getSidebarCollapsed()).toBe(false);
    await setSidebarCollapsed(true);
    db.close();
    await db.open();
    expect(await getSidebarCollapsed()).toBe(true);
    await setSidebarCollapsed(false);
    expect(await getSidebarCollapsed()).toBe(false);
  });

  it('persists preview visibility and startup selection preferences', async () => {
    const group = await createGroup({ title: 'Home' });
    expect(await getShowPreview()).toBe(true);
    expect(await getOpenBehavior()).toBe('all');

    await setShowPreview(false);
    await setOpenBehavior('last');
    await setHomePageGroupId(group.id);
    await setLastSelectedGroupId(group.id);
    db.close();
    await db.open();

    expect(await getShowPreview()).toBe(false);
    expect(await getOpenBehavior()).toBe('home');
    expect(await getHomePageGroupId()).toBe(group.id);
    expect(await getLastSelectedGroupId()).toBe(group.id);

    await setOpenBehavior('last');
    await setHomePageGroupId();
    await setLastSelectedGroupId(null);
    expect(await getOpenBehavior()).toBe('last');
    expect(await getHomePageGroupId()).toBeUndefined();
    expect(await getLastSelectedGroupId()).toBeNull();

    await setHomePageGroupId(group.id);
    await setHomePageGroupId();
    expect(await getOpenBehavior()).toBe('all');
  });

  it.each(['compact', 'extra-small'] as const)(
    'persists %s independently for both layouts',
    async (size) => {
      await setBookmarkSize('grid', size);
      await setBookmarkSize('list', 'large');
      db.close();
      await db.open();
      expect(await getBookmarkSize('grid')).toBe(size);
      expect(await getBookmarkSize('list')).toBe('large');
      await setBookmarkSize('list', size);
      db.close();
      await db.open();
      expect(await getBookmarkSize('grid')).toBe(size);
      expect(await getBookmarkSize('list')).toBe(size === 'extra-small' ? 'small' : size);
    },
  );
  it('defaults invalid sizes to medium and persists independent sizes across reopen', async () => {
    expect(await getBookmarkSize('grid')).toBe('medium');
    expect(await getBookmarkSize('list')).toBe('medium');
    await db.settings.put({ key: 'bookmarkSize:grid', value: 'invalid' });
    expect(await getBookmarkSize('grid')).toBe('medium');
    await setBookmarkSize('grid', 'small');
    await setBookmarkSize('list', 'large');
    db.close();
    await db.open();
    expect(await getBookmarkSize('grid')).toBe('extra-small');
    expect(await getBookmarkSize('list')).toBe('large');
    await setBookmarkSize('grid', 'medium');
    expect(await getBookmarkSize('grid')).toBe('medium');
    expect(await getBookmarkSize('list')).toBe('large');
  });
  it('inserts seven selected favorites as an ordered batch and restores them on undo', async () => {
    const group = await createGroup({ title: 'Stack' });
    const records: Awaited<ReturnType<typeof createItem>>[] = [];
    for (let index = 0; index < 10; index++) {
      records.push(
        await createItem({ url: `https://stack.example/${index}`, groupId: group.id }),
      );
    }
    const selected = [0, 2, 3, 5, 6, 7, 9].map((index) => records[index]);
    const ids = selected.map((item) => item.id);
    const before = selected.map(({ id, groupId, orderKey }) => ({
      id,
      groupId,
      orderKey,
    }));
    await moveItems(ids, group.id, records[4].id);
    expect((await listItems(group.id)).map((item) => item.id)).toEqual([
      records[1].id,
      ...ids,
      records[4].id,
      records[8].id,
    ]);
    await restoreItemPositions(before);
    expect((await listItems(group.id)).map((item) => item.id)).toEqual(
      records.map((item) => item.id),
    );
    await moveItems(ids, group.id);
    expect((await listItems(group.id)).map((item) => item.id)).toEqual([
      records[1].id,
      records[4].id,
      records[8].id,
      ...ids,
    ]);
    await expect(moveItems(ids, group.id, ids[0])).rejects.toThrow('destination');
    expect((await listItems(group.id)).map((item) => item.id)).toEqual([
      records[1].id,
      records[4].id,
      records[8].id,
      ...ids,
    ]);
  });
  it('nests an entire group at the bottom while retaining its children after reopen', async () => {
    const work = await createGroup({ title: 'Work' });
    const child = await createGroup({ title: '123', parentId: work.id });
    const favorites = await createGroup({ title: 'Favorites' });
    const existing = await createGroup({ title: 'Existing', parentId: favorites.id });
    await moveGroup(work.id, favorites.id);
    db.close();
    await db.open();
    const groups = await listGroups();
    expect(groups.find((group) => group.id === work.id)?.parentId).toBe(favorites.id);
    expect(groups.find((group) => group.id === child.id)?.parentId).toBe(work.id);
    expect(
      groups.filter((group) => group.parentId === favorites.id).map((group) => group.id),
    ).toEqual([existing.id, work.id]);
  });
  it('upgrades legacy bookmarks without losing their saved icon or title', async () => {
    const item = await createItem({
      url: 'https://legacy.example',
      title: 'Legacy',
      faviconUrl: 'https://legacy.example/icon.ico',
    });
    const groups = await listGroups();
    Reflect.deleteProperty(item.clock, 'faviconUrl');
    await db.delete();
    const legacy = new Dexie('FavoritePod');
    legacy.version(1).stores({
      groups: 'id,parentId,orderKey,deleted',
      items: 'id,groupId,orderKey,deleted,url,previewHash',
      thumbnails: 'hash,size,createdAt',
      syncMeta: 'key',
      snapshots: '++id,createdAt',
      deviceFiles: 'deviceId,lastSync',
      settings: 'key',
    });
    await legacy.open();
    await legacy.table('groups').bulkPut(groups);
    await legacy.table('items').put(item);
    legacy.close();
    await db.open();
    expect((await listItems())[0]).toMatchObject({
      title: 'Legacy',
      faviconUrl: item.faviconUrl,
      clock: { faviconUrl: item.clock.url },
    });
  });

  it('removes cached Drive storage usage when upgrading', async () => {
    await db.delete();
    const legacy = new Dexie('FavoritePod');
    legacy.version(3).stores({
      groups: 'id,parentId,orderKey,deleted',
      items: 'id,groupId,orderKey,deleted,url,previewHash',
      thumbnails: 'hash,size,createdAt',
      syncMeta: 'key',
      snapshots: '++id,createdAt',
      deviceFiles: 'deviceId,lastSync',
      driveAssets: 'hash,lastSync',
      settings: 'key',
    });
    await legacy.open();
    await legacy.table('syncMeta').bulkPut([
      { key: 'drive.storageQuota', value: { usageInDrive: 1024 } },
      { key: 'drive.lastSync', value: 'keep' },
    ]);
    legacy.close();

    await db.open();
    expect(await db.syncMeta.get('drive.storageQuota')).toBeUndefined();
    expect((await db.syncMeta.get('drive.lastSync'))?.value).toBe('keep');
  });

  it('persists a favicon across reopen, edit, and snapshot restore', async () => {
    const faviconUrl = 'data:image/png;base64,aWNvbg==';
    const item = await createItem({ url: 'https://icon.example', faviconUrl });
    db.close();
    await db.open();
    expect((await listItems())[0].faviconUrl).toBe(faviconUrl);
    await updateItem(item.id, { title: 'Renamed' });
    const snapshot = await createSnapshot();
    await updateItem(item.id, { faviconUrl: 'data:image/png;base64,bmV3' });
    await restoreSnapshot(snapshot.id!);
    expect((await listItems())[0].faviconUrl).toBe(faviconUrl);
  });

  it('backfills an existing bookmark favicon without creating a duplicate', async () => {
    const item = await createItem({ url: 'https://existing.example' });
    const updated = await updateItem(item.id, {
      faviconUrl: 'data:image/png;base64,aWNvbg==',
    });
    expect(updated.clock.faviconUrl > item.clock.faviconUrl).toBe(true);
    expect(await listItems()).toHaveLength(1);
    expect((await listItems())[0].faviconUrl).toBe(updated.faviconUrl);
  });

  it('persists simultaneous recent dismissals without deleting bookmarks', async () => {
    const a = await createItem({ url: 'https://a.example' });
    const b = await createItem({ url: 'https://b.example' });
    await Promise.all([dismissRecentItem(a.id), dismissRecentItem(b.id)]);
    db.close();
    await db.open();
    expect(await getRecentItems()).toHaveLength(0);
    expect(await listItems()).toHaveLength(2);
  });

  it('creates a default group and stores a validated favorite with its preview', async () => {
    const preview = {
      blob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
      smallBlob: new Blob(['small-jpeg-data'], { type: 'image/jpeg' }),
      width: 2,
      height: 1,
    };
    const item = await createItem({
      url: 'https://example.com',
      title: '',
      thumbnail: preview,
    });

    expect((await listGroups())[0]?.title).toBe('Favorites');
    expect(item.title).toBe('example.com');
    expect(item.previewHash).toMatch(/^[a-f0-9]{64}$/);
    expect(await db.thumbnails.get(item.previewHash!)).toMatchObject({
      width: 2,
      height: 1,
      smallBlob: preview.smallBlob,
    });
  });

  it('stores a replacement preview and updates its merge clock', async () => {
    const item = await createItem({ url: 'https://preview.example' });
    const updated = await updateItemThumbnail(item.id, {
      blob: new Blob(['new-jpeg-data'], { type: 'image/jpeg' }),
      smallBlob: new Blob(['small-new-jpeg-data'], { type: 'image/jpeg' }),
      width: 640,
      height: 400,
    });

    expect(updated.previewHash).toMatch(/^[a-f0-9]{64}$/);
    expect(updated.clock.previewHash > item.clock.previewHash).toBe(true);
    expect(await db.thumbnails.get(updated.previewHash!)).toMatchObject({
      width: 640,
      height: 400,
      smallBlob: expect.any(Blob),
      size: 13,
    });
  });

  it('rejects executable URL schemes and writes edits as newer field clocks', async () => {
    await expect(createItem({ url: 'javascript:alert(1)' })).rejects.toThrow(
      'web address',
    );
    const item = await createItem({ url: 'https://example.com', title: 'Example' });
    const updated = await updateItem(item.id, { title: 'Renamed' });

    expect(updated.title).toBe('Renamed');
    expect(updated.clock.title > item.clock.title).toBe(true);
    expect(await listItems()).toHaveLength(1);
  });

  it('orders groups and filters items by group while retaining the latest-used group', async () => {
    const work = await createGroup({ title: 'Work' });
    const personal = await createGroup({ title: 'Personal' });
    await updateGroup(work.id, { title: 'Projects' });
    const first = await createItem({
      url: 'https://first.example',
      title: 'First',
      groupId: work.id,
    });
    const second = await createItem({
      url: 'https://second.example',
      title: 'Second',
      groupId: personal.id,
    });

    expect((await listGroups()).map((group) => group.title)).toEqual([
      'Projects',
      'Personal',
    ]);
    expect((await listItems(work.id)).map((item) => item.id)).toEqual([first.id]);
    expect((await getRecentItems()).map((item) => item.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(await getLastUsedGroupId()).toBe(personal.id);
  });

  it('moves groups between levels, orders siblings, and prevents cycles', async () => {
    const parent = await createGroup({ title: 'Parent' });
    const sibling = await createGroup({ title: 'Sibling' });
    const child = await createGroup({ title: 'Child', parentId: parent.id });
    const grandchild = await createGroup({ title: 'Grandchild', parentId: child.id });

    await moveGroup(sibling.id, parent.id);
    expect((await db.groups.get(sibling.id))?.parentId).toBe(parent.id);
    await expect(moveGroup(parent.id, grandchild.id)).rejects.toThrow('descendants');

    await moveGroup(grandchild.id, parent.id, sibling.id);
    expect(
      (await db.groups.get(grandchild.id))!.orderKey <
        (await db.groups.get(sibling.id))!.orderKey,
    ).toBe(true);
  });

  it('moves and reorders items using fractional keys', async () => {
    const source = await createGroup({ title: 'Source' });
    const destination = await createGroup({ title: 'Destination' });
    const first = await createItem({
      url: 'https://first.example',
      groupId: destination.id,
    });
    const second = await createItem({
      url: 'https://second.example',
      groupId: destination.id,
    });
    const moved = await createItem({ url: 'https://moved.example', groupId: source.id });

    await moveItem(moved.id, destination.id, first.id);
    expect((await listItems(destination.id)).map((item) => item.id)).toEqual([
      moved.id,
      first.id,
      second.id,
    ]);
    await moveItem(second.id, destination.id, moved.id);
    expect((await listItems(destination.id)).map((item) => item.id)).toEqual([
      second.id,
      moved.id,
      first.id,
    ]);
  });

  it('moves and deletes a selected set as one undoable batch', async () => {
    const source = await createGroup({ title: 'Batch source' });
    const destination = await createGroup({ title: 'Batch destination' });
    const first = await createItem({
      url: 'https://batch-first.example',
      groupId: source.id,
    });
    const second = await createItem({
      url: 'https://batch-second.example',
      groupId: source.id,
    });

    await moveItems([first.id, second.id], destination.id);
    expect((await listItems(destination.id)).map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ]);
    await restoreItemPositions([
      { id: first.id, groupId: source.id, orderKey: first.orderKey },
      { id: second.id, groupId: source.id, orderKey: second.orderKey },
    ]);
    expect((await listItems(source.id)).map((item) => item.id)).toEqual([
      first.id,
      second.id,
    ]);

    await deleteItems([first.id, second.id]);
    expect(await listItems()).toHaveLength(0);
    await restoreItems([first.id, second.id]);
    expect((await listItems()).map((item) => item.id)).toEqual([first.id, second.id]);
  });

  it('appends a favorite to the end of its destination group when moved', async () => {
    const source = await createGroup({ title: 'Source' });
    const destination = await createGroup({ title: 'Destination' });
    const moved = await createItem({ url: 'https://moved.example', groupId: source.id });
    const existing = await createItem({
      url: 'https://existing.example',
      groupId: destination.id,
    });

    const updated = await updateItem(moved.id, { groupId: destination.id });

    expect(updated.orderKey).not.toBe(moved.orderKey);
    expect(updated.clock.orderKey > moved.clock.orderKey).toBe(true);
    expect((await listItems(destination.id)).map((item) => item.id)).toEqual([
      existing.id,
      moved.id,
    ]);
  });

  it('dismisses a favorite from recent pages without deleting it', async () => {
    const first = await createItem({ url: 'https://first.example', title: 'First' });
    const second = await createItem({ url: 'https://second.example', title: 'Second' });

    await dismissRecentItem(second.id);

    expect((await getRecentItems()).map((item) => item.id)).toEqual([first.id]);
    expect(await listItems()).toHaveLength(2);

    await updateItem(second.id, { title: 'Second again' });
    expect((await getRecentItems()).map((item) => item.id)).toContain(second.id);
  });

  it('limits the recent pages query to five items by default', async () => {
    const created = [];
    for (let index = 0; index < 7; index += 1) {
      created.push(
        await createItem({
          url: `https://recent-${index}.example`,
          title: `Recent ${index}`,
        }),
      );
    }

    expect(await getRecentItems()).toHaveLength(5);
    expect((await getRecentItems()).map((item) => item.id)).not.toContain(created[0].id);
    expect(await getRecentItems(3)).toHaveLength(3);
  });

  it('persists the preferred dashboard view', async () => {
    expect(await getDefaultView()).toBeUndefined();
    await setDefaultView('list');
    expect(await getDefaultView()).toBe('list');
  });

  it('keeps fractional item order across mixed-case index keys', async () => {
    const created = [];
    for (let index = 0; index < 37; index += 1) {
      created.push(
        await createItem({
          url: `https://example.com/${index}`,
          title: `Item ${index}`,
        }),
      );
    }

    expect(created[35].orderKey).toBe('aZ');
    expect(created[36].orderKey).toBe('aa');
    expect((await listItems()).map((item) => item.id)).toEqual(
      created.map((item) => item.id),
    );
  });

  it('deletes an empty group subtree and restores the subtree together', async () => {
    const group = await createGroup({ title: 'Archive' });
    const child = await createGroup({ title: 'Nested', parentId: group.id });
    const grandchild = await createGroup({ title: 'Deeply nested', parentId: child.id });
    await expect(deleteGroup(group.id)).resolves.toBeUndefined();
    expect(await listGroups()).toHaveLength(0);
    expect((await db.groups.get(group.id))?.deleted).toBeDefined();
    expect((await db.groups.get(child.id))?.deleted).toBeDefined();
    expect((await db.groups.get(grandchild.id))?.deleted).toBeDefined();

    await restoreGroup(group.id);
    expect((await listGroups()).map((entry) => entry.id).sort()).toEqual(
      [group.id, child.id, grandchild.id].sort(),
    );
    expect((await db.groups.get(child.id))?.parentId).toBe(group.id);
    expect((await db.groups.get(grandchild.id))?.parentId).toBe(child.id);
  });

  it('blocks deleting a group when any descendant contains a favorite', async () => {
    const group = await createGroup({ title: 'Work' });
    const child = await createGroup({ title: 'Nested work', parentId: group.id });
    await createItem({ url: 'https://example.com', groupId: child.id });
    await expect(deleteGroup(group.id)).rejects.toThrow(
      'Move favorites before deleting this group.',
    );
    expect((await db.groups.get(group.id))?.deleted).toBeUndefined();
    expect((await db.groups.get(child.id))?.deleted).toBeUndefined();
  });

  it('keeps deletions as tombstones while hiding them from the live library', async () => {
    const item = await createItem({ url: 'https://example.com', title: 'Example' });
    await deleteItem(item.id);

    expect(await listItems()).toHaveLength(0);
    expect((await db.items.get(item.id))?.deleted).toBeDefined();
  });

  it('restores deleted records with a newer field clock', async () => {
    const group = await createGroup({ title: 'Undo group' });
    const item = await createItem({ url: 'https://undo.example', groupId: group.id });
    await deleteItem(item.id);
    await deleteGroup(group.id);
    const groupTombstone = (await db.groups.get(group.id))!.deleted!;
    const itemTombstone = (await db.items.get(item.id))!.deleted!;

    const restoredGroup = await restoreGroup(group.id);
    const restoredItem = await restoreItem(item.id);
    expect((await listGroups()).map((entry) => entry.id)).toContain(group.id);
    expect((await listItems()).map((entry) => entry.id)).toContain(item.id);
    expect(compareHLC(restoredGroup.clock.title, groupTombstone)).toBeGreaterThan(0);
    expect(compareHLC(restoredItem.clock.title, itemTombstone)).toBeGreaterThan(0);
  });

  it('restores an atomic snapshot of records and thumbnails', async () => {
    const first = await createItem({ url: 'https://first.example', title: 'First' });
    const snapshot = await createSnapshot();
    await createItem({ url: 'https://second.example', title: 'Second' });

    await restoreSnapshot(snapshot.id!);
    expect((await listItems()).map((item) => item.id)).toEqual([first.id]);
  });

  it('keeps only the three newest local snapshots', async () => {
    for (let index = 0; index < 4; index += 1) await createSnapshot();

    expect(await listSnapshots()).toHaveLength(3);
  });
});
