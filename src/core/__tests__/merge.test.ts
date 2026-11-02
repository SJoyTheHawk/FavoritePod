import { describe, expect, it } from 'vitest';
import { createHLC } from '../hlc';
import { isGroupDeleted, isItemDeleted, mergeLibrary } from '../merge';
import type { Group, Item, LibraryState } from '../types';

function makeItem(overrides: Partial<Item> = {}): Item {
  const clock = createHLC(10, 0, 'device-a');
  return {
    id: 'item-1',
    groupId: 'group-1',
    orderKey: 'a0',
    url: 'https://example.com',
    title: 'Example',
    clock: {
      groupId: clock,
      orderKey: clock,
      url: clock,
      title: clock,
      previewHash: clock,
    },
    ...overrides,
  };
}

function makeGroup(
  id: string,
  parentId: string | null,
  clock = createHLC(10, 0, 'device-a'),
): Group {
  return {
    id,
    parentId,
    orderKey: 'a0',
    title: id,
    clock: { parentId: clock, orderKey: clock, title: clock },
  };
}

describe('library merge', () => {
  it('merges independent field edits by their own clocks', () => {
    const old = createHLC(10, 0, 'device-a');
    const titleEdit = createHLC(20, 0, 'device-a');
    const moveEdit = createHLC(21, 0, 'device-b');
    const left = makeItem({
      title: 'Renamed',
      clock: {
        groupId: old,
        orderKey: old,
        url: old,
        title: titleEdit,
        previewHash: old,
      },
    });
    const right = makeItem({
      orderKey: 'a1',
      clock: { groupId: old, orderKey: moveEdit, url: old, title: old, previewHash: old },
    });
    const state = (items: Item[]): LibraryState => ({ groups: [], items });

    const merged = mergeLibrary(state([left]), state([right])).items[0];
    expect(merged).toMatchObject({ title: 'Renamed', orderKey: 'a1' });
  });

  it('keeps a newer tombstone but allows a later edit to resurrect the item', () => {
    const deletion = createHLC(20, 0, 'device-a');
    const deleted = makeItem({ deleted: deletion });
    expect(isItemDeleted(deleted)).toBe(true);

    const later = createHLC(21, 0, 'device-b');
    const edited = makeItem({
      title: 'Restored',
      deleted: deletion,
      clock: {
        groupId: later,
        orderKey: later,
        url: later,
        title: later,
        previewHash: later,
      },
    });
    expect(isItemDeleted(edited)).toBe(false);
    expect(
      mergeLibrary({ groups: [], items: [deleted] }, { groups: [], items: [edited] })
        .items[0].title,
    ).toBe('Restored');

    const newerDeletion = makeItem({ deleted: createHLC(22, 0, 'device-b') });
    expect(
      mergeLibrary(
        { groups: [], items: [deleted] },
        { groups: [], items: [newerDeletion] },
      ).items[0].deleted,
    ).toBe(newerDeletion.deleted);
  });

  it('repairs a concurrent group cycle deterministically', () => {
    const cycle = [makeGroup('group-a', 'group-b'), makeGroup('group-b', 'group-a')];
    const merged = mergeLibrary({ groups: cycle, items: [] }, { groups: [], items: [] });

    expect(merged.groups.find((group) => group.id === 'group-b')?.parentId).toBeNull();
    expect(merged.groups.find((group) => group.id === 'group-a')?.parentId).toBe(
      'group-b',
    );
    expect(merged.groups.some(isGroupDeleted)).toBe(false);
  });

  it('resolves equal-clock values deterministically and repairs missing parents', () => {
    const base = makeGroup('group-equal', null);
    const alternate = { ...base, title: 'zulu' };
    const missingParent = makeGroup('group-orphan', 'group-missing');
    const deletedParent = {
      ...makeGroup('group-deleted', null),
      deleted: createHLC(20, 0, 'device-a'),
    };
    const leftItem = makeItem({ id: 'item-a' });
    const rightItem = makeItem({ id: 'item-b' });
    const merged = mergeLibrary(
      { groups: [base], items: [leftItem] },
      { groups: [alternate, missingParent, deletedParent], items: [rightItem] },
    );

    expect(merged.groups.find((group) => group.id === 'group-equal')?.title).toBe('zulu');
    expect(
      merged.groups.find((group) => group.id === 'group-orphan')?.parentId,
    ).toBeNull();
    expect(
      isGroupDeleted(merged.groups.find((group) => group.id === 'group-deleted')!),
    ).toBe(true);
    expect(merged.items.map((item) => item.id)).toEqual(['item-a', 'item-b']);

    const reverse = mergeLibrary(
      { groups: [alternate], items: [] },
      { groups: [base], items: [] },
    );
    expect(reverse.groups[0].title).toBe('zulu');
  });
});
