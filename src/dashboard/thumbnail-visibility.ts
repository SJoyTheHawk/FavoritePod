type VisibilityListener = () => void;

const listeners = new Map<Element, Set<VisibilityListener>>();
let observer: IntersectionObserver | undefined;

function getObserver(): IntersectionObserver | undefined {
  if (observer) return observer;
  if (typeof IntersectionObserver === 'undefined') return undefined;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const targetListeners = listeners.get(entry.target);
        if (!targetListeners) continue;
        listeners.delete(entry.target);
        observer?.unobserve(entry.target);
        for (const listener of targetListeners) listener();
      }
    },
    { rootMargin: '240px' },
  );
  return observer;
}

export function observeThumbnailTarget(
  element: Element,
  onVisible: VisibilityListener,
): () => void {
  const sharedObserver = getObserver();
  if (!sharedObserver) {
    onVisible();
    return () => undefined;
  }
  let targetListeners = listeners.get(element);
  if (!targetListeners) {
    targetListeners = new Set();
    listeners.set(element, targetListeners);
    sharedObserver.observe(element);
  }
  targetListeners.add(onVisible);
  return () => {
    const activeListeners = listeners.get(element);
    activeListeners?.delete(onVisible);
    if (!activeListeners?.size) {
      listeners.delete(element);
      sharedObserver.unobserve(element);
    }
  };
}
