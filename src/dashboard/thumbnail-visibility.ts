import { getViewportBufferPixels } from './viewport-buffer';

type VisibilityListener = (nearViewport: boolean) => void;

const listeners = new Map<Element, Set<VisibilityListener>>();
let observer: IntersectionObserver | undefined;
let observedHeight = 0;

function refreshViewport(): void {
  if (!observer || observedHeight === window.innerHeight) return;
  observer.disconnect();
  observer = undefined;
  const next = createObserver();
  for (const element of listeners.keys()) next.observe(element);
}

function createObserver(): IntersectionObserver {
  observedHeight = window.innerHeight;
  const margin = getViewportBufferPixels(observedHeight);
  const next = new IntersectionObserver(
    (entries) => {
      // Ignore entries queued by the observer replaced during a resize.
      if (observer !== next) return;
      for (const entry of entries) {
        const targetListeners = listeners.get(entry.target);
        if (!targetListeners) continue;
        for (const listener of targetListeners) listener(entry.isIntersecting);
      }
    },
    { rootMargin: `${margin}px 0px ${margin}px 0px` },
  );
  observer = next;
  return next;
}

function getObserver(): IntersectionObserver | undefined {
  if (observer) return observer;
  if (typeof IntersectionObserver === 'undefined') return undefined;
  window.addEventListener('resize', refreshViewport);
  return createObserver();
}

/** Keep cards and collections subscribed so leaving view releases their resources. */
export function observeNearViewport(
  element: Element,
  onVisible: VisibilityListener,
): () => void {
  const sharedObserver = getObserver();
  if (!sharedObserver) {
    onVisible(true);
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
      observer?.unobserve(element);
    }
    if (!listeners.size) {
      observer?.disconnect();
      observer = undefined;
      window.removeEventListener('resize', refreshViewport);
    }
  };
}
