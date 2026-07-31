/**
 * Retailer link hygiene — static invariants over apps/web/src/lib/products/*.ts.
 *
 * Companion to the 2026-07-30 commerce-link audit + remediation
 * (audit-2026-07-30/commerce-links/). No network: these tests parse the
 * catalog sources and pin the invariants the remediation established, so
 * known-dead domains, review links, and bare marketplace homepages can
 * never be reintroduced as retailer_links.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PRODUCTS_DIR = join(__dirname, '..', 'products');

/**
 * Domains removed (or replaced) in the 2026-07-30 remediation because the
 * DOMAIN itself was dead: NXDOMAIN, parked (HugeDomains), TLS-dead,
 * connection-refused, or persistent timeout. Never reintroduce these.
 * (Live sites whose product PATHS died — apos.audio, kitsunehifi.com,
 * musicdirect.com, toneimports.com — are deliberately not listed: the
 * domains work; only stale paths were removed.)
 */
const DENYLIST_DEAD_DOMAINS = [
  'vinnierossiautomotive.com', // fabricated — real: vinnierossi.com
  'rfrequestie.com', // fabricated — real: raalrequisite.com
  'dfridelity.com', // fabricated — real: devorefidelity.com
  'missionspk.com', // fabricated — real: mission.co.uk
  'bottleheadelectronics.com', // fabricated — real: bottlehead.com
  'leben-hifi.com', // NXDOMAIN — real: lebenhifi.com
  'shindolabs.com', // NXDOMAIN, no verified replacement
  'rotelusa.com', // NXDOMAIN — real: rotel.com
  'yamamoto-sound.com', // NXDOMAIN, no verified replacement
  'crayonaudio.com', // NXDOMAIN, no verified replacement
  'molamola.audio', // NXDOMAIN — real: mola-mola.nl
  'sonnet.nl', // NXDOMAIN — real: sonnet-audio.com
  'holoaudio.com', // parked (HugeDomains)
  'rockna.com', // parked (HugeDomains) — real: rockna-audio.com
  'naim-audio.com', // dead-timeout — real: naimaudio.com
  'kinkistudio.com', // TLS-dead — real: kinki-studio.com
  'audalytic.com', // dead-timeout, no verified replacement
  'auralic.com', // dead-timeout, no verified replacement
  'lampizator.eu', // TLS-dead, no verified replacement
  'cubeaudio.com', // connection-refused, no verified replacement
  'falcon-acoustics.co.uk', // dead-timeout — real: falconacoustics.co.uk
];

/** Reviewer domains must never appear as retailer_links (F4 doctrine). */
const REVIEW_SITE_DOMAINS = [
  '6moons.com',
  'positive-feedback.com',
  'stereophile.com',
  'monoandstereo.com',
];

/** Marketplaces where a bare homepage is useless as a commerce link. */
const MARKETPLACE_HOMEPAGE_DOMAINS = ['ebay.com', 'reverb.com', 'usaudiomart.com'];

interface ExtractedLink {
  file: string;
  label: string;
  url: string;
}

function extractRetailerLinks(): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const entryRe = /\{\s*label:\s*'((?:[^'\\]|\\.)*)',\s*url:\s*'((?:[^'\\]|\\.)*)'\s*\}/g;
  for (const file of readdirSync(PRODUCTS_DIR).filter((f) => f.endsWith('.ts'))) {
    const source = readFileSync(join(PRODUCTS_DIR, file), 'utf8');
    for (const match of source.matchAll(entryRe)) {
      links.push({ file, label: match[1], url: match[2] });
    }
  }
  return links;
}

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

const links = extractRetailerLinks();

describe('retailer link hygiene (static, no network)', () => {
  it('extracts a sane number of retailer_links entries', () => {
    expect(links.length).toBeGreaterThan(100);
  });

  it('every retailer_links url parses as a valid https URL', () => {
    const bad = links.filter((l) => {
      try {
        return new URL(l.url).protocol !== 'https:';
      } catch {
        return true;
      }
    });
    expect(bad, `non-https or unparseable retailer urls: ${JSON.stringify(bad)}`).toEqual([]);
  });

  it('no retailer_links host is on the known-dead DENYLIST', () => {
    const bad = links.filter((l) =>
      DENYLIST_DEAD_DOMAINS.some((d) => hostMatches(new URL(l.url).hostname, d)),
    );
    expect(bad, `dead-domain retailer urls reintroduced: ${JSON.stringify(bad)}`).toEqual([]);
  });

  it('no retailer_links host is a review site', () => {
    const bad = links.filter((l) =>
      REVIEW_SITE_DOMAINS.some((d) => hostMatches(new URL(l.url).hostname, d)),
    );
    expect(bad, `review links stored as retailer_links: ${JSON.stringify(bad)}`).toEqual([]);
  });

  it('no retailer_links entry is a direct Amazon ASIN (/dp/) link', () => {
    // 2026-07-31 browser click-test: all 8 hardcoded /dp/ links were bad —
    // 7 dead listings and one ASIN reused by an unrelated product. ASINs
    // rot; the documented strategy (amazon-links.ts) is search-based URLs
    // generated at render time. Direct ASIN links are forbidden in the
    // catalog.
    const bad = links.filter((l) => {
      const u = new URL(l.url);
      return hostMatches(u.hostname, 'amazon.com') && /\/dp\//.test(u.pathname);
    });
    expect(bad, `hardcoded Amazon ASIN links: ${JSON.stringify(bad)}`).toEqual([]);
  });

  it('no retailer_links entry is a bare marketplace homepage', () => {
    const bad = links.filter((l) => {
      const u = new URL(l.url);
      const isMarketplace = MARKETPLACE_HOMEPAGE_DOMAINS.some((d) =>
        hostMatches(u.hostname, d),
      );
      return isMarketplace && (u.pathname === '/' || u.pathname === '') && !u.search;
    });
    expect(bad, `bare marketplace homepages: ${JSON.stringify(bad)}`).toEqual([]);
  });
});
