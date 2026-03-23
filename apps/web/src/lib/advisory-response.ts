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

// ── Country code to name ──────────────────────────────

const COUNTRY_NAMES: Record<string, string> = {
  AT: 'Austria', AU: 'Australia', BE: 'Belgium', CA: 'Canada',
  CH: 'Switzerland', CN: 'China', CZ: 'Czech Republic', DE: 'Germany',
  DK: 'Denmark', ES: 'Spain', FI: 'Finland', FR: 'France',
  GB: 'United Kingdom', HK: 'Hong Kong', HU: 'Hungary', IE: 'Ireland',
  IL: 'Israel', IN: 'India', IT: 'Italy', JP: 'Japan',
  KR: 'South Korea', MY: 'Malaysia', NL: 'Netherlands', NO: 'Norway',
  NZ: 'New Zealand', PL: 'Poland', PT: 'Portugal', RO: 'Romania',
  SE: 'Sweden', SG: 'Singapore', TW: 'Taiwan', UA: 'Ukraine',
  US: 'United States', VN: 'Vietnam',
};

function countryName(code?: string): string | undefined {
  if (!code) return undefined;
  return COUNTRY_NAMES[code.toUpperCase()] ?? code;
}

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

// ── Quick Recommendation (compact onboarding output) ──

/** A single option in the quick-recommendation format. */
export interface QuickRecOption {
  /** Product name. */
  name: string;
  /** Short direction label (e.g. "More energy and impact"). */
  direction: string;
  /** 2–3 short bullet points: sound, use case, key trait. */
  bullets: string[];
}

/** Compact structured recommendation — replaces verbose shopping advisory
 *  when sufficient intent is gathered through the onboarding flow. */
export interface QuickRecommendation {
  /** One-sentence summary confirming intent (e.g. "You're looking for headphones with energy and impact under $200."). */
  summary: string;
  /** 2–3 differentiated options. */
  options: QuickRecOption[];
  /** One directional follow-up question. */
  followUp: string;
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
  /** Direct URL to the review or source, if available. */
  url?: string;
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

  /** Retailer / manufacturer links from catalog data. */
  retailerLinks?: Array<{ label: string; url: string; region?: string }>;
  /** Review and community source references from catalog data. */
  sourceReferences?: Array<{ source: string; note: string; url?: string }>;
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
  kind: 'consultation' | 'shopping' | 'diagnosis' | 'assessment' | 'knowledge' | 'assistant' | 'intake';
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

  // ── 4b. Product Detail ────────────────────────────────
  /** Country of manufacture (human-readable, e.g. "Austria", "Japan"). */
  productOrigin?: string;
  /** System interaction notes — how this product behaves with specific system pairings. */
  interactionNotes?: string[];

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

  // ── 7e2. System Interpretation ──────────────────────
  /** 2–4 sentence system interpretation paragraph — explains what's happening sonically.
   *  Rendered before product cards. Always populated when system or taste context exists. */
  systemInterpretation?: string;

  // ── 7e3. Strategy Bullets ─────────────────────────
  /** 2–4 directional strategy lines — conceptual guidance before product recommendations.
   *  Each bullet describes a kind of change and why it would help. */
  strategyBullets?: string[];

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

  // ── 11c. Quick Recommendation ────────────────────────
  /** Compact structured recommendation — used when sufficient intent is gathered via onboarding. */
  quickRecommendation?: QuickRecommendation;

  // ── 12. Knowledge & Assistant Lanes ────────────────
  /** Structured knowledge response — populated for audio_knowledge intent. */
  knowledgeResponse?: KnowledgeResponse;
  /** Structured assistant response — populated for audio_assistant intent. */
  assistantResponse?: AssistantResponse;

  // ── 12b. Intake Questions ───────────────────────────
  /** Structured intake questions for new/vague user queries. */
  intakeQuestions?: import('./intake').IntakeQuestion[];

  // ── 12c. Diagnosis — enriched structure ─────────────
  /** System interpretation — explains the system character and design trade-off. */
  diagnosisInterpretation?: string;
  /** "What this means" — explains WHY the symptom occurs in this specific system. */
  diagnosisExplanation?: string;
  /** Ranked action areas with product directions. */
  diagnosisActions?: Array<{
    area: string;
    guidance: string;
    examples?: string;
  }>;

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
 * Build a system interpretation paragraph — 2-4 sentences that demonstrate
 * the advisor understands the user's context before jumping to products.
 *
 * This is the key "system reading" step inspired by expert advisor patterns:
 * - Acknowledge the system or user context
 * - Identify the main tendency or likely sonic character
 * - Explain what is happening in plain but expert language
 *
 * Renders before product cards. Always populated when ANY context exists
 * (system, taste signals, genre preferences, or even just category + budget).
 */
function buildSystemInterpretation(
  a: import('./shopping-intent').ShoppingAnswer,
  reasoning?: ReasoningResult,
  ctx?: ShoppingAdvisoryContext,
): string | undefined {
  const parts: string[] = [];

  // Detect whether a real taste profile was matched (vs. fallback)
  const hasTasteSignal = !!reasoning?.taste.archetype;

  // ── Layer 1: System acknowledgment ──
  if (ctx?.systemComponents && ctx.systemComponents.length > 0) {
    const systemList = ctx.systemComponents.slice(0, 3).join(', ');
    const tendency = reasoning?.system.tendencySummary ?? ctx.systemTendencies;
    if (tendency) {
      parts.push(`Your system (${systemList}) leans toward ${tendency.toLowerCase().replace(/\.$/, '')}.`);
    } else {
      parts.push(`With ${systemList} in your system, the component you add will shape the overall character.`);
    }
  }

  // ── Layer 2: Taste/preference interpretation (only with real signal) ──
  if (hasTasteSignal && reasoning?.taste.archetype) {
    const archetype = reasoning.taste.archetype;
    const ARCHETYPE_INTERPRETATION: Record<string, string> = {
      flow_organic: 'You seem to value musical flow and natural phrasing over clinical precision.',
      rhythmic_propulsive: 'You seem drawn to rhythmic energy and transient speed — music that feels alive and forward-moving.',
      tonal_saturated: 'You seem to prioritize tonal richness and harmonic density over speed or detail.',
      precision_explicit: 'You seem to value resolution, separation, and precision — hearing everything clearly matters to you.',
      spatial_holographic: 'You seem to prioritize spatial depth and imaging — the sense of a performance in a real space.',
    };
    const interpretation = ARCHETYPE_INTERPRETATION[archetype];
    if (interpretation) parts.push(interpretation);
  }

  // ── Layer 3: Direction framing (only when taste or system gave signal) ──
  if (parts.length > 0 && hasTasteSignal && a.bestFitDirection) {
    const dirBrief = a.bestFitDirection.split(/\.\s/)[0];
    if (dirBrief.length < 120) {
      parts.push(`${dirBrief}.`);
    }
  }

  // ── Layer 4: Budget-only fallback — category landscape framing ──
  if (parts.length === 0) {
    // Use singular form for "X designs vary..." phrasing
    const catSingular = a.category.replace(/s$/, '');
    const catLabel = catSingular;
    if (a.budget) {
      // Check if bestFitDirection is real content (not a reasoning engine fallback)
      const FALLBACK_DIRECTION_MARKERS = ['avoids strong bias', 'no strong directional change', 'current balance may be close'];
      const isFallbackDirection = !a.bestFitDirection
        || FALLBACK_DIRECTION_MARKERS.some(m => a.bestFitDirection.toLowerCase().includes(m));
      if (!isFallbackDirection) {
        const dirBrief = a.bestFitDirection.split(/\.\s/).slice(0, 2).join('. ').replace(/\.+$/, '');
        // Lowercase the first character of the direction to flow after the price
        const lowerDir = dirBrief.charAt(0).toLowerCase() + dirBrief.slice(1);
        parts.push(`At ~$${a.budget.toLocaleString()}, ${lowerDir}.`);
      } else {
        parts.push(`At this price point, ${catLabel} designs vary considerably in philosophy — from precision-focused to warmth-oriented to rhythm-driven.`);
        parts.push(`The right choice depends on what you want the ${catSingular} to do in your system and for your listening priorities.`);
      }
    }
  }

  if (parts.length === 0) return undefined;
  return parts.join(' ');
}

/**
 * Build 2-4 strategy bullets — conceptual guidance about what kind
 * of change would help, before naming specific products.
 *
 * Each bullet describes a direction and why it would help.
 * These are NOT product names — they are sonic strategies.
 */
function buildStrategyBullets(
  a: import('./shopping-intent').ShoppingAnswer,
  reasoning?: ReasoningResult,
): string[] | undefined {
  // Only render strategy when there's a real taste or system signal.
  // Without context, strategy bullets would just be generic filler.
  const hasTasteSignal = !!reasoning?.taste.archetype;
  const hasSystemSignal = !!(reasoning?.system.tendencySummary || reasoning?.system.currentTendencies?.length);
  if (!hasTasteSignal && !hasSystemSignal) return undefined;

  const bullets: string[] = [];

  // ── From whyThisFits — concise directional reasons ──
  // Skip fallback content (starts with "No strong single-trait")
  if (a.whyThisFits && a.whyThisFits.length > 0) {
    for (const fit of a.whyThisFits.slice(0, 3)) {
      if (fit.toLowerCase().startsWith('no strong')) continue;
      const clean = fit.split(/\.\s/)[0].replace(/\.$/, '');
      if (clean.length > 10 && clean.length < 100) {
        bullets.push(clean);
      }
    }
  }

  // ── From watchFor — reframe as "what to avoid" strategy ──
  if (a.watchFor && a.watchFor.length > 0) {
    const caution = a.watchFor[0].split(/\.\s/)[0].replace(/\.$/, '');
    // Skip fallback "Balanced components rarely excel" text
    if (caution.length > 10 && caution.length < 100 && !caution.toLowerCase().startsWith('balanced components')) {
      bullets.push(`Avoid: ${caution.charAt(0).toLowerCase()}${caution.slice(1)}`);
    }
  }

  // ── From reasoning preserve signals — what to protect ──
  if (reasoning?.direction.preserve && reasoning.direction.preserve.length > 0) {
    const preserve = reasoning.direction.preserve.slice(0, 2).join(' and ');
    bullets.push(`Preserve: ${preserve} in whatever you change`);
  }

  if (bullets.length < 2) return undefined;
  return bullets.slice(0, 4);
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

  // ── Extract rich data from matched products ──────────
  const products = r.matchedProducts ?? [];
  const primaryProduct = products[0];

  // Links from product catalog
  const gearLinks: AdvisoryLink[] = [];
  for (const p of products) {
    for (const l of (p.retailer_links ?? [])) {
      gearLinks.push({
        label: l.label,
        url: l.url,
        kind: l.label.toLowerCase().includes('review') ? 'review' : 'reference',
        region: (l as any).region,
      });
    }
  }

  // Source references with review URLs
  const gearSourceRefs: SourceReference[] = [];
  const seenGearSources = new Set<string>();
  for (const p of products) {
    if (p.sourceReferences) {
      for (const ref of p.sourceReferences) {
        if (!seenGearSources.has(ref.source)) {
          seenGearSources.add(ref.source);
          const matchingLink = (p.retailer_links ?? []).find(
            (l: { label: string; url: string }) =>
              l.label.toLowerCase().includes(ref.source.toLowerCase()) && l.label.toLowerCase().includes('review'),
          );
          gearSourceRefs.push({ source: ref.source, note: ref.note, url: ref.url ?? matchingLink?.url });
        }
      }
    }
  }

  // Interaction notes from product tendencies
  const interactionNotes: string[] = [];
  for (const p of products) {
    if (p.tendencies?.interactions) {
      for (const inter of p.tendencies.interactions) {
        const prefix = inter.valence === 'caution' ? 'Caution: ' : '';
        interactionNotes.push(`${prefix}${inter.condition.charAt(0).toUpperCase() + inter.condition.slice(1)} — ${inter.effect}.`);
      }
    }
  }

  // Trade-offs from product tendencies
  const gearTradeOffs: string[] = [];
  for (const p of products) {
    if (p.tendencies?.tradeoffs) {
      for (const t of p.tendencies.tradeoffs) {
        const rel = t.relative_to ? ` (relative to ${t.relative_to})` : '';
        gearTradeOffs.push(`What you gain: ${t.gains}. What you trade: ${t.cost}${rel}.`);
      }
    }
  }

  // Country of origin
  const origin = primaryProduct ? countryName(primaryProduct.country) : undefined;
  const originNote = origin
    ? `Made in ${origin}.${primaryProduct?.architecture ? ` ${primaryProduct.architecture} design.` : ''}`
    : undefined;

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

    // Product detail
    productOrigin: originNote,
    interactionNotes: interactionNotes.length > 0 ? interactionNotes : undefined,

    recommendedDirection: r.direction,
    tradeOffs: gearTradeOffs.length > 0 ? gearTradeOffs : undefined,
    followUp: r.clarification,

    // Links and sources from catalog
    links: gearLinks.length > 0 ? gearLinks : undefined,
    sourceReferences: gearSourceRefs.length > 0 ? gearSourceRefs : undefined,
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

/**
 * Build an editorial closing verdict — deterministic, no LLM involved.
 * Uses the ranked product list and user context to surface "best match for your system"
 * and "best on sound quality alone" picks.
 */
function buildEditorialClosing(
  products: ShoppingAnswer['productExamples'],
  ctx?: ShoppingAdvisoryContext,
  reasoning?: ReasoningResult,
): EditorialClosing | undefined {
  if (products.length === 0) return undefined;

  // "Top picks on sound quality alone" — first 2 products (already sorted by score)
  const topPicks: EditorialPick[] = products.slice(0, Math.min(2, products.length)).map((p) => ({
    name: `${p.brand} ${p.name}`,
    reason: p.fitNote,
  }));

  // "What I'd recommend for YOUR system" — only when we have system context
  let systemPicks: EditorialPick[] | undefined;
  let systemSummary: string | undefined;
  let avoidanceNote: string | undefined;

  if (ctx?.systemComponents && ctx.systemComponents.length > 0) {
    systemSummary = `Given your ${ctx.systemComponents.join(' + ')}${ctx.systemTendencies ? ` (${ctx.systemTendencies})` : ''}`;

    // System picks are the top products that have a systemDelta or specific fitNote
    systemPicks = products.slice(0, Math.min(2, products.length)).map((p) => {
      const systemReason = p.systemDelta?.whyFitsSystem ?? p.fitNote;
      return { name: `${p.brand} ${p.name}`, reason: systemReason };
    });

    // Avoidance note from risk trait signals
    if (reasoning?.taste.traitSignals) {
      const avoidances: string[] = [];
      const ts = reasoning.taste.traitSignals;
      if (ts.fatigue_risk === 'up') avoidances.push('treble forwardness or fatigue');
      if (ts.glare_risk === 'up') avoidances.push('upper-frequency glare');
      if (avoidances.length > 0) {
        avoidanceNote = `Based on your preferences, I would be cautious with products that lean toward ${avoidances.join(' or ')}.`;
      }
    }
  }

  return {
    topPicks,
    systemPicks,
    systemSummary,
    avoidanceNote,
  };
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

  const statedGaps = a.statedGaps?.map((g) => GAP_LABELS[g]).filter(Boolean) as string[] | undefined;

  // Collect source references from recommended products (deduplicated)
  // Cross-reference with product links to find review URLs
  const sourceRefs: SourceReference[] = [];
  const seenSources = new Set<string>();
  for (const p of a.productExamples) {
    if (p.sourceReferences) {
      for (const ref of p.sourceReferences) {
        if (!seenSources.has(ref.source)) {
          seenSources.add(ref.source);
          // Try to find a matching review URL from the product's links
          const matchingLink = p.links?.find(
            (l) => l.label.toLowerCase().includes(ref.source.toLowerCase()) && l.label.toLowerCase().includes('review'),
          );
          sourceRefs.push({ source: ref.source, note: ref.note, url: ref.url ?? matchingLink?.url });
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

  // Build system interpretation (mandatory reasoning layer before products)
  const systemInterpretation = buildSystemInterpretation(a, reasoning, ctx);

  // Build strategy bullets (conceptual guidance before product cards)
  const strategyBullets = buildStrategyBullets(a, reasoning);

  // ── Build editorial closing (best-match verdict) ─────
  // Only when we have product examples and user context
  const editorialClosing = buildEditorialClosing(a.productExamples, ctx, reasoning);

  return enrichAdvisory({
    kind: 'shopping',
    advisoryMode: 'upgrade_suggestions',
    subject: a.category,

    audioProfile,
    systemContextPreamble,
    systemInterpretation,
    strategyBullets,
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

    editorialClosing,

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

  // ── Build enriched diagnosis layers ──────────────────

  // Layer 1: System interpretation — what the system IS and what trade-off it represents
  const diagnosisInterpretation = buildDiagnosisInterpretation(signals, sysDir, reasoning, ctx);

  // Layer 2: What this means — why the symptom occurs in THIS system
  const diagnosisExplanation = buildDiagnosisExplanation(primary, signals, sysDir, reasoning);

  // Layer 3: Ranked action areas with product directions
  const diagnosisActions = buildDiagnosisActions(primary, signals, sysDir);

  // Follow-up: focused, not generic
  const followUp = buildDiagnosisFollowUp(primary, signals, sysDir, ctx);

  return enrichAdvisory({
    kind: 'diagnosis',
    subject: primary?.label ?? 'your listening situation',

    audioProfile: reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined,
    listenerPriorities: listenerPriorities.length > 0 ? listenerPriorities : undefined,
    listenerAvoids: listenerAvoids.length > 0 ? listenerAvoids : undefined,
    systemTendencies: sysDir?.tendencySummary ?? undefined,

    // Primary rule explanation remains as tendencies prose
    tendencies: primary?.outputs.explanation,

    // Suggestions become whyThisFits (what to do and why)
    whyThisFits: allSuggestions.length > 0 ? allSuggestions : undefined,
    tradeOffs: allRisks.length > 0 ? allRisks : undefined,

    // Enriched diagnosis layers
    diagnosisInterpretation,
    diagnosisExplanation,
    diagnosisActions: diagnosisActions.length > 0 ? diagnosisActions : undefined,

    // Focused follow-up
    followUp,

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

// ── Diagnosis enrichment helpers ────────────────────────

/**
 * Layer 1: System interpretation.
 * Explains the system's character and design trade-off in 1–2 sentences.
 * Only populated when we have system or taste context.
 */
function buildDiagnosisInterpretation(
  signals: ExtractedSignals,
  sysDir?: SystemDirection,
  reasoning?: ReasoningResult,
  ctx?: ShoppingAdvisoryContext,
): string | undefined {
  const parts: string[] = [];

  // System character from components
  if (ctx?.systemComponents && ctx.systemComponents.length > 0) {
    const names = ctx.systemComponents.slice(0, 3).join(', ');
    if (ctx.systemTendencies) {
      parts.push(`Your system (${names}) has a ${ctx.systemTendencies.toLowerCase()} character.`);
    } else {
      parts.push(`Your system includes ${names}.`);
    }
  }

  // Tendency interpretation — what the system optimizes for
  if (sysDir?.tendencySummary) {
    const tendencies = sysDir.currentTendencies;
    if (tendencies.length > 0) {
      const TENDENCY_TRADE_OFFS: Record<string, string> = {
        bright_lean: 'This is a system that prioritizes resolution and transient speed — sometimes at the expense of tonal warmth and harmonic density.',
        warm_dense: 'This is a system that prioritizes harmonic richness and body — sometimes at the expense of detail retrieval and transient precision.',
        forward_aggressive: 'This is a system that prioritizes presence and immediacy — sometimes at the expense of depth and long-session comfort.',
        polite_smooth: 'This is a system that prioritizes composure and ease — sometimes at the expense of dynamic contrast and rhythmic engagement.',
        neutral_transparent: 'This is a system that prioritizes accuracy and neutrality — sometimes at the expense of musical engagement and harmonic character.',
      };
      const primaryTendency = tendencies[0];
      const tradeOff = TENDENCY_TRADE_OFFS[primaryTendency] ?? null;
      if (tradeOff) {
        parts.push(tradeOff);
      }
    }
  } else if (reasoning?.taste.archetype) {
    // No system info but we have taste — frame the listener
    const ARCHETYPE_CONTEXT: Record<string, string> = {
      flow_organic: 'Your preferences lean toward flow and natural presentation — systems that feel effortless and musically involving.',
      precision_explicit: 'Your preferences lean toward precision and detail — systems that reveal structure, layering, and micro-dynamics.',
      rhythmic_propulsive: 'Your preferences lean toward rhythmic engagement and dynamics — systems that convey momentum and transient energy.',
      tonal_saturated: 'Your preferences lean toward harmonic density and tonal richness — systems with midrange weight and body.',
      spatial_holographic: 'Your preferences lean toward spatial presentation — systems that create depth, air, and a convincing soundstage.',
    };
    const ctx2 = ARCHETYPE_CONTEXT[reasoning.taste.archetype];
    if (ctx2) parts.push(ctx2);
  }

  if (parts.length === 0) return undefined;
  return parts.join(' ');
}

/**
 * Layer 2: What this means.
 * Explains WHY the symptom occurs in this specific system.
 * Connects the rule engine's diagnosis to the system's character.
 */
function buildDiagnosisExplanation(
  primary: FiredRule | undefined,
  signals: ExtractedSignals,
  sysDir?: SystemDirection,
  reasoning?: ReasoningResult,
): string | undefined {
  if (!primary) return undefined;

  const symptomId = primary.id;
  const hasTendencies = sysDir && sysDir.currentTendencies.length > 0;
  const hasSystem = !!(sysDir?.tendencySummary);

  // Symptom-specific explanations that connect system character to the complaint
  const SYMPTOM_EXPLANATIONS: Record<string, { withSystem: string; withoutSystem: string }> = {
    'fatigue-brightness': {
      withSystem: 'In a resolving, transparent system, brightness and fatigue often come from the upstream chain — the DAC or source feeds detail faster than the ear can comfortably absorb. This is not a flaw in the system; it is a design trade-off that becomes audible when every component is highly revealing.',
      withoutSystem: 'Brightness and listening fatigue typically originate upstream — the source or DAC is feeding more treble energy or transient detail than the system can absorb comfortably. The effect compounds in resolving systems where nothing softens the signal.',
    },
    'detail-fatigue-tradeoff': {
      withSystem: 'Your system is doing its job — revealing more of the recording. The fatigue you are experiencing is the cost of that transparency. Over time, the ear may adjust. If it does not, the system may be more analytical than your long-term listening preferences require.',
      withoutSystem: 'More detail often means more fatigue initially. A highly resolving system presents everything — including recording artifacts and compression — with full clarity. The question is whether this is temporary adjustment or a genuine mismatch with your preferences.',
    },
    'flat-presentation': {
      withSystem: 'A flat, unengaging presentation usually points to the amplifier or to a system that optimizes for composure at the expense of dynamic contrast. When everything is perfectly controlled, music can lose the tension and release that makes it involving.',
      withoutSystem: 'A flat presentation typically reflects insufficient dynamic contrast — the amplifier may prioritize composure over engagement, or the system as a whole may be over-damped, trading musical involvement for measured precision.',
    },
    'thinness-bass-deficit': {
      withSystem: 'Thinness in a system is most often a room interaction — speaker placement and boundary reinforcement have a larger effect on bass weight than any component change. But it can also indicate a lean-voiced source chain that strips midrange density.',
      withoutSystem: 'Thinness is almost always dominated by room interaction and speaker placement before any component is at fault. The distance from rear and side walls directly controls how much bass energy the room reinforces.',
    },
    'congestion-bottleneck': {
      withSystem: 'Congestion means something in the chain cannot keep up — one component is limiting the system\'s ability to separate and present information clearly. In a well-matched system, this often points to a single bottleneck rather than a general problem.',
      withoutSystem: 'Congestion usually means a bottleneck — one component cannot process information as cleanly as the rest of the chain demands. The source is the most common culprit, followed by the amplifier.',
    },
    'narrow-soundstage': {
      withSystem: 'Soundstage is overwhelmingly determined by speaker positioning and room acoustics. Component changes have a secondary effect. Before looking at gear, the speaker geometry (separation, toe-in, distance from walls) is the single most effective lever.',
      withoutSystem: 'Soundstage width and depth are primarily determined by speaker placement and room geometry — not components. An equilateral triangle between speakers and listening position, with adequate wall clearance, is the foundation.',
    },
    'bass-bloom': {
      withSystem: 'Bass bloom is almost always room-driven — specific frequencies are being reinforced by the room\'s dimensions. The amplifier\'s damping factor plays a secondary role, but moving the speakers away from walls and corners is the most effective first step.',
      withoutSystem: 'Boomy or resonant bass is a room acoustics problem — the room is reinforcing certain frequencies. Corner placement and wall proximity amplify this. Moving speakers into the room and adding corner treatment are the primary remedies.',
    },
  };

  const entry = SYMPTOM_EXPLANATIONS[symptomId];
  if (entry) {
    return hasSystem ? entry.withSystem : entry.withoutSystem;
  }

  // Fallback: build from rule explanation + system context
  if (primary.outputs.explanation && hasSystem) {
    return `${primary.outputs.explanation.trim()} In your system, this tendency is likely shaped by the overall voicing — ${sysDir!.tendencySummary!.toLowerCase()}.`;
  }

  return undefined;
}

/**
 * Layer 3: Ranked action areas with product directions.
 * Returns 2–4 concrete paths, each with an area label, guidance text,
 * and optional product examples.
 */
function buildDiagnosisActions(
  primary: FiredRule | undefined,
  signals: ExtractedSignals,
  sysDir?: SystemDirection,
): Array<{ area: string; guidance: string; examples?: string }> {
  if (!primary) return [];

  const symptomId = primary.id;

  // Symptom-specific ranked action paths
  const SYMPTOM_ACTIONS: Record<string, Array<{ area: string; guidance: string; examples?: string }>> = {
    'fatigue-brightness': [
      { area: 'Source / DAC', guidance: 'The most effective single change. A warmer, more organic DAC shifts the tonal center without sacrificing resolution.', examples: 'R-2R designs (Denafrips Ares II, Schiit Bifrost 2), tube-output DACs (MHDT Orchid)' },
      { area: 'Tube buffer or preamp', guidance: 'A tube stage between source and amplifier adds second-order harmonics that soften transient edges and reduce fatigue.', examples: 'Schiit Freya+, Black Ice Audio FOZ, Linear Tube Audio MicroZOTL' },
      { area: 'Cables', guidance: 'Copper interconnects generally present a warmer tonal balance than silver. This is a subtle but real adjustment at the system level.', examples: 'Cardas Clear Reflection, AudioQuest Yukon' },
      { area: 'Room treatment', guidance: 'Absorption at first reflection points reduces the doubled treble energy that contributes to perceived brightness.' },
    ],
    'detail-fatigue-tradeoff': [
      { area: 'Wait and observe', guidance: 'The ear adjusts to increased resolution over 2–4 weeks. If fatigue persists beyond this, the system may genuinely be too analytical for your preferences.' },
      { area: 'Source voicing', guidance: 'If fatigue does not resolve, a more musical source can ease the relentless detail without losing the improvements you have gained.', examples: 'Denafrips Pontus, Schiit Gungnir, MHDT Orchid' },
      { area: 'Listening level', guidance: 'Highly resolving systems reveal more at lower volumes. Dropping the volume slightly often eliminates fatigue entirely.' },
    ],
    'flat-presentation': [
      { area: 'Amplifier', guidance: 'If the amplifier prioritizes composure, a more dynamic design restores the tension and release that makes music involving.', examples: 'Naim Nait 5si, Rega Brio, Exposure 2510 (for rhythmic drive); Decware Zen (for tube-based engagement)' },
      { area: 'Source / DAC', guidance: 'An analytical source can flatten dynamics before the amplifier sees them. A more expressive DAC can help.', examples: 'Chord Qutest, Denafrips Ares II' },
      { area: 'Speaker positioning', guidance: 'Slight toe-in adjustments and moving closer to the listening position can increase perceived presence and energy.' },
    ],
    'thinness-bass-deficit': [
      { area: 'Speaker placement', guidance: 'Moving speakers closer to the rear wall increases bass reinforcement. Start with 6-inch increments and listen for a few days at each position.' },
      { area: 'Source voicing', guidance: 'A warmer-voiced DAC or source adds midrange density and perceived weight to the tonal balance.', examples: 'Schiit Bifrost 2, Denafrips Ares II, Border Patrol DAC' },
      { area: 'Amplifier pairing', guidance: 'If the amplifier is lean or neutral, a warmer-voiced alternative can restore body without compromising detail.', examples: 'Rega Brio, Exposure 2510, PrimaLuna EVO 100 (tube)' },
      { area: 'Room treatment', guidance: 'Bare floors and hard walls tilt the balance toward upper frequencies. Adding a rug or diffusion panels can shift perceived warmth.' },
    ],
    'congestion-bottleneck': [
      { area: 'Source / DAC', guidance: 'A cleaner, more resolving source often clears congestion throughout the chain. This is the most common bottleneck.', examples: 'Chord Qutest, Denafrips Pontus, Schiit Bifrost 2' },
      { area: 'Amplifier control', guidance: 'If the amplifier lacks damping factor for the speakers, bass becomes loose and bleeds into the midrange.', examples: 'Benchmark AHB2, Parasound A23+, NAD C 298' },
      { area: 'Simplify the chain', guidance: 'Temporarily removing components (external DACs, preamps, equalizers) and running a minimal chain can isolate the bottleneck.' },
    ],
    'narrow-soundstage': [
      { area: 'Speaker positioning', guidance: 'Increase separation to form an equilateral triangle with the listening position. Pull speakers at least 2 feet from side walls.' },
      { area: 'Room treatment', guidance: 'Diffusion on the rear wall and absorption at first reflection points widen the perceived stage.' },
      { area: 'Source quality', guidance: 'Higher-resolution sources can improve spatial cues. This is a secondary factor after positioning.', examples: 'Chord Qutest, Denafrips Pontus' },
    ],
    'bass-bloom': [
      { area: 'Speaker placement', guidance: 'Move speakers away from rear walls and corners. Each inch of distance reduces bass reinforcement at the boundary frequencies.' },
      { area: 'Room treatment', guidance: 'Bass traps in room corners absorb the low-frequency buildup that causes bloom. Start conservatively — over-treatment deadens the room.' },
      { area: 'Amplifier damping', guidance: 'An amplifier with higher damping factor controls the woofer more tightly, reducing bass overshoot.', examples: 'Benchmark AHB2, Parasound A23+' },
    ],
  };

  const actions = SYMPTOM_ACTIONS[symptomId];
  if (actions) return actions;

  // Fallback: convert rule suggestions into action entries
  if (primary.outputs.suggestions.length > 0) {
    return primary.outputs.suggestions.map((s) => ({
      area: 'Suggested action',
      guidance: s,
    }));
  }

  return [];
}

/**
 * Build a focused follow-up question for diagnosis responses.
 * Avoids generic prompts — asks about the specific next diagnostic step.
 */
function buildDiagnosisFollowUp(
  primary: FiredRule | undefined,
  signals: ExtractedSignals,
  sysDir?: SystemDirection,
  ctx?: ShoppingAdvisoryContext,
): string | undefined {
  if (!primary) return primary?.outputs.next_step;

  const hasSystem = !!(ctx?.systemComponents && ctx.systemComponents.length > 0);

  // Symptom-specific focused follow-ups
  const FOCUSED_FOLLOWUPS: Record<string, { withSystem: string; withoutSystem: string }> = {
    'fatigue-brightness': {
      withSystem: 'What source or DAC are you using? That is usually the most effective place to shift tonal balance in a system like this.',
      withoutSystem: 'What is your current source — DAC, streamer, or turntable? And what amplifier and speakers are in the chain? Knowing the full signal path will help me identify where the brightness originates.',
    },
    'detail-fatigue-tradeoff': {
      withSystem: 'How long have you been listening with the current configuration? If it has been less than a few weeks, the fatigue may resolve on its own.',
      withoutSystem: 'How recently did the system change? And what are the main components — knowing the chain helps me assess whether this is adjustment or genuine mismatch.',
    },
    'flat-presentation': {
      withSystem: 'What amplifier are you using? That is often the pivot point for dynamic engagement.',
      withoutSystem: 'What are the main components in your system? A flat presentation often traces to the amplifier or source.',
    },
    'thinness-bass-deficit': {
      withSystem: 'How far are your speakers from the rear wall? And what is the floor surface — carpet, hardwood, tile?',
      withoutSystem: 'Can you describe the room — size, floor surface, speaker distance from walls? Room interaction is usually the dominant factor for thinness.',
    },
    'congestion-bottleneck': {
      withSystem: 'Have you tried simplifying the chain — running source directly into the amplifier, bypassing any preamp or processor? That often reveals the bottleneck.',
      withoutSystem: 'What are the main components in your chain, from source to speakers? Congestion usually has a single origin point.',
    },
    'narrow-soundstage': {
      withSystem: 'How are the speakers positioned — separation distance, toe-in angle, distance from side walls? Small changes here have the biggest impact on staging.',
      withoutSystem: 'How wide apart are your speakers, and how far are you sitting from them? Speaker geometry is the primary factor for soundstage.',
    },
    'bass-bloom': {
      withSystem: 'How close are the speakers to the rear wall and corners? And is the room roughly square — square rooms amplify bass modes significantly.',
      withoutSystem: 'Can you describe the room — size, shape, and where the speakers are positioned relative to walls and corners?',
    },
  };

  const entry = FOCUSED_FOLLOWUPS[primary.id];
  if (entry) {
    return hasSystem ? entry.withSystem : entry.withoutSystem;
  }

  // Fall back to rule engine's next_step
  return primary.outputs.next_step;
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

    // Links and sources from catalog product data
    links: assessment.retailerLinks
      ? assessment.retailerLinks.map((l) => ({
          label: l.label,
          url: l.url,
          kind: 'reference' as const,
          region: l.region,
        }))
      : undefined,
    sourceReferences: assessment.sourceReferences
      ? assessment.sourceReferences.map((s) => ({
          source: s.source,
          note: s.note,
        }))
      : undefined,
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
