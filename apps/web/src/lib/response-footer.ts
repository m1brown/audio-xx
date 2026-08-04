/**
 * Adapter: AdvisoryResponse → the trailing footer's two halves.
 *
 * The advisory payload has no single canonical "products discussed" field —
 * which one is populated depends on the lane (`systemChain.names` for a
 * system assessment, `options` for a recommendation, `comparisonImages` for
 * a comparison). This collects them all, so one call site works for every
 * format.
 *
 * `includeResources` is the duplication guard. The recommendation and
 * comparison cards already render Buy new / Product page / Buy used per
 * product; those call sites pass `false` and get the editorial half only.
 */
import type { AdvisoryResponse } from '@/lib/advisory-response';
import { buildContinueExploring, type ExploreGroup } from '@/lib/continue-exploring';
import { buildProductResources, type ProductResource } from '@/lib/product-resources';

export interface ResponseFooterData {
  groups: ExploreGroup[];
  resources: ProductResource[];
}

function componentNamesFrom(a: AdvisoryResponse): string[] {
  const names: string[] = [];
  for (const n of a.systemChain?.names ?? []) if (n) names.push(n);
  for (const c of a.componentAssessments ?? []) if (c?.name) names.push(c.name);
  for (const o of a.options ?? []) {
    if (o?.name) names.push(o.brand ? `${o.brand} ${o.name}` : o.name);
  }
  for (const c of a.comparisonImages ?? []) {
    if (c?.name) names.push(`${c.brand ?? ''} ${c.name}`.trim());
  }
  return names;
}

/**
 * Prose scanned for idea-page mentions. Deliberately narrow — only fields
 * that hold the advisor's own sentences, never labels or URLs, so a link
 * is never triggered by chrome.
 */
function proseFrom(a: AdvisoryResponse): string {
  return [
    a.subject,
    a.comparisonSummary ?? '',
    a.systemSynergy ?? '',
    ...(a.componentReadings ?? []),
    ...(a.assessmentStrengths ?? []),
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildResponseFooterData(
  a: AdvisoryResponse,
  opts: { includeResources: boolean },
): ResponseFooterData {
  const componentNames = componentNamesFrom(a);
  const brandNames = (a.options ?? []).map((o) => o.brand).filter((b): b is string => !!b);

  return {
    groups: buildContinueExploring({ componentNames, brandNames, prose: proseFrom(a) }),
    resources: opts.includeResources ? buildProductResources({ componentNames }) : [],
  };
}
