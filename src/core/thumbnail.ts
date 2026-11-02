import type { ThumbnailInput } from './types';

const MAX_WIDTH = 640;
const MAX_HEIGHT = 400;

export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function compressThumbnail(blob: Blob): Promise<ThumbnailInput> {
  const image = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, MAX_WIDTH / image.width, MAX_HEIGHT / image.height);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the thumbnail canvas.');
    context.drawImage(image, 0, 0, width, height);
    const preview = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.78 });
    return { blob: preview, width, height };
  } finally {
    image.close();
  }
}

export async function captureThumbnail(windowId?: number): Promise<ThumbnailInput> {
  const options = { format: 'jpeg' as const, quality: 80 };
  const dataUrl =
    windowId === undefined
      ? await chrome.tabs.captureVisibleTab(options)
      : await chrome.tabs.captureVisibleTab(windowId, options);
  const separator = dataUrl.indexOf(',');
  const metadata = dataUrl.slice(0, separator);
  if (separator < 0 || !metadata.endsWith(';base64')) {
    throw new Error('Chrome returned an invalid page image.');
  }
  const binary = atob(dataUrl.slice(separator + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const type = metadata.slice('data:'.length).split(';')[0] || 'image/jpeg';
  return compressThumbnail(new Blob([bytes.buffer], { type }));
}
