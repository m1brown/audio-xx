/**
 * Shadow orchestrator — fire-and-forget parallel call via API route.
 *
 * Called from page.tsx's shopping pipeline to run the new orchestrator
 * in parallel with the existing deterministic pipeline. Results are
 * logged but never rendered.
 *
 * Step 5: The orchestrator now runs server-side via POST /api/orchestrator.
 * This ensures API keys are available and LLM calls work correctly.
 *
 * This module exists to keep page.tsx changes minimal and testable.
 */

import type {
  OrchestratorInput,
  OrchestratorOutput,
  CandidateProduct,
  ConversationMessage,
} from './runAudioXXAssistant';
import type { ProductExample } from '../shopping-intent';
import type { ShoppingCategory, RoomContext, HardConstraints, SemanticPreferences } from '../shopping-intent';
import type { Message } from '../conversation-types';

// Re-export types needed by page.tsx
export type { OrchestratorInput, OrchestratorOutput, CandidateProduct };

// ── Input Assembly ────────────────────────────────────────

export interface ShadowOrchestratorContext {
  // Conversation state
  messages: Message[];
  allUserText: string;
  currentMessage: string;
  shoppingAnswerCount: number;
  // Shopping context
  category: ShoppingCategory;
  budgetAmount: number | null;
  roomContext: RoomContext;
  hardConstraints: HardConstraints;
  semanticPreferences: SemanticPreferences;
  // Products from the deterministic pipeline
  productExamples: ProductExample[];
  // System context
  systemComponents?: string[];
  /** System tendencies summary string (e.g., "warm, tube-driven"). */
  systemTendencies?: string;
  region?: string;
  // Taste/preferences
  musicPreferences?: string[];
  tasteProfile?: { confidence: number; traits: Record<string, number> };
  /** Brands the listener has explicitly rejected. */
  dislikedBrands?: string[];
  /** Product names the listener has explicitly rejected. */
  dislikedProducts?: string[];
  // UI state
  isRefinement: boolean;
  wantsQuickSuggestions: boolean;
}

/**
 * Convert a ProductExample (from the existing pipeline) to a CandidateProduct
 * (for the orchestrator). Maps available fields; missing fields are omitted.
 */
function productExampleToCandidate(p: ProductExample): CandidateProduct {
  return {
    name: p.name,
    brand: p.brand,
    category: (p as any).category ?? 'general',
    priceNew: p.price,
    priceUsedRange: p.usedPriceRange,
    availability: p.availability ?? 'current',
    productRole: mapBrandScale((p as any).catalogBrandScale),
    topology: (p as any).catalogTopology ?? (p as any).topology,
    subcategory: (p as any).subcategory,
    traits: (p as any).traits,
    summary: p.character ?? p.fitNote,
    tradeoffs: p.caution,
    bestFor: p.fitNote,
    furtherReading: p.sourceReferences?.map((r) => ({
      source: r.source,
      url: r.url,
    })),
  };
}

function mapBrandScale(scale: string | undefined): CandidateProduct['productRole'] {
  switch (scale) {
    case 'major': return 'mainstream';
    case 'specialist': return 'specialist';
    case 'boutique': return 'boutique';
    case 'luxury': return 'luxury';
    default: return 'specialist';
  }
}

/**
 * Convert page.tsx conversation messages to orchestrator format.
 * Keeps the last 12 text messages to give the LLM enough context,
 * and filters to messages with actual text content (user messages and notes).
 */
function convertMessages(messages: Message[]): ConversationMessage[] {
  const textMessages = messages
    .filter((m): m is { role: 'user'; content: string } | { role: 'assistant'; content: string; kind: 'note' } =>
      'content' in m && typeof (m as any).content === 'string',
    )
    .slice(-12);

  return textMessages.map((m, i) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
    turn: i + 1,
  }));
}

/**
 * Build a structured conversation summary from accumulated shopping context.
 * Gives the LLM a clear snapshot of what's been established so far,
 * reducing its reliance on inferring context from fragmented recent messages.
 */
function buildConversationSummary(ctx: ShadowOrchestratorContext): string {
  const parts: string[] = [];

  // Current search focus
  parts.push(`Active category: ${ctx.category}`);
  if (ctx.budgetAmount) parts.push(`Budget: $${ctx.budgetAmount}`);
  if (ctx.roomContext) parts.push(`Room: ${ctx.roomContext}`);
  if (ctx.isRefinement) parts.push(`This is a refinement turn (${ctx.shoppingAnswerCount} prior recommendation${ctx.shoppingAnswerCount !== 1 ? 's' : ''} given).`);

  // System context
  if (ctx.systemComponents && ctx.systemComponents.length > 0) {
    parts.push(`Existing system: ${ctx.systemComponents.join(', ')}`);
  }
  if (ctx.systemTendencies) {
    parts.push(`System tendencies: ${ctx.systemTendencies}`);
  }

  // Hard constraints
  const hc = ctx.hardConstraints;
  const constraintParts: string[] = [];
  if (hc.excludeTopologies.length > 0) constraintParts.push(`exclude: ${hc.excludeTopologies.join(', ')}`);
  if (hc.requireTopologies.length > 0) constraintParts.push(`require: ${hc.requireTopologies.join(', ')}`);
  if (hc.newOnly) constraintParts.push('new only');
  if (hc.usedOnly) constraintParts.push('used only');
  if (constraintParts.length > 0) parts.push(`Constraints: ${constraintParts.join('; ')}`);

  // Semantic preferences
  const sp = ctx.semanticPreferences;
  const prefParts: string[] = [];
  if (sp.wantsBigScale) prefParts.push('wants big scale');
  if (sp.energyLevel) prefParts.push(`energy: ${sp.energyLevel}`);
  if (sp.musicHints.length > 0) prefParts.push(`music: ${sp.musicHints.join(', ')}`);
  if (prefParts.length > 0) parts.push(`Preferences: ${prefParts.join('; ')}`);

  // Taste profile
  if (ctx.tasteProfile && ctx.tasteProfile.confidence > 0.3) {
    const topTraits = Object.entries(ctx.tasteProfile.traits)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 4)
      .map(([k, v]) => `${k}: ${v > 0 ? '+' : ''}${v.toFixed(2)}`)
      .join(', ');
    parts.push(`Taste profile (confidence ${ctx.tasteProfile.confidence.toFixed(2)}): ${topTraits}`);
  }

  return parts.join('\n');
}

/**
 * Build a complete OrchestratorInput from page.tsx state.
 */
export function buildOrchestratorInput(ctx: ShadowOrchestratorContext): OrchestratorInput {
  return {
    mode: 'shopping',
    conversationHistory: convertMessages(ctx.messages),
    userContext: {
      allUserText: ctx.allUserText,
      currentMessage: ctx.currentMessage,
      shoppingAnswerCount: ctx.shoppingAnswerCount,
      conversationSummary: buildConversationSummary(ctx),
      musicPreferences: ctx.musicPreferences,
      tasteProfile: ctx.tasteProfile,
    },
    systemContext: {
      components: ctx.systemComponents ?? [],
      roomContext: ctx.roomContext,
      region: ctx.region,
    },
    constraints: {
      category: ctx.category,
      budgetAmount: ctx.budgetAmount,
      hardConstraints: ctx.hardConstraints,
      semanticPreferences: ctx.semanticPreferences,
      dislikedBrands: ctx.dislikedBrands,
      dislikedProducts: ctx.dislikedProducts,
    },
    candidates: ctx.productExamples.map(productExampleToCandidate),
    uiState: {
      isRefinement: ctx.isRefinement,
      wantsQuickSuggestions: ctx.wantsQuickSuggestions,
    },
  };
}

// ── Shadow Execution ──────────────────────────────────────

/** API route endpoint for the server-side orchestrator. */
const ORCHESTRATOR_API = '/api/orchestrator';

/**
 * Fire the orchestrator in shadow mode via the server-side API route.
 * Returns immediately — the fetch is fire-and-forget.
 * All errors are caught and logged — never propagated to the caller.
 */
export function fireShadowOrchestrator(ctx: ShadowOrchestratorContext): void {
  // Don't even attempt if there are no products to evaluate
  if (!ctx.productExamples || ctx.productExamples.length === 0) {
    console.log('[orchestrator-shadow] Skipped — no product examples available');
    return;
  }

  const input = buildOrchestratorInput(ctx);

  // Log input summary
  logShadowInput(input);

  // Fire and forget via server-side API route
  callOrchestratorAPI(input)
    .then((output) => {
      if (output) logShadowOutput(output);
    })
    .catch((err) => {
      console.error('[orchestrator-shadow] ── Error ──');
      console.error('[orchestrator-shadow]   %s', err instanceof Error ? err.message : String(err));
    });
}

function logShadowInput(input: OrchestratorInput): void {
  console.log('[orchestrator-shadow] ── Input ──');
  console.log('[orchestrator-shadow]   mode=%s category=%s budget=$%s room=%s',
    input.mode, input.constraints.category, input.constraints.budgetAmount, input.systemContext.roomContext);
  console.log('[orchestrator-shadow]   candidates=%d shoppingAnswerCount=%d isRefinement=%s',
    input.candidates.length, input.userContext.shoppingAnswerCount, input.uiState.isRefinement);
  console.log('[orchestrator-shadow]   candidate names: %s',
    input.candidates.map((c) => `${c.brand} ${c.name}`).join(', '));
  console.log('[orchestrator-shadow]   constraints: exclude=%j require=%j newOnly=%s usedOnly=%s',
    input.constraints.hardConstraints.excludeTopologies,
    input.constraints.hardConstraints.requireTopologies,
    input.constraints.hardConstraints.newOnly,
    input.constraints.hardConstraints.usedOnly);
  if (input.userContext.conversationSummary) {
    console.log('[orchestrator-shadow]   summary: %s', input.userContext.conversationSummary.replace(/\n/g, ' | '));
  }
  console.log('[orchestrator-shadow]   currentMessage: "%s"', input.userContext.currentMessage ?? '');
  console.log('[orchestrator-shadow]   recentMessages: %d turns', input.conversationHistory.length);
}

/**
 * POST to the server-side orchestrator API route.
 * Returns the OrchestratorOutput on success, or null on failure.
 * Exported so the render path (Step 7) can await it directly.
 */
export async function callOrchestratorAPI(input: OrchestratorInput): Promise<OrchestratorOutput | null> {
  try {
    const response = await fetch(ORCHESTRATOR_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.warn('[orchestrator-shadow] API returned %d: %s',
        response.status, (errorBody as any).error ?? 'unknown error');

      // If the API returned a fallback output, use it for logging
      if ((errorBody as any).fallbackOutput) {
        return (errorBody as any).fallbackOutput as OrchestratorOutput;
      }
      return null;
    }

    const output: OrchestratorOutput = await response.json();
    return output;
  } catch (err) {
    console.error('[orchestrator-shadow] Fetch failed: %s',
      err instanceof Error ? err.message : String(err));
    return null;
  }
}

function logShadowOutput(output: OrchestratorOutput): void {
  console.log('[orchestrator-shadow] ── Output ──');
  console.log('[orchestrator-shadow]   llmCalled=%s version=%s', output.debug.llmCalled, output.debug.version);

  if (output.debug.llmCalled) {
    console.log('[orchestrator-shadow]   provider=%s model=%s', output.debug.llmProvider, output.debug.llmModel);
    if (output.debug.llmWarnings && output.debug.llmWarnings.length > 0) {
      console.log('[orchestrator-shadow]   warnings: %j', output.debug.llmWarnings);
    }
  } else {
    console.log('[orchestrator-shadow]   fallback used — reason: %s', output.debug.fallbackReason ?? 'unknown');
  }

  console.log('[orchestrator-shadow]   candidatesReceived=%d candidatesAfterFilter=%d',
    output.debug.candidatesReceived, output.debug.candidatesAfterFilter);

  if (output.structured.type === 'shopping_recommendation') {
    const data = output.structured.data;
    console.log('[orchestrator-shadow]   recommendations=%d', data.recommendations.length);
    for (const rec of data.recommendations) {
      console.log('[orchestrator-shadow]     %s (%s): %s',
        rec.productName, rec.role, rec.whyThisFitsYou.slice(0, 120));
    }
    console.log('[orchestrator-shadow]   preference values: %j', data.preferenceSummary.values);
    console.log('[orchestrator-shadow]   guidance: %s', data.overallGuidance.slice(0, 200));
  }

  console.log('[orchestrator-shadow]   responseText (first 200 chars): %s',
    output.responseText.slice(0, 200));
  console.log('[orchestrator-shadow] ── End ──');
}
