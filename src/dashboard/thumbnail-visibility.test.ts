import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.stubGlobal('window', Object.assign(new EventTarget(), { innerHeight: 800 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('shared viewport observation', () => {
  it('reports entering and leaving view without retaining unsubscribed targets', async () => {
    let deliver!: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;
    const observe = vi.fn(),
      unobserve = vi.fn();
    const constructor = vi.fn();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: typeof deliver, options: IntersectionObserverInit) {
          deliver = callback;
          constructor(options);
        }
        observe = observe;
        unobserve = unobserve;
        disconnect = vi.fn();
      },
    );
    const { observeNearViewport } = await import('./thumbnail-visibility');
    const target = {} as Element,
      other = {} as Element;
    const first = vi.fn(),
      second = vi.fn(),
      third = vi.fn();
    const stopFirst = observeNearViewport(target, first);
    const stopSecond = observeNearViewport(target, second);
    const stopThird = observeNearViewport(other, third);
    expect(constructor).toHaveBeenCalledOnce();
    expect(constructor).toHaveBeenCalledWith({ rootMargin: '400px 0px 400px 0px' });
    expect(observe).toHaveBeenCalledTimes(2);
    deliver([
      { target, isIntersecting: true },
      { target, isIntersecting: false },
    ]);
    expect(first.mock.calls).toEqual([[true], [false]]);
    expect(second.mock.calls).toEqual([[true], [false]]);
    stopFirst();
    expect(unobserve).not.toHaveBeenCalledWith(target);
    stopSecond();
    expect(unobserve).toHaveBeenCalledWith(target);
    deliver([{ target, isIntersecting: true }]);
    expect(second).toHaveBeenCalledTimes(2);
    stopThird();
    expect(unobserve).toHaveBeenCalledWith(other);
  });

  it('reobserves targets on height changes and cleans up the replacement observer', async () => {
    const instances: Array<{
      deliver: (entries: Array<{ target: Element; isIntersecting: boolean }>) => void;
      options: IntersectionObserverInit;
      observe: ReturnType<typeof vi.fn>;
      unobserve: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
        constructor(
          public deliver: (
            entries: Array<{ target: Element; isIntersecting: boolean }>,
          ) => void,
          public options: IntersectionObserverInit,
        ) {
          instances.push(this);
        }
      },
    );
    const { observeNearViewport } = await import('./thumbnail-visibility');
    const target = {} as Element;
    const onVisible = vi.fn();
    const stop = observeNearViewport(target, onVisible);
    window.innerHeight = 1200;
    window.dispatchEvent(new Event('resize'));
    expect(instances).toHaveLength(2);
    expect(instances[0].disconnect).toHaveBeenCalledOnce();
    expect(instances[1].options.rootMargin).toBe('600px 0px 600px 0px');
    expect(instances[1].observe).toHaveBeenCalledWith(target);
    instances[0].deliver([{ target, isIntersecting: false }]);
    expect(onVisible).not.toHaveBeenCalled();
    instances[1].deliver([{ target, isIntersecting: true }]);
    expect(onVisible).toHaveBeenCalledWith(true);
    window.dispatchEvent(new Event('resize'));
    expect(instances).toHaveLength(2);
    stop();
    expect(instances[1].unobserve).toHaveBeenCalledWith(target);
    expect(instances[1].disconnect).toHaveBeenCalledOnce();
    window.innerHeight = 600;
    window.dispatchEvent(new Event('resize'));
    expect(instances).toHaveLength(2);
  });
});
