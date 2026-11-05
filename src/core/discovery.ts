import { parseSafeUrl } from './validation';

export interface TopSiteEntry {
  url: string;
  title: string;
}

export interface HistorySiteEntry {
  url?: string;
  title?: string;
  visitCount?: number;
  lastVisitTime?: number;
}

export interface VisitedSiteSuggestion {
  url: string;
  title: string;
  visitCount?: number;
  lastVisitTime?: number;
}

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
  history: readonly HistorySiteEntry[],
  hiddenUrls: readonly string[],
  limit = 10,
): VisitedSiteSuggestion[] {
  const excluded = new Set(
    hiddenUrls
      .map(normalizeVisitedSiteUrl)
      .filter((url): url is string => url !== undefined),
  );
  const top = new Map<string, VisitedSiteSuggestion>();
  const recent = new Map<string, VisitedSiteSuggestion>();

  for (const site of topSites) {
    const url = normalizeVisitedSiteUrl(site.url);
    if (!url || excluded.has(url) || top.has(url)) continue;
    top.set(url, { url, title: site.title.trim() || new URL(url).hostname });
  }

  for (const site of history) {
    if (!site.url) continue;
    const url = normalizeVisitedSiteUrl(site.url);
    if (!url || excluded.has(url)) continue;
    const title = site.title?.trim() || new URL(url).hostname;
    const existing = top.get(url) ?? recent.get(url);
    if (existing) {
      existing.visitCount = Math.max(existing.visitCount ?? 0, site.visitCount ?? 0);
      existing.lastVisitTime = Math.max(
        existing.lastVisitTime ?? 0,
        site.lastVisitTime ?? 0,
      );
      if (!existing.title || existing.title === new URL(url).hostname) {
        existing.title = title;
      }
      continue;
    }
    recent.set(url, {
      url,
      title,
      visitCount: site.visitCount,
      lastVisitTime: site.lastVisitTime,
    });
  }

  const rankedRecent = [...recent.values()].sort(
    (left, right) =>
      (right.visitCount ?? 0) - (left.visitCount ?? 0) ||
      (right.lastVisitTime ?? 0) - (left.lastVisitTime ?? 0),
  );
  return [...top.values(), ...rankedRecent].slice(0, Math.max(0, limit));
}
