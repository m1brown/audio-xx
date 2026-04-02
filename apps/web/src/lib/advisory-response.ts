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
  links?: Array<{ label: string; url: string; kind?: 'reference' | 'dealer' | 'review' }>;

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
  /** True when this is the primary recommendation in directed mode. */
  isPrimary?: boolean;
  /** Practical buying guidance — new vs used, availability, regional notes. */
  buyingNote?: string;
  /** Role tag in the 4-option recommendation model. */
  pickRole?: 'anchor' | 'close_alt' | 'contrast' | 'wildcard' | 'top_pick' | 'upgrade_pick' | 'value_pick';
  /** Where this product is typically found (new / used / both). */
  typicalMarket?: 'new' | 'used' | 'both';
  /** Structured buying context label — overrides card inference when present. */
  buyingContext?: 'easy_new' | 'better_used' | 'dealer_likely' | 'used_only';
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
  /** Taste-based verdict — explicit leaning based on listener priorities. */
  tasteVerdict?: string;
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
  /** True when preference signal is weak/generic — triggers "Start here" CTA. */
  lowPreferenceSignal?: boolean;
  /** True when budget + category + taste are all present — shifts output from
   *  exploratory options to directed system-building with a primary recommendation. */
  directed?: boolean;
  /** Next logical build step — what to consider next in a system build.
   *  Only populated in directed mode (e.g. "This speaker choice makes amplifier
   *  matching the critical next step."). */
  nextBuildStep?: string;
  /** The shopping category for this response (used for preference re-run). */
  shoppingCategory?: string;
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

  // ── 7f0. Taste Reflection ─────────────────────────────
  /** Structured taste interpretation — expert-level bullets derived from
   *  accumulated listener profile, rendered before product recommendations. */
  tasteReflection?: {
    bullets: string[];
    summary: string;
    direction: string | null;
    confident: boolean;
  };

  // ── 7f-1. Decisive Recommendation ──────────────────
  /** "What I would actually do" block — top pick + alternative with reasons. */
  decisiveRecommendation?: {
    topPick: { name: string; brand: string; reason: string };
    alternative?: { name: string; brand: string; reason: string };
  };

  // ── 7f-2. System Pairing Intro ────────────────────
  /** System-aware intro referencing the anchor product and pairing logic. */
  systemPairingIntro?: string;

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

  // System compatibility note — extract amplifier name if present
  let systemClause = '';
  if (systemComponents && systemComponents.length > 0) {
    const AMP_KEYWORDS = ['integrated', 'amplifier', 'amp', 'receiver', 'preamp', 'power amp'];
    const ampComponent = systemComponents.find(c =>
      AMP_KEYWORDS.some(kw => c.toLowerCase().includes(kw)),
    );
    if (ampComponent) {
      systemClause = `, with compatibility for your ${ampComponent}`;
    } else {
      systemClause = `, with compatibility for your current system`;
    }
  }

  // Combine — preference and archetype detail now live in systemInterpretation,
  // so the intro stays brief: what category, what budget, what system constraint.
  return `These ${catLabel}${budgetClause} represent different design trade-offs${systemClause}. The first is where I'd start.`;
}

/**
 * Build a directed editorial intro — used when budget + category + taste
 * are all present and the output shifts to system-building mode.
 *
 * Leads with a primary direction statement rather than a curated-list frame.
 * Example: "This system should lean toward rhythmic energy and transient
 * speed. Here is the strongest match for that direction at ~$5,000."
 */
function buildDirectedEditorialIntro(
  category: string,
  budget?: string,
  tasteLabel?: string,
  archetype?: string,
  systemComponents?: string[],
): string | undefined {
  if (!category || category === 'general') return undefined;

  // Use singular/article form for "The [X] should lean toward..." phrasing.
  // Category arrives as the display label (e.g. "speakers" not "speaker"),
  // so map both raw keys and display labels.
  const CATEGORY_LABELS: Record<string, string> = {
    dac: 'DAC',
    DAC: 'DAC',
    amplifier: 'amplifier',
    speaker: 'speaker choice',
    speakers: 'speaker choice',
    headphone: 'headphone choice',
    headphones: 'headphone choice',
    streamer: 'streamer',
    turntable: 'turntable',
  };
  const catLabel = CATEGORY_LABELS[category] ?? category;

  // Archetype-specific direction statements — assertive, system-building language
  const ARCHETYPE_DIRECTION: Record<string, string> = {
    flow_organic: 'musical flow and natural phrasing — designs that prioritise rhythmic ease over clinical precision',
    precision_explicit: 'precision and detail retrieval — designs that reveal everything in the recording',
    rhythmic_propulsive: 'rhythmic energy and transient speed — designs that make music feel alive and forward-moving',
    tonal_saturated: 'tonal richness and harmonic density — designs that favour body and warmth over speed',
    spatial_holographic: 'spatial precision and holographic staging — designs that recreate the recording space',
  };

  const directionPhrase = archetype && ARCHETYPE_DIRECTION[archetype]
    ? ARCHETYPE_DIRECTION[archetype]
    : tasteLabel
      ? `${tasteLabel.toLowerCase()} — designs that lean into that quality`
      : undefined;

  if (!directionPhrase) return undefined;

  const budgetClause = budget ? ` at ~${budget}` : '';

  const systemClause = systemComponents && systemComponents.length > 0
    ? `, working with your ${systemComponents.slice(0, 2).join(' and ')}`
    : '';

  return `This ${catLabel} should lean toward ${directionPhrase}. Here's where I'd look${budgetClause}${systemClause}.`;
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
  // Tendency detail is in systemContextPreamble — keep this brief.
  if (ctx?.systemComponents && ctx.systemComponents.length > 0) {
    const systemList = ctx.systemComponents.slice(0, 3).join(', ');
    parts.push(`With ${systemList} in your system:`);
  }

  // ── Layer 2: Taste/preference interpretation (only with real signal) ──
  // In directed mode, use assertive "Given your preference" framing.
  // In exploratory mode, use observational "You seem to" framing.
  if (hasTasteSignal && reasoning?.taste.archetype) {
    const archetype = reasoning.taste.archetype;
    const isDirected = !!a.directed;
    const ARCHETYPE_INTERPRETATION_DIRECTED: Record<string, string> = {
      flow_organic: 'Priority: musical flow and natural phrasing.',
      rhythmic_propulsive: 'Priority: energy, impact, and transient speed.',
      tonal_saturated: 'Priority: tonal richness and harmonic density.',
      precision_explicit: 'Priority: resolution and precision.',
      spatial_holographic: 'Priority: spatial depth and imaging.',
    };
    const ARCHETYPE_INTERPRETATION: Record<string, string> = {
      flow_organic: 'Your inputs point toward musical flow and natural phrasing over clinical precision.',
      rhythmic_propulsive: 'Your inputs point toward rhythmic energy and transient speed — music that feels alive.',
      tonal_saturated: 'Your inputs point toward tonal richness and harmonic density over speed or detail.',
      precision_explicit: 'Your inputs point toward resolution, separation, and precision.',
      spatial_holographic: 'Your inputs point toward spatial depth and imaging — a sense of real performance space.',
    };
    const interpretation = isDirected
      ? ARCHETYPE_INTERPRETATION_DIRECTED[archetype]
      : ARCHETYPE_INTERPRETATION[archetype];
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
  // When lowPreferenceSignal is true, skip this entirely — the StartHereBlock
  // replaces passive landscape text with an active preference capture CTA.
  const isLowSignal = a.statedGaps?.includes('taste') ?? false;
  if (parts.length === 0 && !isLowSignal) {
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
      }
      // No else — when isLowSignal is false but direction is fallback,
      // the StartHereBlock will handle it. No passive landscape text.
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
    return `For ${subject}: ${dirBrief.toLowerCase()} — the trade-off is ${tradeOffs[0].toLowerCase()}.`;
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
      return `Your system leans ${systemTendencies.toLowerCase()}, and you want ${priorityBrief.toLowerCase()}. The direction below closes that gap.`;
    }
    return `Your system leans ${systemTendencies.toLowerCase()}, and you want ${priorityBrief.toLowerCase()}.`;
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

  // Alignment rationale — only when not already set and not a comparison
  if (!enriched.alignmentRationale && enriched.advisoryMode !== 'gear_comparison') {
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

  // Comparison responses should be concise and decision-oriented.
  // Suppress heavy advisory blocks (audioProfile, philosophy, tendencies,
  // systemFit, recommendations) when comparisonSummary is the primary content.
  const isComparison = !!c.comparisonSummary;

  return enrichAdvisory({
    kind: 'consultation',
    advisoryMode: c.advisoryMode ?? (isComparison ? 'gear_comparison' as AdvisoryMode : undefined),
    title: c.title,
    subject: c.subject,
    source: c.source,

    // Suppress audioProfile and prose blocks for comparisons —
    // the comparisonSummary + followUp is all that should render.
    audioProfile: isComparison ? undefined : (reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined),
    comparisonSummary: c.comparisonSummary,
    philosophy: isComparison ? undefined : c.philosophy,
    tendencies: isComparison ? undefined : c.tendencies,
    systemFit: isComparison ? undefined : (isAssessment ? undefined : c.systemContext),
    systemContext: isComparison ? undefined : (isAssessment ? c.systemContext : undefined),
    followUp: c.followUp,
    links: c.links?.map((l) => ({
      label: l.label,
      url: l.url,
      kind: l.kind,
      region: l.region,
    })),

    // System assessment specific fields (populated only for assessment responses)
    componentReadings: isComparison ? undefined : c.componentReadings,
    systemInteraction: isComparison ? undefined : c.systemInteraction,
    assessmentStrengths: isComparison ? undefined : c.assessmentStrengths,
    assessmentLimitations: isComparison ? undefined : c.assessmentLimitations,
    upgradeDirection: isComparison ? undefined : c.upgradeDirection,

    // Structured memo-format fields — suppress for comparisons
    systemChain: isComparison ? undefined : c.systemChain,
    introSummary: isComparison ? undefined : c.introSummary,
    primaryConstraint: isComparison ? undefined : c.primaryConstraint,
    stackedTraitInsights: isComparison ? undefined : c.stackedTraitInsights,
    componentAssessments: isComparison ? undefined : c.componentAssessments,
    upgradePaths: isComparison ? undefined : c.upgradePaths,
    keepRecommendations: isComparison ? undefined : c.keepRecommendations,
    recommendedSequence: isComparison ? undefined : c.recommendedSequence,
    keyObservation: isComparison ? undefined : c.keyObservation,
    systemSynergy: isComparison ? undefined : c.systemSynergy,
    listenerTasteProfile: isComparison ? undefined : c.listenerTasteProfile,
    spiderChartData: isComparison ? undefined : c.spiderChartData,
    sourceReferences: c.sourceReferences,
    systemSignature: isComparison ? undefined : c.systemSignature,
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
      bullets.push(`You listen ${label} — this shapes which traits matter most in the evaluation.`);
    }
  }

  // System tendency interaction
  if (r.systemDirection?.tendencySummary) {
    bullets.push(`Your system leans ${r.systemDirection.tendencySummary.toLowerCase()} — this component either reinforces or counterbalances that.`);
  }

  // Hearing-derived context (summarize if present)
  if (r.hearing && r.hearing.length > 0 && bullets.length < 3) {
    bullets.push('Your stated priorities are factored into the fit assessment above.');
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
  const isComparison = r.intent === 'comparison';

  // "What I'm hearing" bullets become listener priorities
  // Suppress for comparisons — they add weight without decision value.
  const listenerPriorities = !isComparison && r.hearing && r.hearing.length > 0
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
      advisoryMode: isComparison ? 'gear_comparison' as AdvisoryMode : 'upgrade_suggestions',
      subject: r.subjects.length > 0 ? r.subjects.join(', ') : 'your question',

      audioProfile: isComparison ? undefined : (reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined),
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

  // Comparison responses: concise side-by-side contrast with follow-up.
  // Suppress audioProfile, whyFitsYou, productOrigin, interactionNotes,
  // recommendedDirection, tradeOffs — these create review-weight bloat.
  return enrichAdvisory({
    kind: 'consultation',
    advisoryMode: isComparison ? 'gear_comparison' as AdvisoryMode : 'gear_advice',
    subject: r.subjects.length > 0 ? r.subjects.join(', ') : 'your question',

    audioProfile: isComparison ? undefined : (reasoning || ctx ? buildAudioProfile(reasoning, ctx) : undefined),
    listenerPriorities,
    whyFitsYou: isComparison ? undefined : buildGearWhyFitsYou(r),
    systemTendencies: isComparison ? undefined : (r.systemDirection?.tendencySummary ?? undefined),

    // anchor + character become the prose body
    philosophy: r.anchor,
    tendencies: r.character,
    systemFit: isComparison ? undefined : r.interpretation,

    // Product detail — suppress for comparisons
    productOrigin: isComparison ? undefined : originNote,
    interactionNotes: isComparison ? undefined : (interactionNotes.length > 0 ? interactionNotes : undefined),

    recommendedDirection: isComparison ? undefined : r.direction,
    tradeOffs: isComparison ? undefined : (gearTradeOffs.length > 0 ? gearTradeOffs : undefined),
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
  /** Listener profile taste reflection (from listener-profile.ts). */
  tasteReflection?: {
    bullets: string[];
    summary: string;
    direction: string | null;
    confident: boolean;
  };
  /** Decisive recommendation block (from listener-profile.ts). */
  decisiveRecommendation?: {
    topPick: { name: string; brand: string; reason: string };
    alternative?: { name: string; brand: string; reason: string };
  };
  /** System-aware pairing intro (from listener-profile.ts). */
  systemPairingIntro?: string;
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
        avoidanceNote = `Avoid products that lean toward ${avoidances.join(' or ')} — your preferences point away from that.`;
      }
    }
  }

  // Taste-based verdict — explicit leaning based on listener priorities
  let tasteVerdict: string | undefined;
  if (reasoning?.taste.tasteLabel && products.length > 0) {
    const top = products[0];
    tasteVerdict = `**${top.brand} ${top.name}** is the closest match in this shortlist.`;
  }

  return {
    topPicks,
    systemPicks,
    systemSummary,
    avoidanceNote,
    tasteVerdict,
  };
}

export function shoppingToAdvisory(
  a: ShoppingAnswer,
  signals?: ExtractedSignals,
  reasoning?: ReasoningResult,
  ctx?: ShoppingAdvisoryContext,
  decisionFrame?: DecisionFrame | null,
): AdvisoryResponse {
  // Parse preferenceSummary into listenerPriorities if it's a meaningful sentence.
  // Suppress when systemInterpretation will be rendered — it already covers
  // preference/direction, so "What I'm optimizing for" would repeat it.
  const hasInterpretation = !!(reasoning?.taste.archetype) || !!(ctx?.systemComponents?.length);
  const listenerPriorities = (!hasInterpretation && a.preferenceSummary)
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
    links: [
      ...(p.links?.map((l) => ({ label: l.label, url: l.url, kind: l.label.toLowerCase().includes('review') ? 'review' as const : l.label.toLowerCase().includes('buy') || l.label.toLowerCase().includes('dealer') ? 'dealer' as const : 'reference' as const })) ?? []),
      ...(p.sourceReferences?.filter((r) => r.url).map((r) => ({ label: r.source, url: r.url!, kind: 'review' as const })) ?? []),
    ],
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
    // Buying and role metadata (from deterministic pipeline)
    pickRole: p.pickRole,
    isPrimary: p.isPrimary ?? p.pickRole === 'top_pick',
    // Step 10: Enhanced catalog fields
    imageUrl: p.imageUrl,
    typicalMarket: p.typicalMarket,
    buyingContext: p.buyingContext,
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

  // Build follow-up: taste question takes priority when confidence is low,
  // then explicit refinement question, then synthesized refinement prompts
  const followUp = a.tasteQuestion
    ?? a.categoryQuestion
    ?? a.refinementQuestion
    ?? (a.refinementPrompts && a.refinementPrompts.length > 0
      ? a.refinementPrompts.join(' ')
      : undefined);

  // Build system context preamble (when active system available)
  const systemContextPreamble = buildSystemContextPreamble(
    ctx?.systemComponents,
    reasoning,
    ctx?.systemTendencies,
  );

  // ── Weak preference signal detection ──────────────────
  // Computed once, used to suppress passive text when StartHereBlock is active.
  // True when no explicit taste signal was provided by the user.
  const isPreferenceWeak = a.statedGaps?.includes('taste') ?? false;

  // ── Directed mode ────────────────────────────────────
  // When budget + category + taste are all present, shift from exploratory
  // options to directed system-building with a primary recommendation.
  const isDirected = !!a.directed;

  // Build editorial intro — suppress when preference is weak.
  // In directed mode, use a taste-committed directive instead of a curated-list frame.
  let editorialIntro: string | undefined;
  if (isPreferenceWeak) {
    editorialIntro = undefined;
  } else if (isDirected) {
    editorialIntro = buildDirectedEditorialIntro(
      a.category,
      a.budget ? `$${a.budget}` : undefined,
      reasoning?.taste.tasteLabel,
      reasoning?.taste.archetype ?? undefined,
      ctx?.systemComponents,
    );
  } else {
    editorialIntro = buildEditorialIntro(
      a.category,
      a.budget ? `$${a.budget}` : undefined,
      ctx?.storedDesires,
      reasoning?.taste.tasteLabel,
      ctx?.systemComponents,
      reasoning?.taste.archetype ?? undefined,
    );
  }

  // Build system interpretation (mandatory reasoning layer before products)
  // Suppress for weak preference signal — StartHereBlock takes its place.
  const systemInterpretation = isPreferenceWeak
    ? undefined
    : buildSystemInterpretation(a, reasoning, ctx);

  // Build strategy bullets (conceptual guidance before product cards)
  const strategyBullets = buildStrategyBullets(a, reasoning);

  // ── Build editorial closing (best-match verdict) ─────
  // Only when we have product examples and user context
  const editorialClosing = buildEditorialClosing(a.productExamples, ctx, reasoning);

  // ── Map isPrimary from product examples to options ──
  if (isDirected) {
    for (let i = 0; i < options.length; i++) {
      if (a.productExamples[i]?.isPrimary) {
        options[i] = { ...options[i], isPrimary: true };
      }
    }
  }

  // ── In directed mode, suppress generic filler ──
  // No "For sharper recommendations...", no "Tell me about your system..."
  const suppressFiller = isDirected || isPreferenceWeak;

  return enrichAdvisory({
    kind: 'shopping',
    advisoryMode: 'upgrade_suggestions',
    subject: a.category,

    audioProfile,
    systemContextPreamble,
    systemInterpretation,
    strategyBullets,
    tasteReflection: ctx?.tasteReflection,
    decisiveRecommendation: ctx?.decisiveRecommendation,
    systemPairingIntro: ctx?.systemPairingIntro,
    editorialIntro,
    listenerPriorities,
    whyFitsYou: a.whyFitsYou,
    systemContext: a.systemNote,

    recommendedDirection: a.bestFitDirection,
    // Suppress passive content when preference is weak — StartHereBlock is the primary CTA
    whyThisFits: suppressFiller ? undefined : (a.whyThisFits.length > 0 ? a.whyThisFits : undefined),
    tradeOffs: suppressFiller ? undefined : (a.watchFor.length > 0 ? a.watchFor : undefined),

    options: options.length > 0 ? options : undefined,
    provisional: suppressFiller ? false : a.provisional,
    lowPreferenceSignal: isPreferenceWeak,
    directed: isDirected,
    nextBuildStep: isDirected ? a.nextBuildStep : undefined,
    shoppingCategory: a.category,
    statedGaps: suppressFiller ? undefined : (statedGaps && statedGaps.length > 0 ? statedGaps : undefined),
    dependencyCaveat: suppressFiller ? undefined : a.dependencyCaveat,

    sonicLandscape: a.sonicLandscape,
    decisionFrame: suppressFiller ? undefined : (decisionFrame ?? undefined),
    refinementPrompts: suppressFiller ? undefined : a.refinementPrompts,
    // Taste/category questions always pass through (even when suppressFiller); other followUps suppressed
    followUp: (a.tasteQuestion || a.categoryQuestion) ? (a.tasteQuestion ?? a.categoryQuestion) : (suppressFiller ? undefined : followUp),

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

// ── Multi-symptom tendencies helper ──────────────────

/**
 * Combine primary + secondary rule explanations into a single tendencies
 * string. When only one rule fires, returns its explanation unchanged.
 * When multiple fire, appends a brief note about the secondary issue(s)
 * so both symptoms are acknowledged in the diagnosis.
 */
// Maps rule IDs to natural-language symptom descriptions.
// Used instead of rule labels, which are internal/technical.
const SYMPTOM_DESCRIPTIONS: Record<string, string> = {
  'fatigue-brightness': 'brightness or listening fatigue',
  'detail-fatigue-tradeoff': 'detail fatigue',
  'flat-presentation': 'a flat or lifeless presentation',
  'thinness-bass-deficit': 'thinness or bass deficit',
  'congestion-bottleneck': 'congestion or compression',
  'narrow-soundstage': 'narrow staging',
  'bass-bloom': 'bass bloom or looseness',
  'too-warm': 'excessive warmth',
};

// Known co-occurring symptom pairs that warrant an integrated description
// rather than a primary-plus-appendix structure.
const COMBINED_DESCRIPTIONS: Record<string, string> = {
  'fatigue-brightness+thinness-bass-deficit':
    'Your system sounds bright and lean — too much energy in the upper frequencies and not enough weight underneath. These share a common cause: a tonal balance tilted toward the treble. The brightness adds edge, and the lack of bass reinforcement leaves nothing to counterbalance it. Addressing one will partially resolve the other.',
  'thinness-bass-deficit+fatigue-brightness':
    'Your system sounds lean and bright — the bass feels absent while the upper frequencies push forward. This is a tonal imbalance, not two separate problems. When the low end is underrepresented, brightness becomes more pronounced because there is less body to balance it.',
};

function buildMultiSymptomTendencies(firedRules: FiredRule[]): string | undefined {
  if (firedRules.length === 0) return undefined;

  const primary = firedRules[0];
  const base = primary.outputs.explanation;
  if (!base) return undefined;

  // Single rule — return as-is
  if (firedRules.length === 1) return base;

  // Filter to meaningful secondary rules
  const secondary = firedRules.slice(1, 3).filter(r => r.id !== 'friendly-advisor-fallback');
  if (secondary.length === 0) return base;

  // Check for a known combined description
  const comboKey = `${primary.id}+${secondary[0].id}`;
  if (COMBINED_DESCRIPTIONS[comboKey]) {
    return COMBINED_DESCRIPTIONS[comboKey];
  }

  // Fallback: append natural-language description of secondary symptoms
  const secondaryDescriptions = secondary
    .map(r => SYMPTOM_DESCRIPTIONS[r.id])
    .filter(Boolean);

  if (secondaryDescriptions.length === 0) return base;

  const trimmed = base.replace(/\s+$/, '');
  const joined = secondaryDescriptions.join(' and ');
  const connector = `You also described ${joined}. These share a common cause — addressing the primary symptom addresses both.`;

  return `${trimmed}\n\n${connector}`;
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

  // Collect all suggestions and risks across fired rules.
  // Deduplicate risks that share the same core warning (e.g. multiple rules
  // warning about "warm" components masking qualities). Keep the first
  // occurrence and drop near-duplicates.
  const allSuggestions = result.fired_rules.flatMap((r) => r.outputs.suggestions);
  const rawRisks = result.fired_rules.flatMap((r) => r.outputs.risks);
  const allRisks: string[] = [];
  const seenRiskKeys = new Set<string>();
  for (const risk of rawRisks) {
    // Normalize: lowercase, strip quotes, collapse whitespace
    const key = risk.toLowerCase().replace(/["'"]/g, '').replace(/\s+/g, ' ').trim();
    // Check for semantic overlap — risks starting with the same 6 words
    const shortKey = key.split(' ').slice(0, 6).join(' ');
    if (!seenRiskKeys.has(shortKey)) {
      seenRiskKeys.add(shortKey);
      allRisks.push(risk);
    }
  }

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

  // Layer 3: Ranked action areas with product directions.
  // When multiple symptom rules fire, use a combined action set that
  // interleaves both symptoms' priorities instead of only showing the primary.
  const diagnosisActions = buildDiagnosisActions(primary, signals, sysDir, result.fired_rules);

  // Follow-up: focused, not generic. When multiple symptom rules fire,
  // produce a combined follow-up that reflects both symptoms.
  const followUp = buildDiagnosisFollowUp(primary, signals, sysDir, ctx, result.fired_rules);

  return enrichAdvisory({
    kind: 'diagnosis',
    subject: primary?.label ?? 'your listening situation',

    // Only show Audio Preferences when the user has provided system context
    // AND expressed real preferences. For diagnosis-only inputs ("too bright",
    // "lacks bass") the reasoning fallback produces generic priorities like
    // "musical engagement" — surfacing these feels fabricated and broadens the
    // response beyond the symptom the user actually described.
    audioProfile: ctx?.systemComponents
      ? buildAudioProfile(reasoning, ctx)
      : undefined,
    listenerPriorities: listenerPriorities.length > 0 ? listenerPriorities : undefined,
    listenerAvoids: listenerAvoids.length > 0 ? listenerAvoids : undefined,
    systemTendencies: sysDir?.tendencySummary ?? undefined,

    // Primary rule explanation remains as tendencies prose.
    // When multiple rules fire, append a brief acknowledgment of secondary
    // symptoms so both issues are visible in the explanation.
    tendencies: buildMultiSymptomTendencies(result.fired_rules),

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
  }
  // NOTE: Previously this had an `else if (reasoning?.taste.archetype)` branch
  // that added "Your preferences lean toward..." for diagnosis outputs without
  // system context. Removed: for diagnosis-only inputs ("too bright", "lacks
  // bass"), the reasoning engine infers an archetype from symptom language,
  // producing a preference statement that does not reflect anything the user
  // actually said. Archetype framing belongs in shopping, not diagnosis.

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
      withSystem: 'In a resolving, transparent system, brightness and fatigue come from the upstream chain — the DAC or source feeds detail faster than the ear can comfortably absorb. This is not a flaw; it is a design trade-off that becomes audible when every component is highly revealing.',
      withoutSystem: 'Brightness and listening fatigue originate upstream — the source or DAC is feeding more treble energy or transient detail than the system can absorb comfortably. The effect compounds in resolving systems where nothing softens the signal.',
    },
    'detail-fatigue-tradeoff': {
      withSystem: 'Your system is doing its job — revealing more of the recording. The fatigue you are experiencing is the cost of that transparency. Over time, the ear may adjust. If it does not, the system may be more analytical than your long-term listening preferences require.',
      withoutSystem: 'More detail means more fatigue initially. A highly resolving system presents everything — including recording artifacts and compression — with full clarity. The question is whether this is temporary adjustment or a genuine mismatch with your preferences.',
    },
    'flat-presentation': {
      withSystem: 'A flat, unengaging presentation usually points to the amplifier or to a system that optimizes for composure at the expense of dynamic contrast. When everything is perfectly controlled, music can lose the tension and release that makes it involving.',
      withoutSystem: 'A flat presentation reflects insufficient dynamic contrast — the amplifier prioritizes composure over engagement, or the system as a whole is over-damped, trading musical involvement for measured precision.',
    },
    'thinness-bass-deficit': {
      withSystem: 'Thinness is primarily a room interaction — speaker placement and boundary reinforcement have a larger effect on bass weight than any component change. It can also indicate a lean-voiced source chain that strips midrange density.',
      withoutSystem: 'Thinness is almost always dominated by room interaction and speaker placement before any component is at fault. The distance from rear and side walls directly controls how much bass energy the room reinforces.',
    },
    'congestion-bottleneck': {
      withSystem: 'Congestion means something in the chain cannot keep up — one component is limiting the system\'s ability to separate and present information clearly. In a well-matched system, this points to a single bottleneck rather than a general problem.',
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
    return `${primary.outputs.explanation.trim()} Given your system's voicing — ${sysDir!.tendencySummary!.toLowerCase()} — that tendency is reinforced rather than counterbalanced.`;
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
  allRules?: FiredRule[],
): Array<{ area: string; guidance: string; examples?: string }> {
  if (!primary) return [];

  // ── Combined action sets for known multi-symptom pairs ──
  // When two symptom rules co-fire, interleave both symptoms' action
  // priorities so the secondary symptom is treated as co-equal.
  const secondaryIds = (allRules ?? [])
    .slice(1, 3)
    .filter(r => r.id !== 'friendly-advisor-fallback')
    .map(r => r.id);

  const COMBINED_ACTIONS: Record<string, Array<{ area: string; guidance: string; examples?: string }>> = {
    'fatigue-brightness+thinness-bass-deficit': [
      { area: 'Speaker placement', guidance: 'The most reversible fix. Moving speakers closer to the rear wall increases bass reinforcement and adds body that counterbalances perceived brightness. Start with 6-inch increments.' },
      { area: 'Source / DAC', guidance: 'A warmer, more organic DAC addresses brightness at the source while adding midrange density that helps with perceived thinness.', examples: 'R-2R designs (Denafrips Enyo 15th, Schiit Bifrost 2), tube-output DACs (MHDT Orchid)' },
      { area: 'Room treatment', guidance: 'Two interventions: absorption at first reflection points reduces treble energy; a rug or soft furnishings on hard floors shifts the tonal balance warmer.' },
      { area: 'Amplifier pairing', guidance: 'If the amplifier is lean or neutral, a warmer-voiced alternative can restore body without masking detail.', examples: 'Rega Brio, Exposure 2510, PrimaLuna EVO 100 (tube)' },
    ],
    'thinness-bass-deficit+fatigue-brightness': [
      { area: 'Speaker placement', guidance: 'The most reversible fix. Moving speakers closer to the rear wall increases bass reinforcement — the added body reduces the perception of brightness by restoring tonal balance.' },
      { area: 'Source / DAC', guidance: 'A warmer DAC adds midrange density and reduces upstream treble edge simultaneously.', examples: 'Denafrips Enyo 15th, Schiit Bifrost 2, Border Patrol DAC' },
      { area: 'Room treatment', guidance: 'Hard floors and bare walls tilt the balance bright and thin. Adding a rug, diffusion panels, or absorption at first reflections addresses both symptoms.' },
      { area: 'Amplifier pairing', guidance: 'A warmer-voiced amplifier restores harmonic weight. Especially impactful if the current amp is lean or analytical.', examples: 'Rega Brio, Exposure 2510, PrimaLuna EVO 100 (tube)' },
    ],
  };

  if (secondaryIds.length > 0) {
    const comboKey = `${primary.id}+${secondaryIds[0]}`;
    if (COMBINED_ACTIONS[comboKey]) {
      return COMBINED_ACTIONS[comboKey];
    }
  }

  const symptomId = primary.id;

  // Symptom-specific ranked action paths (single-symptom)
  const SYMPTOM_ACTIONS: Record<string, Array<{ area: string; guidance: string; examples?: string }>> = {
    'fatigue-brightness': [
      { area: 'Source / DAC', guidance: 'The most effective single change. A warmer, more organic DAC shifts the tonal center without sacrificing resolution.', examples: 'R-2R designs (Denafrips Enyo 15th, Schiit Bifrost 2), tube-output DACs (MHDT Orchid)' },
      { area: 'Tube buffer or preamp', guidance: 'A tube stage between source and amplifier adds second-order harmonics that soften transient edges and reduce fatigue.', examples: 'Schiit Freya+, Black Ice Audio FOZ, Linear Tube Audio MicroZOTL' },
      { area: 'Cables', guidance: 'Copper interconnects generally present a warmer tonal balance than silver. This is a subtle but real adjustment at the system level.', examples: 'Cardas Clear Reflection, AudioQuest Yukon' },
      { area: 'Room treatment', guidance: 'Absorption at first reflection points reduces the doubled treble energy that contributes to perceived brightness.' },
    ],
    'detail-fatigue-tradeoff': [
      { area: 'Wait and observe', guidance: 'The ear adjusts to increased resolution over 2–4 weeks. If fatigue persists beyond this, the system may genuinely be too analytical for your preferences.' },
      { area: 'Source voicing', guidance: 'If fatigue does not resolve, a more musical source can ease the relentless detail without losing the improvements you have gained.', examples: 'Denafrips Pontus, Schiit Gungnir, MHDT Orchid' },
      { area: 'Listening level', guidance: 'Highly resolving systems reveal more at lower volumes. Dropping the volume slightly eliminates fatigue in many cases.' },
    ],
    'flat-presentation': [
      { area: 'Amplifier', guidance: 'If the amplifier prioritizes composure, a more dynamic design restores the tension and release that makes music involving.', examples: 'Naim Nait 5si, Rega Brio, Exposure 2510 (for rhythmic drive); Decware Zen (for tube-based engagement)' },
      { area: 'Source / DAC', guidance: 'An analytical source can flatten dynamics before the amplifier sees them. A more expressive DAC can help.', examples: 'Chord Qutest, Denafrips Enyo 15th' },
      { area: 'Speaker positioning', guidance: 'Slight toe-in adjustments and moving closer to the listening position can increase perceived presence and energy.' },
    ],
    'thinness-bass-deficit': [
      { area: 'Speaker placement', guidance: 'Moving speakers closer to the rear wall increases bass reinforcement. Start with 6-inch increments and listen for a few days at each position.' },
      { area: 'Source voicing', guidance: 'A warmer-voiced DAC or source adds midrange density and perceived weight to the tonal balance.', examples: 'Schiit Bifrost 2, Denafrips Enyo 15th, Border Patrol DAC' },
      { area: 'Amplifier pairing', guidance: 'If the amplifier is lean or neutral, a warmer-voiced alternative can restore body without compromising detail.', examples: 'Rega Brio, Exposure 2510, PrimaLuna EVO 100 (tube)' },
      { area: 'Room treatment', guidance: 'Bare floors and hard walls tilt the balance toward upper frequencies. Adding a rug or diffusion panels can shift perceived warmth.' },
    ],
    'congestion-bottleneck': [
      { area: 'Source / DAC', guidance: 'A cleaner, more resolving source clears congestion throughout the chain — this is the most common bottleneck.', examples: 'Chord Qutest, Denafrips Pontus, Schiit Bifrost 2' },
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
  allRules?: FiredRule[],
): string | undefined {
  if (!primary) return primary?.outputs.next_step;

  const hasSystem = !!(ctx?.systemComponents && ctx.systemComponents.length > 0);

  // ── Combined follow-ups for known multi-symptom pairs ──
  // When two symptom rules co-fire, the follow-up should address both
  // rather than asking only about the primary symptom.
  const secondaryIds = (allRules ?? [])
    .slice(1, 3)
    .filter(r => r.id !== 'friendly-advisor-fallback')
    .map(r => r.id);

  const COMBINED_FOLLOWUPS: Record<string, { withSystem: string; withoutSystem: string }> = {
    'fatigue-brightness+thinness-bass-deficit': {
      withSystem: 'Two things would narrow this down: what source or DAC is in the chain (brightness starts upstream), and how far are the speakers from the rear wall (bass reinforcement is the most reversible fix for thinness).',
      withoutSystem: 'Can you walk me through the signal chain — source, DAC, amplifier, speakers? And describe the room: size, floor surface, how far the speakers sit from walls. Brightness usually traces to the source; thinness to room interaction.',
    },
    'thinness-bass-deficit+fatigue-brightness': {
      withSystem: 'How far are the speakers from the rear wall? And what source or DAC feeds the chain? Thinness responds to placement; brightness points upstream.',
      withoutSystem: 'Can you describe the room — size, floor surface, speaker distance from walls — and the main components from source to speakers? The bass issue is likely room-related; the brightness may originate further upstream.',
    },
  };

  if (secondaryIds.length > 0) {
    const comboKey = `${primary.id}+${secondaryIds[0]}`;
    const comboEntry = COMBINED_FOLLOWUPS[comboKey];
    if (comboEntry) {
      return hasSystem ? comboEntry.withSystem : comboEntry.withoutSystem;
    }
  }

  // Symptom-specific focused follow-ups (single-symptom)
  const FOCUSED_FOLLOWUPS: Record<string, { withSystem: string; withoutSystem: string }> = {
    'fatigue-brightness': {
      withSystem: 'What source or DAC are you using? That\'s the first place I\'d look to shift tonal balance.',
      withoutSystem: 'What is your current source — DAC, streamer, or turntable? And what amplifier and speakers are in the chain? Knowing the full signal path will help me identify where the brightness originates.',
    },
    'detail-fatigue-tradeoff': {
      withSystem: 'How long have you been listening with the current configuration? If it has been less than a few weeks, the fatigue may resolve on its own.',
      withoutSystem: 'How recently did the system change? And what are the main components — knowing the chain helps me assess whether this is adjustment or genuine mismatch.',
    },
    'flat-presentation': {
      withSystem: 'What amplifier are you using? That is the pivot point for dynamic engagement.',
      withoutSystem: 'What are the main components in your system? A flat presentation traces to the amplifier or source.',
    },
    'thinness-bass-deficit': {
      withSystem: 'How far are your speakers from the rear wall? And what is the floor surface — carpet, hardwood, tile?',
      withoutSystem: 'Can you describe the room — size, floor surface, speaker distance from walls? Room interaction is usually the dominant factor for thinness.',
    },
    'congestion-bottleneck': {
      withSystem: 'Have you tried simplifying the chain — running source directly into the amplifier, bypassing any preamp or processor? That reveals the bottleneck.',
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

// ── Diagnosis Follow-Up Refinement ──────────────────
//
// When the user answers a diagnostic follow-up question (e.g., room
// details after a bass_bloom diagnosis), this function builds a
// refined response that incorporates the context instead of repeating
// the same generic diagnosis.

interface RoomContext {
  small?: boolean;
  large?: boolean;
  speakersNearWall?: boolean;
  speakersInCorner?: boolean;
  speakersCloseTogether?: boolean;
  hardFloor?: boolean;
  carpet?: boolean;
  square?: boolean;
}

function extractRoomContext(text: string): RoomContext {
  const lower = text.toLowerCase();
  return {
    small: /\b(?:small|tiny|compact|little|rather small|quite small|not (?:very )?big)\b/i.test(lower),
    large: /\b(?:large|big|spacious|open plan|open.?plan)\b/i.test(lower),
    speakersNearWall: /\b(?:(?:against|near|close to|next to|by|up against)\s+(?:the\s+)?wall|wall\s*(?:mounted|hugging)|middle of the wall|on the wall)\b/i.test(lower),
    speakersInCorner: /\b(?:corner|corners)\b/i.test(lower),
    speakersCloseTogether: /\b(?:next to each other|close together|not (?:very )?far apart|side by side|bunched|(?:only|about|maybe|like)\s+\d+\s*(?:inch|foot|feet|cm|"|')?\s*apart)\b/i.test(lower),
    hardFloor: /\b(?:hardwood|hard\s*floor|tile|tiles|concrete|laminate|wood\s*floor|wooden\s*floor)\b/i.test(lower),
    carpet: /\b(?:carpet|carpeted|rug|rugs)\b/i.test(lower),
    square: /\b(?:square|cube|cubic|almost square|nearly square)\b/i.test(lower),
  };
}

/**
 * Refine a diagnosis advisory using room/system context the user just provided.
 *
 * Returns a new AdvisoryResponse that replaces the original, or undefined
 * if no meaningful refinement can be produced.
 */
export function refineDiagnosisWithContext(
  originalAdvisory: AdvisoryResponse,
  userText: string,
): AdvisoryResponse | undefined {
  const room = extractRoomContext(userText);
  const hasRoomInfo = Object.values(room).some(Boolean);

  // If no room or system context was extractable, return undefined
  // to let the normal pipeline handle it.
  if (!hasRoomInfo) return undefined;

  // ── Bass bloom + room context refinement ──────────
  const isBassBloom = originalAdvisory.diagnostics?.symptoms?.includes('bass_bloom')
    || originalAdvisory.subject?.toLowerCase().includes('bass')
    || originalAdvisory.subject?.toLowerCase().includes('boom');

  if (isBassBloom) {
    return buildBassBloomRoomRefinement(originalAdvisory, room, userText);
  }

  // ── Generic room context refinement ──────────────
  // For other symptoms, provide a lighter-touch refinement
  return buildGenericRoomRefinement(originalAdvisory, room);
}

function buildBassBloomRoomRefinement(
  original: AdvisoryResponse,
  room: RoomContext,
  _userText: string,
): AdvisoryResponse {
  // Build a contextualized explanation
  const explanationParts: string[] = [];

  if (room.small) {
    explanationParts.push(
      'A small room is the single biggest contributor to bass problems. The walls are close enough that low-frequency sound waves bounce back before they decay, reinforcing certain bass frequencies and creating audible resonances (room modes). This is physics, not a flaw in your equipment.',
    );
  }

  if (room.speakersNearWall) {
    explanationParts.push(
      'Speakers placed against or near a wall get a significant bass boost from the boundary — the wall acts as an acoustic mirror, roughly doubling the bass energy at certain frequencies. This is called boundary reinforcement.',
    );
  }

  if (room.speakersCloseTogether) {
    explanationParts.push(
      'Speakers placed close together can couple their bass output, reinforcing low frequencies further. Separating them changes which room modes are excited.',
    );
  }

  if (room.speakersInCorner) {
    explanationParts.push(
      'Corner placement gives the strongest possible bass reinforcement — three boundaries converge, each adding energy. Moving even one speaker away from the corner will produce a noticeable improvement.',
    );
  }

  if (room.square) {
    explanationParts.push(
      'A square room is acoustically the worst case for bass — the same resonant frequencies are reinforced in both horizontal dimensions, creating very pronounced modes.',
    );
  }

  // Build room-specific actions
  const actions: Array<{ area: string; guidance: string; examples?: string }> = [];

  if (room.speakersNearWall) {
    actions.push({
      area: 'Pull speakers away from the wall',
      guidance: 'This is the single most impactful change. Even 6–12 inches of clearance from the rear wall reduces boundary reinforcement significantly. If the room allows it, 18–24 inches is better. Move in small increments and listen for a few days at each position before adjusting further.',
    });
  }

  if (room.speakersCloseTogether) {
    actions.push({
      area: 'Increase speaker separation',
      guidance: 'Wider spacing changes which room modes are excited and improves stereo imaging. Aim for an equilateral triangle between the two speakers and your listening position. Even modest separation — moving each speaker 6 inches outward — can reduce bass coupling.',
    });
  }

  if (room.small) {
    actions.push({
      area: 'Corner bass traps',
      guidance: 'In a small room, bass traps in two or more corners are highly effective. They absorb the excess energy that room modes create. Start with the rear corners — you can use commercial acoustic panels or even dense rockwool panels propped into corners.',
    });
  }

  if (!room.speakersNearWall && !room.speakersCloseTogether) {
    // If we don't know the exact position, give general placement advice
    actions.push({
      area: 'Speaker placement experiment',
      guidance: 'Try pulling speakers further from all walls and increasing the distance between them. Each boundary (wall, floor, ceiling) adds bass energy — more distance means less reinforcement.',
    });
  }

  // Always include the "before buying anything" framing
  if (actions.length > 0) {
    actions.push({
      area: 'Listen before buying anything',
      guidance: 'Placement and treatment changes are free (or cheap) and reversible. Spend a week experimenting before considering component changes. In a small room with wall-adjacent speakers, placement alone resolves the issue.',
    });
  }

  // Build the next follow-up question (context-dependent)
  let followUp: string | undefined;
  if (!room.hardFloor && !room.carpet) {
    followUp = 'What is the floor surface — carpet, hardwood, tile? And are there curtains or soft furnishings in the room? This affects how much high-frequency energy balances the bass.';
  } else if (actions.length > 0) {
    followUp = 'Try the placement changes when you have a chance and let me know how it sounds. I can also assess whether your amplifier\'s damping characteristics are contributing.';
  }

  return {
    ...original,
    // Update the explanation to be room-specific
    diagnosisExplanation: explanationParts.length > 0
      ? explanationParts.join(' ')
      : original.diagnosisExplanation,
    // Replace generic actions with room-specific ones
    diagnosisActions: actions.length > 0 ? actions : original.diagnosisActions,
    // Update tendencies to acknowledge the room context
    tendencies: buildRoomAcknowledgedTendencies(original.tendencies, room),
    // Replace the follow-up (don't ask the same room question again)
    followUp,
    // Clear the interpretation since we now have actual room context
    diagnosisInterpretation: room.small
      ? 'Small room with wall-adjacent speaker placement — this is a room acoustics issue, not an equipment problem.'
      : original.diagnosisInterpretation,
  };
}

function buildGenericRoomRefinement(
  original: AdvisoryResponse,
  room: RoomContext,
): AdvisoryResponse {
  // For non-bass-bloom symptoms, just acknowledge the room context
  // and adjust the follow-up so we don't re-ask.
  const roomDesc = room.small ? 'small room' : room.large ? 'large room' : 'your room';

  return {
    ...original,
    diagnosisInterpretation: original.diagnosisInterpretation
      ? `${original.diagnosisInterpretation} (Noted: ${roomDesc}${room.speakersNearWall ? ', speakers near the wall' : ''}${room.speakersCloseTogether ? ', speakers close together' : ''}.)`
      : undefined,
    // Replace the room question with the next diagnostic step
    followUp: 'What amplifier and source are you using? Knowing the chain will help me assess whether this is purely room-driven or if there\'s a component contribution.',
  };
}

function buildRoomAcknowledgedTendencies(
  original: string | undefined,
  room: RoomContext,
): string | undefined {
  if (!original) return original;

  const roomFactors: string[] = [];
  if (room.small) roomFactors.push('small room');
  if (room.speakersNearWall) roomFactors.push('speakers positioned near the wall');
  if (room.speakersCloseTogether) roomFactors.push('speakers placed close together');
  if (room.speakersInCorner) roomFactors.push('corner placement');

  if (roomFactors.length === 0) return original;

  return `Based on your room — ${roomFactors.join(', ')} — the bass issue is almost certainly room-driven. The room is reinforcing certain bass frequencies, creating the excess you\'re hearing.`;
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
