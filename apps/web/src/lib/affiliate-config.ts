/**
 * Affiliate configuration — centralized env-driven config for
 * outbound affiliate / partner-network identifiers.
 *
 * Contract:
 *   - This module reads from process.env ONLY.
 *   - It MUST NEVER import product-scoring, product-assessment,
 *     advisory-response, or any module that produces recommendations.
 *     Affiliate availability is forbidden from influencing ranking,
 *     scoring, confidence, or system-fit logic.
 *   - When env vars are absent or empty, helpers return undefined so
 *     URL builders can fall back to plain (non-affiliate) search
 *     links. This keeps dev / preview / forked deployments from
 *     polluting the production account's affiliate traffic.
 *
 * Where to set values:
 *   - Vercel production / preview: Project Settings → Environment
 *     Variables (one entry per environment as needed)
 *   - Local development: apps/web/.env.local (gitignored)
 *   - Never commit the .env.local file. Affiliate IDs/tags may appear
 *     in generated outbound URLs at runtime, but the underlying
 *     account credentials, passwords, and API keys do not belong in
 *     source.
 *
 * Currently supported (env-driven):
 *   - AMAZON_AFFILIATE_TAG — Amazon Associates store ID
 *     (e.g. "audioxx20-20"). When set, populates the `tag=` query
 *     parameter on Amazon search URLs built by amazon-links.ts. When
 *     unset, URLs are generated without the `tag=` parameter (plain
 *     search link). The tag itself is a public identifier — it
 *     appears in every outbound affiliate URL — and is safe to set
 *     directly in Vercel env vars (NOT a credential).
 *   - EBAY_CAMPAIGN_ID — eBay Partner Network campaign ID. When set,
 *     `getEbaySearchUrl` in ebay-links.ts appends `campid=<value>`
 *     to outbound eBay search URLs. When unset, links remain plain
 *     search URLs (no EPN attribution).
 *   - EBAY_CUSTOM_ID — optional EPN custom tracking ID. When set,
 *     `getEbaySearchUrl` appends `customid=<value>` (typically used
 *     to bucket attribution by sub-source). Only meaningful when
 *     EBAY_CAMPAIGN_ID is also set; ignored otherwise.
 *   - EBAY_HOST — eBay marketplace host (e.g. "www.ebay.com",
 *     "www.ebay.co.uk", "www.ebay.fr"). Defaults to "www.ebay.com"
 *     when unset. Single-marketplace configuration only — Audio XX
 *     does NOT do geo-routing, region detection, or marketplace
 *     selection. The default is U.S.-centered; deployments serving
 *     other regions set this once per environment.
 *
 * Currently NOT supported (no public affiliate / partner program):
 *   - HiFi Shark — pure availability aggregator, no partner program
 *   - Audiogon — no public partner program
 *   - US Audio Mart — no public partner program
 *   - Reverb — partner program exists but no integration here yet
 *
 * All affiliate links are disclosed to users on the public-facing
 * Affiliate Disclosure page (/affiliate-disclosure) and via the
 * affiliate-disclosure line in the footer.
 */

function readEnvString(name: string): string | undefined {
  const raw = process.env[name];
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Returns the Amazon Associates store ID configured for this
 * deployment, or undefined when no value is set. Callers that
 * generate Amazon URLs should append the `tag=` query parameter
 * only when this returns a defined value.
 */
export function getAmazonAffiliateTag(): string | undefined {
  return readEnvString('AMAZON_AFFILIATE_TAG');
}

/**
 * Returns the eBay Partner Network campaign ID configured for this
 * deployment, or undefined when no value is set. `getEbaySearchUrl`
 * in ebay-links.ts appends `campid=<value>` to outbound eBay search
 * URLs only when this returns a defined value.
 */
export function getEbayCampaignId(): string | undefined {
  return readEnvString('EBAY_CAMPAIGN_ID');
}

/**
 * Returns the optional EPN custom tracking ID configured for this
 * deployment, or undefined when no value is set. `getEbaySearchUrl`
 * appends `customid=<value>` only when this returns a defined value
 * AND the campaign ID is also defined (custom IDs are meaningless
 * without an EPN campaign to attribute to).
 */
export function getEbayCustomId(): string | undefined {
  return readEnvString('EBAY_CUSTOM_ID');
}

/**
 * Returns the eBay marketplace host configured for this deployment.
 * Defaults to "www.ebay.com" when unset — Audio XX is U.S.-centered
 * by default, Europe-aware via single-host override. Set
 * EBAY_HOST=www.ebay.fr or EBAY_HOST=www.ebay.co.uk per environment
 * to redirect outbound used-market links to a different marketplace.
 * No region detection or geo-routing — one host per deployment.
 */
export function getEbayHost(): string {
  return readEnvString('EBAY_HOST') ?? 'www.ebay.com';
}
