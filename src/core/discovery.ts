import { parseSafeUrl } from './validation';

export interface TopSiteEntry {
  url: string;
  title: string;
}

export type VisitedSiteSuggestion = TopSiteEntry;

export function normalizeVisitedSiteUrl(value: string): string | undefined {
  const parsed = parseSafeUrl(value);
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return undefined;
  }
  parsed.hash = '';
  return parsed.toString();
}

export function buildVisitedSiteSuggestions(
  topSites: readonly TopSiteEntry[],
  hiddenUrls: readonly string[],
  limit = 10,
): VisitedSiteSuggestion[] {
  const excluded = new Set(
    hiddenUrls
      .map(normalizeVisitedSiteUrl)
      .filter((url): url is string => url !== undefined),
  );
  const top = new Map<string, VisitedSiteSuggestion>();

  for (const site of topSites) {
    const url = normalizeVisitedSiteUrl(site.url);
    if (!url || excluded.has(url) || top.has(url)) continue;
    top.set(url, { url, title: site.title.trim() || new URL(url).hostname });
  }

  // Chrome owns selection and ranking; never fill gaps with browsing history.
  return [...top.values()].slice(0, Math.max(0, limit));
}
