import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { getCardThumbnailBlob } from '../card-thumbnail';
import { createSmallThumbnail } from '../thumbnail';
vi.mock('../thumbnail', () => ({ createSmallThumbnail: vi.fn() }));
const createSmall = vi.mocked(createSmallThumbnail);
const original = {
  hash: 'imported',
  blob: new Blob(['original']),
  size: 8,
  width: 3840,
  height: 2160,
  createdAt: 123,
};
beforeEach(async () => {
  await db.open();
  await db.thumbnails.put(original);
});
afterEach(async () => {
  vi.restoreAllMocks();
  createSmall.mockReset();
  await db.delete();
});

describe('imported card thumbnails', () => {
  it('persists and reuses a small derivative without changing the original bytes or metadata', async () => {
    const small = new Blob(['small']);
    createSmall.mockResolvedValue(small);
    expect(await (await getCardThumbnailBlob('imported'))?.text()).toBe('small');
    expect(await (await getCardThumbnailBlob('imported'))?.text()).toBe('small');
    expect(createSmall).toHaveBeenCalledOnce();
    const saved = (await db.thumbnails.get('imported'))!;
    expect(await saved.blob.text()).toBe('original');
    expect(saved).toMatchObject({
      hash: 'imported',
      size: 8,
      width: 3840,
      height: 2160,
      createdAt: 123,
    });
    expect(await saved.smallBlob?.text()).toBe('small');
  });
  it('skips obsolete work and does not persist a decode that finishes after cancellation', async () => {
    expect(await getCardThumbnailBlob('imported', () => false)).toBeUndefined();
    expect(createSmall).not.toHaveBeenCalled();
    let needed = true;
    createSmall.mockImplementation(async () => {
      needed = false;
      return new Blob(['unused']);
    });
    expect(await getCardThumbnailBlob('imported', () => needed)).toBeUndefined();
    expect((await db.thumbnails.get('imported'))?.smallBlob).toBeUndefined();
  });
  it('never recreates a thumbnail deleted while decoding', async () => {
    createSmall.mockImplementation(async () => {
      await db.thumbnails.delete('imported');
      return new Blob(['small']);
    });
    await getCardThumbnailBlob('imported');
    expect(await db.thumbnails.get('imported')).toBeUndefined();
  });
  it('returns the small image if persisting the optional derivative fails', async () => {
    createSmall.mockResolvedValue(new Blob(['small']));
    vi.spyOn(db.thumbnails, 'update').mockRejectedValue(new Error('QuotaExceededError'));
    expect(await (await getCardThumbnailBlob('imported'))?.text()).toBe('small');
  });
  it('does not fall back to a large original when decoding fails', async () => {
    createSmall.mockRejectedValue(new Error('Invalid image'));
    await expect(getCardThumbnailBlob('imported')).rejects.toThrow('Invalid image');
    expect((await db.thumbnails.get('imported'))?.smallBlob).toBeUndefined();
    expect(await getCardThumbnailBlob('missing')).toBeUndefined();
  });
});
