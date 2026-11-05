import { setContextMenuEnabled, setSiteDiscoveryEnabled } from './storage';

export const CONTEXT_MENUS_REFRESH_MESSAGE = 'favoritepod.contextMenus.refresh';

export async function saveSiteDiscoveryEnabled(enabled: boolean): Promise<void> {
  // Request before any storage awaits so Chrome retains the Settings user gesture.
  if (
    enabled &&
    !(await chrome.permissions.request({ permissions: ['history', 'topSites'] }))
  ) {
    throw new Error('Discovery stays off because Chrome permission was not granted.');
  }
  await setSiteDiscoveryEnabled(enabled);
  if (!enabled) await chrome.permissions.remove({ permissions: ['history', 'topSites'] });
}

export async function saveContextMenuEnabled(enabled: boolean): Promise<void> {
  if (enabled && !(await chrome.permissions.request({ permissions: ['contextMenus'] }))) {
    throw new Error(
      'The right-click menu stays off because Chrome permission was not granted.',
    );
  }
  await setContextMenuEnabled(enabled);
  const response: { error?: string } | undefined = await chrome.runtime.sendMessage({
    type: CONTEXT_MENUS_REFRESH_MESSAGE,
  });
  if (response?.error) throw new Error(response.error);
}
