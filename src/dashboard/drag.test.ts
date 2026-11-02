import { describe, expect, it } from 'vitest';
import type { Group } from '../core/types';
import { getGroupDropPlacement, resolveGroupDrop } from './drag';

function group(id: string, parentId: string | null, orderKey: string): Group {
  return {
    id,
    parentId,
    orderKey,
    title: id,
    clock: { parentId: '', orderKey: '', title: '' },
  };
}
const groups = [
  group('Work', null, 'a0'),
  group('123', 'Work', 'a0'),
  group('Favorites', null, 'a1'),
  group('Existing', 'Favorites', 'a0'),
  group('Last', null, 'a2'),
];

describe('tree drop destinations', () => {
  it('uses the row body for nesting and narrow edges for sibling insertion', () => {
    expect(getGroupDropPlacement(102, 100, 40)).toBe('before');
    expect(getGroupDropPlacement(120, 100, 40)).toBe('inside');
    expect(getGroupDropPlacement(138, 100, 40)).toBe('after');
  });
  it('appends Work inside Favorites while edge drops retain the root level', () => {
    expect(resolveGroupDrop(groups, 'Work', 'Favorites', 'inside')).toEqual({
      parentId: 'Favorites',
    });
    expect(resolveGroupDrop(groups, 'Work', 'Favorites', 'before')).toEqual({
      parentId: null,
      beforeId: 'Favorites',
    });
    expect(resolveGroupDrop(groups, 'Work', 'Favorites', 'after')).toEqual({
      parentId: null,
      beforeId: 'Last',
    });
  });
  it('uses the target subgroup level on edges and permits moving back to root', () => {
    expect(resolveGroupDrop(groups, '123', 'Existing', 'after')).toEqual({
      parentId: 'Favorites',
      beforeId: undefined,
    });
    expect(resolveGroupDrop(groups, '123', 'Last', 'after')).toEqual({
      parentId: null,
      beforeId: undefined,
    });
  });
  it('rejects self and descendant destinations and excludes the dragged sibling', () => {
    for (const placement of ['before', 'inside', 'after'] as const) {
      expect(resolveGroupDrop(groups, 'Work', 'Work', placement)).toBeNull();
      expect(resolveGroupDrop(groups, 'Work', '123', placement)).toBeNull();
    }
    expect(resolveGroupDrop(groups, 'Last', 'Favorites', 'after')).toEqual({
      parentId: null,
      beforeId: undefined,
    });
  });
});
