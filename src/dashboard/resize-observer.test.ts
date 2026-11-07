import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeElementResize } from './resize-observer';

let deliver: (entries: ResizeObserverEntry[]) => void;
let nextFrame: FrameRequestCallback;
const observe = vi.fn();
const disconnect = vi.fn();
const requestFrame = vi.fn((callback: FrameRequestCallback) => {
  nextFrame = callback;
  return 0;
});
const cancelFrame = vi.fn();
const entry = (target: Element, height: number) =>
  ({ target, contentRect: { height } }) as ResizeObserverEntry;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('window', {
    requestAnimationFrame: requestFrame,
    cancelAnimationFrame: cancelFrame,
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: typeof deliver) {
        deliver = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
});

afterEach(() => vi.unstubAllGlobals());

describe('frame-scheduled resize observation', () => {
  it('defers layout work and batches the latest size for every target', () => {
    const first = {} as Element;
    const second = {} as Element;
    const onResize = vi.fn();
    const stop = observeElementResize([first, second], onResize);
    expect(observe.mock.calls).toEqual([[first], [second]]);
    deliver([entry(first, 100), entry(second, 200)]);
    const latest = entry(first, 120);
    deliver([latest]);
    expect(onResize).not.toHaveBeenCalled();
    expect(requestFrame).toHaveBeenCalledOnce();
    nextFrame(0);
    expect(onResize).toHaveBeenCalledWith([latest, entry(second, 200)]);
    deliver([entry(second, 240)]);
    expect(requestFrame).toHaveBeenCalledTimes(2);
    nextFrame(16);
    expect(onResize).toHaveBeenLastCalledWith([entry(second, 240)]);
    stop();
  });

  it('cancels queued work and ignores late notifications after cleanup', () => {
    const target = {} as Element;
    const onResize = vi.fn();
    const stop = observeElementResize([target], onResize);
    deliver([entry(target, 100)]);
    stop();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(cancelFrame).toHaveBeenCalledWith(0);
    nextFrame(0);
    deliver([entry(target, 200)]);
    expect(onResize).not.toHaveBeenCalled();
    expect(requestFrame).toHaveBeenCalledOnce();
  });
});
