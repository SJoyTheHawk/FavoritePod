import { describe, expect, it } from 'vitest';
import { keyBetween, keysBetween, nextOrderKey } from '../ordering';

describe('fractional ordering', () => {
  it('creates keys before, between, and after existing keys', () => {
    const first = keyBetween(null, null);
    const last = keyBetween(first, null);
    const middle = keyBetween(first, last);

    expect(first < middle && middle < last).toBe(true);
    expect(keyBetween(null, first) < first).toBe(true);
    expect(keyBetween(last, null) > last).toBe(true);
  });

  it('generates a batch of increasing keys and appends after the last key', () => {
    const keys = keysBetween(null, null, 4);
    expect(keys).toHaveLength(4);
    expect([...keys].sort()).toEqual(keys);
    expect(nextOrderKey(keys) > keys.at(-1)!).toBe(true);
  });
});
