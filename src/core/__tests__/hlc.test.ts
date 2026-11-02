import { describe, expect, it } from 'vitest';
import { compareHLC, createHLC, receiveHLC, tickHLC } from '../hlc';

describe('hybrid logical clocks', () => {
  it('keeps local edits monotonic when the system clock moves backwards', () => {
    const initial = createHLC(1_700_000_000_000, 4, 'device-a');
    const next = tickHLC(initial, 'device-a', 1_600_000_000_000);

    expect(compareHLC(next, initial)).toBeGreaterThan(0);
  });

  it('advances beyond a received future clock', () => {
    const local = createHLC(1_700_000_000_000, 2, 'device-a');
    const remote = createHLC(1_700_000_010_000, 9, 'device-b');
    const merged = receiveHLC(local, remote, 'device-a', 1_700_000_000_000);

    expect(compareHLC(merged, remote)).toBeGreaterThan(0);
  });

  it('orders equal wall times and counters by device ID', () => {
    expect(compareHLC(createHLC(10, 0, 'a'), createHLC(10, 0, 'b'))).toBeLessThan(0);
  });
});
