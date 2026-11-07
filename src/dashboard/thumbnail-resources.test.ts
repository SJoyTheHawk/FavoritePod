import { afterEach, describe, expect, it, vi } from 'vitest';
import { getThumbnail } from '../core/storage';
import { acquireThumbnailUrl } from './thumbnail-resources';

vi.mock('../core/storage', () => ({ getThumbnail: vi.fn() }));

const getThumbnailMock = vi.mocked(getThumbnail);

afterEach(() => {
  vi.restoreAllMocks();
  getThumbnailMock.mockReset();
});

describe('thumbnail resource sharing', () => {
  it('deduplicates concurrent small-image reads and shares one object URL', async () => {
    const blob = new Blob(['small'], { type: 'image/jpeg' });
    getThumbnailMock.mockResolvedValue({
      hash: 'shared-small',
      blob: new Blob(['full']),
      smallBlob: blob,
      size: 10,
      width: 320,
      height: 200,
      createdAt: 1,
    });
    const createUrl = vi.spyOn(URL, 'createObjectURL');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL');

    const [first, second] = await Promise.all([
      acquireThumbnailUrl('shared-small', 'small'),
      acquireThumbnailUrl('shared-small', 'small'),
    ]);

    expect(first?.url).toBe(second?.url);
    expect(getThumbnailMock).toHaveBeenCalledTimes(1);
    expect(createUrl).toHaveBeenCalledTimes(1);
    first?.release();
    second?.release();
    expect(revokeUrl).not.toHaveBeenCalled();
  });

  it('releases full-size resources as soon as their final consumer closes', async () => {
    getThumbnailMock.mockResolvedValue({
      hash: 'shared-full',
      blob: new Blob(['full']),
      size: 4,
      width: 1280,
      height: 800,
      createdAt: 1,
    });
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL');
    const resource = await acquireThumbnailUrl('shared-full', 'full');

    resource?.release();

    expect(revokeUrl).toHaveBeenCalledWith(resource?.url);
  });

  it('evicts old unused small previews after the bounded cache fills', async () => {
    getThumbnailMock.mockImplementation(async (hash) => ({
      hash,
      blob: new Blob([hash]),
      smallBlob: new Blob([hash]),
      size: hash.length,
      width: 320,
      height: 200,
      createdAt: 1,
    }));
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL');

    for (let index = 0; index < 70; index++) {
      const resource = await acquireThumbnailUrl(`cache-entry-${index}`, 'small');
      resource?.release();
    }

    expect(revokeUrl).toHaveBeenCalled();
  });
});
