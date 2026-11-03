import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';
import { db } from '../db';
import { createHLC, tickHLC } from '../hlc';
import {
  createGroup,
  createItem,
  listGroups,
  listItems,
  listSnapshots,
} from '../storage';
import { exportToZip } from '../export';
import { importArchive, parseImportFile } from '../import';
import { hashBlob } from '../thumbnail';
import type { ExportDataV1, ImportArchive } from '../archive';
import type { Group, Item } from '../types';

beforeEach(async () => {
  await db.delete();
  await db.open();
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(
      async () =>
        ({
          width: 640,
          height: 400,
          close: vi.fn(),
        }) as unknown as ImageBitmap,
    ),
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.delete();
});

function exportData(groups: Group[], items: Item[]): ExportDataV1 {
  return {
    format: 'visual-launcher',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    exportedBy: 'source-device',
    groups,
    items,
  };
}

function zipFile(data: ExportDataV1, images: Record<string, Uint8Array> = {}): File {
  return new File(
    [
      zipSync({
        'launcher.json': strToU8(JSON.stringify(data)),
        ...images,
      }),
    ],
    'library.zip',
    { type: 'application/zip' },
  );
}

function asImportArchive(data: ExportDataV1, filename = 'library.zip'): ImportArchive {
  return { data, thumbnails: new Map(), filename };
}

describe('FavoritePod ZIP archives', () => {
  it('exports selected group contents with ancestor structure and preview bytes', async () => {
    const parent = await createGroup({ title: 'Work' });
    const child = await createGroup({ title: 'Tools', parentId: parent.id });
    const other = await createGroup({ title: 'Personal' });
    const preview = new Blob(['preview bytes'], { type: 'image/jpeg' });
    const selectedItem = await createItem({
      url: 'https://tools.example',
      groupId: child.id,
      thumbnail: { blob: preview, width: 640, height: 400 },
    });
    await createItem({ url: 'https://personal.example', groupId: other.id });

    const blob = await exportToZip({ groupIds: [child.id] });
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const data = JSON.parse(
      new TextDecoder().decode(files['launcher.json']),
    ) as ExportDataV1;

    expect(data.groups.map((group) => group.id).sort()).toEqual(
      [parent.id, child.id].sort(),
    );
    expect(data.items.map((item) => item.id)).toEqual([selectedItem.id]);
    expect(files[`previews/${selectedItem.previewHash}.jpg`]).toEqual(
      new Uint8Array(await preview.arrayBuffer()),
    );
    expect(data.schemaVersion).toBe(1);
  });

  it('rejects unsafe URLs before presenting an import preview', async () => {
    const clock = createHLC(Date.now(), 0, 'source-device');
    const group: Group = {
      id: 'group-a',
      parentId: null,
      orderKey: 'a0',
      title: 'Links',
      clock: { parentId: clock, orderKey: clock, title: clock },
    };
    const item: Item = {
      id: 'item-a',
      groupId: group.id,
      orderKey: 'a0',
      url: 'javascript:alert(1)',
      title: 'Unsafe',
      clock: {
        groupId: clock,
        orderKey: clock,
        url: clock,
        title: clock,
        previewHash: clock,
        faviconUrl: clock,
      },
    };

    await expect(parseImportFile(zipFile(exportData([group], [item])))).rejects.toThrow(
      'invalid URL',
    );
  });

  it('rejects missing and hash-mismatched referenced previews', async () => {
    const clock = createHLC(Date.now(), 0, 'source-device');
    const group: Group = {
      id: 'group-preview',
      parentId: null,
      orderKey: 'a0',
      title: 'Preview',
      clock: { parentId: clock, orderKey: clock, title: clock },
    };
    const expectedHash = 'a'.repeat(64);
    const item: Item = {
      id: 'item-preview',
      groupId: group.id,
      orderKey: 'a0',
      url: 'https://preview.example',
      title: 'Preview',
      previewHash: expectedHash,
      clock: {
        groupId: clock,
        orderKey: clock,
        url: clock,
        title: clock,
        previewHash: clock,
        faviconUrl: clock,
      },
    };
    const data = exportData([group], [item]);

    await expect(parseImportFile(zipFile(data))).rejects.toThrow(
      'missing a referenced preview',
    );
    await expect(
      parseImportFile(
        zipFile(data, {
          [`previews/${expectedHash}.jpg`]: new Uint8Array([1, 2, 3]),
        }),
      ),
    ).rejects.toThrow('failed its integrity check');
  });

  it('copies imported data under new IDs and keeps the existing library intact', async () => {
    const existingGroup = await createGroup({ title: 'Existing' });
    const existingItem = await createItem({
      url: 'https://existing.example',
      groupId: existingGroup.id,
    });
    const importedGroup: Group = {
      ...existingGroup,
      id: 'source-group',
      title: 'Shared',
    };
    const importedItem: Item = {
      ...existingItem,
      id: 'source-item',
      groupId: importedGroup.id,
      url: 'https://shared.example',
      title: 'Shared page',
    };
    const archive = asImportArchive(
      exportData([importedGroup], [importedItem]),
      'Shared.zip',
    );

    const result = await importArchive(archive, 'copy');
    const groups = await listGroups();
    const items = await listItems();

    expect(result).toEqual({ importedGroups: 2, importedItems: 1 });
    expect(items.map((item) => item.id)).toContain(existingItem.id);
    expect(items.map((item) => item.id)).not.toContain(importedItem.id);
    expect(items).toHaveLength(2);
    expect(groups.find((group) => group.title === 'Imported: Shared')).toBeDefined();
  });

  it('updates matching IDs while preserving unrelated local records', async () => {
    const sourceGroup = await createGroup({ title: 'Original group' });
    const sourceItem = await createItem({
      url: 'https://before.example',
      title: 'Before',
      groupId: sourceGroup.id,
    });
    const unrelatedGroup = await createGroup({ title: 'Unrelated group' });
    const unrelatedItem = await createItem({
      url: 'https://unrelated.example',
      groupId: unrelatedGroup.id,
    });
    const sourceClock = createHLC(Date.now() + 1000, 0, 'source-device');
    const updatedGroup: Group = {
      ...sourceGroup,
      title: 'Updated group',
      clock: { ...sourceGroup.clock, title: sourceClock },
    };
    const updatedItem: Item = {
      ...sourceItem,
      url: 'https://after.example',
      title: 'After',
      clock: {
        ...sourceItem.clock,
        url: tickHLC(sourceItem.clock.url, 'source-device', Date.now() + 1000),
        title: sourceClock,
      },
    };

    await importArchive(
      asImportArchive(exportData([updatedGroup], [updatedItem])),
      'update',
    );

    expect((await listGroups()).find((group) => group.id === sourceGroup.id)?.title).toBe(
      'Updated group',
    );
    expect((await listItems()).find((item) => item.id === sourceItem.id)?.url).toBe(
      'https://after.example',
    );
    expect((await listItems()).map((item) => item.id)).toContain(unrelatedItem.id);
  });

  it('snapshots the library before replace and rolls back failed writes', async () => {
    const originalGroup = await createGroup({ title: 'Original' });
    const originalItem = await createItem({
      url: 'https://original.example',
      groupId: originalGroup.id,
    });
    const replacementGroup = await createGroup({ title: 'Replacement' });
    const replacementItem = await createItem({
      url: 'https://replacement.example',
      groupId: replacementGroup.id,
    });
    const archive = asImportArchive(exportData([replacementGroup], [replacementItem]));

    await importArchive(archive, 'replace');
    expect((await listItems()).map((item) => item.id)).toEqual([replacementItem.id]);
    expect((await listSnapshots())[0]).toMatchObject({
      groups: expect.arrayContaining([expect.objectContaining({ id: originalGroup.id })]),
      items: expect.arrayContaining([expect.objectContaining({ id: originalItem.id })]),
    });

    const failedArchive = asImportArchive(
      exportData(
        [
          {
            ...replacementGroup,
            id: 'failed-group',
            title: 'Failed write',
          },
        ],
        [
          {
            ...replacementItem,
            id: 'failed-item',
            groupId: 'failed-group',
          },
        ],
      ),
    );
    const bulkPut = vi
      .spyOn(db.items, 'bulkPut')
      .mockRejectedValue(new Error('write failed'));
    await expect(importArchive(failedArchive, 'replace')).rejects.toThrow('write failed');
    bulkPut.mockRestore();
    expect(await db.groups.get('failed-group')).toBeUndefined();
    expect((await listItems()).map((item) => item.id)).toEqual([replacementItem.id]);
  });

  it('round-trips a valid preview through validation and storage', async () => {
    const group = await createGroup({ title: 'Round trip' });
    const preview = new Blob(['preview bytes'], { type: 'image/jpeg' });
    const previewHash = await hashBlob(preview);
    const item = await createItem({
      url: 'file:///Users/example/tool.html',
      groupId: group.id,
      thumbnail: { blob: preview, width: 640, height: 400 },
    });
    const data = exportData([group], [{ ...item, previewHash }]);
    const file = zipFile(data, {
      [`previews/${previewHash}.jpg`]: new Uint8Array(await preview.arrayBuffer()),
    });

    const parsed = await parseImportFile(file);
    expect(parsed.thumbnails.size).toBe(1);
    const imported = await importArchive(parsed, 'copy');
    expect(imported.importedItems).toBe(1);
    expect(await db.thumbnails.get(previewHash)).toMatchObject({ hash: previewHash });
  });
});
