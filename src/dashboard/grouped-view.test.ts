import { describe, expect, it } from 'vitest';
import type { Group, Item } from '../core/types';
import { getItemsByGroupAndDescendants, getGroupedFavoriteView } from './grouped-view';

const groups: Group[] = [
  {
    id: 'work',
    parentId: null,
    orderKey: 'a',
    title: 'Work',
    clock: {} as Group['clock'],
  },
  {
    id: 'docs',
    parentId: 'work',
    orderKey: 'a',
    title: 'Documentation',
    clock: {} as Group['clock'],
  },
  {
    id: 'deep',
    parentId: 'docs',
    orderKey: 'a',
    title: 'Reference',
    clock: {} as Group['clock'],
  },
  {
    id: 'personal',
    parentId: null,
    orderKey: 'b',
    title: 'Personal',
    clock: {} as Group['clock'],
  },
];

const items: Item[] = [
  {
    id: 'z',
    groupId: 'docs',
    orderKey: 'b',
    title: 'Z',
    url: 'https://z.test',
    clock: {} as Item['clock'],
  },
  {
    id: 'a',
    groupId: 'deep',
    orderKey: 'a',
    title: 'A',
    url: 'https://a.test',
    clock: {} as Item['clock'],
  },
  {
    id: 'b',
    groupId: 'docs',
    orderKey: 'a',
    title: 'B',
    url: 'https://b.test',
    clock: {} as Item['clock'],
  },
];

describe('grouped favorite views', () => {
  it('keeps empty top-level groups in hierarchical mode', () => {
    const view = getGroupedFavoriteView(groups, items, null, 'hierarchical');
    expect(view.mode).toBe('hierarchical');
    if (view.mode !== 'hierarchical') throw new Error('Expected a hierarchical view.');
    expect(view.groups.map((group) => group.id)).toEqual(['work', 'personal']);
  });

  it('shows direct parent items and immediate children in hierarchy mode', () => {
    const parentItems = [
      ...items,
      {
        id: 'direct',
        groupId: 'work',
        orderKey: 'a',
        title: 'Direct',
        url: 'https://direct.test',
        clock: {} as Item['clock'],
      },
    ];
    const view = getGroupedFavoriteView(groups, parentItems, 'work', 'hierarchical');
    expect(view.mode).toBe('hierarchical');
    if (view.mode !== 'hierarchical') throw new Error('Expected a hierarchical view.');
    expect(view.groups.map((group) => group.id)).toEqual(['docs']);
    expect(view.directItems.map((item) => item.id)).toEqual(['direct']);
  });

  it('sorts labeled items by group path and then order key', () => {
    const view = getGroupedFavoriteView(groups, items, null, 'labeled');
    expect(view.mode).toBe('labeled');
    if (view.mode !== 'labeled') throw new Error('Expected a labeled view.');
    expect(view.items.map((item) => item.id)).toEqual(['b', 'z', 'a']);
  });

  it('keeps leaf group views flat regardless of the preference', () => {
    const leafItems = items.filter((item) => item.groupId === 'deep');
    const view = getGroupedFavoriteView(groups, leafItems, 'deep', 'hierarchical');
    expect(view).toEqual({ mode: 'flat', items: leafItems });
  });

  it('counts each item for its group and all ancestors', () => {
    const byGroup = getItemsByGroupAndDescendants(groups, items);
    expect(byGroup.get('deep')?.map((item) => item.id)).toEqual(['a']);
    expect(byGroup.get('docs')?.map((item) => item.id)).toEqual(['z', 'a', 'b']);
    expect(byGroup.get('work')?.map((item) => item.id)).toEqual(['z', 'a', 'b']);
    expect(byGroup.get('personal')).toEqual([]);
  });
});
