import type { MetadataRoute } from 'next';

/**
 * sitemap.xml (Gate 9). Lists the stable public editorial pages. Private
 * account surfaces are excluded (and noindexed); per-assessment artifact
 * links are shared directly and are not enumerated here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://audio-xx.com';
  const paths = ['', '/how-it-works', '/glossary', '/resources', '/about', '/privacy', '/terms', '/affiliate-disclosure', '/publishers-reviewers'];
  return paths.map((p) => ({
    url: base + p,
    changeFrequency: 'monthly' as const,
    priority: p === '' ? 1 : 0.6,
  }));
}
