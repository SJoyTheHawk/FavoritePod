import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { createItem, deleteItem, updateItem, updateItemThumbnail } from '../storage';

beforeEach(async () => {
  await db.open();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});
const preview = {
  blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
  width: 640,
  height: 400,
};

describe('atomic thumbnail storage', () => {
  it('removes an image through the thumbnail API and retains it for undo', async () => {
    const item = await createItem({
      title: 'Saved favorite',
      url: 'file:///saved-page.html',
      thumbnail: preview,
    });
    const updated = await updateItemThumbnail(item.id, null, item);
    expect(updated.previewHash).toBeUndefined();
    expect(updated.clock.previewHash).not.toBe(item.clock.previewHash);
    expect(updated.title).toBe(item.title);
    expect(updated.url).toBe(item.url);
    expect(updated.groupId).toBe(item.groupId);
    expect(updated.deleted).toBeUndefined();
    expect(await db.items.get(item.id)).toEqual(updated);
    expect(await db.thumbnails.get(item.previewHash!)).toBeDefined();

    const restored = await updateItem(item.id, { previewHash: item.previewHash });
    expect(restored.previewHash).toBe(item.previewHash);
    const removedAgain = await updateItemThumbnail(item.id, null, restored);
    expect(removedAgain.previewHash).toBeUndefined();
  });

  it('removes only the thumbnail and advances its sync clock', async () => {
    const item = await createItem({ url: 'https://example.com', thumbnail: preview });
    const updated = await updateItem(
      item.id,
      { title: 'Reviewed title' },
      { thumbnail: null, expected: item },
    );
    expect(updated.id).toBe(item.id);
    expect(updated.previewHash).toBeUndefined();
    expect(updated.deleted).toBeUndefined();
    expect(updated.title).toBe('Reviewed title');
    expect(updated.clock.previewHash).not.toBe(item.clock.previewHash);
  });

  it('preserves the saved thumbnail when the draft leaves it unchanged', async () => {
    const item = await createItem({ url: 'https://example.com', thumbnail: preview });
    const updated = await updateItem(
      item.id,
      { title: 'Reviewed title' },
      { thumbnail: undefined, expected: item },
    );
    expect(updated.previewHash).toBe(item.previewHash);
    expect(updated.clock.previewHash).toBe(item.clock.previewHash);
  });

  it('rolls back both the image and details if the folder is invalid', async () => {
    const item = await createItem({ url: 'https://example.com' });
    await expect(
      updateItem(
        item.id,
        { title: 'New', groupId: 'missing' },
        { thumbnail: preview, expected: item },
      ),
    ).rejects.toThrow('group');
    expect(await db.items.get(item.id)).toEqual(item);
    expect(await db.thumbnails.count()).toBe(0);
  });

  it('rejects stale removal without changing the favorite', async () => {
    const item = await createItem({ url: 'https://example.com', thumbnail: preview });
    await updateItemThumbnail(item.id, { ...preview, blob: new Blob(['new']) });
    const current = await db.items.get(item.id);
    await expect(
      updateItem(item.id, { title: 'Old draft' }, { thumbnail: null, expected: item }),
    ).rejects.toThrow('changed');
    expect(await db.items.get(item.id)).toEqual(current);
  });

  it.each(['url', 'previewHash', 'deleted', 'url-clock'])(
    'rejects stale captures after %s changes',
    async (change) => {
      const item = await createItem({ url: 'https://example.com' });
      if (change === 'url') await updateItem(item.id, { url: 'https://other.example' });
      if (change === 'previewHash')
        await updateItemThumbnail(item.id, { ...preview, blob: new Blob(['other']) });
      if (change === 'deleted') await deleteItem(item.id);
      if (change === 'url-clock') {
        await updateItem(item.id, { url: 'https://other.example' });
        await updateItem(item.id, { url: item.url });
      }
      const before = await db.items.get(item.id);
      const count = await db.thumbnails.count();
      await expect(updateItemThumbnail(item.id, preview, item)).rejects.toThrow();
      expect(await db.items.get(item.id)).toEqual(before);
      expect(await db.thumbnails.count()).toBe(count);
    },
  );

  it('preserves unrelated edits and permits restoring the previous preview', async () => {
    const item = await createItem({
      url: 'https://example.com',
      thumbnail: { ...preview, blob: new Blob(['old']) },
    });
    await updateItem(item.id, { title: 'New title' });
    const updated = await updateItemThumbnail(item.id, preview, item);
    expect(updated.title).toBe('New title');
    expect(updated.previewHash).not.toBe(item.previewHash);
    await updateItem(item.id, { previewHash: item.previewHash });
    expect((await db.items.get(item.id))?.previewHash).toBe(item.previewHash);
    await updateItemThumbnail(item.id, preview);
    expect((await db.items.get(item.id))?.previewHash).toBe(updated.previewHash);
  });

  it('does not write after cancellation', async () => {
    const item = await createItem({ url: 'file:///page.html' });
    const controller = new AbortController();
    controller.abort();
    await expect(
      updateItemThumbnail(item.id, preview, item, controller.signal),
    ).rejects.toThrow();
    expect(await db.thumbnails.count()).toBe(0);
    expect(await db.items.get(item.id)).toEqual(item);
  });
});
