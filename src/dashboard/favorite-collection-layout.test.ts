import { describe, expect, it } from 'vitest';
import {
  getFavoriteCollectionMetrics,
  getFavoriteNavigationGeometry,
} from './favorite-collection-layout';

describe('favorite collection layout', () => {
  it('fits the existing grid card widths at desktop and mobile sizes', () => {
    expect(getFavoriteCollectionMetrics(1120, 'grid', 'medium', false).columns).toBe(5);
    expect(getFavoriteCollectionMetrics(350, 'grid', 'medium', false).columns).toBe(1);
    expect(getFavoriteCollectionMetrics(1120, 'grid', 'compact', false).columns).toBe(10);
  });

  it('uses one row per favorite for list layouts and reserves group labels', () => {
    const list = getFavoriteCollectionMetrics(900, 'list', 'small', true);
    expect(list.columns).toBe(1);
    expect(list.rowHeight).toBe(94);
  });

  it('maps logical row positions to the same visual columns used by arrow navigation', () => {
    const metrics = getFavoriteCollectionMetrics(640, 'grid', 'medium', false);
    const geometry = getFavoriteNavigationGeometry(5, metrics, {
      left: 20,
      top: 100,
      width: 640,
    });
    expect(metrics.columns).toBe(3);
    expect(geometry[0]).toEqual({ left: 20, top: 100, width: expect.any(Number) });
    expect(geometry[1].left).toBeCloseTo(238.67, 1);
    expect(geometry[2].left).toBeCloseTo(457.33, 1);
    expect(geometry[3].top).toBeCloseTo(311.42, 1);
    expect(geometry[4].top).toBeCloseTo(311.42, 1);
  });
});
