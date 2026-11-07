/** Initial tuning value: half the window scroll viewport above and below. */
export const VIEWPORT_BUFFER_FRACTION = 0.5;

export function getViewportBufferPixels(viewportHeight: number): number {
  return Math.max(0, viewportHeight) * VIEWPORT_BUFFER_FRACTION;
}

/** Round outward to whole rows so rendering covers the image-loading buffer. */
export function getViewportOverscanRows(
  viewportHeight: number,
  rowHeight: number,
): number {
  return rowHeight > 0
    ? Math.ceil(getViewportBufferPixels(viewportHeight) / rowHeight)
    : 0;
}
