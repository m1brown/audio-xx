import type { MetadataRoute } from 'next';

/**
 * robots.txt (Gate 9). Public editorial + assessment surfaces are
 * crawlable; the private account surfaces and API are disallowed as
 * defence-in-depth (they are already noindexed per-page). Points crawlers
 * at the sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/systems', '/save', '/auth/', '/api/', '/profile', '/onboarding'],
    },
    sitemap: 'https://audio-xx.com/sitemap.xml',
    host: 'https://audio-xx.com',
  };
}
