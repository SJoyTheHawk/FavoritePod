import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getThumbnail } from '../core/storage';
import { getCardThumbnailBlob } from '../core/card-thumbnail';
import type * as ThumbnailResources from './thumbnail-resources';
let acquireThumbnailUrl: typeof ThumbnailResources.acquireThumbnailUrl;
let retainThumbnailUrl: typeof ThumbnailResources.retainThumbnailUrl;
let getThumbnailResourceStats: typeof ThumbnailResources.getThumbnailResourceStats;

vi.mock('../core/storage', () => ({ getThumbnail: vi.fn() }));
vi.mock('../core/card-thumbnail', () => ({ getCardThumbnailBlob: vi.fn() }));
const getThumbnailMock = vi.mocked(getThumbnail);
const getSmallMock = vi.mocked(getCardThumbnailBlob);
const fullThumbnail = {
  hash: 'full',
  blob: new Blob(['full']),
  size: 4,
  width: 640,
  height: 400,
  createdAt: 1,
};

beforeEach(async () => {
  vi.resetModules();
  ({ acquireThumbnailUrl, retainThumbnailUrl, getThumbnailResourceStats } =
    await import('./thumbnail-resources'));
});

afterEach(() => {
  vi.restoreAllMocks();
  getThumbnailMock.mockReset();
  getSmallMock.mockReset();
});

describe('thumbnail resource ownership', () => {
  it('reports aggregate ownership and bytes without retaining released small images', async () => {
    getSmallMock.mockResolvedValue(new Blob(['small']));
    getThumbnailMock.mockResolvedValue(fullThumbnail);
    const small = await acquireThumbnailUrl('private-small-hash', 'small');
    const full = await acquireThumbnailUrl('private-full-hash', 'full');
    const live = getThumbnailResourceStats();
    expect(live.small).toMatchObject({ urls: 1, consumers: 1, encodedBytes: 5 });
    expect(live.full).toMatchObject({
      urls: 1,
      consumers: 1,
      encodedBytes: 4,
      fullImageRgbaBytesEstimate: 640 * 400 * 4,
    });
    small!.release();
    full!.release();
    const closed = getThumbnailResourceStats();
    expect(closed.small).toMatchObject({ entries: 0, urls: 0, encodedBytes: 0 });
    expect(closed.full).toMatchObject({ urls: 1, consumers: 0, encodedBytes: 4 });
    expect(closed).toMatchObject({
      cachedHoverImages: 1,
      urlsCreated: 2,
      urlsRevoked: 1,
    });
    expect(JSON.stringify(closed)).not.toContain('private-');
  });
  it('keeps drag-copy images alive until both the card and overlay release them', async () => {
    getSmallMock.mockResolvedValue(new Blob(['small']));
    const card = await acquireThumbnailUrl('drag-copy', 'small');
    const releaseCopy = retainThumbnailUrl(card!.url)!;
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    card!.release();
    expect(revoke).not.toHaveBeenCalled();
    releaseCopy();
    releaseCopy();
    expect(revoke).toHaveBeenCalledExactlyOnceWith(card!.url);
  });
  it('shares concurrent reads and revokes only after the last card releases', async () => {
    getSmallMock.mockResolvedValue(new Blob(['small']));
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const [first, second] = await Promise.all([
      acquireThumbnailUrl('shared', 'small'),
      acquireThumbnailUrl('shared', 'small'),
    ]);
    expect(first?.url).toBe(second?.url);
    expect(getSmallMock).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    first!.release();
    expect(revoke).not.toHaveBeenCalled();
    second!.release();
    expect(revoke).toHaveBeenCalledExactlyOnceWith(first!.url);
    second!.release();
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('reserves a cached URL while a new consumer awaits it', async () => {
    getSmallMock.mockResolvedValue(new Blob(['small']));
    const first = await acquireThumbnailUrl('handoff', 'small');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const next = acquireThumbnailUrl('handoff', 'small');
    first!.release();
    expect(revoke).not.toHaveBeenCalled();
    const second = await next;
    expect(second!.url).toBe(first!.url);
    second!.release();
    expect(revoke).toHaveBeenCalledExactlyOnceWith(first!.url);
  });

  it('does not retain URLs after scrolling through hundreds of distinct images', async () => {
    getSmallMock.mockResolvedValue(new Blob(['small']));
    const create = vi.spyOn(URL, 'createObjectURL');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    for (let index = 0; index < 200; index++) {
      const resource = await acquireThumbnailUrl('scroll-' + index, 'small');
      resource!.release();
    }
    expect(create).toHaveBeenCalledTimes(200);
    expect(revoke.mock.calls.map(([url]) => url)).toEqual(
      create.mock.results.map(({ value }) => value),
    );
  });

  it('drops an in-flight image without allocating a URL when its card unmounts', async () => {
    let finish!: (blob: Blob) => void;
    getSmallMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const create = vi.spyOn(URL, 'createObjectURL');
    const controller = new AbortController();
    const request = acquireThumbnailUrl('cancel-loading', 'small', controller.signal);
    await vi.waitFor(() => expect(getSmallMock).toHaveBeenCalledOnce());
    controller.abort();
    finish(new Blob(['obsolete']));
    expect(await request).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });

  it('allows one shared consumer to cancel without cancelling another', async () => {
    let finish!: (blob: Blob) => void;
    getSmallMock.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const controller = new AbortController();
    const first = acquireThumbnailUrl('partial-cancel', 'small', controller.signal);
    const second = acquireThumbnailUrl('partial-cancel', 'small');
    controller.abort();
    finish(new Blob(['needed']));
    expect(await first).toBeUndefined();
    const resource = await second;
    expect(resource?.url).toBeDefined();
    resource!.release();
  });

  it('limits work to four jobs and skips queued requests that leave view', async () => {
    const finish: Array<(blob: Blob) => void> = [];
    getSmallMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish.push(resolve);
        }),
    );
    const controllers = Array.from({ length: 12 }, () => new AbortController());
    const requests = controllers.map((controller, index) =>
      acquireThumbnailUrl('queued-' + index, 'small', controller.signal),
    );
    await vi.waitFor(() => expect(finish).toHaveLength(4));
    controllers.slice(4).forEach((controller) => controller.abort());
    finish.forEach((resolve) => resolve(new Blob(['loaded'])));
    const resources = await Promise.all(requests);
    expect(getSmallMock).toHaveBeenCalledTimes(4);
    expect(resources.slice(4)).toEqual(Array(8).fill(undefined));
    resources.forEach((resource) => resource?.release());
  });

  it('keeps a loaded full preview after closing and retries failed/missing images', async () => {
    getThumbnailMock.mockResolvedValue({
      hash: 'full',
      blob: new Blob(['full']),
      size: 4,
      width: 640,
      height: 400,
      createdAt: 1,
    });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const controller = new AbortController();
    const full = await acquireThumbnailUrl('full', 'full', controller.signal);
    controller.abort();
    expect(revoke).not.toHaveBeenCalled();
    const reopened = await acquireThumbnailUrl('full', 'full');
    expect(reopened!.url).toBe(full!.url);
    expect(getThumbnailMock).toHaveBeenCalledOnce();
    reopened!.release();
    getSmallMock
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(new Blob(['retry']));
    await expect(acquireThumbnailUrl('retry', 'small')).rejects.toThrow('read failed');
    expect(await acquireThumbnailUrl('retry', 'small')).toBeUndefined();
    const retried = await acquireThumbnailUrl('retry', 'small');
    expect(retried?.url).toBeDefined();
    retried!.release();
  });

  it('keeps ten distinct hover images and updates recency on reopening', async () => {
    getThumbnailMock.mockResolvedValue(fullThumbnail);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const urls: string[] = [];
    for (let i = 0; i < 10; i++) {
      const resource = await acquireThumbnailUrl('hover-' + i, 'full');
      urls.push(resource!.url);
      resource!.release();
    }
    expect(revoke).not.toHaveBeenCalled();
    const reopened = await acquireThumbnailUrl('hover-0', 'full');
    expect(reopened!.url).toBe(urls[0]);
    reopened!.release();
    const eleventh = await acquireThumbnailUrl('hover-10', 'full');
    eleventh!.release();
    expect(revoke).toHaveBeenCalledExactlyOnceWith(urls[1]);
    expect(getThumbnailMock).toHaveBeenCalledTimes(11);
    const evicted = await acquireThumbnailUrl('hover-1', 'full');
    expect(evicted!.url).not.toBe(urls[1]);
    expect(getThumbnailMock).toHaveBeenCalledTimes(12);
    evicted!.release();
  });

  it('protects a shared active preview until its final owner releases after eviction', async () => {
    getThumbnailMock.mockResolvedValue(fullThumbnail);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const first = await acquireThumbnailUrl('shared-full', 'full');
    const second = await acquireThumbnailUrl('shared-full', 'full');
    expect(second!.url).toBe(first!.url);
    for (let i = 0; i < 10; i++) {
      const resource = await acquireThumbnailUrl('next-' + i, 'full');
      resource!.release();
    }
    expect(revoke).not.toHaveBeenCalled();
    first!.release();
    expect(revoke).not.toHaveBeenCalled();
    second!.release();
    expect(revoke).toHaveBeenCalledExactlyOnceWith(first!.url);
  });

  it('uses opening order rather than completion or closing order for eviction', async () => {
    let finish!: (value: typeof fullThumbnail) => void;
    getThumbnailMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    getThumbnailMock.mockResolvedValue(fullThumbnail);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const slow = acquireThumbnailUrl('slow-first', 'full');
    for (let i = 0; i < 10; i++) {
      const resource = await acquireThumbnailUrl('fast-' + i, 'full');
      resource!.release();
    }
    finish(fullThumbnail);
    const first = await slow;
    expect(revoke).not.toHaveBeenCalled();
    first!.release();
    expect(revoke).toHaveBeenCalledExactlyOnceWith(first!.url);
  });

  it('does not cache cancelled pending hover loads or evict successful previews', async () => {
    getThumbnailMock.mockResolvedValue(fullThumbnail);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const first = await acquireThumbnailUrl('kept', 'full');
    first!.release();
    let finish!: (value: typeof fullThumbnail) => void;
    getThumbnailMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const create = vi.spyOn(URL, 'createObjectURL');
    const controller = new AbortController();
    const pending = acquireThumbnailUrl('cancelled-full', 'full', controller.signal);
    await vi.waitFor(() => expect(getThumbnailMock).toHaveBeenCalledTimes(2));
    controller.abort();
    finish(fullThumbnail);
    expect(await pending).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalled();
  });
});
