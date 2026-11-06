import { hasFileAccess } from './file-links';
import { canCaptureSaveRequest, type PopupSaveRequest } from './popup-save-request';
import { captureVisibleTab, thumbnailFromDataUrl } from './thumbnail';
import type { ThumbnailInput } from './types';

/** Capture only the page the user invoked the popup on; never open or close tabs. */
export async function capturePopupThumbnail(
  request: PopupSaveRequest,
  signal: AbortSignal,
): Promise<ThumbnailInput> {
  signal.throwIfAborted();
  if (!request.capturePage)
    throw new Error('Open this link and use FavoritePod there to capture its thumbnail.');
  if (request.url.startsWith('file:') && !(await hasFileAccess()))
    throw new Error(
      'To capture local files, enable “Allow access to file URLs” in Chrome’s extension settings. You can also save without a thumbnail.',
    );

  let changed = false;
  const onActivated = (info: chrome.tabs.OnActivatedInfo) => {
    if (info.windowId === request.sourceWindowId && info.tabId !== request.sourceTabId)
      changed = true;
  };
  const onUpdated = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
    if (
      id === request.sourceTabId &&
      (info.url !== undefined || info.status === 'loading')
    )
      changed = true;
  };
  const onRemoved = (id: number) => {
    if (id === request.sourceTabId) changed = true;
  };
  const guard = async () => {
    signal.throwIfAborted();
    const matches = await canCaptureSaveRequest(request);
    signal.throwIfAborted();
    if (changed || !matches)
      throw new Error(
        'The page changed. Reopen FavoritePod on the page you want to save.',
      );
  };

  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  chrome.tabs.onRemoved.addListener(onRemoved);
  chrome.tabs.onDetached.addListener(onRemoved);
  try {
    await guard();
    const dataUrl = await captureVisibleTab(request.sourceWindowId, guard);
    await guard();
    const thumbnail = await thumbnailFromDataUrl(dataUrl);
    await guard();
    return thumbnail;
  } finally {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
    chrome.tabs.onRemoved.removeListener(onRemoved);
    chrome.tabs.onDetached.removeListener(onRemoved);
  }
}
