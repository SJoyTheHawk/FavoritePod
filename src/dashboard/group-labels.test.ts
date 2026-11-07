import { describe, expect, it } from 'vitest';
import type { Group } from '../core/types';
import { getGroupsInTreeOrder } from './group-labels';

const makeGroup = (
  id: string,
  title: string,
  parentId: string | null,
  orderKey: string,
): Group => ({
  id,
  title,
  parentId,
  orderKey,
  clock: {} as Group['clock'],
});

describe('favorite group ordering', () => {
  it('orders parent groups before their children in sidebar order', () => {
    const groups = [
      makeGroup('work-child', '123', 'work', 'a'),
      makeGroup('work', 'Work', null, 'b'),
      makeGroup('favorites', 'Favorites', null, 'a'),
      makeGroup('other', 'Other', null, 'c'),
    ];

    expect(getGroupsInTreeOrder(groups).map((group) => group.id)).toEqual([
      'favorites',
      'work',
      'work-child',
      'other',
    ]);
  });
});
