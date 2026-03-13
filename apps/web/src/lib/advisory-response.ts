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
import { findBrandProfileByName } from './consultation';
import type { ShoppingAnswer, GapDimension } from './shopping-intent';
import type { GearResponse } from './conversation-types';
import type { EvaluationResult, FiredRule } from './rule-types';
import type { ExtractedSignals } from './signal-types';
import type { SystemDirection } from './system-direction';
import type { ReasoningResult } from './reasoning';
import { getArchetypeLabel } from './archetype';

// ── Types ────────────────────────────────────────────

export interface AdvisoryOption {
  name: string;
  brand?: string;
  price?: number;
  priceCurrency?: string;
  /** Brief sonic character description — what this component sounds like. */
  character?: string;
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

// ── Structured assessment types (memo format) ─────────

/**
 * Per-component structured assessment.
 * Replaces prose componentReadings with a Strengths/Weakness
 * format matching the reference advisory memo style.
 */
export interface ComponentAssessment {
  /** Component display name (e.g. "JOB Integrated", "Chord Hugo v1"). */
  name: string;
  /** Role in the system (e.g. "anchor", "source", "transducer"). */
  role?: string;
  /** One-line framing sentence. */
  summary: string;
  /** What this component does well (short bullet items). */
  strengths: string[];
  /** Where this component is limited (short bullet items). */
  weaknesses: string[];
  /** Bold verdict — "Keep this." or "This is the weak link." */
  verdict: string;
}

/**
 * Ranked upgrade path — one axis of improvement.
 * Each path may contain multiple product options.
 */
export interface UpgradePath {
  /** Display rank (1 = highest impact). */
  rank: number;
  /** Path label (e.g. "DAC", "Speaker Upgrade", "Add Subwoofer"). */
  label: string;
  /** Impact framing (e.g. "Highest Impact"). */
  impact?: string;
  /** Why this path matters (1–2 sentences). */
  rationale: string;
  /** Ranked product options within this path. */
  options: UpgradePathOption[];
}

/**
 * A single product option within an upgrade path.
 */
export interface UpgradePathOption {
  /** Display rank within the path. */
  rank: number;
  /** Product name. */
  name: string;
  brand?: string;
  /** Approximate price (used market or new). */
  price?: number;
  priceCurrency?: string;
  /** Price context (e.g. "~$900–1200 used"). */
  priceNote?: string;
  /** One-line summary. */
  summary: string;
  /** What improves (short bullet items). */
  pros: string[];
  /** What to watch for (short bullet items). */
  cons?: string[];
  /** Bold verdict (e.g. "best match with the JOB"). */
  verdict?: string;
}

/**
 * Component the advisor recommends keeping unchanged.
 */
export interface KeepRecommendation {
  /** Component name. */
  name: string;
  /** Why to keep it (1 sentence). */
  reason: string;
}

/**
 * Sequenced upgrade step — "What I Would Do" format.
 */
export interface RecommendedStep {
  /** Step number (1-based). */
  step: number;
  /** Action description (e.g. "Upgrade DAC → Chord Qutest or TT2"). */
  action: string;
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

  // ── 5b. Upgrade Analysis Sections ─────────────────
  /** "What is working well" — bullet list of current system strengths. */
  strengths?: string[];
  /** "Where limitations may appear" — bullet list of current limitations. */
  limitations?: string[];
  /** "What improves" — bullet list of concrete improvements from the proposed change. */
  improvements?: string[];
  /** "What probably stays the same" — bullet list of continuities. */
  unchanged?: string[];
  /** "When this upgrade makes sense" — conditions where the move is appropriate. */
  whenToAct?: string;
  /** "When it may not be the best next step" — conditions for restraint. */
  whenToWait?: string;

  // ── 5c. System Balance & Impact ───────────────────
  /** System balance summary — trait-level diagnostic across core listening traits. */
  systemBalance?: import('./conversation-types').SystemBalanceEntry[];
  /** Where upgrades would have the most impact — system-level reasoning (bullet list). */
  upgradeImpactAreas?: string[];
  /** Expected magnitude of change — Minor / Moderate / Major + explanation. */
  changeMagnitude?: import('./conversation-types').ChangeMagnitude;

  // ── 5d. System Assessment Sections ─────────────────
  /** Per-component character paragraphs for system assessment responses. */
  componentReadings?: string[];
  /** How the components interact as a system (prose). */
  systemInteraction?: string;
  /** What is working well in the current system (prose or bullets). */
  assessmentStrengths?: string[];
  /** Where limitations may appear (prose or bullets). */
  assessmentLimitations?: string[];
  /** Likely upgrade direction or "do nothing" guidance (prose). */
  upgradeDirection?: string;

  // ── 5e. Structured Assessment (memo format) ────────
  /** Per-component structured analysis (Strengths/Weaknesses/Verdict). */
  componentAssessments?: ComponentAssessment[];
  /** Ranked upgrade paths with product options. */
  upgradePaths?: UpgradePath[];
  /** Components the advisor recommends keeping unchanged. */
  keepRecommendations?: KeepRecommendation[];
  /** Sequenced upgrade steps ("What I Would Do"). */
  recommendedSequence?: RecommendedStep[];
  /** Key observation about the listener's taste pattern. */
  keyObservation?: string;

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
 * Generate alignment rationale with graceful fallback chain.
 *
 * Fallback order:
 *   1. systemTendencies + listenerPriorities → full bridge sentence
 *   2. reasoning.direction.archetypeNote → already human-readable
 *   3. reasoning.direction.statement + preserve[] → direction + preserve
 *   4. reasoning.taste.archetype → archetype-based framing
 *   5. nothing → section doesn't render
 */
function generateAlignmentRationale(
  systemTendencies?: string,
  listenerPriorities?: string[],
  recommendedDirection?: string,
  reasoning?: ReasoningResult,
): string | undefined {
  // 1. Full bridge — system tendencies + listener priorities
  if (systemTendencies && listenerPriorities && listenerPriorities.length > 0) {
    const priorityBrief = listenerPriorities[0];
    if (recommendedDirection) {
      return `Your system's current tendencies — ${systemTendencies.toLowerCase()} — interact with your preference for ${priorityBrief.toLowerCase()}. The recommended direction addresses that relationship.`;
    }
    return `Your system's current tendencies — ${systemTendencies.toLowerCase()} — relate to your preference for ${priorityBrief.toLowerCase()}.`;
  }

  if (!reasoning) return undefined;

  // 2. Archetype note from reasoning direction layer
  if (reasoning.direction.archetypeNote) {
    return reasoning.direction.archetypeNote;
  }

  // 3. Direction statement + preserve qualities
  if (reasoning.direction.statement && reasoning.direction.preserve.length > 0) {
    return `${reasoning.direction.statement} Worth preserving: ${reasoning.direction.preserve.join(', ')}.`;
  }

  // 4. Taste archetype framing
  if (reasoning.taste.archetype) {
    const label = getArchetypeLabel(reasoning.taste.archetype);
    if (label) {
      return `Your preferences align with a ${label.toLowerCase()} listening approach.`;
    }
  }

  return undefined;
}

/**
 * Collect brand-level links from advisory options or explicit subject names.
 *
 * Extracts unique brand names, looks up their brand profiles, and returns
 * deduplicated AdvisoryLink[] for the "Learn More" section. Skips brands
 * that have no profile or no links.
 */
function collectBrandLinks(
  options?: AdvisoryOption[],
  subjectNames?: string[],
): AdvisoryLink[] {
  const seen = new Set<string>();
  const links: AdvisoryLink[] = [];

  // Collect brand names from options
  const brandNames: string[] = [];
  if (options) {
    for (const opt of options) {
      if (opt.brand && !seen.has(opt.brand.toLowerCase())) {
        seen.add(opt.brand.toLowerCase());
        brandNames.push(opt.brand);
      }
    }
  }

  // Collect from explicit subject names (gear-response subjects)
  if (subjectNames) {
    for (const name of subjectNames) {
      const lower = name.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        brandNames.push(name);
      }
    }
  }

  // Look up brand profiles and collect links
  const seenUrls = new Set<string>();
  for (const brandName of brandNames) {
    const profile = findBrandProfileByName(brandName);
    if (!profile?.links) continue;
    for (const link of profile.links) {
      if (!seenUrls.has(link.url)) {
        seenUrls.add(link.url);
        links.push({
          label: link.label,
          url: link.url,
          kind: link.kind,
          region: link.region,
        });
      }
    }
  }

  return links;
}

/**
 * Enrich an AdvisoryResponse with generated content.
 * Called after the base adapter mapping. Only adds fields that
 * are not already populated.
 *
 * Accepts an optional ReasoningResult for richer alignment generation.
 * Accepts optional subjectNames for brand link collection (gear-response path).
 */
function enrichAdvisory(
  advisory: AdvisoryResponse,
  reasoning?: ReasoningResult,
  subjectNames?: string[],
): AdvisoryResponse {
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
      reasoning,
    );
  }

  // Listener priorities from reasoning taste label — if not already populated
  if (!enriched.listenerPriorities && reasoning?.taste.tasteLabel) {
    enriched.listenerPriorities = [reasoning.taste.tasteLabel];
  }

  // Brand links — collect from options and/or explicit subject names
  if (!enriched.links || enriched.links.length === 0) {
    const brandLinks = collectBrandLinks(enriched.options, subjectNames);
    if (brandLinks.length > 0) {
      enriched.links = brandLinks;
    }
  }

  return enriched;
}

// ── Adapter: Consultation → Advisory ─────────────────

export function consultationToAdvisory(c: ConsultationResponse): AdvisoryResponse {
  // For system assessments, systemContext carries the character opening —
  // map it to the dedicated systemContext field (not systemFit, which feeds
  // into AdvisoryProse and would duplicate the content).
  const isAssessment = !!(c.componentReadings && c.componentReadings.length > 0);

  return enrichAdvisory({
    kind: 'consultation',
    subject: c.subject,

    comparisonSummary: c.comparisonSummary,
    philosophy: c.philosophy,
    tendencies: c.tendencies,
    systemFit: isAssessment ? undefined : c.systemContext,
    systemContext: isAssessment ? c.systemContext : undefined,
    followUp: c.followUp,
    links: c.links?.map((l) => ({
      label: l.label,
      url: l.url,
      kind: l.kind,
      region: l.region,
    })),

    // System assessment specific fields (populated only for assessment responses)
    componentReadings: c.componentReadings,
    systemInteraction: c.systemInteraction,
    assessmentStrengths: c.assessmentStrengths,
    assessmentLimitations: c.assessmentLimitations,
    upgradeDirection: c.upgradeDirection,

    // Structured memo-format fields
    componentAssessments: c.componentAssessments,
    upgradePaths: c.upgradePaths,
    keepRecommendations: c.keepRecommendations,
    recommendedSequence: c.recommendedSequence,
    keyObservation: c.keyObservation,
  });
}

// ── Adapter: GearResponse → Advisory ─────────────────

export function gearResponseToAdvisory(r: GearResponse): AdvisoryResponse {
  // "What I'm hearing" bullets become listener priorities
  const listenerPriorities = r.hearing && r.hearing.length > 0
    ? r.hearing
    : undefined;

  // When a structured upgrade analysis is present, map it into
  // the dedicated advisory sections. The old anchor/character/direction
  // fields remain populated as fallbacks but the structured fields
  // take rendering priority in AdvisoryMessage.
  if (r.upgradeAnalysis) {
    const ua = r.upgradeAnalysis;
    return enrichAdvisory({
      kind: 'consultation',
      subject: r.subjects.length > 0 ? r.subjects.join(', ') : 'your question',

      listenerPriorities,
      systemTendencies: r.systemDirection?.tendencySummary ?? undefined,

      // Section 1 → systemContext (renders under "Your system" label)
      systemContext: ua.systemCharacter,

      // Section 4 → tendencies (core prose body)
      tendencies: ua.whatChanges,

      // Section 2 → strengths
      strengths: ua.workingWell,
      // Section 3 → limitations
      limitations: ua.limitations,
      // Section 5 → improvements
      improvements: ua.improvements,
      // Section 6 → unchanged
      unchanged: ua.unchanged,
      // Section 7 → whenToAct
      whenToAct: ua.whenMakesSense,
      // Section 8 → whenToWait
      whenToWait: ua.whenToWait,

      // Section 9 → systemBalance
      systemBalance: ua.systemBalance,
      // Section 10 → upgradeImpactAreas
      upgradeImpactAreas: ua.upgradeImpactAreas,
      // Section 11 → changeMagnitude
      changeMagnitude: ua.changeMagnitude,

      // Follow-up → followUp
      followUp: r.clarification,
    }, undefined, r.subjects.length > 0 ? r.subjects : undefined);
  }

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
  }, undefined, r.subjects.length > 0 ? r.subjects : undefined);
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
  reasoning?: ReasoningResult,
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
    character: p.character,
    fitNote: p.fitNote,
    caution: p.caution,
    links: p.links?.map((l) => ({ label: l.label, url: l.url })),
  }));

  const statedGaps = a.statedGaps?.map((g) => GAP_LABELS[g]);

  // Collect source references from recommended products (deduplicated)
  const sourceRefs: SourceReference[] = [];
  const seenSources = new Set<string>();
  for (const p of a.productExamples) {
    if (p.sourceReferences) {
      for (const ref of p.sourceReferences) {
        if (!seenSources.has(ref.source)) {
          seenSources.add(ref.source);
          sourceRefs.push({ source: ref.source, note: ref.note });
        }
      }
    }
  }

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

    // Source references from recommended products
    sourceReferences: sourceRefs.length > 0 ? sourceRefs : undefined,

    // Diagnostics from signals
    diagnostics: signals ? {
      matchedPhrases: signals.matched_phrases,
      symptoms: signals.symptoms,
      traits: signals.traits,
    } : undefined,
  }, reasoning);
}

// ── Adapter: Analysis → Advisory ─────────────────────

export function analysisToAdvisory(
  result: EvaluationResult,
  signals: ExtractedSignals,
  sysDir?: SystemDirection,
  reasoning?: ReasoningResult,
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
  }, reasoning);
}
