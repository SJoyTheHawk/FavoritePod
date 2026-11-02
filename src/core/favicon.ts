import { parseSafeUrl } from './validation';

export function faviconSources(pageUrl: string, savedUrl?: string): string[] {
  const sources: string[] = [];
  if (savedUrl && /^(https?:|data:image\/)/i.test(savedUrl)) sources.push(savedUrl);
  const page = parseSafeUrl(pageUrl);
  if (
    page &&
    page.protocol !== 'file:' &&
    typeof chrome !== 'undefined' &&
    chrome.runtime?.id
  ) {
    const endpoint = new URL(chrome.runtime.getURL('_favicon/'));
    endpoint.searchParams.set('pageUrl', pageUrl);
    endpoint.searchParams.set('size', '32');
    sources.push(endpoint.toString());
  }
  return [...new Set(sources)];
}

// Run outside IndexedDB transactions: fetching and decoding may take time.
export async function captureFavicon(
  pageUrl: string,
  tabIcon?: string,
): Promise<string | undefined> {
  for (const source of faviconSources(pageUrl, tabIcon)) {
    try {
      const response = await fetch(source, { signal: AbortSignal.timeout(1500) });
      if (!response.ok) continue;
      const blob = await response.blob();
      if (blob.size > 1024 * 1024) continue;
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = new OffscreenCanvas(32, 32);
        const context = canvas.getContext('2d');
        if (!context) continue;
        const scale = Math.min(32 / bitmap.width, 32 / bitmap.height);
        const width = bitmap.width * scale;
        const height = bitmap.height * scale;
        context.drawImage(bitmap, (32 - width) / 2, (32 - height) / 2, width, height);
        const png = await canvas.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await png.arrayBuffer());
        return `data:image/png;base64,${btoa(String.fromCharCode(...bytes))}`;
      } finally {
        bitmap.close();
      }
    } catch {
      // A missing icon must never prevent saving the bookmark.
    }
  }
  return undefined;
}
