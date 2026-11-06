import { describe, expect, it } from 'vitest';
import { CONTEXT_MENU_ROOT_ID, buildContextMenuEntries } from './context-menu-items';

describe('context menu entries', () => {
  it('offers one direct save action for pages and links without submenus', () => {
    expect(buildContextMenuEntries()).toEqual([
      {
        id: CONTEXT_MENU_ROOT_ID,
        title: 'Save to FavoritePod',
        contexts: ['page', 'link'],
      },
    ]);
  });
});
