import { parse, type DefaultTreeAdapterMap } from 'parse5';
import { MAX_RECORDS } from './archive';
import { getDefaultTitle, parseSafeUrl } from './validation';

export const MAX_BOOKMARKS_HTML_SIZE = 20 * 1024 * 1024;
const MAX_TITLE_LENGTH = 1000;
const MAX_URL_LENGTH = 65_536;

export interface ChromeBookmark {
  url: string;
  title: string;
  added: Date;
}

export interface ChromeFolder {
  title: string;
  added?: Date;
  children: (ChromeBookmark | ChromeFolder)[];
}

export interface ParseChromeBookmarksResult {
  // An empty title represents loose bookmarks, stored directly in the import folder.
  folders: ChromeFolder[];
  skipped: Array<{ url?: string; title?: string; reason: string }>;
  bookmarkCount: number;
  folderCount: number;
  protocolCounts: Record<string, number>;
}

type Node = DefaultTreeAdapterMap['node'];

function children(node: Node): Node[] {
  return 'childNodes' in node ? node.childNodes : [];
}

function attribute(node: Node, name: string): string | undefined {
  return 'attrs' in node
    ? node.attrs.find((attr) => attr.name === name)?.value
    : undefined;
}

function textContent(node: Node): string {
  const parts: string[] = [];
  const pending = [node];
  while (pending.length) {
    const current = pending.pop()!;
    if (current.nodeName === '#text' && 'value' in current) parts.push(current.value);
    else {
      const nodes = children(current);
      for (let index = nodes.length - 1; index >= 0; index--) pending.push(nodes[index]);
    }
  }
  return parts.join('').trim();
}

function addedDate(value: string | undefined, fallback?: Date): Date | undefined {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const date = new Date(Number(value) * 1000);
  return Number.isFinite(date.getTime()) ? date : fallback;
}

/** Parse bookmark HTML as inert data. No source HTML, icons or resources enter the DOM. */
export function parseChromeBookmarksHtml(html: string): ParseChromeBookmarksResult {
  if (new TextEncoder().encode(html).byteLength > MAX_BOOKMARKS_HTML_SIZE)
    throw new Error('The bookmarks file is larger than the 20 MB limit.');

  const document = parse(html);
  let bookmarkFormat = false;
  let bookmarkHeading = false;
  let rootList: Node | undefined;
  const pending: Node[] = [document];
  while (pending.length) {
    const node = pending.pop()!;
    if (node.nodeName === '#documentType' && 'name' in node)
      bookmarkFormat ||= node.name.toLowerCase() === 'netscape-bookmark-file-1';
    if (node.nodeName === 'h1')
      bookmarkHeading ||= /^bookmarks$/i.test(textContent(node));
    if (node.nodeName === 'dl' && !rootList) rootList = node;
    if (rootList && (bookmarkFormat || bookmarkHeading)) break;
    if (!['script', 'style', 'template', 'noscript'].includes(node.nodeName)) {
      const nodes = children(node);
      for (let index = nodes.length - 1; index >= 0; index--) pending.push(nodes[index]);
    }
  }
  if ((!bookmarkFormat && !bookmarkHeading) || !rootList)
    throw new Error('Choose a Chrome bookmarks HTML export from Bookmark Manager.');

  const result: ParseChromeBookmarksResult = {
    folders: [],
    skipped: [],
    bookmarkCount: 0,
    folderCount: 0,
    protocolCounts: {},
  };
  interface Context {
    entries: ChromeFolder['children'];
    pendingFolder?: ChromeFolder;
  }
  const root: Context = { entries: [] };
  // Contexts follow DL boundaries, rather than DT parents: Chrome omits DT end tags.
  const tasks = children(rootList)
    .slice()
    .reverse()
    .map((node) => ({
      node,
      context: root,
      inEntry: false,
    }));
  const now = new Date();
  function enqueue(node: Node, context: Context, inEntry: boolean): void {
    const nodes = children(node);
    for (let index = nodes.length - 1; index >= 0; index--)
      tasks.push({ node: nodes[index], context, inEntry });
  }
  while (tasks.length) {
    const { node, context, inEntry } = tasks.pop()!;
    if (['script', 'style', 'template', 'noscript'].includes(node.nodeName)) continue;
    if (node.nodeName === 'h3' && inEntry) {
      const folder: ChromeFolder = {
        title: (textContent(node) || 'Untitled folder').slice(0, MAX_TITLE_LENGTH),
        added: addedDate(attribute(node, 'add_date')),
        children: [],
      };
      context.entries.push(folder);
      context.pendingFolder = folder;
      result.folderCount += 1;
      if (result.folderCount + 1 > MAX_RECORDS)
        throw new Error(
          `The import exceeds the ${MAX_RECORDS.toLocaleString()} group limit, including its import folder.`,
        );
      continue;
    }
    if (node.nodeName === 'a' && inEntry) {
      context.pendingFolder = undefined;
      const url = attribute(node, 'href')?.trim();
      const title = textContent(node).slice(0, MAX_TITLE_LENGTH);
      const parsed = url ? parseSafeUrl(url) : null;
      if (!url || !parsed || url.length > MAX_URL_LENGTH) {
        result.skipped.push({
          url,
          title: title || url,
          reason: !url
            ? 'Missing URL attribute'
            : url.length > MAX_URL_LENGTH
              ? 'URL exceeds the supported length'
              : 'Malformed URL or unsupported URL scheme',
        });
        continue;
      }
      context.entries.push({
        url,
        title:
          title ||
          getDefaultTitle(url).slice(0, MAX_TITLE_LENGTH) ||
          url.slice(0, MAX_TITLE_LENGTH),
        added: addedDate(attribute(node, 'add_date'), now)!,
      });
      result.bookmarkCount += 1;
      if (result.bookmarkCount > MAX_RECORDS)
        throw new Error(
          `The import exceeds the ${MAX_RECORDS.toLocaleString()} favorite limit.`,
        );
      result.protocolCounts[parsed.protocol] =
        (result.protocolCounts[parsed.protocol] ?? 0) + 1;
      continue;
    }
    if (node.nodeName === 'dl') {
      const nested: Context = {
        entries: context.pendingFolder?.children ?? context.entries,
      };
      context.pendingFolder = undefined;
      enqueue(node, nested, false);
      continue;
    }
    enqueue(node, context, inEntry || node.nodeName === 'dt');
  }

  if (!result.folderCount && !result.bookmarkCount)
    throw new Error('This file contains no importable folders or bookmarks.');
  for (const entry of root.entries) {
    if ('url' in entry) {
      const last = result.folders.at(-1);
      if (last?.title === '') last.children.push(entry);
      else result.folders.push({ title: '', children: [entry] });
    } else result.folders.push(entry);
  }
  return result;
}

// Retain the spelling used in the implementation guide.
export const parseChromBookmarksHtml = parseChromeBookmarksHtml;

export interface ParsedBookmarksFile extends ParseChromeBookmarksResult {
  filename: string;
}

export async function parseBookmarksHtml(file: File): Promise<ParsedBookmarksFile> {
  if (!/\.html?$/i.test(file.name))
    throw new Error('Choose an .html or .htm bookmarks file.');
  if (!file.size) throw new Error('The selected bookmarks file is empty.');
  if (file.size > MAX_BOOKMARKS_HTML_SIZE)
    throw new Error('The bookmarks file is larger than the 20 MB limit.');
  return { ...parseChromeBookmarksHtml(await file.text()), filename: file.name };
}
