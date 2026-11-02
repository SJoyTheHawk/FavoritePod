const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);

export function parseSafeUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      !parsed.hostname
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isValidUrl(value: string): boolean {
  return parseSafeUrl(value) !== null;
}

export function getUrlLabel(value: string): string {
  const parsed = parseSafeUrl(value);
  if (!parsed) return value;
  if (parsed.protocol === 'file:') return 'Local file';
  return parsed.hostname;
}

export function getDefaultTitle(value: string): string {
  const parsed = parseSafeUrl(value);
  if (!parsed) return '';
  if (parsed.protocol !== 'file:') return parsed.hostname;
  const name = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (!name) return 'Local file';
  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
}
