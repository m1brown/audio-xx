/**
 * Orchestrator → AdvisoryResponse adapter.
 *
 * Maps ShoppingDecisionOutput (from the LLM orchestrator) into the existing
 * AdvisoryResponse shape so the current UI components can render it without
 * modification.
 *
 * Design principles:
 *   - LLM prose (whyThisFitsYou, soundCharacter, tradeoffs, buyingNote)
 *     replaces the deterministic fitNote/character/caution.
 *   - Catalog metadata (links, manufacturerUrl, usedMarketSources, topology,
 *     systemDelta) is preserved from the original ProductExample.
 *   - Role labels map: best_choice → top_pick, upgrade_choice → upgrade_pick,
 *     value_choice → value_pick.
 *   - PreferenceSummary maps to listenerPriorities (values) and
 *     listenerAvoids (avoids).
 *   - overallGuidance → recommendedDirection + bottomLine.
 *   - whatToAvoid → tradeOffs.
 *
 * Step 7: This adapter is used when NEXT_PUBLIC_ORCHESTRATOR_RENDER=true
 * and the orchestrator returns valid structured shopping output.
 */

import type { AdvisoryResponse, AdvisoryOption, SourceReference } from '../advisory-response';
import type { ProductExample } from '../shopping-intent';
import { getProductImage } from '../product-images';
import type {
  OrchestratorOutput,
  ShoppingDecisionOutput,
  ShoppingRecommendation,
  CandidateProduct,
} from './runAudioXXAssistant';

// ── Role Mapping ─────────────────────────────────────────

const ROLE_MAP: Record<string, AdvisoryOption['pickRole']> = {
  best_choice: 'anchor',
  upgrade_choice: 'close_alt',
  value_choice: 'contrast',
};

// ── Feature Flag ─────────────────────────────────────────

/**
 * Check whether the orchestrator render path is enabled.
 * Reads NEXT_PUBLIC_ORCHESTRATOR_RENDER at call time (safe for client-side).
 */
export function isOrchestratorRenderEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ORCHESTRATOR_RENDER === 'true';
}

// ── Validation ───────────────────────────────────────────

/**
 * Validate that an OrchestratorOutput contains usable shopping data.
 * Returns the ShoppingDecisionOutput if valid, or null if the output
 * should fall back to the deterministic pipeline.
 */
export function extractValidShoppingOutput(
  output: OrchestratorOutput | null,
): ShoppingDecisionOutput | null {
  if (!output) return null;
  if (!output.debug.llmCalled) return null;
  if (output.structured.type !== 'shopping_recommendation') return null;

  const data = output.structured.data as ShoppingDecisionOutput;

  // Must have recommendations
  if (!data.recommendations || data.recommendations.length === 0) return null;
  // Must have preference summary
  if (!data.preferenceSummary?.values || data.preferenceSummary.values.length === 0) return null;
  // Must have guidance
  if (!data.overallGuidance) return null;

  return data;
}

// ── Product Matching ─────────────────────────────────────

/**
 * Find the original ProductExample that matches a ShoppingRecommendation.
 * Matches on product name (case-insensitive, partial match).
 * Returns null if no match found.
 */
function findOriginalProduct(
  rec: ShoppingRecommendation,
  products: ProductExample[],
): ProductExample | null {
  const recName = rec.productName.toLowerCase();
  // Exact match first
  const exact = products.find((p) =>
    `${p.brand} ${p.name}`.toLowerCase() === recName ||
    p.name.toLowerCase() === recName,
  );
  if (exact) return exact;

  // Partial match — product name contained in recommendation name or vice versa
  const partial = products.find((p) =>
    recName.includes(p.name.toLowerCase()) ||
    p.name.toLowerCase().includes(recName),
  );
  return partial ?? null;
}

// ── Adapter: Recommendation → AdvisoryOption ─────────────

/**
 * Convert a single ShoppingRecommendation + its original ProductExample
 * into an AdvisoryOption for the rendering layer.
 *
 * LLM prose replaces deterministic text; catalog metadata is preserved.
 */
function recommendationToOption(
  rec: ShoppingRecommendation,
  original: ProductExample | null,
): AdvisoryOption {
  const option: AdvisoryOption = {
    // Identity
    name: original?.name ?? (rec.productName.split(' ').slice(1).join(' ') || rec.productName),
    brand: original?.brand ?? rec.productName.split(' ')[0],
    price: original?.price,
    priceCurrency: original?.priceCurrency,

    // LLM-generated prose (replaces deterministic character/fitNote/caution)
    character: rec.soundCharacter,
    fitNote: rec.whyThisFitsYou,
    caution: rec.tradeoffs,

    // Catalog metadata (preserved from original product)
    links: original?.links?.map((l) => ({ label: l.label, url: l.url, kind: l.label.toLowerCase().includes('review') ? 'review' as const : l.label.toLowerCase().includes('buy') || l.label.toLowerCase().includes('dealer') ? 'dealer' as const : 'reference' as const })),
    sonicDirectionLabel: original?.sonicDirectionLabel,
    productType: original?.productType,
    manufacturerUrl: original?.manufacturerUrl,
    usedMarketUrl: original?.usedMarketUrl,
    availability: original?.availability,
    usedPriceRange: original?.usedPriceRange,
    usedMarketSources: original?.usedMarketSources,
    systemDelta: original?.systemDelta,
    standoutFeatures: original?.standoutFeatures,
    soundProfile: original?.soundProfile,

    // Catalog facts
    catalogArchitecture: original?.catalogArchitecture,
    catalogTopology: original?.catalogTopology,
    catalogCountry: original?.catalogCountry,
    catalogBrandScale: original?.catalogBrandScale,
    isCurrentComponent: original?.isCurrentComponent,

    // Primary pick marker
    isPrimary: rec.role === 'best_choice',

    // Buying and role metadata
    buyingNote: rec.buyingNote,
    pickRole: ROLE_MAP[rec.role ?? ''] ?? (original as any)?.pickRole ?? undefined,

    // Step 10: Enhanced catalog fields (from original product)
    // Catalog imageUrl wins; fall back to the seeded product-image mapping.
    imageUrl: original?.imageUrl ?? getProductImage(original?.brand ?? rec.productName.split(' ')[0], original?.name ?? rec.productName),
    typicalMarket: original?.typicalMarket,
    buyingContext: original?.buyingContext,
  };

  return option;
}

// ── Source References ─────────────────────────────────────

function collectSourceReferences(
  recommendations: ShoppingRecommendation[],
  products: ProductExample[],
): SourceReference[] {
  const refs: SourceReference[] = [];
  const seen = new Set<string>();

  for (const rec of recommendations) {
    const original = findOriginalProduct(rec, products);
    if (!original?.sourceReferences) continue;

    for (const ref of original.sourceReferences) {
      if (seen.has(ref.source)) continue;
      seen.add(ref.source);

      const matchingLink = original.links?.find(
        (l) => l.label.toLowerCase().includes(ref.source.toLowerCase()) && l.label.toLowerCase().includes('review'),
      );
      refs.push({ source: ref.source, note: ref.note, url: ref.url ?? matchingLink?.url });
    }
  }

  return refs;
}

// ── Main Adapter ─────────────────────────────────────────

export interface AdapterContext {
  /** The ShoppingDecisionOutput from the orchestrator. */
  shoppingOutput: ShoppingDecisionOutput;
  /** Original ProductExamples from the deterministic pipeline. */
  productExamples: ProductExample[];
  /** Shopping category. */
  category: string;
  /** Budget amount (or null). */
  budget: number | null;
  /** Debug metadata from the orchestrator output. */
  debug: OrchestratorOutput['debug'];
}

/**
 * Convert orchestrator shopping output into an AdvisoryResponse.
 *
 * This is the primary adapter function — called when the feature flag is
 * enabled and the orchestrator returns valid structured output.
 */
export function orchestratorToAdvisory(ctx: AdapterContext): AdvisoryResponse {
  const { shoppingOutput, productExamples, category, budget, debug } = ctx;
  const { preferenceSummary, recommendations, overallGuidance, whatToAvoid } = shoppingOutput;

  // ── Map recommendations to options ──
  // Dedupe by normalized brand+name. The orchestrator can occasionally
  // emit the same product under more than one role (e.g. value_choice and
  // best_choice) when its candidate list is small. Render-layer dedupe
  // keeps the first occurrence so we never surface the same card twice.
  const rawOptions: AdvisoryOption[] = recommendations.map((rec) => {
    const original = findOriginalProduct(rec, productExamples);
    return recommendationToOption(rec, original);
  });
  const seenIdentity = new Set<string>();
  const options: AdvisoryOption[] = [];
  for (const opt of rawOptions) {
    const key = `${(opt.brand ?? '').toLowerCase()} ${(opt.name ?? '').toLowerCase()}`
      .replace(/\s+/g, ' ')
      .trim();
    if (key && seenIdentity.has(key)) continue;
    if (key) seenIdentity.add(key);
    options.push(opt);
  }

  // ── Source references from matched products ──
  const sourceRefs = collectSourceReferences(recommendations, productExamples);

  // ── Build advisory ──
  const advisory: AdvisoryResponse = {
    kind: 'shopping',
    advisoryMode: 'upgrade_suggestions',
    subject: category,

    // Preference mirror (from LLM)
    listenerPriorities: preferenceSummary.values,
    listenerAvoids: preferenceSummary.avoids.length > 0 ? preferenceSummary.avoids : undefined,

    // Editorial intro (from LLM optimizingFor)
    editorialIntro: preferenceSummary.optimizingFor,

    // Direction and trade-offs (from LLM)
    recommendedDirection: overallGuidance,
    tradeOffs: whatToAvoid ? [whatToAvoid] : undefined,

    // Product options
    options: options.length > 0 ? options : undefined,
    shoppingCategory: category,

    // Bottom line (condensed from overallGuidance)
    bottomLine: overallGuidance.length > 200
      ? overallGuidance.slice(0, 200).replace(/\s+\S*$/, '') + '…'
      : overallGuidance,

    // Source references
    sourceReferences: sourceRefs.length > 0 ? sourceRefs : undefined,

    // Not provisional — LLM had full context
    provisional: false,
    lowPreferenceSignal: false,

    // Directed mode if budget + category present
    directed: !!budget,

    // Mark as orchestrator-sourced (for logging/debugging)
    source: 'orchestrator' as any,
  };

  return advisory;
}

// ── Logging ──────────────────────────────────────────────

/**
 * Log which render path was used and key metrics.
 */
export function logRenderSource(
  source: 'orchestrator' | 'deterministic',
  debug?: OrchestratorOutput['debug'],
): void {
  if (source === 'orchestrator' && debug) {
    console.log('[render-source] ✓ orchestrator — llmCalled=%s provider=%s model=%s recs=%d',
      debug.llmCalled, debug.llmProvider, debug.llmModel,
      debug.candidatesAfterFilter ?? 0);
  } else {
    console.log('[render-source] ✗ deterministic fallback — reason: %s',
      debug?.fallbackReason ?? (source === 'deterministic' ? 'flag off or invalid output' : 'unknown'));
  }
}
