import { describe, expect, it } from 'vitest';
import { getFavoriteOrderRevision, getFavoriteReorderOffset } from './favorite-motion';

const layout = {
  left: 200,
  top: 100,
  width: 180,
  height: 160,
  layout: 'grid',
  size: 'medium',
  orderRevision: 'before',
  collectionRevision: 'same cards and groups',
  animateReorder: true,
  cancellationRevision: 0,
};
const reordered = { ...layout, left: 0, top: 200, orderRevision: 'after' };

describe('favorite visible order', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('tracks entering, moving, and leaving a cross-group placeholder', () => {
    const before = new Map([
      ['foreign', 0],
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ]);
    const after = new Map([
      ['a', 0],
      ['b', 1],
      ['foreign', 2],
      ['c', 3],
    ]);
    const original = getFavoriteOrderRevision(items, null);
    expect(getFavoriteOrderRevision(items, before)).toBe(original);
    expect(getFavoriteOrderRevision(items, after)).toBe(original);
    const entered = getFavoriteOrderRevision(items, before, 'foreign');
    const retargeted = getFavoriteOrderRevision(items, after, 'foreign');
    expect(entered).not.toBe(original);
    expect(retargeted).not.toBe(entered);
    expect(getFavoriteOrderRevision(items, after, 'foreign')).toBe(retargeted);
    expect(
      getFavoriteReorderOffset(layout, { ...reordered, orderRevision: entered }),
    ).toEqual({ x: 200, y: -100 });
    expect(
      getFavoriteReorderOffset(
        { ...layout, orderRevision: entered },
        { ...reordered, orderRevision: retargeted },
      ),
    ).toEqual({ x: 200, y: -100 });
    expect(
      getFavoriteReorderOffset(
        { ...layout, orderRevision: entered },
        { ...reordered, orderRevision: original },
      ),
    ).toEqual({ x: 200, y: -100 });
  });

  it('keeps the revision stable when a drag starts without moving cards', () => {
    expect(
      getFavoriteOrderRevision(
        items,
        new Map([
          ['a', 4],
          ['b', 5],
          ['c', 6],
        ]),
      ),
    ).toBe(getFavoriteOrderRevision(items, null));
  });

  it('keeps the preview revision when its visible order is committed', () => {
    const preview = getFavoriteOrderRevision(
      items,
      new Map([
        ['a', 2],
        ['b', 0],
        ['c', 1],
      ]),
    );
    expect(preview).not.toBe(getFavoriteOrderRevision(items, null));
    expect(preview).toBe(getFavoriteOrderRevision([items[1], items[2], items[0]], null));
  });
});

describe('favorite reorder motion', () => {
  it('restores cancelled drags immediately and allows the next reorder to animate', () => {
    const cancelled = { ...reordered, cancellationRevision: 1 };
    expect(getFavoriteReorderOffset(layout, cancelled)).toBeNull();
    expect(
      getFavoriteReorderOffset(cancelled, { ...layout, cancellationRevision: 1 }),
    ).toEqual({ x: -200, y: 100 });
  });

  it('animates a moved card when reordering the same collection', () => {
    expect(getFavoriteReorderOffset(layout, reordered)).toEqual({ x: 200, y: -100 });
  });

  it('does not animate neighbors when a favorite is added, removed, or regrouped', () => {
    for (const collectionRevision of ['added', 'removed', 'different group']) {
      expect(
        getFavoriteReorderOffset(layout, { ...reordered, collectionRevision }),
      ).toBeNull();
    }
  });

  it('honors motion suppression before or after a layout change', () => {
    expect(
      getFavoriteReorderOffset(layout, { ...reordered, animateReorder: false }),
    ).toBeNull();
    expect(
      getFavoriteReorderOffset({ ...layout, animateReorder: false }, reordered),
    ).toBeNull();
  });

  it.each([{ width: 200 }, { height: 180 }, { layout: 'list' }, { size: 'large' }])(
    'skips responsive and presentation changes: %j',
    (change) => {
      expect(getFavoriteReorderOffset(layout, { ...reordered, ...change })).toBeNull();
    },
  );

  it('ignores initial renders, ordinary rerenders, and stationary cards', () => {
    expect(getFavoriteReorderOffset(undefined, reordered)).toBeNull();
    expect(getFavoriteReorderOffset(layout, { ...layout, top: 150 })).toBeNull();
    expect(
      getFavoriteReorderOffset(layout, { ...layout, orderRevision: 'after' }),
    ).toBeNull();
  });
});
