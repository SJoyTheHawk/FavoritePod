const ALLOWED_PROTOCOLS = new Set([
  'http:',
  'https:',
  'file:',
  'chrome:',
  'chrome-extension:',
  'ftp:',
  'mailto:',
  'tel:',
  'sms:',
]);
const HOST_PROTOCOLS = new Set([
  'http:',
  'https:',
  'chrome:',
  'chrome-extension:',
  'ftp:',
]);

export const INVALID_URL_MESSAGE =
  'Use an http, https, file, chrome, chrome-extension, ftp, mailto, tel, or sms address.';

export function parseSafeUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
    if (HOST_PROTOCOLS.has(parsed.protocol) && !parsed.hostname) {
      return null;
    }
    if (
      (parsed.protocol === 'chrome:' || parsed.protocol === 'chrome-extension:') &&
      (!/^chrome(?:-extension)?:\/\/[^/]/i.test(value.trim()) ||
        parsed.username ||
        parsed.password ||
        parsed.port)
    )
      return null;
    if (['mailto:', 'tel:', 'sms:'].includes(parsed.protocol) && !parsed.pathname)
      return null;
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
  if (parsed.protocol === 'chrome:') return 'Chrome shortcut';
  if (parsed.protocol === 'chrome-extension:') return 'Chrome extension';
  if (parsed.protocol === 'ftp:') return 'FTP (legacy)';
  if (parsed.protocol === 'mailto:') return 'Email';
  if (parsed.protocol === 'tel:') return 'Phone';
  if (parsed.protocol === 'sms:') return 'SMS';
  return parsed.hostname;
}

export function getDefaultTitle(value: string): string {
  const parsed = parseSafeUrl(value);
  if (!parsed) return '';
  if (parsed.protocol === 'chrome:') {
    return parsed.hostname.charAt(0).toUpperCase() + parsed.hostname.slice(1);
  }
  if (parsed.protocol === 'chrome-extension:') {
    const name = parsed.pathname.split('/').filter(Boolean).at(-1);
    return name ? decodeName(name) : 'Chrome extension';
  }
  if (['mailto:', 'tel:', 'sms:'].includes(parsed.protocol)) {
    return decodeName(parsed.pathname);
  }
  if (parsed.protocol !== 'file:') return parsed.hostname;
  const name = parsed.pathname.split('/').filter(Boolean).at(-1);
  if (!name) return 'Local file';
  return decodeName(name);
}

function decodeName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isMobilePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  const agent = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return (
    agent.userAgentData?.mobile === true ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(agent.userAgent) ||
    (agent.platform === 'MacIntel' && agent.maxTouchPoints > 1)
  );
}

export function isHiddenOnThisPlatform(
  value: string,
  mobile = isMobilePlatform(),
): boolean {
  const protocol = parseSafeUrl(value)?.protocol;
  return (
    protocol === 'ftp:' ||
    (protocol === 'mailto:' && mobile) ||
    ((protocol === 'tel:' || protocol === 'sms:') && !mobile)
  );
}
