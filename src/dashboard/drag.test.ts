import { describe, expect, it } from 'vitest';
import type { Group } from '../core/types';
import {
  getGroupDropPlacement,
  getItemDropPlacement,
  getItemDropTarget,
  previewItemOrder,
  resolveGroupDrop,
  resolveItemDropDestination,
} from './drag';

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

describe('favorite drop destinations', () => {
  it.each(['grid', 'list'] as const)(
    'keeps a stationary pointer stable after a stack swap in %s',
    (layout) => {
      const slot = (index: number) => ({
        id: 'neighbor',
        left: layout === 'grid' ? index * 112 : 0,
        top: layout === 'list' ? index * 72 : 0,
        width: 100,
        height: 60,
      });
      const x = layout === 'grid' ? 190 : 50;
      const y = layout === 'list' ? 120 : 30;
      const target = getItemDropTarget(x, y, [slot(1)], layout);
      expect(target).toEqual({ targetId: 'neighbor', placement: 'after' });
      expect(
        previewItemOrder(
          ['a', 'b', 'neighbor'],
          'a',
          target!.targetId,
          target!.placement,
          ['a', 'b'],
        ),
      ).toEqual(['neighbor', 'a', 'b']);
      // After swapping, the pointer is over the placeholder, even while the
      // neighbor's visual animation crosses it. Do not reverse the destination.
      for (let frame = 0; frame < 20; frame++) {
        expect(getItemDropTarget(x, y, [slot(0)], layout)).toBeNull();
      }
      expect(getItemDropTarget(10, 10, [slot(0)], layout)).toEqual({
        targetId: 'neighbor',
        placement: 'before',
      });
    },
  );

  it('ignores grid gaps and targets the correct row', () => {
    const slots = [
      { id: 'top', left: 0, top: 0, width: 100, height: 60 },
      { id: 'bottom', left: 0, top: 72, width: 100, height: 60 },
    ];
    expect(getItemDropTarget(50, 65, slots, 'grid')).toBeNull();
    expect(getItemDropTarget(20, 90, slots, 'grid')).toEqual({
      targetId: 'bottom',
      placement: 'before',
    });
    expect(getItemDropTarget(80, 90, slots, 'grid')).toEqual({
      targetId: 'bottom',
      placement: 'after',
    });
  });
  it('gathers seven nonadjacent selections in visual order and ignores selected targets', () => {
    const ids = Array.from({ length: 10 }, (_, index) => String(index));
    const selected = ['0', '2', '3', '5', '6', '7', '9'];
    expect(previewItemOrder(ids, '5', '8', 'after', selected)).toEqual([
      '1',
      '4',
      '8',
      ...selected,
    ]);
    expect(previewItemOrder(ids, '5', '1', 'before', selected)).toEqual([
      ...selected,
      '1',
      '4',
      '8',
    ]);
    expect(previewItemOrder(ids, '5', '3', 'after', selected)).toBeNull();
    expect(ids).toEqual(Array.from({ length: 10 }, (_, index) => String(index)));
  });

  it('skips the entire selection when resolving the insertion neighbor', () => {
    const items = ['a', 'b', 'c', 'd'].map((id, index) => ({
      id,
      groupId: 'g',
      orderKey: `a${index}`,
    }));
    expect(resolveItemDropDestination(items, 'b', 'a', 'after', ['b', 'c'])).toEqual({
      groupId: 'g',
      beforeItemId: 'd',
    });
    expect(resolveItemDropDestination(items, 'b', 'd', 'after', ['b', 'c'])).toEqual({
      groupId: 'g',
      beforeItemId: undefined,
    });
  });
  const items = [
    { id: 'a', groupId: 'Work', orderKey: 'a0' },
    { id: 'b', groupId: 'Work', orderKey: 'a1' },
    { id: 'c', groupId: 'Work', orderKey: 'a2' },
    { id: 'd', groupId: 'Personal', orderKey: 'a0' },
  ];

  it('uses the horizontal midpoint for grid cards and vertical midpoint for list rows', () => {
    const rect = { left: 10, top: 20, width: 100, height: 60 };
    expect(getItemDropPlacement(40, 70, rect, 'grid')).toBe('before');
    expect(getItemDropPlacement(80, 20, rect, 'grid')).toBe('after');
    expect(getItemDropPlacement(10, 35, rect, 'list')).toBe('before');
    expect(getItemDropPlacement(110, 65, rect, 'list')).toBe('after');
  });

  it('previews insertion before and after the hovered favorite', () => {
    expect(previewItemOrder(['a', 'b', 'c'], 'a', 'c', 'before')).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(previewItemOrder(['a', 'b', 'c'], 'a', 'b', 'after')).toEqual(['b', 'a', 'c']);
    expect(previewItemOrder(['a', 'b'], 'a', 'a', 'after')).toBeNull();
  });

  it('resolves after the last sibling to an append destination', () => {
    expect(resolveItemDropDestination(items, 'a', 'c', 'after')).toEqual({
      groupId: 'Work',
      beforeItemId: undefined,
    });
  });

  it('resolves before and after positions within the target group', () => {
    expect(resolveItemDropDestination(items, 'd', 'b', 'before')).toEqual({
      groupId: 'Work',
      beforeItemId: 'b',
    });
    expect(resolveItemDropDestination(items, 'd', 'a', 'after')).toEqual({
      groupId: 'Work',
      beforeItemId: 'b',
    });
  });

  it.each([
    ['a', 'c', 'after', ['b', 'c', 'a']],
    ['c', 'a', 'before', ['c', 'a', 'b']],
    ['a', 'c', 'before', ['b', 'a', 'c']],
    ['c', 'a', 'after', ['a', 'c', 'b']],
  ] as const)(
    'persists the preview for %s moved %s (%s), including an empty-slot drop',
    (draggedId, targetId, placement, expected) => {
      const siblings = items.filter((item) => item.groupId === 'Work');
      const preview = previewItemOrder(
        siblings.map((item) => item.id),
        draggedId,
        targetId,
        placement,
      );
      // The panel caches this destination on hover and commits it without
      // requiring a tile under the pointer at release.
      const destination = resolveItemDropDestination(
        items,
        draggedId,
        targetId,
        placement,
      );
      expect(destination).not.toBeNull();
      const persisted = siblings.map((item) => item.id).filter((id) => id !== draggedId);
      const index = destination?.beforeItemId
        ? persisted.indexOf(destination.beforeItemId)
        : persisted.length;
      persisted.splice(index, 0, draggedId);
      expect(preview).toEqual(expected);
      expect(persisted).toEqual(preview);
    },
  );
});
