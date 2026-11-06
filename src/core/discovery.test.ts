import { describe, expect, it } from 'vitest';
import { buildVisitedSiteSuggestions, normalizeVisitedSiteUrl } from './discovery';

describe('Chrome top-sites shortcuts', () => {
  it('canonicalizes safe web URLs and ignores fragments', () => {
    expect(normalizeVisitedSiteUrl('https://Example.com/path#section')).toBe(
      'https://example.com/path',
    );
    for (const url of [
      'file:///Users/me/index.html',
      'javascript:alert(1)',
      'chrome://settings',
      'data:text/plain,hello',
      'not a URL',
    ]) {
      expect(normalizeVisitedSiteUrl(url)).toBeUndefined();
    }
  });

  it('preserves Chrome order, including saved sites, without filling a short list', () => {
    const sites = [
      { url: 'https://z.example/', title: 'Z first' },
      { url: 'https://saved.example/', title: 'Already saved' },
      { url: 'https://a.example/', title: 'A last' },
    ];
    expect(buildVisitedSiteSuggestions(sites, [])).toEqual(sites);
    expect(buildVisitedSiteSuggestions([], [])).toEqual([]);
  });

  it('filters hidden URLs and duplicate fragments while retaining the first source title', () => {
    expect(
      buildVisitedSiteSuggestions(
        [
          { url: 'https://first.example/#top', title: 'First' },
          { url: 'https://hidden.example/', title: 'Hidden' },
          { url: 'https://first.example/#duplicate', title: 'Duplicate' },
          { url: 'https://last.example/', title: 'Last' },
        ],
        ['https://hidden.example/#section'],
      ),
    ).toEqual([
      { url: 'https://first.example/', title: 'First' },
      { url: 'https://last.example/', title: 'Last' },
    ]);
  });

  it('does not invent domain grouping or strip query parameters from Chrome entries', () => {
    const sites = [
      { url: 'https://same.example/page?q=2', title: 'Second search' },
      { url: 'https://same.example/another', title: 'Another page' },
      { url: 'https://same.example/page?q=1', title: 'First search' },
    ];
    expect(buildVisitedSiteSuggestions(sites, [])).toEqual(sites);
  });

  it('uses a hostname only when Chrome supplies a blank title', () => {
    expect(
      buildVisitedSiteSuggestions(
        [
          { url: 'https://blank.example/', title: ' ' },
          { url: 'https://titled.example/', title: ' Chrome title ' },
        ],
        [],
      ),
    ).toEqual([
      { url: 'https://blank.example/', title: 'blank.example' },
      { url: 'https://titled.example/', title: 'Chrome title' },
    ]);
  });

  it('applies the cap after safety and hidden filtering, using only source entries', () => {
    const source = Array.from({ length: 12 }, (_, index) => ({
      url: 'https://site' + index + '.example/',
      title: 'Site ' + index,
    }));
    const sites = [{ url: 'javascript:alert(1)', title: 'Unsafe' }, ...source];
    expect(buildVisitedSiteSuggestions(sites, [source[0].url])).toEqual(
      source.slice(1, 11),
    );
    expect(buildVisitedSiteSuggestions(sites, [], 2)).toEqual(source.slice(0, 2));
    expect(buildVisitedSiteSuggestions(sites, [], 0)).toEqual([]);
    expect(buildVisitedSiteSuggestions(sites, [], -1)).toEqual([]);
    expect(
      buildVisitedSiteSuggestions(
        sites,
        source.map((site) => site.url),
      ),
    ).toEqual([]);
  });
});
