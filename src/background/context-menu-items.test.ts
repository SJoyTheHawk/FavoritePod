import { describe, expect, it } from 'vitest';
import type { Group } from '../core/types';
import { createHLC } from '../core/hlc';
import {
  CONTEXT_MENU_GROUPS_ID,
  CONTEXT_MENU_GROUP_PREFIX,
  CONTEXT_MENU_LINK_ID,
  CONTEXT_MENU_PAGE_ID,
  CONTEXT_MENU_ROOT_ID,
  buildContextMenuEntries,
} from './context-menu-items';

const clock = createHLC(100, 0, 'test');
const group = (id: string, title: string, parentId: string | null = null): Group => ({
  id,
  parentId,
  orderKey: 'a0',
  title,
  clock: { parentId: clock, orderKey: clock, title: clock },
});

describe('context menu entries', () => {
  it('provides page, link, and full-path group actions', () => {
    const entries = buildContextMenuEntries([
      group('work', 'Work'),
      group('research', 'Research', 'work'),
    ]);

    expect(entries.slice(0, 4)).toEqual([
      {
        id: CONTEXT_MENU_ROOT_ID,
        title: 'Save to FavoritePod',
        contexts: ['page', 'link'],
      },
      {
        id: CONTEXT_MENU_PAGE_ID,
        parentId: CONTEXT_MENU_ROOT_ID,
        title: 'Save this page',
        contexts: ['page'],
      },
      {
        id: CONTEXT_MENU_LINK_ID,
        parentId: CONTEXT_MENU_ROOT_ID,
        title: 'Save this link',
        contexts: ['link'],
      },
      {
        id: CONTEXT_MENU_GROUPS_ID,
        parentId: CONTEXT_MENU_ROOT_ID,
        title: 'Save to group',
        contexts: ['page', 'link'],
      },
    ]);
    expect(entries.slice(4)).toEqual([
      {
        id: `${CONTEXT_MENU_GROUP_PREFIX}work`,
        parentId: CONTEXT_MENU_GROUPS_ID,
        title: 'Work',
        contexts: ['page', 'link'],
      },
      {
        id: `${CONTEXT_MENU_GROUP_PREFIX}research`,
        parentId: CONTEXT_MENU_GROUPS_ID,
        title: 'Work » Research',
        contexts: ['page', 'link'],
      },
    ]);
  });

  it('does not expose deleted groups', () => {
    const deleted = { ...group('old', 'Old'), deleted: clock };
    expect(buildContextMenuEntries([deleted]).map((entry) => entry.id)).not.toContain(
      `${CONTEXT_MENU_GROUP_PREFIX}old`,
    );
  });

  it('keeps restored groups and omits empty group submenus', () => {
    expect(buildContextMenuEntries([]).map((entry) => entry.id)).not.toContain(
      CONTEXT_MENU_GROUPS_ID,
    );
    const restored = {
      ...group('restored', 'Restored'),
      deleted: createHLC(50, 0, 'test'),
    };
    expect(buildContextMenuEntries([restored]).map((entry) => entry.id)).toContain(
      `${CONTEXT_MENU_GROUP_PREFIX}restored`,
    );
  });
});
