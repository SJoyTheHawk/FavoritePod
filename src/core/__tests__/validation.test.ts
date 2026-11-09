import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDefaultTitle,
  getUrlLabel,
  isHiddenOnThisPlatform,
  isMobilePlatform,
  isValidUrl,
  parseSafeUrl,
} from '../validation';

afterEach(() => vi.unstubAllGlobals());

describe('supported bookmark protocols', () => {
  it.each([
    'https://example.com',
    'http://example.com',
    'file:///tmp/tool.html',
    'chrome://settings',
    'chrome://extensions/',
    'chrome://settings/privacy',
    'chrome-extension://abcdefghijklmnop/options.html',
    'ftp://archive.example/file',
    'mailto:alex@example.com',
    'tel:+1234',
    'sms:+1234',
  ])('accepts %s', (url) => {
    expect(isValidUrl(url)).toBe(true);
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,x',
    'about:blank',
    'https://',
    'chrome:',
    'chrome:settings',
    'chrome://',
    'chrome:///settings',
    'chrome-extension://',
    'chrome://user:password@settings',
    'chrome://settings:80',
    'mailto:',
    'tel:',
    'sms:',
    'not a url',
  ])('rejects %s', (url) => {
    expect(parseSafeUrl(url)).toBeNull();
  });
  it.each([
    ['chrome://settings/privacy', 'Chrome shortcut', 'Settings'],
    ['chrome://extensions/', 'Chrome shortcut', 'Extensions'],
    [
      'chrome-extension://abcdefghijklmnop/options.html',
      'Chrome extension',
      'options.html',
    ],
    ['chrome-extension://abcdefghijklmnop/', 'Chrome extension', 'Chrome extension'],
    ['mailto:alex@example.com', 'Email', 'alex@example.com'],
    ['tel:+1234', 'Phone', '+1234'],
    ['sms:+1234', 'SMS', '+1234'],
    ['ftp://archive.example/file', 'FTP (legacy)', 'archive.example'],
    ['https://example.com/path', 'example.com', 'example.com'],
    ['file:///tmp/my%20tool.html', 'Local file', 'my tool.html'],
  ])('labels %s', (url, label, title) => {
    expect(getUrlLabel(url)).toBe(label);
    expect(getDefaultTitle(url)).toBe(title);
  });
  it('uses the hostname rather than the path for Chrome shortcut titles', () => {
    const parsed = parseSafeUrl('chrome://settings');
    expect(parsed?.hostname).toBe('settings');
    expect(parsed?.pathname).toBe('');
    expect(getDefaultTitle('chrome://settings')).toBe('Settings');
  });
  it.each([
    ['https://example.com', false, false],
    ['file:///tmp/tool', false, false],
    ['chrome://settings', false, false],
    ['ftp://archive.example', true, true],
    ['mailto:alex@example.com', false, true],
    ['tel:+1234', true, false],
    ['sms:+1234', true, false],
    ['javascript:alert(1)', false, false],
  ])('uses platform visibility rules for %s', (url, desktop, mobile) => {
    expect(isHiddenOnThisPlatform(url, false)).toBe(desktop);
    expect(isHiddenOnThisPlatform(url, true)).toBe(mobile);
  });
  it('detects the platform independently of window width', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Desktop Chrome',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    });
    vi.stubGlobal('window', { innerWidth: 400 });
    expect(isMobilePlatform()).toBe(false);
    expect(isHiddenOnThisPlatform('tel:+1234')).toBe(true);
    vi.stubGlobal('navigator', { userAgent: 'Android Mobile' });
    expect(isMobilePlatform()).toBe(true);
    expect(isHiddenOnThisPlatform('tel:+1234')).toBe(false);
  });
});
