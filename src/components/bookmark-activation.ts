import type { MouseEventHandler } from 'react';

/** Match browser link behavior on bookmark buttons, including background tabs. */
export function bookmarkActivationHandlers(onOpen: (background: boolean) => void): {
  onClick: MouseEventHandler<HTMLButtonElement>;
  onAuxClick: MouseEventHandler<HTMLButtonElement>;
  onMouseDown: MouseEventHandler<HTMLButtonElement>;
} {
  return {
    onClick: () => onOpen(false),
    onAuxClick: (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      onOpen(!event.shiftKey);
    },
    onMouseDown: (event) => {
      // Suppress native autoscroll; opening happens once, on auxclick.
      if (event.button === 1) event.preventDefault();
    },
  };
}
