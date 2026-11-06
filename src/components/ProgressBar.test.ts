import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('sync progress accessibility', () => {
  it('reports actual progress and constrains values to the reported total', () => {
    const render = (current: number) =>
      renderToStaticMarkup(
        createElement(ProgressBar, { label: 'Sync progress', total: 10, current }),
      );
    expect(render(3)).toContain('aria-valuenow="3"');
    expect(render(3)).toContain('width:30%');
    expect(render(14)).toContain('aria-valuenow="10"');
    expect(render(-2)).toContain('aria-valuenow="0"');
  });

  it.each([undefined, 0, -1, Infinity, NaN])(
    'leaves unknown or invalid totals (%s) indeterminate',
    (total) => {
      const markup = renderToStaticMarkup(
        createElement(ProgressBar, { label: 'Sync progress', current: 0, total }),
      );
      expect(markup).toContain('role="progressbar"');
      expect(markup).not.toContain('aria-valuenow');
      expect(markup).not.toContain('aria-valuemax');
    },
  );

  it('does not claim zero progress when the current count is unknown', () => {
    const markup = renderToStaticMarkup(
      createElement(ProgressBar, { label: 'Sync progress', total: 10 }),
    );
    expect(markup).not.toContain('aria-valuenow');
  });
});
