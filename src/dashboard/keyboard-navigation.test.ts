import { describe, expect, it } from 'vitest';
import { getNavigationTarget } from './keyboard-navigation';

const grid = [
  { left: 0, top: 0, width: 100 },
  { left: 120, top: 0, width: 100 },
  { left: 240, top: 0, width: 100 },
  { left: 0, top: 100, width: 100 },
  { left: 120, top: 100, width: 100 },
];

describe('favorite keyboard navigation', () => {
  it('follows adjacent favorites and stops at collection boundaries', () => {
    expect(getNavigationTarget(grid, 0, 'ArrowRight')).toBe(1);
    expect(getNavigationTarget(grid, 3, 'ArrowLeft')).toBe(2);
    expect(getNavigationTarget(grid, 0, 'ArrowLeft')).toBeUndefined();
    expect(getNavigationTarget(grid, 4, 'ArrowRight')).toBeUndefined();
    expect(getNavigationTarget(grid, 3, 'Home')).toBe(0);
    expect(getNavigationTarget(grid, 1, 'End')).toBe(4);
  });

  it('uses the nearest column in adjacent rows, including incomplete rows', () => {
    expect(getNavigationTarget(grid, 1, 'ArrowDown')).toBe(4);
    expect(getNavigationTarget(grid, 4, 'ArrowUp')).toBe(1);
    expect(getNavigationTarget(grid, 2, 'ArrowDown')).toBe(4);
    expect(getNavigationTarget(grid, 0, 'ArrowUp')).toBeUndefined();
    expect(getNavigationTarget(grid, 4, 'ArrowDown')).toBeUndefined();
  });

  it('crosses group spacing and follows a one-column list', () => {
    const list = [0, 90, 300].map((top) => ({ left: 0, top, width: 600 }));
    expect(getNavigationTarget(list, 1, 'ArrowDown')).toBe(2);
    expect(getNavigationTarget(list, 2, 'ArrowUp')).toBe(1);
  });

  it('ignores other keys and empty collections', () => {
    expect(getNavigationTarget(grid, 0, 'Enter')).toBeUndefined();
    expect(getNavigationTarget([], 0, 'End')).toBeUndefined();
  });
});
