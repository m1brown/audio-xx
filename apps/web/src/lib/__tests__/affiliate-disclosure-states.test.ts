import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAffiliateState, getAmazonAffiliateTag, getEbayCampaignId } from '../affiliate-config';
import { getAmazonSearchUrl } from '../amazon-links';
import { getEbaySearchUrl } from '../ebay-links';

/**
 * A disclosure page may not describe a state the deployment is not in.
 *
 * The original defect: the footer derived its sentence from the affiliate
 * configuration while /affiliate-disclosure hardcoded one. Correcting the
 * hardcoded copy to the ACTIVE state did not close the defect class — it
 * inverted it, and a build with credentials unset rendered a page claiming
 * affiliate links against a footer correctly denying them.
 *
 * These pin the public statements to actual LINK BEHAVIOUR in all four
 * configurations, because agreement between two pieces of copy is worth
 * nothing if neither matches what the URLs do. Safe test values only — no
 * real credential ever appears here.
 */

const AMZ = 'NEXT_PUBLIC_AMAZON_AFFILIATE_TAG';
const EBAY = 'NEXT_PUBLIC_EBAY_CAMPAIGN_ID';
const saved: Record<string, string | undefined> = {};

beforeEach(() => { for (const k of [AMZ, EBAY]) saved[k] = process.env[k]; });
afterEach(() => {
  for (const k of [AMZ, EBAY]) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function configure(amazon: boolean, ebay: boolean) {
  if (amazon) process.env[AMZ] = 'audioxx-test-20'; else delete process.env[AMZ];
  if (ebay) process.env[EBAY] = '5338000000'; else delete process.env[EBAY];
}

/** The footer's inline expression, mirrored so drift is caught. */
const footerSaysActive = () => !!(getAmazonAffiliateTag() || getEbayCampaignId());

const STATES: Array<[string, boolean, boolean]> = [
  ['A. Amazon OFF / eBay OFF', false, false],
  ['B. Amazon ON  / eBay OFF', true, false],
  ['C. Amazon OFF / eBay ON ', false, true],
  ['D. Amazon ON  / eBay ON ', true, true],
];

describe.each(STATES)('%s', (_label, amazon, ebay) => {
  beforeEach(() => configure(amazon, ebay));

  it('derived state matches the configuration', () => {
    const s = getAffiliateState();
    expect(s.amazon).toBe(amazon);
    expect(s.ebay).toBe(ebay);
    expect(s.any).toBe(amazon || ebay);
  });

  it('the footer and the derived state cannot disagree', () => {
    // The footer is the reference implementation and is deliberately left
    // unchanged; this is the lock that keeps the projection equal to it.
    expect(getAffiliateState().any).toBe(footerSaysActive());
  });

  it('Amazon URLs carry tag= only when Amazon is configured', () => {
    const url = getAmazonSearchUrl('Chord Qutest');
    expect(/[?&]tag=/.test(url)).toBe(amazon);
  });

  it('eBay URLs carry campid= only when eBay is configured', () => {
    const url = getEbaySearchUrl('Chord Qutest');
    expect(/[?&]campid=/.test(url)).toBe(ebay);
  });

  it('a program is nameable only when its own credential is set', () => {
    const s = getAffiliateState();
    // Enrollment in one program is not enrollment in the other. This is the
    // rule that stops "any affiliate active" from licensing the word "Amazon".
    expect(s.amazon).toBe(/[?&]tag=/.test(getAmazonSearchUrl('x')));
    expect(s.ebay).toBe(/[?&]campid=/.test(getEbaySearchUrl('x')));
  });
});

describe('the projection exposes no credential value', () => {
  it('returns booleans only', () => {
    configure(true, true);
    const s = getAffiliateState();
    for (const v of Object.values(s)) expect(typeof v).toBe('boolean');
    expect(JSON.stringify(s)).not.toMatch(/audioxx-test-20|5338000000/);
  });
});
