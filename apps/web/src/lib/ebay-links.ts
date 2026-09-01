/**
 * Audio XX — eBay URL Helper
 *
 * Single canonical builder for outbound eBay search URLs. Wraps the
 * three env-driven affiliate primitives from affiliate-config:
 *
 *   - EBAY_HOST           → marketplace host (defaults to www.ebay.com)
 *   - EBAY_CAMPAIGN_ID    → EPN campaign ID, appended as `campid=`
 *   - EBAY_CUSTOM_ID      → optional EPN custom tracking ID,
 *                           appended as `customid=` (only when
 *                           campaign ID is also set)
 *
 * Contract:
 *   - When EBAY_CAMPAIGN_ID is UNSET, output is a plain eBay search
 *     URL with no EPN parameters. Fallback works on its own.
 *   - When EBAY_CAMPAIGN_ID is SET, `campid` is appended. If
 *     EBAY_CUSTOM_ID is also set, `customid` is appended.
 *   - EBAY_HOST defaults to www.ebay.com and is the only way to
 *     change marketplace — no UI selector, no geo-detection, no
 *     region routing. One host per deployment.
 *   - extraParams are caller-controlled passthroughs (e.g. _sacat
 *     category filters, LH_All scopes). They are URL-encoded by
 *     URLSearchParams.
 *
 * This module is forbidden from importing product-scoring,
 * recommendation, ranking, or confidence modules. Affiliate
 * availability must NEVER influence what is surfaced — see
 * affiliate-config.ts for the full policy.
 */

import { getEbayCampaignId, getEbayCustomId, getEbayHost } from './affiliate-config';

// ── Types ────────────────────────────────────────────

export interface EbaySearchOptions {
  /**
   * Additional caller-controlled query parameters to merge into
   * the eBay URL (e.g. `{ _sacat: '293', LH_All: '1' }`). These
   * are appended to the URLSearchParams alongside `_nkw`. Values
   * are URL-encoded by URLSearchParams.
   */
  extraParams?: Record<string, string>;
}

// ── Public API ───────────────────────────────────────

/**
 * Build an eBay search URL, optionally with EPN tracking params.
 *
 * @param query        The raw search query (e.g. "Naim Nait XS 3").
 *                     Will be URL-encoded as the `_nkw` parameter.
 * @param opts         Optional caller-controlled extras (category,
 *                     listing scope, etc.).
 * @returns            Full eBay search URL with host from EBAY_HOST
 *                     (or default), plus EPN params when env set.
 */
export function getEbaySearchUrl(query: string, opts?: EbaySearchOptions): string {
  const host = getEbayHost();
  const params = new URLSearchParams({ _nkw: query });

  // Caller-controlled passthroughs (category filters, listing scope).
  if (opts?.extraParams) {
    for (const [k, v] of Object.entries(opts.extraParams)) {
      params.set(k, v);
    }
  }

  // EPN tagging — campid first; customid only when campaign exists.
  // The order matters only for human readability; URLSearchParams
  // preserves insertion order in the serialized string.
  const campaignId = getEbayCampaignId();
  if (campaignId) {
    params.set('campid', campaignId);
    const customId = getEbayCustomId();
    if (customId) {
      params.set('customid', customId);
    }
  }

  return `https://${host}/sch/i.html?${params.toString()}`;
}
