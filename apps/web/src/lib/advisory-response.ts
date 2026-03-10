/**
 * Unified advisory response — shared structure for all substantive advisory output.
 *
 * Audio XX has four advisory paths (consultation, gear-response, shopping, analysis)
 * that each produce their own response type. This module defines a shared
 * AdvisoryResponse structure and adapter functions that map each native type
 * into the unified format.
 *
 * The unified response drives a single UI component (AdvisoryMessage) with
 * conditional section rendering — only populated fields appear.
 *
 * Native builders remain unchanged. Adapters are thin mapping functions
 * called at the dispatch boundary in page.tsx.
 */

import type { ConsultationResponse } from './consultation';
import type { ShoppingAnswer, GapDimension } from './shopping-intent';
import type { GearResponse } from './conversation-types';
import type { EvaluationResult, FiredRule } from './rule-types';
import type { ExtractedSignals } from './signal-types';
import type { SystemDirection } from './system-direction';

// ── Types ────────────────────────────────────────────

export interface AdvisoryOption {
  name: string;
  brand?: string;
  price?: number;
  priceCurrency?: string;
  /** Why this option fits the listener's priorities. */
  fitNote: string;
  /** Any caution or trade-off note. */
  caution?: string;
  /** Links to official site, reviews, retailers. */
  links?: Array<{ label: string; url: string }>;
}

export interface AdvisoryLink {
  label: string;
  url: string;
  kind?: 'reference' | 'dealer' | 'review';
  region?: string;
}

export interface SourceReference {
  /** Publication or reviewer name. */
  source: string;
  /** What the source says or covers. */
  note: string;
}

/**
 * Unified advisory response.
 *
 * All substantive advisory output — whether from consultation, shopping,
 * gear inquiry, or diagnosis — maps into this structure. Sections are
 * optional; the UI renders only populated fields.
 *
 * The `kind` field determines framing voice:
 *   consultation — educational, brand/technology-oriented
 *   shopping     — directional, recommendation-oriented
 *   diagnosis    — corrective, symptom-oriented
 */
export interface AdvisoryResponse {
  /** Determines framing voice. */
  kind: 'consultation' | 'shopping' | 'diagnosis';
  /** The subject being advised about (brand, product, symptom, category). */
  subject: string;

  // ── 1. Listener Priorities ──────────────────────────
  /** "What you seem to value" — bullet list of preferences. */
  listenerPriorities?: string[];
  /** "What you tend to avoid" — bullet list of anti-preferences. */
  listenerAvoids?: string[];

  // ── 2. System / Use-Case Context ────────────────────
  /** Current system and listening context (prose). */
  systemContext?: string;
  /** Inferred system tendencies (prose summary). */
  systemTendencies?: string;

  // ── 3. Alignment ────────────────────────────────────
  /** How listener priorities relate to the recommendation. */
  alignmentRationale?: string;

  // ── 4. Core Advisory (prose body) ───────────────────
  /** Design philosophy or brand positioning. */
  philosophy?: string;
  /** Sonic tendencies — how it sounds. */
  tendencies?: string;
  /** System fit — where it works well. */
  systemFit?: string;
  /** Comparison summary — renders first for comparison responses. */
  comparisonSummary?: string;

  // ── 5. Component Guidance ───────────────────────────
  /** Recommended direction or best-fit approach. */
  recommendedDirection?: string;
  /** Why this direction fits the listener's priorities (bullet list). */
  whyThisFits?: string[];

  // ── 6. Trade-offs ───────────────────────────────────
  /** What to watch for / what you trade away (bullet list). */
  tradeOffs?: string[];

  // ── 7. Recommended Options ──────────────────────────
  /** Product or option examples with fit notes. */
  options?: AdvisoryOption[];
  /** True when based on incomplete context. */
  provisional?: boolean;
  /** What context is missing (shown as caveats). */
  statedGaps?: string[];
  /** Category-specific dependency caveat. */
  dependencyCaveat?: string;

  // ── 8. Bottom Line ──────────────────────────────────
  /** One-sentence restrained conclusion. */
  bottomLine?: string;

  // ── 9. Continuation ─────────────────────────────────
  /** Light follow-up question. */
  followUp?: string;

  // ── 10. Learn More ──────────────────────────────────
  /** Grouped links (reference / dealer / review). */
  links?: AdvisoryLink[];

  // ── 11. Sources & Reviews ───────────────────────────
  /** Primary reviews or trusted source references. */
  sourceReferences?: SourceReference[];

  // ── 12. Diagnostics (collapsible) ───────────────────
  /** Signal interpretation transparency. */
  diagnostics?: {
    matchedPhrases: string[];
    symptoms: string[];
    traits: Record<string, 'up' | 'down'>;
  };
}

// ── Content Enrichment ───────────────────────────────

/**
 * Generate a one-sentence restrained conclusion.
 * Deterministic template — no LLM call.
 */
function generateBottomLine(
  kind: AdvisoryResponse['kind'],
  subject: string,
  recommendedDirection?: string,
  tradeOffs?: string[],
): string | undefined {
  if (!recommendedDirection) return undefined;

  // Trim direction to first sentence for brevity
  const dirBrief = recommendedDirection.split(/\.\s/)[0];

  if (kind === 'diagnosis' && tradeOffs && tradeOffs.length > 0) {
    return `For ${subject}: ${dirBrief.toLowerCase()} — worth exploring, with awareness that ${tradeOffs[0].toLowerCase()}.`;
  }
  if (kind === 'shopping') {
    return `For ${subject}: ${dirBrief.toLowerCase()}.`;
  }
  // consultation — keep it light
  return undefined;
}

/**
 * Generate alignment rationale bridging listener priorities to system context.
 * Only produces text when both priority and system data exist.
 */
function generateAlignmentRationale(
  systemTendencies?: string,
  listenerPriorities?: string[],
  recommendedDirection?: string,
): string | undefined {
  if (!systemTendencies || !listenerPriorities || listenerPriorities.length === 0) {
    return undefined;
  }
  const priorityBrief = listenerPriorities[0];
  if (recommendedDirection) {
    return `Your system's current tendencies — ${systemTendencies.toLowerCase()} — interact with your preference for ${priorityBrief.toLowerCase()}. The recommended direction addresses that relationship.`;
  }
  return `Your system's current tendencies — ${systemTendencies.toLowerCase()} — relate to your preference for ${priorityBrief.toLowerCase()}.`;
}

/**
 * Enrich an AdvisoryResponse with generated content.
 * Called after the base adapter mapping. Only adds fields that
 * are not already populated.
 */
function enrichAdvisory(advisory: AdvisoryResponse): AdvisoryResponse {
  const enriched = { ...advisory };

  // Bottom line — only for shopping and diagnosis
  if (!enriched.bottomLine && enriched.kind !== 'consultation') {
    enriched.bottomLine = generateBottomLine(
      enriched.kind,
      enriched.subject,
      enriched.recommendedDirection,
      enriched.tradeOffs,
    );
  }

  // Alignment rationale — only when not already set
  if (!enriched.alignmentRationale) {
    enriched.alignmentRationale = generateAlignmentRationale(
      enriched.systemTendencies,
      enriched.listenerPriorities,
      enriched.recommendedDirection,
    );
  }

  return enriched;
}

// ── Adapter: Consultation → Advisory ─────────────────

export function consultationToAdvisory(c: ConsultationResponse): AdvisoryResponse {
  return enrichAdvisory({
    kind: 'consultation',
    subject: c.subject,

    comparisonSummary: c.comparisonSummary,
    philosophy: c.philosophy,
    tendencies: c.tendencies,
    systemFit: c.systemContext,
    followUp: c.followUp,
    links: c.links?.map((l) => ({
      label: l.label,
      url: l.url,
      kind: l.kind,
      region: l.region,
    })),
  });
}

// ── Adapter: GearResponse → Advisory ─────────────────

export function gearResponseToAdvisory(r: GearResponse): AdvisoryResponse {
  // "What I'm hearing" bullets become listener priorities
  const listenerPriorities = r.hearing && r.hearing.length > 0
    ? r.hearing
    : undefined;

  return enrichAdvisory({
    kind: 'consultation',
    subject: r.subjects.length > 0 ? r.subjects.join(', ') : 'your question',

    listenerPriorities,
    systemTendencies: r.systemDirection?.tendencySummary ?? undefined,

    // anchor + character become the prose body
    philosophy: r.anchor,
    tendencies: r.character,
    systemFit: r.interpretation,

    recommendedDirection: r.direction,
    followUp: r.clarification,
  });
}

// ── Adapter: ShoppingAnswer → Advisory ───────────────

/**
 * Map gap dimension labels to readable strings.
 */
const GAP_LABELS: Record<GapDimension, string> = {
  taste: 'sonic preferences',
  system: 'system context',
  budget: 'budget',
  use_case: 'listening context',
};

export function shoppingToAdvisory(
  a: ShoppingAnswer,
  signals?: ExtractedSignals,
): AdvisoryResponse {
  // Parse preferenceSummary into listenerPriorities if it's a meaningful sentence
  const listenerPriorities = a.preferenceSummary
    ? [a.preferenceSummary]
    : undefined;

  const options: AdvisoryOption[] = a.productExamples.map((p) => ({
    name: p.name,
    brand: p.brand,
    price: p.price,
    priceCurrency: p.priceCurrency,
    fitNote: p.fitNote,
    caution: p.caution,
    links: p.links?.map((l) => ({ label: l.label, url: l.url })),
  }));

  const statedGaps = a.statedGaps?.map((g) => GAP_LABELS[g]);

  return enrichAdvisory({
    kind: 'shopping',
    subject: a.category,

    listenerPriorities,
    systemContext: a.systemNote,

    recommendedDirection: a.bestFitDirection,
    whyThisFits: a.whyThisFits.length > 0 ? a.whyThisFits : undefined,
    tradeOffs: a.watchFor.length > 0 ? a.watchFor : undefined,

    options: options.length > 0 ? options : undefined,
    provisional: a.provisional,
    statedGaps: statedGaps && statedGaps.length > 0 ? statedGaps : undefined,
    dependencyCaveat: a.dependencyCaveat,

    followUp: a.refinementQuestion,

    // Diagnostics from signals
    diagnostics: signals ? {
      matchedPhrases: signals.matched_phrases,
      symptoms: signals.symptoms,
      traits: signals.traits,
    } : undefined,
  });
}

// ── Adapter: Analysis → Advisory ─────────────────────

export function analysisToAdvisory(
  result: EvaluationResult,
  signals: ExtractedSignals,
  sysDir?: SystemDirection,
): AdvisoryResponse {
  // Use the highest-priority fired rule for the main advisory content
  const primary: FiredRule | undefined = result.fired_rules[0];

  // Collect all suggestions and risks across fired rules
  const allSuggestions = result.fired_rules.flatMap((r) => r.outputs.suggestions);
  const allRisks = result.fired_rules.flatMap((r) => r.outputs.risks);

  // Derive listener priorities from system direction if available
  const listenerPriorities: string[] = [];
  if (sysDir?.directionSummary) {
    listenerPriorities.push(sysDir.directionSummary);
  }

  // Derive avoids from current tendencies (what the system is doing that the user doesn't want)
  const listenerAvoids: string[] = [];
  if (sysDir?.tendencySummary) {
    listenerAvoids.push(sysDir.tendencySummary);
  }

  return enrichAdvisory({
    kind: 'diagnosis',
    subject: primary?.label ?? 'your listening situation',

    listenerPriorities: listenerPriorities.length > 0 ? listenerPriorities : undefined,
    listenerAvoids: listenerAvoids.length > 0 ? listenerAvoids : undefined,
    systemTendencies: sysDir?.tendencySummary ?? undefined,

    // Primary rule explanation becomes the tendencies prose
    tendencies: primary?.outputs.explanation,

    // Suggestions become whyThisFits (what to do and why)
    whyThisFits: allSuggestions.length > 0 ? allSuggestions : undefined,
    tradeOffs: allRisks.length > 0 ? allRisks : undefined,

    // Next step from primary rule becomes follow-up
    followUp: primary?.outputs.next_step,

    // Archetype note surfaced if present
    alignmentRationale: primary?.outputs.archetype_note ?? sysDir?.archetypeNote ?? undefined,

    // Diagnostics
    diagnostics: {
      matchedPhrases: signals.matched_phrases,
      symptoms: signals.symptoms,
      traits: signals.traits,
    },
  });
}
