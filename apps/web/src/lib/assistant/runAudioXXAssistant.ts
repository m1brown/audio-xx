/**
 * Unified LLM Orchestrator — Audio XX
 *
 * Single entry point for all user-facing responses:
 *
 *   OrchestratorInput → runAudioXXAssistant() → OrchestratorOutput
 *
 * Architecture goals:
 *   1. Single entry point for all conversation modes
 *   2. Clean separation of context assembly from response generation
 *   3. Deterministic structured data + optional LLM prose overlay
 *   4. Full observability via structured output (no side effects)
 *
 * Step 1: Types + placeholder stub for all modes.
 * Step 2: Real shopping schemas, master prompt, production-shaped stub.
 * Step 3 (current): Real LLM call for shopping mode with validation + fallback.
 * Step 4 (next):    Wire shopping mode in page.tsx as shadow/parallel path.
 * Step 5 (future):  Diagnosis/consultation modes.
 */

import type { HardConstraints, ShoppingCategory, RoomContext, SemanticPreferences } from '../shopping-intent';
import { callLLM, buildUserPrompt, parseShoppingOutput } from './callShoppingLLM';
import type { LLMCallResult } from './callShoppingLLM';

// ── Shared Input Types ───────────────────────────────────

/** The conversation mode determines which pipeline processes the turn. */
export type OrchestratorMode = 'shopping' | 'diagnosis' | 'onboarding' | 'general';

/** A single message in the conversation history. */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Turn number (1-indexed). */
  turn: number;
}

/** User-side context accumulated across the conversation. */
export interface UserContext {
  /** All user text, newline-joined (mirrors page.tsx allUserText). */
  allUserText: string;
  /** The current turn's message text. */
  currentMessage: string;
  /** Number of shopping advisories already delivered. */
  shoppingAnswerCount: number;
  /** Stored taste profile, if available. */
  tasteProfile?: {
    confidence: number;
    traits: Record<string, number>;
  };
  /** Natural-language conversation summary (condensed from history). */
  conversationSummary?: string;
  /** Music preferences extracted from conversation. */
  musicPreferences?: string[];
}

/** System-side context: what the user owns or has described. */
export interface SystemContext {
  /** Named components in the user's system. */
  components: string[];
  /** System-level sonic tendencies, if inferred. */
  tendencies?: Record<string, number>;
  /** Room context. */
  roomContext: RoomContext;
  /** User's region (for pricing/availability context). */
  region?: string;
}

/** UI state that may influence response formatting. */
export interface UIState {
  /** Whether this is a refinement turn. */
  isRefinement: boolean;
  /** Whether the user clicked "skip to suggestions". */
  wantsQuickSuggestions: boolean;
}

// ── Shopping Input Types ─────────────────────────────────

/** Recommendation role for pick assignment. */
export type RecommendationRole = 'best_choice' | 'upgrade_choice' | 'value_choice';

/** Brand/market positioning. */
export type ProductRole = 'mainstream' | 'specialist' | 'boutique' | 'luxury';

/** A buying option for a candidate product. */
export interface BuyingOption {
  /** Retailer or marketplace name. */
  retailer: string;
  /** URL to the product page. */
  url: string;
  /** Optional price at this retailer. */
  price?: number;
  /** Whether this is new, used, or refurbished. */
  condition?: 'new' | 'used' | 'refurbished';
}

/** A candidate product available for recommendation.
 *  This is the full product card the LLM sees when generating prose. */
export interface CandidateProduct {
  /** Product name (e.g., "SuperNait 3"). */
  name: string;
  /** Brand name (e.g., "Naim"). */
  brand: string;
  /** Product category. */
  category: ShoppingCategory;
  /** New retail price in USD. */
  priceNew: number;
  /** Used market price range, if applicable. */
  priceUsedRange?: { low: number; high: number };
  /** Market availability status. */
  availability: 'current' | 'discontinued' | 'vintage';
  /** Brand/market positioning. */
  productRole: ProductRole;
  /** Design topology (e.g., "class-ab-solid-state", "horn-loaded"). */
  topology?: string;
  /** Subcategory (e.g., "floorstanding", "integrated-amp"). */
  subcategory?: string;
  /** Numeric trait scores (0–1 scale). */
  traits?: Record<string, number>;
  /** Short editorial summary of the product's character. */
  summary?: string;
  /** Known trade-offs or limitations. */
  tradeoffs?: string;
  /** Who this product is best suited for. */
  bestFor?: string;
  /** Links to reviews, measurements, or further reading. */
  furtherReading?: Array<{ source: string; url?: string }>;
  /** Where to buy. */
  buyingOptions?: BuyingOption[];
  /** Product image URL for UI rendering. */
  imageUrl?: string;
}

/** Constraints and preferences extracted from the conversation. */
export interface ShoppingConstraints {
  /** Product category being shopped. */
  category: ShoppingCategory;
  /** Budget in dollars, or null if unstated. */
  budgetAmount: number | null;
  /** Hard topology/availability filters. */
  hardConstraints: HardConstraints;
  /** Soft semantic preferences (big scale, warm, etc.). */
  semanticPreferences: SemanticPreferences;
  /** Brands the listener has explicitly disliked — hard removal before LLM sees candidates. */
  dislikedBrands?: string[];
  /** Product names the listener has explicitly disliked — hard removal before LLM sees candidates. */
  dislikedProducts?: string[];
}

/** Complete input to the orchestrator. */
export interface OrchestratorInput {
  /** Which pipeline to use. */
  mode: OrchestratorMode;
  /** Full conversation history. */
  conversationHistory: ConversationMessage[];
  /** User-accumulated context. */
  userContext: UserContext;
  /** System context (what the user owns). */
  systemContext: SystemContext;
  /** Shopping constraints (only meaningful when mode === 'shopping'). */
  constraints: ShoppingConstraints;
  /** Available candidate products for recommendation. */
  candidates: CandidateProduct[];
  /** Current UI state. */
  uiState: UIState;
}

// ── Shopping Output Types ────────────────────────────────

/** Preference summary — mirrors the user's values back to them. */
export interface PreferenceSummary {
  /** What the user seems to value (2–4 bullets). */
  values: string[];
  /** What the user tends to avoid (1–2 bullets). */
  avoids: string[];
  /** What this recommendation optimizes for (1–2 sentences). */
  optimizingFor: string;
}

/** A single product recommendation with contextual explanation. */
export interface ShoppingRecommendation {
  /** Assigned role: best fit, stretch upgrade, or budget-conscious pick. */
  role: RecommendationRole;
  /** Must match a candidate product name exactly. */
  productName: string;
  /** Why this product fits THIS user's preferences, room, and system. */
  whyThisFitsYou: string;
  /** What this product actually sounds like in plain language. */
  soundCharacter: string;
  /** What this product does NOT do well or what you trade away. */
  tradeoffs: string;
  /** Practical buying guidance (new/used pricing, availability, region). */
  buyingNote: string;
  /** Link to a review or further reading, if available. */
  furtherReading?: string;
}

/** Complete structured shopping output — matches the LLM JSON contract. */
export interface ShoppingDecisionOutput {
  /** Preference reflection before recommendations. */
  preferenceSummary: PreferenceSummary;
  /** 1–3 product recommendations with assigned roles. */
  recommendations: ShoppingRecommendation[];
  /** Directional advice after recommendations. */
  overallGuidance: string;
  /** What to avoid — common mistakes for this user's situation. */
  whatToAvoid: string;
}

// ── Generic Output Types ─────────────────────────────────

/** Union of all structured response payloads. */
export type StructuredData =
  | { type: 'shopping_recommendation'; data: ShoppingDecisionOutput }
  | { type: 'diagnosis_response'; data: Record<string, unknown> }
  | { type: 'onboarding_question'; data: { question: string; acknowledge?: string } }
  | { type: 'general_response'; data: Record<string, unknown> };

/** Complete output from the orchestrator. */
export interface OrchestratorOutput {
  /** Human-readable response text (prose). Stub in Step 2. */
  responseText: string;
  /** Structured machine-readable response. */
  structured: StructuredData;
  /** Debug/observability metadata. */
  debug: {
    /** Which mode was used. */
    mode: OrchestratorMode;
    /** Timestamp of response generation. */
    timestamp: number;
    /** Whether an LLM call was made. */
    llmCalled: boolean;
    /** Version tag for the orchestrator. */
    version: string;
    /** Number of candidates before filtering. */
    candidatesReceived?: number;
    /** Number of candidates after hard constraint filtering. */
    candidatesAfterFilter?: number;
    /** LLM provider used (when llmCalled is true). */
    llmProvider?: string;
    /** LLM model used (when llmCalled is true). */
    llmModel?: string;
    /** Validation warnings from LLM output parsing. */
    llmWarnings?: string[];
    /** Reason for falling back to deterministic output. */
    fallbackReason?: string;
  };
}

// ── Orchestrator ─────────────────────────────────────────

/** Current orchestrator version. Increment on each architectural step. */
const ORCHESTRATOR_VERSION = '0.3.0';

/**
 * Unified orchestrator entry point.
 *
 * Step 3: Shopping mode makes a real LLM call with the master prompt.
 * If the LLM call fails or returns invalid JSON, falls back to a
 * deterministic stub response (same as Step 2 behavior).
 *
 * Other modes remain stubbed.
 *
 * @param input - Complete orchestrator input
 * @returns Structured output with response text and typed data
 */
export async function runAudioXXAssistant(
  input: OrchestratorInput,
): Promise<OrchestratorOutput> {
  const { mode } = input;
  const timestamp = Date.now();

  switch (mode) {
    case 'shopping':
      return buildShoppingResponse(input, timestamp);

    case 'diagnosis':
      return buildGenericStub(mode, 'diagnosis_response', timestamp);

    case 'onboarding':
      return buildOnboardingStub(timestamp);

    case 'general':
    default:
      return buildGenericStub(mode, 'general_response', timestamp);
  }
}

// ── Hard constraint filtering ────────────────────────────

/**
 * Apply hard constraints to candidate products.
 * This mirrors the rankProducts filtering in product-scoring.ts.
 * Filtering happens BEFORE the LLM sees candidates — the LLM
 * never receives products that violate hard constraints.
 */
export function filterCandidates(
  candidates: CandidateProduct[],
  constraints: ShoppingConstraints,
): CandidateProduct[] {
  let filtered = [...candidates];

  // Dislike filter — hard removal of brands/products the listener has rejected.
  // Applied first so disliked products never reach the LLM.
  if (constraints.dislikedBrands && constraints.dislikedBrands.length > 0) {
    const disliked = new Set(constraints.dislikedBrands.map((b) => b.toLowerCase()));
    filtered = filtered.filter((c) => !disliked.has(c.brand.toLowerCase()));
  }
  if (constraints.dislikedProducts && constraints.dislikedProducts.length > 0) {
    const disliked = new Set(constraints.dislikedProducts.map((p) => p.toLowerCase()));
    filtered = filtered.filter(
      (c) => !disliked.has(c.name.toLowerCase()) && !disliked.has(`${c.brand} ${c.name}`.toLowerCase()),
    );
  }

  // Budget filter — hard constraint, no stretch allowance.
  // Used-market pricing qualifies only if new price is within 2× budget.
  if (constraints.budgetAmount) {
    const budget = constraints.budgetAmount;
    filtered = filtered.filter((c) => {
      if (c.priceNew <= budget) return true;
      if (c.priceUsedRange && c.priceUsedRange.high <= budget && c.priceNew <= budget * 2) return true;
      return false;
    });
  }

  // Topology exclusion
  if (constraints.hardConstraints.excludeTopologies.length > 0) {
    filtered = filtered.filter(
      (c) => !c.topology || !constraints.hardConstraints.excludeTopologies.includes(c.topology),
    );
  }

  // Topology requirement
  if (constraints.hardConstraints.requireTopologies.length > 0) {
    filtered = filtered.filter(
      (c) => c.topology && constraints.hardConstraints.requireTopologies.includes(c.topology),
    );
  }

  // Availability: new only
  if (constraints.hardConstraints.newOnly) {
    filtered = filtered.filter(
      (c) => c.availability === 'current',
    );
  }

  // Availability: used only
  if (constraints.hardConstraints.usedOnly) {
    filtered = filtered.filter(
      (c) => c.availability === 'discontinued' || c.availability === 'vintage',
    );
  }

  return filtered;
}

// ── Shopping Response Builder ─────────────────────────────

/**
 * Build a shopping response by calling the LLM with the master prompt.
 * Falls back to deterministic stub if LLM call fails or returns invalid JSON.
 */
async function buildShoppingResponse(
  input: OrchestratorInput,
  timestamp: number,
): Promise<OrchestratorOutput> {
  const { constraints, candidates, userContext, systemContext } = input;
  const candidatesReceived = candidates.length;

  // Apply hard constraint filtering BEFORE the LLM sees anything
  const filtered = filterCandidates(candidates, constraints);
  const candidatesAfterFilter = filtered.length;

  // Build candidate name list for validation
  const candidateNames = filtered.map((c) => `${c.brand} ${c.name}`);

  // Assemble user prompt
  const userPrompt = buildUserPrompt(input, filtered);
  console.log('[orchestrator-debug] Input payload:\n%s', userPrompt.slice(0, 1000) + (userPrompt.length > 1000 ? '...' : ''));

  // Attempt LLM call
  let llmResult: LLMCallResult | null = null;
  let parsedOutput: ShoppingDecisionOutput | null = null;
  let llmWarnings: string[] = [];
  let fallbackReason: string | null = null;

  try {
    llmResult = await callLLM(userPrompt);
    console.log('[orchestrator-debug] LLM raw output (%s, success=%s):\n%s',
      llmResult.provider, llmResult.success,
      llmResult.rawText.slice(0, 1500) + (llmResult.rawText.length > 1500 ? '...' : ''));

    if (llmResult.success) {
      const parseResult = parseShoppingOutput(llmResult.rawText, candidateNames);
      if (parseResult) {
        parsedOutput = parseResult.parsed;
        llmWarnings = parseResult.warnings;
        console.log('[orchestrator-debug] Parsed structured output: %d recommendations, %d warnings',
          parsedOutput.recommendations.length, llmWarnings.length);
        if (llmWarnings.length > 0) {
          console.warn('[orchestrator-debug] Validation warnings:', llmWarnings);
        }
      } else {
        fallbackReason = 'JSON validation failed';
        console.warn('[orchestrator-debug] JSON validation failed, falling back to deterministic output');
      }
    } else {
      fallbackReason = llmResult.error ?? 'LLM call returned success=false';
      console.warn('[orchestrator-debug] LLM call failed: %s', fallbackReason);
    }
  } catch (err) {
    fallbackReason = err instanceof Error ? err.message : String(err);
    console.error('[orchestrator-debug] LLM call threw: %s', fallbackReason);
  }

  // Use LLM output if valid, otherwise fall back to deterministic stub
  if (parsedOutput) {
    // Build prose response text from structured output
    const proseLines: string[] = [];
    const ps = parsedOutput.preferenceSummary;
    proseLines.push(`What you seem to value: ${ps.values.join('; ')}`);
    if (ps.avoids.length > 0) proseLines.push(`What you tend to avoid: ${ps.avoids.join('; ')}`);
    proseLines.push('');
    for (const rec of parsedOutput.recommendations) {
      proseLines.push(`${rec.productName} (${rec.role.replace(/_/g, ' ')}): ${rec.whyThisFitsYou}`);
    }
    proseLines.push('');
    proseLines.push(parsedOutput.overallGuidance);

    return {
      responseText: proseLines.join('\n'),
      structured: {
        type: 'shopping_recommendation',
        data: parsedOutput,
      },
      debug: {
        mode: 'shopping',
        timestamp,
        llmCalled: true,
        version: ORCHESTRATOR_VERSION,
        candidatesReceived,
        candidatesAfterFilter,
        llmProvider: llmResult?.provider,
        llmModel: llmResult?.model,
        llmWarnings: llmWarnings.length > 0 ? llmWarnings : undefined,
      },
    };
  }

  // ── Deterministic Fallback ──────────────────────────────
  return buildDeterministicFallback(
    input, filtered, candidatesReceived, candidatesAfterFilter, timestamp, fallbackReason,
  );
}

/**
 * Deterministic fallback when LLM is unavailable or returns invalid output.
 * Identical to Step 2 stub logic — ensures the system always returns
 * a valid ShoppingDecisionOutput.
 */
function buildDeterministicFallback(
  input: OrchestratorInput,
  filtered: CandidateProduct[],
  candidatesReceived: number,
  candidatesAfterFilter: number,
  timestamp: number,
  fallbackReason: string | null,
): OrchestratorOutput {
  const { constraints, userContext, systemContext } = input;

  // Sort by price proximity to budget, take top 3
  const sorted = [...filtered].sort((a, b) => {
    if (!constraints.budgetAmount) return 0;
    return Math.abs(a.priceNew - constraints.budgetAmount) - Math.abs(b.priceNew - constraints.budgetAmount);
  });
  const top3 = sorted.slice(0, 3);

  // Assign roles
  const roles: RecommendationRole[] = ['best_choice', 'upgrade_choice', 'value_choice'];
  const recommendations: ShoppingRecommendation[] = top3.map((c, i) => ({
    role: roles[i] ?? 'value_choice',
    productName: `${c.brand} ${c.name}`,
    whyThisFitsYou: `${c.brand} ${c.name} aligns with your preferences for ${constraints.category} under $${constraints.budgetAmount ?? '?'}.`,
    soundCharacter: c.summary ?? `${c.topology ?? 'Unknown topology'} design with characteristic presentation.`,
    tradeoffs: c.tradeoffs ?? `Trade-off assessment requires further analysis.`,
    buyingNote: `$${c.priceNew} new.${c.priceUsedRange ? ` $${c.priceUsedRange.low}–$${c.priceUsedRange.high} used.` : ''} ${c.availability === 'current' ? 'Currently available.' : `Status: ${c.availability}.`}`,
    furtherReading: c.furtherReading?.[0]?.url,
  }));

  const preferenceSummary: PreferenceSummary = {
    values: userContext.musicPreferences?.length
      ? userContext.musicPreferences.map((p) => `Music: ${p}`)
      : ['Preference details pending.'],
    avoids: constraints.hardConstraints.excludeTopologies.length > 0
      ? constraints.hardConstraints.excludeTopologies.map((t) => `No ${t}`)
      : ['No specific avoidances noted.'],
    optimizingFor: `Finding the best ${constraints.category} fit under $${constraints.budgetAmount ?? '?'}${systemContext.roomContext ? ` for a ${systemContext.roomContext} room` : ''}.`,
  };

  const shoppingOutput: ShoppingDecisionOutput = {
    preferenceSummary,
    recommendations,
    overallGuidance: `${recommendations.length} candidate${recommendations.length === 1 ? '' : 's'} passed constraint filtering.`,
    whatToAvoid: 'Avoid products outside your stated constraints.',
  };

  console.log('[orchestrator-debug] Using deterministic fallback. Reason: %s', fallbackReason ?? 'no LLM configured');

  return {
    responseText: `Shopping recommendation for ${constraints.category} under $${constraints.budgetAmount ?? '?'}. ${candidatesAfterFilter} of ${candidatesReceived} candidates passed filtering.`,
    structured: {
      type: 'shopping_recommendation',
      data: shoppingOutput,
    },
    debug: {
      mode: 'shopping',
      timestamp,
      llmCalled: false,
      version: ORCHESTRATOR_VERSION,
      candidatesReceived,
      candidatesAfterFilter,
      fallbackReason: fallbackReason ?? 'no LLM configured',
    },
  };
}

// ── Stub builders (non-shopping modes) ───────────────────

function buildOnboardingStub(timestamp: number): OrchestratorOutput {
  return {
    responseText: '[stub] Onboarding — what kind of listening are you looking to do?',
    structured: {
      type: 'onboarding_question',
      data: {
        question: 'Are you looking to buy something new, improve what you already have, or troubleshoot a problem you\'re hearing?',
        acknowledge: 'Good place to start.',
      },
    },
    debug: {
      mode: 'onboarding',
      timestamp,
      llmCalled: false,
      version: ORCHESTRATOR_VERSION,
    },
  };
}

function buildGenericStub(
  mode: OrchestratorMode,
  type: 'diagnosis_response' | 'general_response',
  timestamp: number,
): OrchestratorOutput {
  return {
    responseText: `[stub] ${mode} mode — not yet implemented.`,
    structured: {
      type,
      data: {},
    },
    debug: {
      mode,
      timestamp,
      llmCalled: false,
      version: ORCHESTRATOR_VERSION,
    },
  };
}
