import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureThumbnail, compressThumbnail, hashBlob } from '../thumbnail';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('thumbnail pipeline', () => {
  it('hashes the encoded thumbnail bytes deterministically', async () => {
    await expect(hashBlob(new Blob(['thumbnail']))).resolves.toBe(
      '80f61f96184524ba54db767ed49487392430ad26bf5cf2ef689905f3400325d7',
    );
  });

  it('creates a full and card-sized JPEG from one decoded image', async () => {
    const drawImage = vi.fn();
    const convertToBlob = vi
      .fn()
      .mockResolvedValueOnce(new Blob(['full'], { type: 'image/jpeg' }))
      .mockResolvedValueOnce(new Blob(['small'], { type: 'image/jpeg' }));
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 1200, height: 800, close: vi.fn() }),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        constructor(
          public width: number,
          public height: number,
        ) {}

        getContext() {
          return { drawImage };
        }

        convertToBlob = convertToBlob;
      },
    );

    const result = await compressThumbnail(new Blob(['source']));

    expect(result.width).toBe(640);
    expect(result.height).toBe(400);
    expect(result.blob.type).toBe('image/jpeg');
    expect(result.smallBlob?.type).toBe('image/jpeg');
    expect(convertToBlob).toHaveBeenNthCalledWith(1, {
      type: 'image/jpeg',
      quality: 0.75,
    });
    expect(convertToBlob).toHaveBeenCalledTimes(2);
    expect(drawImage).toHaveBeenCalledTimes(2);
  });

  it('serializes a captured page before compressing it', async () => {
    const captureVisibleTab = vi
      .fn()
      .mockResolvedValue(`data:image/png;base64,${btoa('captured')}`);
    vi.stubGlobal('chrome', {
      tabs: { captureVisibleTab },
    });
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 640, height: 400, close: vi.fn() }),
    );
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return { drawImage: vi.fn() };
        }

        async convertToBlob() {
          return new Blob(['jpeg'], { type: 'image/jpeg' });
        }
      },
    );

    const result = await captureThumbnail(7);

    expect(captureVisibleTab).toHaveBeenCalledWith(7, { format: 'jpeg', quality: 80 });
    expect(result.smallBlob).toBeDefined();
  });
});
