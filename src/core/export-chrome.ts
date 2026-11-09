import { MAX_RECORDS } from './archive';
import { selectExportRecords } from './export';
import type { Group, Item } from './types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportToChromiumHtml(
  groups: Group[],
  items: Item[],
  groupIds?: Set<string>,
): string {
  const selected = selectExportRecords(
    groups,
    items,
    groupIds ? [...groupIds] : undefined,
  );
  if (selected.groups.length > MAX_RECORDS || selected.items.length > MAX_RECORDS)
    throw new Error(
      `The HTML export exceeds the ${MAX_RECORDS.toLocaleString()} record limit.`,
    );
  const childrenByParent = new Map<string | null, Group[]>();
  const itemsByGroup = new Map<string, Item[]>();
  for (const group of selected.groups) {
    const siblings = childrenByParent.get(group.parentId) ?? [];
    siblings.push(group);
    childrenByParent.set(group.parentId, siblings);
  }
  for (const item of selected.items) {
    const siblings = itemsByGroup.get(item.groupId) ?? [];
    siblings.push(item);
    itemsByGroup.set(item.groupId, siblings);
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- Exported by FavoritePod -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks from FavoritePod</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
  ];
  type Task = { group: Group; depth: number } | { closing: true; depth: number };
  const pending: Task[] = (childrenByParent.get(null) ?? [])
    .slice()
    .reverse()
    .map((group) => ({ group, depth: 1 }));
  const visited = new Set<string>();
  while (pending.length) {
    const task = pending.pop()!;
    // Whitespace is cosmetic; cap indentation so deep hierarchies remain compact.
    const indent = '  '.repeat(Math.min(task.depth, 20));
    if ('closing' in task) {
      lines.push(`${indent}</DL><p>`);
      continue;
    }
    const { group, depth } = task;
    if (visited.has(group.id)) throw new Error('The library contains a group cycle.');
    visited.add(group.id);
    lines.push(
      `${indent}<DT><H3 ADD_DATE="${timestamp}">${escapeHtml(group.title)}</H3>`,
    );
    lines.push(`${indent}<DL><p>`);
    for (const item of itemsByGroup.get(group.id) ?? [])
      lines.push(
        `${indent}  <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${timestamp}">${escapeHtml(item.title)}</A>`,
      );
    pending.push({ closing: true, depth });
    for (const child of (childrenByParent.get(group.id) ?? []).slice().reverse())
      pending.push({ group: child, depth: depth + 1 });
  }
  if (visited.size !== selected.groups.length)
    throw new Error('The library contains a group cycle.');
  lines.push('</DL><p>', '');
  return lines.join('\n');
}

export function downloadChromiumHtml(html: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html; charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
