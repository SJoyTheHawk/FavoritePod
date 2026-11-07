/** Keep layout updates out of ResizeObserver's pre-paint delivery cycle. */
export function observeElementResize(
  targets: readonly Element[],
  onResize: (entries: ResizeObserverEntry[]) => void,
): () => void {
  const pending = new Map<Element, ResizeObserverEntry>();
  let frame: number | undefined;
  let active = true;
  const observer = new ResizeObserver((entries) => {
    if (!active) return;
    for (const entry of entries) pending.set(entry.target, entry);
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      if (!active) return;
      const latest = [...pending.values()];
      pending.clear();
      onResize(latest);
    });
  });
  for (const target of targets) observer.observe(target);
  return () => {
    active = false;
    observer.disconnect();
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    pending.clear();
  };
}
