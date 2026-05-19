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
 *     callers MAY populate the `campid=` query parameter on eBay
 *     search URLs. NOTE: the existing 5 eBay URL builders in the
 *     codebase have not yet been migrated to read this value — the
 *     helper is here so adoption is one search/replace away when
 *     opt-in is desired. Until migrated, eBay URLs are plain search
 *     links regardless of env state.
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
 * deployment, or undefined when no value is set. Callers that
 * generate eBay URLs MAY append the `campid=` query parameter only
 * when this returns a defined value.
 */
export function getEbayCampaignId(): string | undefined {
  return readEnvString('EBAY_CAMPAIGN_ID');
}
