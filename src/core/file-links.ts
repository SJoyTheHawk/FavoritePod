import { db } from './db';
import { getDeviceId } from './storage';
import { parseSafeUrl } from './validation';

export type FileAvailability = 'unknown' | 'available' | 'missing';

export interface PathOverride {
  from: string;
  to: string;
}

export const FILE_ACCESS_DENIED = 'FILE_ACCESS_DENIED';

function settingsKey(deviceId: string): string {
  return `pathOverrides:${deviceId}`;
}

function normalizeFilePrefix(value: string): string {
  const parsed = parseSafeUrl(value.trim());
  if (
    !parsed ||
    parsed.protocol !== 'file:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error('Enter a valid local folder URL beginning with file://.');
  }
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  return parsed.href;
}

export function normalizePathOverrides(overrides: PathOverride[]): PathOverride[] {
  const sources = new Set<string>();
  return overrides.map(({ from, to }) => {
    if (!from.trim() || !to.trim()) {
      throw new Error('Enter both folder URLs for each path override.');
    }
    const normalizedFrom = normalizeFilePrefix(from);
    const normalizedTo = normalizeFilePrefix(to);
    if (normalizedFrom === normalizedTo) {
      throw new Error('The source and destination folders must be different.');
    }
    if (sources.has(normalizedFrom)) {
      throw new Error('Each source folder can only have one path override.');
    }
    sources.add(normalizedFrom);
    return { from: normalizedFrom, to: normalizedTo };
  });
}

export async function getPathOverrides(): Promise<PathOverride[]> {
  const deviceId = await getDeviceId();
  const record = await db.settings.get(settingsKey(deviceId));
  if (!Array.isArray(record?.value)) return [];

  const overrides: PathOverride[] = [];
  for (const value of record.value) {
    if (
      !value ||
      typeof value !== 'object' ||
      typeof value.from !== 'string' ||
      typeof value.to !== 'string'
    ) {
      continue;
    }
    try {
      overrides.push(...normalizePathOverrides([value]));
    } catch {
      continue;
    }
  }
  return overrides;
}

export async function savePathOverrides(overrides: PathOverride[]): Promise<void> {
  const normalized = normalizePathOverrides(overrides);
  const deviceId = await getDeviceId();
  await db.settings.put({ key: settingsKey(deviceId), value: normalized });
}

export function applyPathOverride(url: string, overrides: PathOverride[]): string {
  const target = parseSafeUrl(url);
  if (!target || target.protocol !== 'file:') return url;

  const matchingOverride = overrides
    .flatMap((override) => {
      try {
        return [
          {
            from: new URL(normalizeFilePrefix(override.from)),
            to: new URL(normalizeFilePrefix(override.to)),
          },
        ];
      } catch {
        return [];
      }
    })
    .filter(
      ({ from }) =>
        from.host === target.host && target.pathname.startsWith(from.pathname),
    )
    .sort((left, right) => right.from.pathname.length - left.from.pathname.length)[0];

  if (!matchingOverride) return url;
  const { from, to } = matchingOverride;
  const rewritten = new URL(target.href);
  rewritten.host = to.host;
  rewritten.pathname = to.pathname + target.pathname.slice(from.pathname.length);
  return rewritten.href;
}

export async function hasFileAccess(): Promise<boolean> {
  try {
    return await chrome.extension.isAllowedFileSchemeAccess();
  } catch {
    return false;
  }
}

export function getExtensionSettingsUrl(): string {
  return `chrome://extensions/?id=${chrome.runtime.id}`;
}

export async function openFileUrl(url: string): Promise<void> {
  const parsed = parseSafeUrl(url);
  if (!parsed || parsed.protocol !== 'file:') {
    throw new Error('This is not a valid local file URL.');
  }
  if (!(await hasFileAccess())) throw new Error(FILE_ACCESS_DENIED);

  const target = applyPathOverride(url, await getPathOverrides());
  await chrome.tabs.create({ url: target });
}

export async function openSavedUrl(url: string): Promise<void> {
  const parsed = parseSafeUrl(url);
  if (!parsed) throw new Error('This favorite has an invalid address.');
  if (parsed.protocol === 'file:') {
    await openFileUrl(url);
    return;
  }
  await chrome.tabs.create({ url });
}

export async function checkFileAvailability(
  url: string,
  overrides: PathOverride[],
): Promise<FileAvailability> {
  const parsed = parseSafeUrl(url);
  if (!parsed || parsed.protocol !== 'file:' || !(await hasFileAccess())) {
    return 'unknown';
  }

  try {
    const response = await fetch(applyPathOverride(url, overrides));
    return response.ok ? 'available' : 'missing';
  } catch {
    return 'missing';
  }
}
