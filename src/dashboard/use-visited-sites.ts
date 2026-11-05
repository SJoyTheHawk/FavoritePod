import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import {
  buildVisitedSiteSuggestions,
  type HistorySiteEntry,
  type TopSiteEntry,
} from '../core/discovery';
import { getHiddenVisitedSiteUrls } from '../core/storage';

export function useVisitedSites(enabled: boolean) {
  const [topSites, setTopSites] = useState<TopSiteEntry[]>([]);
  const [history, setHistory] = useState<HistorySiteEntry[]>([]);
  const [hiddenUrls, setHiddenUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [hiddenError, setHiddenError] = useState<string>();
  const [hiddenReady, setHiddenReady] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setHiddenReady(false);
    const subscription = liveQuery(getHiddenVisitedSiteUrls).subscribe({
      next: (urls) => {
        setHiddenUrls(urls);
        setHiddenError(undefined);
        setHiddenReady(true);
      },
      error: () => setHiddenError('Could not read hidden suggestions. Try again.'),
    });
    return () => subscription.unsubscribe();
  }, [revision]);

  useEffect(() => {
    let active = true;
    setTopSites([]);
    setHistory([]);
    setError(undefined);
    setLoading(enabled);
    if (!enabled) return;

    void (async () => {
      if (
        !(await chrome.permissions.contains({ permissions: ['history', 'topSites'] }))
      ) {
        throw new Error(
          'Allow history and top sites access in Settings to see suggestions.',
        );
      }
      if (!active) return;
      const [top, recent] = await Promise.all([
        chrome.topSites.get(),
        chrome.history.search({
          text: '',
          startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
          maxResults: 500,
        }),
      ]);
      if (!active) return;
      setTopSites(top);
      setHistory(recent);
    })()
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'Could not load suggestions.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, revision]);

  const suggestions = useMemo(
    () =>
      enabled && hiddenReady && !hiddenError
        ? buildVisitedSiteSuggestions(topSites, history, hiddenUrls)
        : [],
    [enabled, hiddenError, hiddenReady, history, hiddenUrls, topSites],
  );
  return {
    suggestions,
    loading: enabled && (loading || !hiddenReady),
    error: hiddenError ?? error,
    refresh: () => setRevision((value) => value + 1),
  };
}
