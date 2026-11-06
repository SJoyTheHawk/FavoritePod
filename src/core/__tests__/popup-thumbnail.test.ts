import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { capturePopupThumbnail } from '../popup-thumbnail';
import { captureVisibleTab, thumbnailFromDataUrl } from '../thumbnail';

vi.mock('../thumbnail', () => ({
  captureVisibleTab: vi.fn(),
  thumbnailFromDataUrl: vi.fn(),
}));

const request = {
  url: 'https://example.com/',
  title: 'Example',
  sourceTabId: 5,
  sourceWindowId: 2,
  capturePage: true,
};
const preview = { blob: new Blob(['image']), width: 640, height: 400 };
function event() {
  const listeners = new Set<(...args: never[]) => void>();
  return {
    addListener: vi.fn((listener) => listeners.add(listener)),
    removeListener: vi.fn((listener) => listeners.delete(listener)),
    emit: (...args: unknown[]) =>
      listeners.forEach((listener) => listener(...(args as never[]))),
    listeners,
  };
}
let tabs: {
  get: ReturnType<typeof vi.fn>;
  onActivated: ReturnType<typeof event>;
  onUpdated: ReturnType<typeof event>;
  onRemoved: ReturnType<typeof event>;
  onDetached: ReturnType<typeof event>;
};

beforeEach(() => {
  tabs = {
    get: vi.fn().mockResolvedValue({
      active: true,
      windowId: 2,
      url: request.url,
      status: 'complete',
    }),
    onActivated: event(),
    onUpdated: event(),
    onRemoved: event(),
    onDetached: event(),
  };
  vi.stubGlobal('chrome', {
    tabs,
    extension: { isAllowedFileSchemeAccess: vi.fn().mockResolvedValue(true) },
  });
  vi.mocked(captureVisibleTab).mockImplementation(async (_window, guard) => {
    await guard?.();
    return 'image';
  });
  vi.mocked(thumbnailFromDataUrl).mockResolvedValue(preview);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe('popup thumbnail capture', () => {
  it('captures the invoking page and releases all listeners without opening or closing tabs', async () => {
    await expect(
      capturePopupThumbnail(request, new AbortController().signal),
    ).resolves.toBe(preview);
    expect(captureVisibleTab).toHaveBeenCalledExactlyOnceWith(2, expect.any(Function));
    for (const source of [
      tabs.onActivated,
      tabs.onUpdated,
      tabs.onRemoved,
      tabs.onDetached,
    ])
      expect(source.listeners.size).toBe(0);
  });

  it('never captures the containing page when saving a link', async () => {
    await expect(
      capturePopupThumbnail(
        { ...request, capturePage: false },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Open this link');
    expect(captureVisibleTab).not.toHaveBeenCalled();
  });

  it.each([
    { active: false, windowId: 2, url: request.url },
    { active: true, windowId: 3, url: request.url },
    { active: true, windowId: 2, url: 'https://other.example/' },
    { active: true, windowId: 2, url: request.url, pendingUrl: 'https://other.example/' },
    { active: true, windowId: 2, url: request.url, status: 'loading' },
  ])('rejects a stale target before capture: %j', async (tab) => {
    tabs.get.mockResolvedValue(tab);
    await expect(
      capturePopupThumbnail(request, new AbortController().signal),
    ).rejects.toThrow('page changed');
    expect(captureVisibleTab).not.toHaveBeenCalled();
  });

  it('rechecks after waiting in the capture queue', async () => {
    vi.mocked(captureVisibleTab).mockImplementation(async (_window, guard) => {
      tabs.get.mockResolvedValue({ active: false });
      await guard?.();
      return 'wrong image';
    });
    await expect(
      capturePopupThumbnail(request, new AbortController().signal),
    ).rejects.toThrow('page changed');
    expect(thumbnailFromDataUrl).not.toHaveBeenCalled();
  });

  it.each(['activation', 'navigation', 'removed', 'detached'])(
    'discards captures after %s even if the original tab becomes active again',
    async (change) => {
      vi.mocked(captureVisibleTab).mockImplementation(async (_window, guard) => {
        await guard?.();
        if (change === 'activation') {
          tabs.onActivated.emit({ windowId: 2, tabId: 99 });
          tabs.onActivated.emit({ windowId: 2, tabId: 5 });
        }
        if (change === 'navigation') tabs.onUpdated.emit(5, { status: 'loading' });
        if (change === 'removed') tabs.onRemoved.emit(5);
        if (change === 'detached') tabs.onDetached.emit(5);
        return 'wrong image';
      });
      await expect(
        capturePopupThumbnail(request, new AbortController().signal),
      ).rejects.toThrow('page changed');
      expect(thumbnailFromDataUrl).not.toHaveBeenCalled();
    },
  );

  it('does not replace a removed thumbnail with a late capture', async () => {
    const controller = new AbortController();
    vi.mocked(captureVisibleTab).mockImplementation(async () => {
      controller.abort();
      return 'late image';
    });
    await expect(capturePopupThumbnail(request, controller.signal)).rejects.toThrow();
    expect(thumbnailFromDataUrl).not.toHaveBeenCalled();
  });

  it('discards cancellation during image compression', async () => {
    const controller = new AbortController();
    vi.mocked(thumbnailFromDataUrl).mockImplementation(async () => {
      controller.abort();
      return preview;
    });
    await expect(capturePopupThumbnail(request, controller.signal)).rejects.toThrow();
  });

  it('checks local file access without prompting for broad permission', async () => {
    vi.stubGlobal('chrome', {
      tabs,
      extension: { isAllowedFileSchemeAccess: vi.fn().mockResolvedValue(false) },
    });
    await expect(
      capturePopupThumbnail(
        { ...request, url: 'file:///page.html' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Allow access to file URLs');
    expect(captureVisibleTab).not.toHaveBeenCalled();
  });

  it('captures a local file when file access is enabled', async () => {
    const local = { ...request, url: 'file:///page.html' };
    tabs.get.mockResolvedValue({ active: true, windowId: 2, url: local.url });
    await expect(
      capturePopupThumbnail(local, new AbortController().signal),
    ).resolves.toBe(preview);
  });

  it('releases listeners on capture failure', async () => {
    vi.mocked(captureVisibleTab).mockRejectedValue(new Error('Capture denied'));
    await expect(
      capturePopupThumbnail(request, new AbortController().signal),
    ).rejects.toThrow('Capture denied');
    expect(tabs.onActivated.listeners.size).toBe(0);
    expect(tabs.onUpdated.listeners.size).toBe(0);
  });
});
