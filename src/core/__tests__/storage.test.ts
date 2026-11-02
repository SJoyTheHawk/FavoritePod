import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db';
import {
  createItem,
  createGroup,
  createSnapshot,
  deleteGroup,
  deleteItem,
  getDefaultView,
  getLastUsedGroupId,
  getRecentItems,
  listGroups,
  listItems,
  listSnapshots,
  restoreSnapshot,
  setDefaultView,
  updateGroup,
  updateItem,
} from '../storage';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterAll(async () => {
  await db.delete();
});

describe('local library storage', () => {
  it('creates a default group and stores a validated favorite with its preview', async () => {
    const preview = {
      blob: new Blob(['jpeg-data'], { type: 'image/jpeg' }),
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

  it('soft-deletes empty groups and protects groups that still contain records', async () => {
    const group = await createGroup({ title: 'Archive' });
    await expect(deleteGroup(group.id)).resolves.toBeUndefined();
    expect(await listGroups()).toHaveLength(0);
    expect((await db.groups.get(group.id))?.deleted).toBeDefined();

    const occupied = await createGroup({ title: 'Work' });
    await createItem({ url: 'https://example.com', groupId: occupied.id });
    await expect(deleteGroup(occupied.id)).rejects.toThrow('Move favorites');
    expect((await db.groups.get(occupied.id))?.deleted).toBeUndefined();
  });

  it('keeps deletions as tombstones while hiding them from the live library', async () => {
    const item = await createItem({ url: 'https://example.com', title: 'Example' });
    await deleteItem(item.id);

    expect(await listItems()).toHaveLength(0);
    expect((await db.items.get(item.id))?.deleted).toBeDefined();
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
