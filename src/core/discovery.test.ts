import { describe, expect, it } from 'vitest';
import { buildVisitedSiteSuggestions, normalizeVisitedSiteUrl } from './discovery';

describe('visited-site discovery', () => {
  it('canonicalizes safe web URLs and ignores fragments', () => {
    expect(normalizeVisitedSiteUrl('https://Example.com/path#section')).toBe(
      'https://example.com/path',
    );
    expect(normalizeVisitedSiteUrl('file:///Users/me/index.html')).toBeUndefined();
    expect(normalizeVisitedSiteUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('prioritizes top sites, merges history, and filters saved or hidden URLs', () => {
    const suggestions = buildVisitedSiteSuggestions(
      [
        { url: 'https://top.example/', title: 'Top Site' },
        { url: 'https://saved.example/', title: 'Saved' },
      ],
      [
        {
          url: 'https://top.example/#latest',
          title: 'History title',
          visitCount: 20,
          lastVisitTime: 300,
        },
        {
          url: 'https://frequent.example/',
          title: 'Frequent',
          visitCount: 12,
          lastVisitTime: 200,
        },
        {
          url: 'https://recent.example/',
          title: 'Recent',
          visitCount: 2,
          lastVisitTime: 400,
        },
        { url: 'https://hidden.example/', title: 'Hidden', visitCount: 40 },
      ],
      ['https://saved.example/#section'],
      ['https://hidden.example/'],
    );

    expect(suggestions).toEqual([
      {
        url: 'https://top.example/',
        title: 'Top Site',
        visitCount: 20,
        lastVisitTime: 300,
      },
      {
        url: 'https://frequent.example/',
        title: 'Frequent',
        visitCount: 12,
        lastVisitTime: 200,
      },
      {
        url: 'https://recent.example/',
        title: 'Recent',
        visitCount: 2,
        lastVisitTime: 400,
      },
    ]);
  });

  it('sorts history by visit count then recency and applies the result limit', () => {
    const suggestions = buildVisitedSiteSuggestions(
      [],
      [
        { url: 'https://older.example/', visitCount: 4, lastVisitTime: 100 },
        { url: 'https://newer.example/', visitCount: 4, lastVisitTime: 200 },
        { url: 'https://most-visited.example/', visitCount: 9, lastVisitTime: 50 },
      ],
      [],
      [],
      2,
    );

    expect(suggestions.map((site) => site.url)).toEqual([
      'https://most-visited.example/',
      'https://newer.example/',
    ]);
  });
});
