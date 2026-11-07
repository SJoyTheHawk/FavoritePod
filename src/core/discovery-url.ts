import { parseSafeUrl } from './validation';

export function normalizeVisitedSiteUrl(value: string): string | undefined {
  const parsed = parseSafeUrl(value);
  if (!parsed || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) {
    return undefined;
  }
  parsed.hash = '';
  return parsed.toString();
}
