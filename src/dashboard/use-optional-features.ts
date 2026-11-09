import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import {
  getContextMenuEnabled,
  getShowFrequentlyVisited,
  getShowFrequentlyVisitedOnHome,
  getShowHiddenBookmarks,
  getSiteDiscoveryEnabled,
  setShowFrequentlyVisited,
  setShowFrequentlyVisitedOnHome,
  setShowHiddenBookmarks,
} from '../core/storage';
import {
  saveContextMenuEnabled,
  saveSiteDiscoveryEnabled,
} from '../core/optional-features';

export function useOptionalFeatures() {
  const [preferences, setPreferences] = useState({
    showFrequentlyVisited: true,
    showFrequentlyVisitedOnHome: false,
    showHiddenBookmarks: false,
    discovery: false,
    contextMenu: false,
  });
  const [permissions, setPermissions] = useState({
    discovery: false,
    contextMenu: false,
  });
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let active = true;
    let revision = 0;
    const refreshPermissions = () => {
      const current = ++revision;
      void Promise.all([
        chrome.permissions.contains({ permissions: ['topSites'] }),
        chrome.permissions.contains({ permissions: ['contextMenus'] }),
      ])
        .then(([discovery, contextMenu]) => {
          if (active && current === revision) {
            setPermissions({ discovery, contextMenu });
            setPermissionsReady(true);
            setError(undefined);
          }
        })
        .catch(() => {
          if (active)
            setError('Could not read Chrome permissions. Reopen the launcher to retry.');
        });
    };
    const subscription = liveQuery(async () => ({
      showFrequentlyVisited: await getShowFrequentlyVisited(),
      showFrequentlyVisitedOnHome: await getShowFrequentlyVisitedOnHome(),
      showHiddenBookmarks: await getShowHiddenBookmarks(),
      discovery: await getSiteDiscoveryEnabled(),
      contextMenu: await getContextMenuEnabled(),
    })).subscribe({
      next: (value) => {
        setPreferences(value);
        setPreferencesReady(true);
      },
      error: () =>
        setError(
          'Could not load permission and visibility settings. Reopen the launcher to retry.',
        ),
    });
    refreshPermissions();
    chrome.permissions.onAdded.addListener(refreshPermissions);
    chrome.permissions.onRemoved.addListener(refreshPermissions);
    window.addEventListener('focus', refreshPermissions);
    return () => {
      active = false;
      subscription.unsubscribe();
      chrome.permissions.onAdded.removeListener(refreshPermissions);
      chrome.permissions.onRemoved.removeListener(refreshPermissions);
      window.removeEventListener('focus', refreshPermissions);
    };
  }, []);

  return {
    ready: permissionsReady && preferencesReady,
    error,
    showFrequentlyVisited: preferences.showFrequentlyVisited,
    saveShowFrequentlyVisited: setShowFrequentlyVisited,
    showFrequentlyVisitedOnHome: preferences.showFrequentlyVisitedOnHome,
    saveShowFrequentlyVisitedOnHome: setShowFrequentlyVisitedOnHome,
    showHiddenBookmarks: preferences.showHiddenBookmarks,
    saveShowHiddenBookmarks: setShowHiddenBookmarks,
    discoveryEnabled: preferences.discovery && permissions.discovery,
    discoveryPermissionGranted: permissions.discovery,
    contextMenuEnabled: preferences.contextMenu && permissions.contextMenu,
    contextMenuPermissionGranted: permissions.contextMenu,
    saveSiteDiscoveryEnabled,
    saveContextMenuEnabled,
  };
}
