import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildSavePopupUrl,
  canCaptureSaveRequest,
  readPopupSaveRequest,
} from './popup-save-request';

const request = {
  url: 'https://example.com/a?q=one&x=two#part',
  title: 'Name & title?',
  sourceTabId: 5,
  sourceWindowId: 2,
  capturePage: true,
};
afterEach(() => vi.unstubAllGlobals());

describe('popup save requests', () => {
  it('round trips the clicked address and title without shared storage', () => {
    vi.stubGlobal('chrome', {
      runtime: { getURL: (path: string) => 'chrome-extension://test/' + path },
    });
    expect(readPopupSaveRequest(buildSavePopupUrl(request))).toEqual(request);
  });
  it('does not treat the normal toolbar popup or unsafe/malformed targets as save requests', () => {
    const base = 'chrome-extension://test/src/popup/popup.html';
    for (const query of [
      '',
      '?saveUrl=javascript:alert(1)&sourceTabId=1&sourceWindowId=2',
      '?saveUrl=https://example.com/',
      '?saveUrl=https://example.com/&sourceTabId=no&sourceWindowId=2',
      '?saveUrl=https://example.com/&sourceTabId=-1&sourceWindowId=2',
    ]) {
      expect(readPopupSaveRequest(base + query)).toBeUndefined();
    }
  });
  it('only captures the original page while it remains active in the source window', async () => {
    const get = vi
      .fn()
      .mockResolvedValue({ active: true, windowId: 2, url: request.url });
    vi.stubGlobal('chrome', { tabs: { get } });
    expect(await canCaptureSaveRequest(request)).toBe(true);
    expect(await canCaptureSaveRequest({ ...request, capturePage: false })).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
    for (const tab of [
      { active: false, windowId: 2, url: request.url },
      { active: true, windowId: 3, url: request.url },
      { active: true, windowId: 2, url: 'https://different.example/' },
    ]) {
      get.mockResolvedValueOnce(tab);
      expect(await canCaptureSaveRequest(request)).toBe(false);
    }
    get.mockRejectedValueOnce(new Error('Tab closed'));
    expect(await canCaptureSaveRequest(request)).toBe(false);
  });
});
