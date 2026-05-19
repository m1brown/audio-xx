/**
 * Unknown-product clarification builder (P1 follow-on, 2026-05-18).
 *
 * Builds the hedged AdvisoryResponse returned when a user asks about
 * a product we don't have in the catalog. The response:
 *
 *   - admits limited catalog knowledge (no fabrication of specs,
 *     price, sonic traits, or reviewer-derived claims)
 *   - asks for the user to confirm the exact product name / share
 *     details so we can give a proper evaluation
 *   - surfaces an "Explore" section with deterministic search URLs
 *     so the user has somewhere useful to go:
 *       * a manufacturer Google search (clearly labelled as a search)
 *       * an eBay search
 *       * a HiFi Shark search
 *
 * The image surface (generic placeholder) is rendered by the
 * AdvisoryMessage ConsultationSubjectContext component as a separate
 * concern — when the catalog lookups fail it falls back to the
 * generic SVG silhouette with a "Generic placeholder" caption that
 * explicitly disclaims it as the actual product image.
 *
 * Constraints:
 *   - no reviewer/review data anywhere in the response
 *   - no fabricated manufacturer URL — manufacturer link is a search
 *   - no top-level AdvisoryResponse.imageUrl
 *   - safe for unknown-product clarification only (do not reuse for
 *     known products — those go through buildProductAssessment)
 */

import type { AdvisoryLink, AdvisoryResponse } from './advisory-response';
import type { SubjectMatch } from './intent';
import { getEbaySearchUrl } from './ebay-links';

/**
 * Resolve the product name for the unknown-product safety-check
 * fallback.
 *
 * Priority order:
 *   1. turnCtx.subjectMatches — populated by buildTurnContext via
 *      extractSubjectMatches against the catalog. Returns the
 *      catalogued canonical name when the product IS in the catalog.
 *   2. intent.subjectMatches — populated by detectIntent. For unknown
 *      products this is the SYNTHESIZED match produced by gate 0a in
 *      intent.ts (carries the user-typed name verbatim). Without this
 *      fallback the safety-check sees no subject for non-catalogued
 *      products and degrades to "that product" — breaking the hedged
 *      clarification text AND disabling Explore links (the link
 *      builder rejects the fallback string by design).
 *   3. The string "that product" as a last resort.
 *
 * P1 follow-on fix (2026-05-18) — addresses the production regression
 * where "thoughts on the Buchardt A700" rendered with "the that
 * product" broken grammar and no Explore section.
 */
export function resolveUnknownProductName(
  turnCtxMatches: SubjectMatch[] | undefined,
  intentSyntheticMatches: SubjectMatch[] | undefined,
): string {
  const ctx = turnCtxMatches ?? [];
  const syn = intentSyntheticMatches ?? [];
  return (
    ctx.find((m) => m.kind === 'product')?.name
    ?? ctx.find((m) => m.kind === 'brand')?.name
    ?? syn.find((m) => m.kind === 'product')?.name
    ?? syn.find((m) => m.kind === 'brand')?.name
    ?? 'that product'
  );
}

/**
 * Build the Explore links for an unknown product clarification.
 * Returns undefined when productName is the fallback placeholder
 * "that product" (i.e., no candidate name was extractable), since
 * search URLs with that string would be useless.
 */
export function buildUnknownProductExploreLinks(
  productName: string,
): AdvisoryLink[] | undefined {
  if (!productName || productName === 'that product') return undefined;
  const q = encodeURIComponent(productName);
  return [
    {
      label: 'Find manufacturer',
      url: `https://www.google.com/search?q=${q}+official+site`,
      kind: 'reference',
    },
    {
      label: 'eBay',
      // Host + EPN tagging come from ebay-links → affiliate-config
      // (env-driven). Plain search fallback when env vars unset.
      url: getEbaySearchUrl(productName),
      kind: 'dealer',
      region: 'global',
    },
    {
      label: 'HiFi Shark',
      url: `https://www.hifishark.com/search?q=${q}`,
      kind: 'dealer',
      region: 'global',
    },
  ];
}

/**
 * Build the full hedged clarification AdvisoryResponse for an
 * unknown product. The image surface is handled separately by the
 * AdvisoryMessage renderer's ConsultationSubjectContext fallback.
 */
export function buildUnknownProductClarification(
  productName: string,
): AdvisoryResponse {
  const exploreLinks = buildUnknownProductExploreLinks(productName);
  return {
    kind: 'assessment',
    subject: productName,
    advisoryMode: 'product_assessment',
    bottomLine: `I want to make sure I understand — are you asking about the ${productName}? I don't have full catalog data on that specific model yet. If you can share more details (brand, model number, or category), I can offer a more informed assessment.`,
    followUp: `Could you confirm the exact product name or share a link? That way I can give you a proper evaluation rather than guessing.`,
    links: exploreLinks,
  };
}
