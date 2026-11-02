import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureFavicon, faviconSources } from '../favicon';

const page = 'https://example.com/path?a=1&b=2';
const cachedEndpoint = () => {
  const endpoint = new URL('chrome-extension://test/_favicon/');
  endpoint.searchParams.set('pageUrl', page);
  endpoint.searchParams.set('size', '32');
  return endpoint.toString();
};
function mockChrome() {
  vi.stubGlobal('chrome', {
    runtime: { id: 'test', getURL: (path: string) => `chrome-extension://test/${path}` },
  });
}
afterEach(() => vi.unstubAllGlobals());

describe('favicon persistence', () => {
  it('prefers saved pixels over Chrome cache and works outside the extension', () => {
    mockChrome();
    const saved = 'data:image/png;base64,aWNvbg==';
    expect(faviconSources(page, saved)).toEqual([saved, cachedEndpoint()]);
    vi.stubGlobal('chrome', undefined);
    expect(faviconSources(page, saved)).toEqual([saved]);
    expect(faviconSources('file:///tmp/example.html')).toEqual([]);
  });

  it('falls back from an inaccessible tab icon and serializes decoded pixels', async () => {
    mockChrome();
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('CORS'))
      .mockResolvedValueOnce(new Response(new Blob(['source image'])));
    vi.stubGlobal('fetch', fetcher);
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 64, height: 64, close }),
    );
    const drawImage = vi.fn();
    vi.stubGlobal(
      'OffscreenCanvas',
      class {
        getContext() {
          return { drawImage };
        }
        async convertToBlob() {
          return new Blob(['persisted png']);
        }
      },
    );
    const result = await captureFavicon(page, 'https://cdn.example.com/icon.ico');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://cdn.example.com/icon.ico',
      cachedEndpoint(),
    ]);
    expect(result).toBe(`data:image/png;base64,${btoa('persisted png')}`);
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it('leaves missing icons optional when all sources fail', async () => {
    mockChrome();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Unavailable')));
    await expect(
      captureFavicon(page, 'https://example.com/favicon.ico'),
    ).resolves.toBeUndefined();
  });
});
