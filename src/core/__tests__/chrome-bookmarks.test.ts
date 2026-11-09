import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db';
import { MAX_RECORDS, ExportDataV1Schema } from '../archive';
import { compareHLC, createHLC } from '../hlc';
import { exportToZip } from '../export';
import { exportToChromiumHtml } from '../export-chrome';
import { importArchive, parseImportFile } from '../import';
import { chromeBookmarksToArchive, importBookmarks } from '../import-chrome';
import {
  MAX_BOOKMARKS_HTML_SIZE,
  parseBookmarksHtml,
  parseChromeBookmarksHtml,
} from '../parse-chrome-bookmarks';
import {
  createGroup,
  createItem,
  deleteGroup,
  deleteItem,
  getRecentItems,
  getShowHiddenBookmarks,
  listGroups,
  listItems,
  setShowHiddenBookmarks,
} from '../storage';
import type { ChromeFolder } from '../parse-chrome-bookmarks';

const html = (content: string) => `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>${content}</DL><p>`;
const fixture = html(`
  <DT><A HREF="https://root.example/?a=1&amp;b=2" ADD_DATE="1704067200"> Loose &amp; link </A>
  <DT><H3 ADD_DATE="1704067200" FOLDED PERSONAL_TOOLBAR_FOLDER="true"> Bookmarks bar </H3>
  <DL><p>
    <DT><A HREF="https://example.com">First</A>
    <DT><H3>工作 &amp; Tools</H3>
    <DL><p>
      <DT><A HREF="file:///Users/Alex/my%20tool.html"> Local tool </A>
      <DT><A HREF="https://example.com">Duplicate</A>
      <DT><A HREF="chrome://settings"> </A>
      <DT><A HREF="chrome-extension://abcdefghijklmnop/options.html">Options</A>
      <DT><A HREF="ftp://archive.example/file">Legacy</A>
      <DT><A HREF="mailto:alex@example.com">Email</A>
      <DT><A HREF="tel:+1234">Phone</A>
      <DT><A HREF="sms:+1234">Message</A>
    </DL><p>
    <DT><A HREF="https://last.example">Last</A>
    <DT><H3>Empty &quot;folder&quot;</H3><DL><p></DL><p>
  </DL><p>
  <DT><A HREF="https://after.example">After folders</A>
  <DT><H3> </H3><DL><p></DL><p>
`);

function allBookmarks(folders: ChromeFolder[]) {
  const result = [];
  const pending = [...folders];
  while (pending.length) {
    const entry = pending.shift()!;
    for (const child of entry.children) {
      if ('url' in child) result.push(child);
      else pending.push(child);
    }
  }
  return result;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await db.delete();
});

describe('Chrome bookmarks parsing', () => {
  it('handles real loose HTML, nested/empty folders, entities, Unicode, duplicates and protocols', () => {
    const parsed = parseChromeBookmarksHtml(fixture);
    expect(parsed).toMatchObject({ bookmarkCount: 12, folderCount: 4, skipped: [] });
    expect(parsed.folders.map((folder) => folder.title)).toEqual([
      '',
      'Bookmarks bar',
      '',
      'Untitled folder',
    ]);
    const bar = parsed.folders[1];
    expect(bar.children.map((entry) => entry.title)).toEqual([
      'First',
      '工作 & Tools',
      'Last',
      'Empty "folder"',
    ]);
    const nested = bar.children[1] as ChromeFolder;
    expect(nested.children.map((entry) => entry.title)).toEqual([
      'Local tool',
      'Duplicate',
      'Settings',
      'Options',
      'Legacy',
      'Email',
      'Phone',
      'Message',
    ]);
    expect((bar.children[3] as ChromeFolder).children).toEqual([]);
    const bookmarks = allBookmarks(parsed.folders);
    expect(bookmarks.filter((entry) => entry.url === 'https://example.com')).toHaveLength(
      2,
    );
    expect(bookmarks[0]).toMatchObject({
      url: 'https://root.example/?a=1&b=2',
      title: 'Loose & link',
      added: new Date('2024-01-01T00:00:00Z'),
    });
    expect(parsed.protocolCounts).toMatchObject({
      'https:': 5,
      'file:': 1,
      'chrome:': 1,
      'chrome-extension:': 1,
      'ftp:': 1,
      'mailto:': 1,
      'tel:': 1,
      'sms:': 1,
    });
  });

  it('associates sibling DLs with folders even with explicit DT end tags', () => {
    const parsed = parseChromeBookmarksHtml(
      html(
        '<DT><H3>A</H3></DT><DL><DT><A HREF="https://a.example">A link</A></DT></DL><DT><H3>B</H3></DT><DL></DL>',
      ),
    );
    expect(parsed.folders[0].children).toHaveLength(1);
    expect(parsed.folders[1]).toMatchObject({ title: 'B', children: [] });
  });

  it('reports invalid/unsafe entries and never executes or fetches embedded resources', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const parsed = parseChromeBookmarksHtml(
      html(`
      <script>throw new Error('executed')</script><img src="https://tracker.example/pixel">
      <DT><A HREF="javascript:alert(1)">Script</A>
      <DT><A HREF="data:text/html,unsafe">Data</A>
      <DT><A HREF="ht!tps://broken">Broken</A>
      <DT><A>No href</A>
      <DT><A HREF="chrome:">Bad shortcut</A>
      <DT><A HREF="https://good.example" ICON="data:ignored" ADD_DATE="bad"><b>Safe &lt;script&gt;</b></A>
    `),
    );
    expect(parsed.skipped).toHaveLength(5);
    expect(parsed.skipped[3]).toMatchObject({
      title: 'No href',
      reason: 'Missing URL attribute',
    });
    expect(allBookmarks(parsed.folders)[0]).toMatchObject({
      title: 'Safe <script>',
      url: 'https://good.example',
    });
    expect(allBookmarks(parsed.folders)[0].added.getTime()).toBeGreaterThan(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('trims and caps names, falls back for blank titles, and handles invalid dates', () => {
    const parsed = parseChromeBookmarksHtml(
      html(
        `<DT><H3>${'界'.repeat(1100)}</H3><DL><DT><A HREF="file:///tmp/my%20tool.html" ADD_DATE="9999999999999999999999"> </A><DT><A HREF="https://example.com">${'x'.repeat(1100)}</A></DL>`,
      ),
    );
    expect(parsed.folders[0].title).toHaveLength(1000);
    const bookmarks = allBookmarks(parsed.folders);
    expect(bookmarks[0].title).toBe('my tool.html');
    expect(Number.isFinite(bookmarks[0].added.getTime())).toBe(true);
    expect(bookmarks[1].title).toHaveLength(1000);
  });

  it('preserves deep nesting', () => {
    const parsed = parseChromeBookmarksHtml(
      html(
        '<DT><H3>Level</H3><DL>'.repeat(120) +
          '<DT><A HREF="https://deep.example">Deep</A>' +
          '</DL>'.repeat(120),
      ),
    );
    expect(parsed.folderCount).toBe(120);
    expect(parsed.bookmarkCount).toBe(1);
    let current = parsed.folders[0];
    for (let depth = 1; depth < 120; depth++)
      current = current.children[0] as ChromeFolder;
    expect(current.children[0]).toMatchObject({ title: 'Deep' });
  });

  it.each([
    '<html><a href="https://example.com">Page</a></html>',
    html(''),
    html('<DT><A HREF="javascript:alert(1)">No</A>'),
  ])('rejects unrelated or unimportable HTML', (value) => {
    expect(() => parseChromeBookmarksHtml(value)).toThrow();
  });

  it('validates file extension, empty files, and the 20 MB limit before reading', async () => {
    await expect(
      parseBookmarksHtml(new File([fixture], 'BOOKMARKS.HTM')),
    ).resolves.toMatchObject({ filename: 'BOOKMARKS.HTM' });
    await expect(
      parseBookmarksHtml(new File([fixture], 'bookmarks.txt')),
    ).rejects.toThrow('.html or .htm');
    await expect(parseBookmarksHtml(new File([], 'bookmarks.html'))).rejects.toThrow(
      'empty',
    );
    const large = new File([], 'large.html');
    Object.defineProperty(large, 'size', { value: MAX_BOOKMARKS_HTML_SIZE + 1 });
    const read = vi.spyOn(large, 'text');
    await expect(parseBookmarksHtml(large)).rejects.toThrow('20 MB');
    expect(read).not.toHaveBeenCalled();
  });

  it('enforces limits including the container while allowing the boundary', () => {
    const folders = '<DT><H3>Empty</H3><DL></DL>';
    expect(
      parseChromeBookmarksHtml(html(folders.repeat(MAX_RECORDS - 1))).folderCount,
    ).toBe(MAX_RECORDS - 1);
    expect(() => parseChromeBookmarksHtml(html(folders.repeat(MAX_RECORDS)))).toThrow(
      'group limit',
    );
    const bookmark = '<DT><A HREF="https://example.com">Link</A>';
    expect(
      parseChromeBookmarksHtml(html(bookmark.repeat(MAX_RECORDS))).bookmarkCount,
    ).toBe(MAX_RECORDS);
    expect(() =>
      parseChromeBookmarksHtml(html(bookmark.repeat(MAX_RECORDS + 1))),
    ).toThrow('favorite limit');
  });
});

describe('Chrome bookmarks import and export', () => {
  it('reviews without writes and imports one container with fresh IDs, local clocks and stable sibling order', async () => {
    const existing = await createGroup({ title: 'Existing' });
    const existingItem = await createItem({
      groupId: existing.id,
      url: 'https://existing.example',
    });
    const futureClock = createHLC(Date.now() + 60_000, 4, 'local-device');
    await db.syncMeta.put({ key: 'lastHlc', value: futureClock });
    const parsed = await parseBookmarksHtml(new File([fixture], 'Chrome.html'));
    expect(await listGroups()).toEqual([existing]);
    expect(await listItems()).toEqual([existingItem]);
    const archive = await chromeBookmarksToArchive(
      parsed,
      parsed.filename,
      'local-device',
    );
    expect(ExportDataV1Schema.safeParse(archive.data).success).toBe(true);
    expect(archive.thumbnails.size).toBe(0);
    expect(
      archive.data.items.every((item) => compareHLC(item.clock.url, futureClock) > 0),
    ).toBe(true);
    const progress = vi.fn();
    expect(await importBookmarks(parsed, progress)).toEqual({
      importedGroups: 5,
      importedItems: 12,
    });
    const groups = await listGroups();
    const items = await listItems();
    const container = groups.find((group) => group.title === 'Imported: Chrome')!;
    expect(container.parentId).toBeNull();
    expect(container.orderKey > existing.orderKey).toBe(true);
    expect(groups.filter((group) => group.title.startsWith('Imported:'))).toHaveLength(1);
    expect(
      items.filter((item) => item.groupId === container.id).map((item) => item.title),
    ).toEqual(['Loose & link', 'After folders']);
    const bar = groups.find((group) => group.title === 'Bookmarks bar')!;
    expect(bar.parentId).toBe(container.id);
    expect(
      items.filter((item) => item.groupId === bar.id).map((item) => item.title),
    ).toEqual(['First', 'Last']);
    expect(await db.groups.get(existing.id)).toEqual(existing);
    expect(await db.items.get(existingItem.id)).toEqual(existingItem);
    expect(progress).toHaveBeenLastCalledWith({
      stage: 'writing',
      current: 17,
      total: 17,
    });
    const lastClock = (await db.syncMeta.get('lastHlc'))?.value;
    expect(typeof lastClock === 'string' && compareHLC(lastClock, futureClock) > 0).toBe(
      true,
    );
    expect(items.every((item) => !item.previewHash && !item.faviconUrl)).toBe(true);

    const firstIds = new Set([...groups, ...items].map((record) => record.id));
    await importBookmarks(parsed);
    expect((await listGroups()).filter((group) => !firstIds.has(group.id))).toHaveLength(
      5,
    );
    expect((await listItems()).filter((item) => !firstIds.has(item.id))).toHaveLength(12);
  });

  it('rolls back groups, items and sync metadata if a write fails', async () => {
    const existing = await createGroup({ title: 'Existing' });
    const syncBefore = await db.syncMeta.toArray();
    const parsed = await parseBookmarksHtml(new File([fixture], 'Chrome.html'));
    vi.spyOn(db.items, 'bulkPut').mockRejectedValue(new Error('Disk full'));
    await expect(importBookmarks(parsed)).rejects.toThrow('Disk full');
    expect(await listGroups()).toEqual([existing]);
    expect(await listItems()).toEqual([]);
    expect(await db.syncMeta.toArray()).toEqual(syncBefore);
  });

  it('survives ZIP export/import and HTML round trips with every protocol and duplicate', async () => {
    await importBookmarks(await parseBookmarksHtml(new File([fixture], 'Chrome.html')));
    const originalGroups = await listGroups();
    const originalItems = await listItems();
    const zip = await exportToZip();
    const archive = await parseImportFile(new File([zip], 'backup.zip'));
    expect(archive.data.items.map((item) => item.url).sort()).toEqual(
      originalItems.map((item) => item.url).sort(),
    );
    await importArchive(archive, 'replace');
    expect(await listGroups()).toEqual(originalGroups);
    expect(await listItems()).toEqual(originalItems);
    const output = exportToChromiumHtml(await listGroups(), await listItems());
    const reparsed = parseChromeBookmarksHtml(output);
    expect(reparsed.folderCount).toBe(5);
    expect(reparsed.bookmarkCount).toBe(12);
    expect(
      allBookmarks(reparsed.folders)
        .map(({ title, url }) => ({ title, url }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    ).toEqual(
      originalItems
        .map(({ title, url }) => ({ title, url }))
        .sort((a, b) => a.title.localeCompare(b.title)),
    );
    expect(reparsed.skipped).toEqual([]);
  });

  it('exports selected descendants with ancestor structure, excludes tombstones, and escapes attributes/text', async () => {
    const root = await createGroup({ title: 'Parent' });
    const child = await createGroup({ title: 'Child <&> "quoted"', parentId: root.id });
    const grandchild = await createGroup({ title: 'Empty', parentId: child.id });
    await createItem({
      groupId: root.id,
      title: 'Excluded parent item',
      url: 'https://parent.example',
    });
    await createItem({
      groupId: child.id,
      title: '<script>alert("x")</script> & 工作',
      url: 'https://example.com/?a="b"&c=1',
    });
    const deleted = await createItem({
      groupId: child.id,
      title: 'Deleted',
      url: 'https://deleted.example',
    });
    await deleteItem(deleted.id);
    const deletedGroup = await createGroup({ title: 'Deleted group' });
    await deleteGroup(deletedGroup.id);
    const output = exportToChromiumHtml(
      await db.groups.toArray(),
      await db.items.toArray(),
      new Set([child.id]),
    );
    expect(output).toContain('&lt;script&gt;');
    expect(output).toContain('HREF="https://example.com/?a=&quot;b&quot;&amp;c=1"');
    expect(output).not.toContain('Deleted');
    expect(output).not.toContain('Excluded parent item');
    const parsed = parseChromeBookmarksHtml(output);
    expect(parsed.folderCount).toBe(3);
    expect(parsed.folders[0].title).toBe('Parent');
    expect((parsed.folders[0].children[0] as ChromeFolder).title).toBe(child.title);
    expect(
      ((parsed.folders[0].children[0] as ChromeFolder).children[1] as ChromeFolder).title,
    ).toBe(grandchild.title);
    expect(allBookmarks(parsed.folders)[0].title).toBe(
      '<script>alert("x")</script> & 工作',
    );
  });

  it('keeps hidden links in storage, exports and sync data and reveals them without restoring deleted items', async () => {
    const group = await createGroup({ title: 'Hidden links' });
    const child = await createGroup({ title: 'Nested', parentId: group.id });
    const ftp = await createItem({
      groupId: child.id,
      url: 'ftp://archive.example/file',
    });
    const deleted = await createItem({
      groupId: child.id,
      url: 'ftp://deleted.example/file',
    });
    await deleteItem(deleted.id);
    expect(await getShowHiddenBookmarks()).toBe(false);
    expect(await getRecentItems()).toEqual([]);
    expect(await listItems()).toEqual([ftp]);
    const before = await db.items.toArray();
    await expect(deleteGroup(group.id)).rejects.toThrow('1 hidden bookmark');
    await expect(deleteGroup(group.id)).rejects.toThrow('Show hidden bookmarks');
    await setShowHiddenBookmarks(true);
    expect(await getRecentItems()).toEqual([ftp]);
    expect(await db.items.toArray()).toEqual(before);
    await expect(deleteGroup(group.id)).rejects.toThrow('Move favorites');
    expect(exportToChromiumHtml(await listGroups(), await listItems())).toContain(
      'ftp://archive.example/file',
    );
    await deleteItem(ftp.id);
    await expect(deleteGroup(group.id)).resolves.toBeUndefined();
  });
});
