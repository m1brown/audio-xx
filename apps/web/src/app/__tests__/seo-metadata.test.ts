/**
 * Gate 9 (G9-D1) — SEO surface regression pins.
 * robots.txt and sitemap.xml exist and never expose private surfaces.
 */
import { describe, it, expect } from 'vitest';
import robots from '../robots';
import sitemap from '../sitemap';

const PRIVATE = ['/account', '/systems', '/save', '/auth', '/api', '/profile', '/onboarding'];

describe('robots.txt', () => {
  const r = robots();
  it('allows crawling and points at the sitemap', () => {
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.allow).toBe('/');
    expect(r.sitemap).toContain('/sitemap.xml');
  });
  it('disallows every private surface', () => {
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    const disallow = ([] as string[]).concat(rule.disallow ?? []);
    for (const p of ['/account', '/systems', '/save', '/auth/', '/api/', '/profile', '/onboarding']) {
      expect(disallow).toContain(p);
    }
  });
});

describe('sitemap.xml', () => {
  const entries = sitemap();
  it('lists the public editorial pages', () => {
    const urls = entries.map((e) => e.url);
    expect(urls.some((u) => u.endsWith('audio-xx.com'))).toBe(true); // home
    for (const p of ['/how-it-works', '/glossary', '/resources', '/about']) {
      expect(urls.some((u) => u.endsWith(p))).toBe(true);
    }
  });
  it('never lists a private surface', () => {
    const urls = entries.map((e) => e.url);
    for (const u of urls) {
      for (const priv of PRIVATE) {
        expect(u.includes(priv)).toBe(false);
      }
    }
  });
});
