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
import type { DecisionFrame } from './decision-frame';
import { detectSystemPhono, buildPhonoCaveat } from './products/turntables';

// ── Types ────────────────────────────────────────────

/**
 * Structured audio listener profile — rendered as the "Audio Preferences"
 * block at the top of shopping/editorial responses.
 *
 * Built from reasoning layers + system context. When the profile is
 * incomplete, `profileComplete` is false and `missingDimensions` lists
 * what we don't know — the UI can then offer to gather more context
 * or proceed with diverse/exploratory recommendations.
 */
export interface AudioProfile {
  /** User's signal chain components (e.g. ["Eversolo DMP-A6", "Chord Hugo v1", "JOB Integrated", "WLM Diva monitors"]). */
  systemChain?: string[];
  /** What the user values sonically (e.g. ["flow", "elasticity", "air and sparkle", "no glare"]). */
  sonicPriorities?: string[];
  /** What the user tends to avoid (e.g. ["harshness", "digital glare", "fatigue"]). */
  sonicAvoids?: string[];
  /** Listening context clues (e.g. ["apartment listening", "low volume", "jazz and classical", "tube-friendly"]). */
  listeningContext?: string[];
  /** Sonic archetype label (e.g. "flow-oriented", "precision-focused"). */
  archetype?: string;
  /** Budget context if stated. */
  budget?: string;
  /** One-line direction statement (e.g. "Move toward more warmth without sacrificing detail"). */
  directionStatement?: string;
  /** Whether the profile has enough data for personalized recommendations. */
  profileComplete: boolean;
  /** Which dimensions are missing when profile is incomplete. */
  missingDimensions?: string[];
}

/**
 * Predicted sonic impact of adding a product to the user's system.
 * Generated deterministically from product tendency profiles and
 * system character. Explains *what changes*, not just *what it is*.
 */
export interface SystemDelta {
  /** One-sentence explanation of why this product fits the system context. */
  whyFitsSystem?: string;
  /** Traits the product is likely to improve or add to the system. */
  likelyImprovements?: string[];
  /** Traits the product may reduce or trade away. */
  tradeOffs?: string[];
}

export interface AdvisoryOption {
  name: string;
  brand?: string;
  price?: number;
  priceCurrency?: string;
  /** Brief sonic character description — what this component sounds like. */
  character?: string;
  /** Design/architecture highlights — "Why it stands out" bullets. */
  standoutFeatures?: string[];
  /** Sonic character bullets — "Sound profile" (distinct from fitNote verdict). */
  soundProfile?: string[];
  /** Why this option fits the listener's priorities. */
  fitNote: string;
  /** Any caution or trade-off note. */
  caution?: string;
  /** Links to official site, reviews, retailers. */
  links?: Array<{ label: string; url: string }>;

  // ── Enhanced card fields ─────────────────────────────
  /** Product image URL — falls back to placeholder when absent. */
  imageUrl?: string;
  /** Sonic direction label (e.g. "flow-oriented", "precision-focused"). */
  sonicDirectionLabel?: string;
  /** Product category or type for display (e.g. "Integrated Amplifier"). */
  productType?: string;
  /** Manufacturer URL — prioritized in link display. */
  manufacturerUrl?: string;
  /** Used-market exploration link (HiFi Shark, Audiogon, etc.). */
  usedMarketUrl?: string;
  /** Market availability. */
  availability?: 'current' | 'discontinued' | 'vintage';
  /** Used price range for discontinued/vintage products. */
  usedPriceRange?: { low: number; high: number };
  /** Used-market discovery links (HiFi Shark, Audiogon, etc.). */
  usedMarketSources?: Array<{ name: string; url: string; region: string }>;
  /** Predicted sonic impact of this product in the user's system. */
  systemDelta?: SystemDelta;

  // ── Catalog facts (not rendered — used for LLM validation) ──
  /** Raw architecture string from catalog (e.g. "delta-sigma (ESS)"). */
  catalogArchitecture?: string;
  /** Design topology (e.g. "r2r", "fpga", "delta-sigma"). */
  catalogTopology?: string;
  /** Country of origin (ISO code, e.g. "CN", "US", "JP"). */
  catalogCountry?: string;
  /** Brand scale from catalog (e.g. "specialist", "boutique", "major"). */
  catalogBrandScale?: string;

  // ── Decision frame mapping ──────────────────────────
  /** Which decision direction this product supports (label from DecisionFrame). */
  directionLabel?: string;
  /** True when this product is already in the user's current system. */
  isCurrentComponent?: boolean;
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

// ── Editorial closing types ──────────────────────────

/** A single pick in the editorial closing section. */
export interface EditorialPick {
  /** Product name. */
  name: string;
  /** One-line reason (e.g. "Best resolution and timing under $1k."). */
  reason: string;
}

/** LLM-generated editorial closing — system-specific synthesis. */
export interface EditorialClosing {
  /** "Top picks on sound quality alone" — context-free ranking. */
  topPicks?: EditorialPick[];
  /** "What I'd recommend for YOUR system" — system-aware picks. */
  systemPicks?: EditorialPick[];
  /** System context summary (e.g. "Given your JOB Integrated + Boenicke W5…"). */
  systemSummary?: string;
  /** Avoidance note (e.g. "I would avoid overly analytical ESS DACs in your system…"). */
  avoidanceNote?: string;
}

// ── Structured assessment types (memo format) ─────────

/**
 * Machine-readable verdict classification for deterministic logic and downstream consumers.
 * Complements the prose `verdict` field on ComponentAssessment.
 */
export type VerdictKind =
  | 'bottleneck'
  | 'upgrade_candidate'
  | 'keeper'
  | 'balanced';

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
  /**
   * Design trade-offs for elite products — axis-derived observations that
   * represent intentional design philosophy rather than actual limitations.
   * Not counted toward upgrade path ranking. Rendered with distinct framing.
   */
  designTradeoffs?: string[];
  /** Bold verdict — "Keep this." or "This is the weak link." */
  verdict: string;
  /** Machine-readable verdict classification for deterministic consumers. */
  verdictKind: VerdictKind;
  /** Product/brand links associated with this component. */
  links?: Array<{ label: string; url: string; kind?: 'reference' | 'dealer' | 'review'; region?: string }>;
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
  /** System-level reasoning — how this option interacts with the current system. */
  systemDelta?: SystemDelta;
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
 * System signal chain — ordered component listing for display.
 *
 * Two layers:
 *   1. fullChain — the user's entered chain preserved as-is (includes cables, accessories).
 *   2. roles / names — major signal-path components only (streamer, DAC, amp, speakers).
 */
export interface SystemChain {
  /** Full chain as entered by the user, arrow-separated segments preserved. */
  fullChain?: string[];
  /** Ordered role labels for major components (e.g. ["Streamer", "DAC", "Amplifier", "Speakers"]). */
  roles: string[];
  /** Ordered component names matching the role positions. */
  names: string[];
}

/**
 * Primary system constraint identified by bottleneck detection.
 * Drives upgrade path ranking — Path 1 always addresses this.
 */
export interface PrimaryConstraint {
  /** Which component (by display name) is the bottleneck. */
  componentName: string;
  /** Constraint category. */
  category: 'dac_limitation' | 'speaker_scale' | 'amplifier_control' | 'tonal_imbalance' | 'stacked_bias' | 'source_limitation';
  /** One-line explanation of the constraint. */
  explanation: string;
}

/**
 * Stacked trait detection result.
 * When multiple components push in the same sonic direction.
 */
export interface StackedTraitInsight {
  /** Label for the stacked tendency (e.g. "high transient bias"). */
  label: string;
  /** Which components contribute. */
  contributors: string[];
  /** Explanatory prose for the assessment. */
  explanation: string;
  /**
   * Classification of the stacked trait:
   * - 'system_character': Intentional or desirable alignment — defines the system's
   *   sonic identity. Not treated as a weakness.
   * - 'system_imbalance': Stacking that pushes the system beyond reasonable thresholds,
   *   conflicts with common listening goals, or lacks opposing counterbalance.
   */
  classification: 'system_character' | 'system_imbalance';
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
/**
 * Advisory mode — determines the response rendering path.
 * Shown as a subtle indicator near the top of the response.
 */
export type AdvisoryMode =
  | 'system_review'
  | 'gear_advice'
  | 'gear_comparison'
  | 'upgrade_suggestions'
  | 'product_assessment'
  | 'audio_knowledge'
  | 'audio_assistant'
  | 'general';

/**
 * Structured product assessment — evaluates a single component
 * in the context of the user's system and preferences.
 *
 * This is the structured input object that the LLM synthesizes
 * into advisory prose. All fields are deterministic; the LLM
 * translates, it does not invent.
 */
export interface ProductAssessment {
  /** The product being evaluated. */
  candidateName: string;
  candidateBrand: string;
  candidateArchitecture?: string;
  candidateDescription?: string;
  candidateTraits?: Record<string, number>;
  candidatePrice?: number;
  candidateTopology?: string;

  /** The current component being replaced (if identifiable). */
  currentComponentName?: string;
  currentComponentArchitecture?: string;

  /** Short answer — 1-2 sentence practical conclusion. */
  shortAnswer: string;

  /** What actually changes — architecture, tonal, transient differences. */
  whatChanges: string[];

  /** How it behaves in this system — interaction with the user's chain. */
  systemBehavior: string[];

  /** Does this solve the user's real goal? */
  goalAlignment: string;

  /** Honest recommendation — keep, upgrade, wait, or change philosophy. */
  recommendation: string;

  /** Whether the product was found in the catalog (affects confidence). */
  catalogMatch: boolean;
}

/**
 * Audio Knowledge response — general audio questions not tied to
 * a system decision. Technology explanations, product opinions,
 * sound signatures, brand discussion.
 *
 * The LLM generates the prose body, but receives structured context
 * (system chain, taste profile, catalog data) as input. System-aware
 * commentary is deterministically composed from the profile.
 */
export interface KnowledgeResponse {
  /** The topic being explained or discussed. */
  topic: string;
  /** Main explanation body — LLM-generated prose. */
  explanation: string;
  /** Optional system-aware note — deterministically derived from user context. */
  systemNote?: string;
  /** Key takeaways or summary points. */
  keyPoints?: string[];
}

/**
 * Audio Assistant response — practical hobby tasks: negotiation,
 * translation, message writing, travel/audition logistics.
 *
 * Open LLM generation with Audio XX tone guardrails
 * (calm, non-promotional, no urgency).
 */
export interface AssistantResponse {
  /** The task type (negotiation, translation, message, logistics). */
  taskType: 'negotiation' | 'translation' | 'message' | 'logistics' | 'listing_evaluation' | 'general';
  /** Main response body — LLM-generated prose or the drafted message. */
  body: string;
  /** For translations — the original language detected. */
  sourceLanguage?: string;
  /** For translations — the target language. */
  targetLanguage?: string;
  /** Practical tips or considerations. */
  tips?: string[];
}

/** Where the response data originated — used for provenance labeling. */
export type AdvisorySource = 'catalog' | 'brand_profile' | 'llm_inferred' | 'provisional_system';

export interface AdvisoryResponse {
  /** Determines framing voice. */
  kind: 'consultation' | 'shopping' | 'diagnosis' | 'assessment' | 'knowledge' | 'assistant';
  /** Display title for the assessment (e.g. "Living Room System"). */
  title?: string;
  /** The subject being advised about (brand, product, symptom, category). */
  subject: string;
  /** Advisory mode label — shown as a subtle indicator in the response header. */
  advisoryMode?: AdvisoryMode;
  /** Data provenance — determines whether a confidence label appears. */
  source?: AdvisorySource;
  /** Names of components not in the validated catalog (provisional assessments only). */
  unknownComponents?: string[];
  /** System signature — one-sentence characterization of the system's sonic identity. */
  systemSignature?: string;

  // ── 0. Audio Profile ──────────────────────────────────
  /** Structured listener profile — system, sonic priorities, context. */
  audioProfile?: AudioProfile;

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

  // ── 2b. Why This Fits You ───────────────────────────
  /** Compact personalization bullets connecting recommendation to user context. */
  whyFitsYou?: string[];

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
  /** Ordered system chain for display (Role → Role / Name → Name). */
  systemChain?: SystemChain;
  /** Intro paragraph — 1–2 sentence system overview before numbered sections. */
  introSummary?: string;
  /** Primary system constraint (bottleneck). Drives upgrade path ranking. */
  primaryConstraint?: PrimaryConstraint;
  /** Stacked trait insights — when multiple components push the same direction. */
  stackedTraitInsights?: StackedTraitInsight[];
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
  /** System synergy summary — why the system works well together. */
  systemSynergy?: string;
  /** Listener taste profile — structured sonic preferences for the profile section. */
  listenerTasteProfile?: {
    /** Primary sonic traits the listener values. */
    primaryTraits: string[];
    /** Secondary traits — present but less dominant. */
    secondaryTraits?: string[];
    /** Traits the listener typically avoids or de-emphasizes. */
    avoided?: string[];
    /** Prose summary of the listener's design philosophy. */
    philosophy?: string;
  };
  /** Spider chart data — numeric trait values for radar visualization. */
  spiderChartData?: Array<{ trait: string; value: number; fullMark: number }>;

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

  // ── 7b. Sonic Landscape ────────────────────────────
  /** Explains the design philosophies represented in the shortlist. */
  sonicLandscape?: string;

  // ── 7d. Decision Frame ────────────────────────────
  /** Strategic decision frame — presented before product options. */
  decisionFrame?: DecisionFrame;

  // ── 7c. Refinement Prompts ────────────────────────
  /** Questions that would deepen personalization in the next turn. */
  refinementPrompts?: string[];

  // ── 7e. System Context Preamble ─────────────────────
  /** Compact system diagnosis before product recommendations (2–3 sentences).
   *  Covers: current tendency, main interaction risk, sensible upgrade direction.
   *  Only populated when an active system is available during shopping. */
  systemContextPreamble?: string;

  // ── 7f. Editorial Intro ─────────────────────────────
  /** Taste-anchored intro paragraph — frames the shortlist in terms of user preferences. */
  editorialIntro?: string;

  // ── 7f. Editorial Closing ─────────────────────────
  /** LLM-generated closing: system-specific top picks + avoidance notes. */
  editorialClosing?: EditorialClosing;

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

  // ── 11b. Product Assessment ─────────────────────────
  /** Structured product assessment — populated for product_assessment advisory mode. */
  productAssessment?: ProductAssessment;

  // ── 12. Knowledge & Assistant Lanes ────────────────
  /** Structured knowledge response — populated for audio_knowledge intent. */
  knowledgeResponse?: KnowledgeResponse;
  /** Structured assistant response — populated for audio_assistant intent. */
  assistantResponse?: AssistantResponse;

  // ── 13. Diagnostics (collapsible) ───────────────────
  /** Signal interpretation transparency. */
  diagnostics?: {
    matchedPhrases: string[];
    symptoms: string[];
    traits: Record<string, 'up' | 'down'>;
  };
}

// ── Content Enrichment ───────────────────────────────

/**
 * Build a taste-anchored intro paragraph that frames the shortlist
 * in terms of the user's preferences and priorities.
 *
 * Example output:
 * "Below is a curated shortlist of DACs under $1,000, focusing on units
 *  known for clarity, dynamics, and spatial depth — which aligns with
 *  your preference for precision and rhythmic engagement."
 */
function buildEditorialIntro(
  category: string,
  budget?: string,
  storedDesires?: string[],
  tasteLabel?: string,
  systemComponents?: string[],
  archetype?: string,
): string | undefined {
  // Need at least a category
  if (!category || category === 'general') return undefined;

  // Category label
  const CATEGORY_LABELS: Record<string, string> = {
    dac: 'DACs',
    amplifier: 'amplifiers',
    speaker: 'speakers',
    headphone: 'headphones',
    streamer: 'streamers',
    turntable: 'turntables',
  };
  const catLabel = CATEGORY_LABELS[category] ?? category;

  // Build the budget clause — include used-market note
  const budgetClause = budget
    ? ` under ~${budget} (new price or typical used price)`
    : '';

  // Selection philosophy sentence
  const selectionNote = ` I selected models that are widely regarded for sound quality and musical engagement, not simply "good for the money."`;

  // Build the preference anchor
  let preferenceClause = '';

  if (storedDesires && storedDesires.length >= 2) {
    // Use stored taste profile traits
    const traitList = storedDesires.slice(0, 3);
    const formatted = traitList.length === 1
      ? traitList[0].toLowerCase()
      : traitList.length === 2
        ? `${traitList[0].toLowerCase()} and ${traitList[1].toLowerCase()}`
        : `${traitList.slice(0, -1).map(t => t.toLowerCase()).join(', ')}, and ${traitList[traitList.length - 1].toLowerCase()}`;
    preferenceClause = ` The list considers your listening priorities: ${formatted}`;
  } else if (tasteLabel) {
    preferenceClause = ` The list is aligned with your preference for ${tasteLabel.toLowerCase()}`;
  }

  // Build the archetype bridge
  const ARCHETYPE_BRIDGES: Record<string, string> = {
    flow_organic: 'musical flow and organic presentation',
    precision_explicit: 'precision and detail retrieval',
    rhythmic_propulsive: 'rhythmic energy and dynamic engagement',
    tonal_saturated: 'tonal richness and harmonic density',
    spatial_holographic: 'spatial precision and holographic staging',
  };

  let alignmentClause = '';
  if (archetype && ARCHETYPE_BRIDGES[archetype]) {
    alignmentClause = `, prioritising ${ARCHETYPE_BRIDGES[archetype]} rather than purely measurement-driven designs`;
  }

  // System compatibility note — extract amplifier name if present
  let systemClause = '';
  if (systemComponents && systemComponents.length > 0) {
    const AMP_KEYWORDS = ['integrated', 'amplifier', 'amp', 'receiver', 'preamp', 'power amp'];
    const ampComponent = systemComponents.find(c =>
      AMP_KEYWORDS.some(kw => c.toLowerCase().includes(kw)),
    );
    if (ampComponent) {
      systemClause = `, and compatibility with your ${ampComponent}`;
    } else {
      systemClause = `, and compatibility with your current system`;
    }
  }

  // Combine: "Below are … under ~$2,000 (new price or typical used price). I selected …
  //           The list considers … prioritising …, and compatibility with …."
  const opening = `Below are the most consistently respected ${catLabel}${budgetClause}.`;
  const body = `${selectionNote}${preferenceClause}${alignmentClause}${systemClause}.`;

  return `${opening}${body}`;
}

/**
 * Build a compact system context preamble for shopping responses.
 *
 * When an active system is available, this produces 2–3 sentences covering:
 *   1. Current system tendency (from axis model or tendency summary)
 *   2. Main interaction risk or constraint
 *   3. Sensible upgrade direction
 *
 * Uses the existing deterministic reasoning engine — no LLM call.
 * Returns undefined when no active system or reasoning data is available.
 */
function buildSystemContextPreamble(
  systemComponents?: string[],
  reasoning?: ReasoningResult,
  systemTendencies?: string | null,
): string | undefined {
  // Gate: need a system and some reasoning data
  if (!systemComponents || systemComponents.length === 0) return undefined;
  if (!reasoning) return undefined;

  const parts: string[] = [];

  // ── Sentence 1: Current system tendency ──
  // Prefer the reasoning engine's tendency summary; fall back to stored tendencies.
  const tendencySummary = reasoning.system.tendencySummary ?? systemTendencies;
  if (tendencySummary) {
    parts.push(`Your current system leans toward ${tendencySummary.toLowerCase().replace(/\.$/, '')}.`);
  } else {
    // Derive from current tendencies if no summary
    const tendencyLabels = reasoning.system.currentTendencies;
    if (tendencyLabels.length > 0) {
      const tendencyStr = tendencyLabels.length <= 2
        ? tendencyLabels.join(' and ')
        : `${tendencyLabels.slice(0, -1).join(', ')}, and ${tendencyLabels[tendencyLabels.length - 1]}`;
      parts.push(`Your current system leans toward a ${tendencyStr} presentation.`);
    }
  }

  // ── Sentence 2: Interaction risk / constraint ──
  // Build from preserve + arrows to describe what to watch for.
  const preserve = reasoning.direction.preserve;
  const arrows = reasoning.direction.arrows;
  const downArrows = arrows.filter((a) => a.direction === 'down');

  if (preserve.length > 0 && downArrows.length > 0) {
    const preserveStr = preserve.slice(0, 2).join(' and ');
    const riskStr = downArrows.slice(0, 1).map((a) => a.quality).join('');
    parts.push(`A change here should preserve the system's ${preserveStr} — adding too much ${riskStr} could shift the balance.`);
  } else if (preserve.length > 0) {
    const preserveStr = preserve.slice(0, 2).join(' and ');
    parts.push(`The main constraint is preserving the system's ${preserveStr} while making any change.`);
  } else if (downArrows.length > 0) {
    const riskStr = downArrows.slice(0, 2).map((a) => a.quality).join(' or ');
    parts.push(`Watch for components that push toward ${riskStr} — that would compound a current tendency.`);
  }

  // ── Sentence 3: Upgrade direction ──
  const direction = reasoning.direction.statement;
  if (direction) {
    parts.push(direction.endsWith('.') ? direction : `${direction}.`);
  }

  if (parts.length === 0) return undefined;

  return parts.join(' ');
}

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

// ── Phono stage caveat injection ─────────────────────

/**
 * Post-process an advisory to inject a phono stage caveat when:
 *   1. The advisory subject involves a turntable product
 *   2. The user's active system doesn't have a phono stage
 *   3. The advisory doesn't already have a dependencyCaveat
 *
 * Call this in page.tsx after building any advisory, before dispatch.
 */
export function withPhonoCaveat(
  advisory: AdvisoryResponse,
  activeSystem: { components: Array<{ name: string; category: string; role: string | null }> } | null | undefined,
): AdvisoryResponse {
  // Already has a dependency caveat — don't overwrite
  if (advisory.dependencyCaveat) return advisory;

  // Check if the subject involves a turntable
  const subjectLower = (advisory.subject || '').toLowerCase();
  const turntableKeywords = ['turntable', 'rega', 'planar', 'technics sl-1', 'pro-ject', 'debut', 'vpi', 'cliffwood', 'linn lp12', 'lp12', 'thorens', 'td 1600'];
  const involvesTurntable = turntableKeywords.some((kw) => subjectLower.includes(kw));
  if (!involvesTurntable) return advisory;

  // Detect system phono status
  const phonoStatus = detectSystemPhono(activeSystem);
  const caveat = buildPhonoCaveat(null, phonoStatus);

  if (!caveat) return advisory;
  return { ...advisory, dependencyCaveat: caveat };
}

// ── Adapter: Consultation → Advisory ─────────────────

export function consultationToAdvisory(
  c: ConsultationResponse,
  reasoning?: ReasoningResult,
  ctx?: ShoppingAdvisoryContext,
): AdvisoryResponse {
  // For system assessments, systemContext carries the character opening —
  // map it to the dedicated systemContext field (not systemFit, which feeds
  // into AdvisoryProse and would duplicate the content).
  const isAssessment = !!(c.componentReadings && c.componentReadings.length > 0);

  return enrichAdvisory({
    kind: 'consultation',
    title: c.title,
    subject: c.subject,
    source: c.source,

    audioProfile: reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined,
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
    systemChain: c.systemChain,
    introSummary: c.introSummary,
    primaryConstraint: c.primaryConstraint,
    stackedTraitInsights: c.stackedTraitInsights,
    componentAssessments: c.componentAssessments,
    upgradePaths: c.upgradePaths,
    keepRecommendations: c.keepRecommendations,
    recommendedSequence: c.recommendedSequence,
    keyObservation: c.keyObservation,
    systemSynergy: c.systemSynergy,
    listenerTasteProfile: c.listenerTasteProfile,
    spiderChartData: c.spiderChartData,
    sourceReferences: c.sourceReferences,
    advisoryMode: c.advisoryMode,
    systemSignature: c.systemSignature,
  });
}

// ── "Why this fits you" for gear responses ────────────

/**
 * Build compact personalization bullets from gear response data.
 * Deterministic — uses only hearing, systemDirection, and archetype.
 */
function buildGearWhyFitsYou(r: GearResponse): string[] | undefined {
  const bullets: string[] = [];

  // Archetype context
  if (r.userArchetype) {
    const archetypeLabels: Record<string, string> = {
      flow_organic: 'flow-oriented',
      precision_explicit: 'precision-oriented',
      rhythmic_propulsive: 'rhythm-oriented',
      tonal_saturated: 'tonally saturated',
      spatial_holographic: 'spatially focused',
    };
    const label = archetypeLabels[r.userArchetype.primary];
    if (label) {
      bullets.push(`Your ${label} listening style is relevant to how this component will present music in your system.`);
    }
  }

  // System tendency interaction
  if (r.systemDirection?.tendencySummary) {
    bullets.push(`Given your system's current character — ${r.systemDirection.tendencySummary.toLowerCase()} — this component's behavior may shift or reinforce the balance.`);
  }

  // Hearing-derived context (summarize if present)
  if (r.hearing && r.hearing.length > 0 && bullets.length < 3) {
    bullets.push('Your stated priorities are reflected in the evaluation above — the fit assessment considers what you told us you value.');
  }

  if (bullets.length === 0) return undefined;
  return bullets.slice(0, 4);
}

// ── Adapter: GearResponse → Advisory ─────────────────

export function gearResponseToAdvisory(
  r: GearResponse,
  reasoning?: ReasoningResult,
  ctx?: ShoppingAdvisoryContext,
): AdvisoryResponse {
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
      advisoryMode: 'upgrade_suggestions',
      subject: r.subjects.length > 0 ? r.subjects.join(', ') : 'your question',

      audioProfile: reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined,
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
    advisoryMode: 'gear_advice',
    subject: r.subjects.length > 0 ? r.subjects.join(', ') : 'your question',

    audioProfile: reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined,
    listenerPriorities,
    whyFitsYou: buildGearWhyFitsYou(r),
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

// ── Audio Profile Builder ─────────────────────────────

/** Archetype labels for display. */
const ARCHETYPE_DISPLAY: Record<string, string> = {
  flow_organic: 'Flow-oriented',
  precision_explicit: 'Precision-focused',
  rhythmic_propulsive: 'Rhythm-driven',
  tonal_saturated: 'Tonally rich',
  spatial_holographic: 'Spatially focused',
};

/**
 * Build a structured AudioProfile from reasoning layers and context.
 * This powers the "Audio Preferences" section at the top of ALL advisory responses.
 *
 * Works with or without a ShoppingAnswer — can be called from any adapter.
 */
function buildAudioProfile(
  reasoning?: ReasoningResult,
  ctx?: ShoppingAdvisoryContext,
  budgetAmount?: number | null,
): AudioProfile {
  // ── System chain ────────────────────────────────────
  const systemChain = ctx?.systemComponents && ctx.systemComponents.length > 0
    ? ctx.systemComponents
    : undefined;

  // ── Sonic priorities ────────────────────────────────
  // Build from multiple sources, prefer richest
  const sonicPriorities: string[] = [];

  // From reasoning desires (most specific)
  if (reasoning?.taste.desires && reasoning.taste.desires.length > 0) {
    for (const d of reasoning.taste.desires) {
      const label = d.direction === 'more'
        ? d.quality
        : `less ${d.quality}`;
      if (!sonicPriorities.includes(label)) {
        sonicPriorities.push(label);
      }
    }
  }

  // From stored desires (if provided and we need more)
  if (sonicPriorities.length < 2 && ctx?.storedDesires) {
    for (const d of ctx.storedDesires) {
      if (!sonicPriorities.includes(d)) {
        sonicPriorities.push(d);
      }
    }
  }

  // Fallback: from tasteLabel
  if (sonicPriorities.length === 0 && reasoning?.taste.tasteLabel) {
    sonicPriorities.push(reasoning.taste.tasteLabel);
  }

  // ── Sonic avoids ────────────────────────────────────
  const sonicAvoids: string[] = [];
  if (reasoning?.taste.desires) {
    for (const d of reasoning.taste.desires) {
      if (d.direction === 'less') {
        sonicAvoids.push(d.quality);
      }
    }
  }

  // ── Listening context ───────────────────────────────
  const listeningContext: string[] = [];
  if (ctx?.systemLocation) listeningContext.push(ctx.systemLocation);
  if (ctx?.systemPrimaryUse) listeningContext.push(ctx.systemPrimaryUse);
  // Infer from system profile
  if (reasoning?.system.profile.tubeAmplification) listeningContext.push('tube amplification');
  if (reasoning?.system.profile.lowPowerContext) listeningContext.push('low-power / near-field');
  if (reasoning?.system.profile.outputType === 'headphones') listeningContext.push('headphone listening');

  // ── Archetype ───────────────────────────────────────
  const archetype = reasoning?.taste.archetype
    ? ARCHETYPE_DISPLAY[reasoning.taste.archetype] ?? null
    : null;

  // ── Budget ──────────────────────────────────────────
  const budget = budgetAmount != null
    ? `$${budgetAmount.toLocaleString()}`
    : undefined;

  // ── Direction ───────────────────────────────────────
  const directionStatement = reasoning?.direction.statement || undefined;

  // ── Profile completeness ────────────────────────────
  const missingDimensions: string[] = [];
  if (!systemChain || systemChain.length === 0) missingDimensions.push('system');
  if (sonicPriorities.length === 0) missingDimensions.push('sonic preferences');
  if (!budget) missingDimensions.push('budget');

  const profileComplete = missingDimensions.length === 0
    || (systemChain && systemChain.length > 0 && sonicPriorities.length > 0);

  return {
    systemChain,
    sonicPriorities: sonicPriorities.length > 0 ? sonicPriorities : undefined,
    sonicAvoids: sonicAvoids.length > 0 ? sonicAvoids : undefined,
    listeningContext: listeningContext.length > 0 ? listeningContext : undefined,
    archetype: archetype ?? undefined,
    budget,
    directionStatement,
    profileComplete: !!profileComplete,
    missingDimensions: missingDimensions.length > 0 ? missingDimensions : undefined,
  };
}

/**
 * Additional context for building the AudioProfile.
 * Passed from page.tsx where system/turn context is available.
 */
export interface ShoppingAdvisoryContext {
  /** Component names from the user's saved/active system. */
  systemComponents?: string[];
  /** System location (e.g. "Living Room"). */
  systemLocation?: string;
  /** Primary use (e.g. "critical listening", "background music"). */
  systemPrimaryUse?: string;
  /** User's taste profile trait labels (e.g. ["warmth", "dynamics", "detail"]). */
  storedDesires?: string[];
  /** Stored system tendencies string (e.g. "warm, tube-driven, vinyl-focused"). */
  systemTendencies?: string;
}

export function shoppingToAdvisory(
  a: ShoppingAnswer,
  signals?: ExtractedSignals,
  reasoning?: ReasoningResult,
  ctx?: ShoppingAdvisoryContext,
  decisionFrame?: DecisionFrame | null,
): AdvisoryResponse {
  // Parse preferenceSummary into listenerPriorities if it's a meaningful sentence
  const listenerPriorities = a.preferenceSummary
    ? [a.preferenceSummary]
    : undefined;

  // ── Build Audio Profile ─────────────────────────────
  const audioProfile = buildAudioProfile(reasoning, ctx, a.budget);

  const options: AdvisoryOption[] = a.productExamples.map((p) => ({
    name: p.name,
    brand: p.brand,
    price: p.price,
    priceCurrency: p.priceCurrency,
    character: p.character,
    standoutFeatures: p.standoutFeatures,
    soundProfile: p.soundProfile,
    fitNote: p.fitNote,
    caution: p.caution,
    links: p.links?.map((l) => ({ label: l.label, url: l.url })),
    // Enhanced card fields
    sonicDirectionLabel: p.sonicDirectionLabel,
    productType: p.productType,
    manufacturerUrl: p.manufacturerUrl,
    usedMarketUrl: p.usedMarketUrl,
    availability: p.availability,
    usedPriceRange: p.usedPriceRange,
    usedMarketSources: p.usedMarketSources,
    systemDelta: p.systemDelta,
    // Catalog facts for LLM validation
    catalogArchitecture: p.catalogArchitecture,
    catalogTopology: p.catalogTopology,
    catalogCountry: p.catalogCountry,
    catalogBrandScale: p.catalogBrandScale,
    isCurrentComponent: p.isCurrentComponent,
  }));

  // Tag each product with its decision frame direction (if frame is available)
  if (decisionFrame) {
    for (const opt of options) {
      const topo = opt.catalogTopology?.toLowerCase();
      if (!topo) continue;
      for (const dir of decisionFrame.directions) {
        if (dir.isDoNothing) continue;
        if (dir.topologyFilter?.some((t) => topo.includes(t) || t.includes(topo))) {
          opt.directionLabel = dir.label;
          break;
        }
      }
    }
  }

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

  // Build follow-up: prefer explicit refinement question, then
  // synthesize from refinement prompts
  const followUp = a.refinementQuestion
    ?? (a.refinementPrompts && a.refinementPrompts.length > 0
      ? a.refinementPrompts.join(' ')
      : undefined);

  // Build system context preamble (when active system available)
  const systemContextPreamble = buildSystemContextPreamble(
    ctx?.systemComponents,
    reasoning,
    ctx?.systemTendencies,
  );

  // Build editorial intro
  const editorialIntro = buildEditorialIntro(
    a.category,
    a.budget ? `$${a.budget}` : undefined,
    ctx?.storedDesires,
    reasoning?.taste.tasteLabel,
    ctx?.systemComponents,
    reasoning?.taste.archetype ?? undefined,
  );

  return enrichAdvisory({
    kind: 'shopping',
    advisoryMode: 'upgrade_suggestions',
    subject: a.category,

    audioProfile,
    systemContextPreamble,
    editorialIntro,
    listenerPriorities,
    whyFitsYou: a.whyFitsYou,
    systemContext: a.systemNote,

    recommendedDirection: a.bestFitDirection,
    whyThisFits: a.whyThisFits.length > 0 ? a.whyThisFits : undefined,
    tradeOffs: a.watchFor.length > 0 ? a.watchFor : undefined,

    options: options.length > 0 ? options : undefined,
    provisional: a.provisional,
    statedGaps: statedGaps && statedGaps.length > 0 ? statedGaps : undefined,
    dependencyCaveat: a.dependencyCaveat,

    sonicLandscape: a.sonicLandscape,
    decisionFrame: decisionFrame ?? undefined,
    refinementPrompts: a.refinementPrompts,
    followUp,

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
  ctx?: ShoppingAdvisoryContext,
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

    audioProfile: reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined,
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

// ── Product Assessment Adapter ──────────────────────

export function assessmentToAdvisory(
  assessment: ProductAssessment,
  ctx?: ShoppingAdvisoryContext,
): AdvisoryResponse {
  return {
    kind: 'assessment',
    subject: assessment.candidateName,
    advisoryMode: 'product_assessment',
    audioProfile: ctx ? buildAudioProfile(undefined, ctx) : undefined,
    productAssessment: assessment,

    // Map assessment fields into standard advisory fields for fallback rendering
    bottomLine: assessment.shortAnswer,
    recommendedDirection: assessment.recommendation,
    followUp: assessment.catalogMatch
      ? undefined
      : 'If you can share the specific model, I may be able to offer a more detailed assessment.',

    // Links from the candidate product (if catalog match)
    links: undefined, // Will be populated by the routing layer if needed
  };
}

// ── Lane 2: Audio Knowledge adapter ──────────────────

/**
 * Wraps a KnowledgeResponse into a unified AdvisoryResponse.
 * The LLM generates the explanation prose; structured context
 * (system, taste profile) is passed as input, not invented.
 */
export function knowledgeToAdvisory(
  knowledge: KnowledgeResponse,
  ctx?: ShoppingAdvisoryContext,
): AdvisoryResponse {
  return {
    kind: 'knowledge',
    subject: knowledge.topic,
    advisoryMode: 'audio_knowledge',
    audioProfile: ctx ? buildAudioProfile(undefined, ctx) : undefined,
    knowledgeResponse: knowledge,
    bottomLine: knowledge.systemNote ?? undefined,
  };
}

// ── Lane 3: Audio Assistant adapter ──────────────────

/**
 * Wraps an AssistantResponse into a unified AdvisoryResponse.
 * Open LLM generation with tone guardrails.
 */
export function assistantToAdvisory(
  assistant: AssistantResponse,
): AdvisoryResponse {
  return {
    kind: 'assistant',
    subject: assistant.taskType,
    advisoryMode: 'audio_assistant',
    assistantResponse: assistant,
  };
}
