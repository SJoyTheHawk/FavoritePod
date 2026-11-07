import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'react';
import type { TopSiteEntry, VisitedSiteSuggestion } from '../core/discovery';
import { getHiddenVisitedSiteUrls } from '../core/storage';

type SuggestionBuilder = (
  topSites: readonly TopSiteEntry[],
  hiddenUrls: readonly string[],
) => VisitedSiteSuggestion[];

export function useVisitedSites(enabled: boolean) {
  const [topSites, setTopSites] = useState<TopSiteEntry[]>([]);
  const [buildSuggestions, setBuildSuggestions] = useState<SuggestionBuilder | null>(
    null,
  );
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
    setBuildSuggestions(null);
    setError(undefined);
    setLoading(enabled);
    if (!enabled) return;

    void (async () => {
      if (!(await chrome.permissions.contains({ permissions: ['topSites'] }))) {
        throw new Error(
          'Allow Chrome top sites access in Settings to see your shortcuts.',
        );
      }
      if (!active) return;
      const discovery = await import('../core/discovery');
      if (!active) return;
      setBuildSuggestions(() => discovery.buildVisitedSiteSuggestions);
      const top = await chrome.topSites.get();
      if (!active) return;
      setTopSites(top);
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
        ? (buildSuggestions?.(topSites, hiddenUrls) ?? [])
        : [],
    [buildSuggestions, enabled, hiddenError, hiddenReady, hiddenUrls, topSites],
  );
  return {
    suggestions,
    loading: enabled && (loading || !hiddenReady),
    error: hiddenError ?? error,
    refresh: () => setRevision((value) => value + 1),
  };
}
