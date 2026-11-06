import { getDefaultTitle, parseSafeUrl } from './validation';

export const POPUP_PATH = 'src/popup/popup.html';

export interface PopupSaveRequest {
  url: string;
  title: string;
  sourceTabId: number;
  sourceWindowId: number;
  capturePage: boolean;
}

/** Carry the clicked target in this popup URL, not in shared/persisted settings. */
export function buildSavePopupUrl(request: PopupSaveRequest): string {
  const url = new URL(chrome.runtime.getURL(POPUP_PATH));
  url.searchParams.set('saveUrl', request.url);
  url.searchParams.set('saveTitle', request.title);
  url.searchParams.set('sourceTabId', String(request.sourceTabId));
  url.searchParams.set('sourceWindowId', String(request.sourceWindowId));
  url.searchParams.set('capturePage', String(request.capturePage));
  return url.href;
}

export function readPopupSaveRequest(href: string): PopupSaveRequest | undefined {
  const params = new URL(href).searchParams;
  const url = parseSafeUrl(params.get('saveUrl') ?? '');
  const sourceTabId = Number(params.get('sourceTabId'));
  const sourceWindowId = Number(params.get('sourceWindowId'));
  if (
    !url ||
    !params.has('sourceTabId') ||
    !params.has('sourceWindowId') ||
    !Number.isInteger(sourceTabId) ||
    sourceTabId < 0 ||
    !Number.isInteger(sourceWindowId) ||
    sourceWindowId < 0
  )
    return undefined;
  return {
    url: url.href,
    title: params.get('saveTitle')?.trim() || getDefaultTitle(url.href),
    sourceTabId,
    sourceWindowId,
    capturePage: params.get('capturePage') === 'true',
  };
}

/** Never capture a containing page for a link, or another tab after navigation. */
export async function canCaptureSaveRequest(request: PopupSaveRequest): Promise<boolean> {
  if (!request.capturePage) return false;
  try {
    const tab = await chrome.tabs.get(request.sourceTabId);
    return (
      tab.active && tab.windowId === request.sourceWindowId && tab.url === request.url
    );
  } catch {
    return false;
  }
}
