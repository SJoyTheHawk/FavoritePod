import type { ThumbnailInput } from './types';

const MAX_WIDTH = 640;
const MAX_HEIGHT = 400;
const SMALL_WIDTH = 320;
const SMALL_HEIGHT = 200;
const CAPTURE_INTERVAL_MS = 500;
let captureQueue: Promise<void> = Promise.resolve();
let lastCaptureAt = 0;

export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function compressThumbnail(blob: Blob): Promise<ThumbnailInput> {
  const image = await createImageBitmap(blob);
  try {
    const [preview, smallPreview] = await Promise.all([
      resizeThumbnail(image, MAX_WIDTH, MAX_HEIGHT),
      resizeThumbnail(image, SMALL_WIDTH, SMALL_HEIGHT),
    ]);
    return {
      blob: preview,
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      smallBlob: smallPreview,
    };
  } finally {
    image.close();
  }
}

async function resizeThumbnail(
  image: ImageBitmap,
  width: number,
  height: number,
): Promise<Blob> {
  const targetRatio = width / height;
  const imageRatio = image.width / image.height;
  const sourceWidth = imageRatio > targetRatio ? image.height * targetRatio : image.width;
  const sourceHeight =
    imageRatio > targetRatio ? image.height : image.width / targetRatio;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the thumbnail canvas.');
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.75 });
}

export async function captureVisibleTab(windowId?: number): Promise<string> {
  let release = () => {};
  const previous = captureQueue;
  captureQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const wait = lastCaptureAt + CAPTURE_INTERVAL_MS - Date.now();
    if (lastCaptureAt && wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastCaptureAt = Date.now();
    const options = { format: 'jpeg' as const, quality: 80 };
    return windowId === undefined
      ? await chrome.tabs.captureVisibleTab(options)
      : await chrome.tabs.captureVisibleTab(windowId, options);
  } finally {
    release();
  }
}

export async function captureThumbnail(windowId?: number): Promise<ThumbnailInput> {
  const dataUrl = await captureVisibleTab(windowId);
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
