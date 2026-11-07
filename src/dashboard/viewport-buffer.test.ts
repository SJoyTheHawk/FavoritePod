import { describe, expect, it } from 'vitest';
import { getViewportBufferPixels, getViewportOverscanRows } from './viewport-buffer';

describe('half-viewport resource buffer', () => {
  it('scales with viewport height instead of screen width or a fixed pixel margin', () => {
    expect(getViewportBufferPixels(800)).toBe(400);
    expect(getViewportBufferPixels(1200)).toBe(600);
    expect(getViewportBufferPixels(600)).toBe(300);
  });

  it('covers the image buffer with whole rows across grid and list sizes', () => {
    expect(getViewportOverscanRows(800, 240)).toBe(2);
    expect(getViewportOverscanRows(800, 80)).toBe(5);
    expect(getViewportOverscanRows(1200, 240)).toBe(3);
    expect(getViewportOverscanRows(800, 0)).toBe(0);
  });
});
