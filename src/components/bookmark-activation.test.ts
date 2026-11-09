import type { MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { bookmarkActivationHandlers } from './bookmark-activation';

function mouseEvent(button: number, shiftKey = false): MouseEvent<HTMLButtonElement> {
  return {
    button,
    shiftKey,
    preventDefault: vi.fn(),
  } as unknown as MouseEvent<HTMLButtonElement>;
}

describe('bookmark activation', () => {
  it('opens left clicks and keyboard activation in a foreground tab', () => {
    const open = vi.fn();
    bookmarkActivationHandlers(open).onClick(mouseEvent(0));
    expect(open).toHaveBeenCalledExactlyOnceWith(false);
  });

  it('suppresses autoscroll and opens a middle click exactly once in the background', () => {
    const open = vi.fn();
    const handlers = bookmarkActivationHandlers(open);
    const event = mouseEvent(1);
    handlers.onMouseDown(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
    handlers.onAuxClick(event);
    expect(open).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('supports shift-middle-click in the foreground and leaves right clicks alone', () => {
    const open = vi.fn();
    const handlers = bookmarkActivationHandlers(open);
    handlers.onAuxClick(mouseEvent(1, true));
    expect(open).toHaveBeenCalledExactlyOnceWith(false);
    const right = mouseEvent(2);
    handlers.onMouseDown(right);
    handlers.onAuxClick(right);
    expect(right.preventDefault).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
  });
});
