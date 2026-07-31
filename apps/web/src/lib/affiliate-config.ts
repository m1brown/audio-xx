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

/**
 * D-010 resolution (pre-beta item 9, 2026-07-31).
 *
 * The original implementation read server-only vars via a DYNAMIC
 * process.env[name] lookup. Link generation runs in client components,
 * where (a) server vars are never available and (b) Next.js only
 * inlines NEXT_PUBLIC_* vars referenced as LITERAL expressions — so
 * configured identifiers could never reach a generated link in the
 * deployed app. Two failures, one symptom: setting the vars did
 * nothing.
 *
 * Chosen fix: build-time public configuration (NEXT_PUBLIC_* literal
 * references, server-var fallback for server contexts). Rationale over
 * server-side link generation: affiliate tags are public by nature
 * (they appear in every clicked URL), so there is no secret to
 * protect; client-side generation keeps caching simple and the
 * operational surface is two env vars + redeploy. Amazon Associates
 * and EPN both only require the identifier in the outbound URL.
 *
 * Activation (founder action, after program enrollment — never ship
 * fake IDs): set NEXT_PUBLIC_AMAZON_AFFILIATE_TAG and/or
 * NEXT_PUBLIC_EBAY_CAMPAIGN_ID in Vercel (Production), redeploy.
 * Links and the footer disclosure flip together, because the
 * disclosure derives from these same getters.
 */

function normalize(raw: string | undefined): string | undefined {
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
  return (
    normalize(process.env.NEXT_PUBLIC_AMAZON_AFFILIATE_TAG) ??
    normalize(process.env.AMAZON_AFFILIATE_TAG)
  );
}

/**
 * Returns the eBay Partner Network campaign ID configured for this
 * deployment, or undefined when no value is set. `getEbaySearchUrl`
 * in ebay-links.ts appends `campid=<value>` to outbound eBay search
 * URLs only when this returns a defined value.
 */
export function getEbayCampaignId(): string | undefined {
  return (
    normalize(process.env.NEXT_PUBLIC_EBAY_CAMPAIGN_ID) ??
    normalize(process.env.EBAY_CAMPAIGN_ID)
  );
}

/**
 * Returns the optional EPN custom tracking ID configured for this
 * deployment, or undefined when no value is set. `getEbaySearchUrl`
 * appends `customid=<value>` only when this returns a defined value
 * AND the campaign ID is also defined (custom IDs are meaningless
 * without an EPN campaign to attribute to).
 */
export function getEbayCustomId(): string | undefined {
  return (
    normalize(process.env.NEXT_PUBLIC_EBAY_CUSTOM_ID) ??
    normalize(process.env.EBAY_CUSTOM_ID)
  );
}

/**
 * Returns the eBay marketplace host configured for this deployment.
 * Defaults to "www.ebay.com" when unset — Audio XX is U.S.-centered
 * by default, Europe-aware via single-host override. Set
 * NEXT_PUBLIC_EBAY_HOST=www.ebay.fr or =www.ebay.co.uk per environment
 * to redirect outbound used-market links to a different marketplace.
 * No region detection or geo-routing — one host per deployment.
 */
export function getEbayHost(): string {
  return (
    normalize(process.env.NEXT_PUBLIC_EBAY_HOST) ??
    normalize(process.env.EBAY_HOST) ??
    'www.ebay.com'
  );
}
