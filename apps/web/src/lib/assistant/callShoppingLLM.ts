/**
 * LLM call layer for the Audio XX shopping orchestrator.
 *
 * Supports Anthropic (default) and OpenAI providers via raw fetch.
 * Mirrors the provider/model pattern from api/memo-overlay/route.ts.
 *
 * Configuration (environment variables):
 *   ORCHESTRATOR_LLM_PROVIDER — 'anthropic' | 'openai' (default: 'anthropic')
 *   ORCHESTRATOR_LLM_MODEL    — model identifier
 *     Defaults: 'claude-sonnet-4-5-20250929' (Anthropic), 'gpt-4o' (OpenAI)
 *   ANTHROPIC_API_KEY          — required when provider is 'anthropic'
 *   OPENAI_API_KEY             — required when provider is 'openai'
 *
 * Returns: raw LLM response text (expected to be JSON).
 * Caller is responsible for parsing and validating.
 */

import { SHOPPING_SYSTEM_PROMPT } from './prompts/audioXXMasterPrompt';
import type {
  OrchestratorInput,
  CandidateProduct,
  ShoppingDecisionOutput,
  ShoppingRecommendation,
  PreferenceSummary,
} from './runAudioXXAssistant';

// ── Provider Configuration ────────────────────────────────

function getProvider(): string {
  return process.env.ORCHESTRATOR_LLM_PROVIDER ?? 'anthropic';
}

function getModel(): string {
  const provider = getProvider();
  const defaultModel = provider === 'openai' ? 'gpt-4o' : 'claude-sonnet-4-5-20250929';
  return process.env.ORCHESTRATOR_LLM_MODEL ?? defaultModel;
}

function getApiKey(): string | undefined {
  const provider = getProvider();
  return provider === 'openai'
    ? process.env.OPENAI_API_KEY
    : process.env.ANTHROPIC_API_KEY;
}

// ── User Prompt Assembly ──────────────────────────────────

/**
 * Build the user-facing JSON payload sent alongside the system prompt.
 * This is what the LLM sees as the "user message" — structured context
 * plus the list of pre-filtered candidate products.
 */
export function buildUserPrompt(
  input: OrchestratorInput,
  filteredCandidates: CandidateProduct[],
): string {
  const { userContext, systemContext, constraints, conversationHistory } = input;

  const payload = {
    conversationSummary: userContext.conversationSummary ?? null,
    currentMessage: userContext.currentMessage ?? null,
    recentMessages: conversationHistory.slice(-8).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    userPreferences: {
      musicPreferences: userContext.musicPreferences ?? [],
      tasteProfile: userContext.tasteProfile ?? null,
    },
    systemContext: {
      components: systemContext.components,
      roomContext: systemContext.roomContext,
      region: systemContext.region ?? null,
    },
    constraints: {
      category: constraints.category,
      budgetAmount: constraints.budgetAmount,
      hardConstraints: constraints.hardConstraints,
      semanticPreferences: {
        wantsBigScale: constraints.semanticPreferences.wantsBigScale,
        energyLevel: constraints.semanticPreferences.energyLevel,
        musicHints: constraints.semanticPreferences.musicHints,
      },
    },
    candidateProducts: filteredCandidates.map((c) => ({
      name: `${c.brand} ${c.name}`,
      brand: c.brand,
      category: c.category,
      priceNew: c.priceNew,
      priceUsedRange: c.priceUsedRange ?? null,
      availability: c.availability,
      productRole: c.productRole,
      topology: c.topology ?? null,
      subcategory: c.subcategory ?? null,
      summary: c.summary ?? null,
      tradeoffs: c.tradeoffs ?? null,
      bestFor: c.bestFor ?? null,
      furtherReading: c.furtherReading ?? null,
    })),
  };

  return JSON.stringify(payload, null, 2);
}

// ── Raw LLM Call ──────────────────────────────────────────

export interface LLMCallResult {
  /** Raw text returned by the LLM (before JSON parsing). */
  rawText: string;
  /** Provider that was called. */
  provider: string;
  /** Model used. */
  model: string;
  /** Whether the call succeeded (HTTP 2xx + non-empty text). */
  success: boolean;
  /** Error message if the call failed. */
  error?: string;
}

/**
 * Make a raw LLM call with the shopping system prompt and assembled user context.
 * Returns the raw text response — caller is responsible for JSON parsing.
 */
export async function callLLM(userPrompt: string): Promise<LLMCallResult> {
  const provider = getProvider();
  const model = getModel();
  const apiKey = getApiKey();

  console.log('[orchestrator-llm] provider=%s model=%s key_present=%s', provider, model, !!apiKey);
  console.log('[orchestrator-llm] user prompt length=%d chars', userPrompt.length);

  if (!apiKey) {
    console.warn('[orchestrator-llm] No API key configured for provider=%s', provider);
    return {
      rawText: '',
      provider,
      model,
      success: false,
      error: `No API key configured for ${provider}. Set ${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'}.`,
    };
  }

  try {
    if (provider === 'openai') {
      return await callOpenAI(apiKey, model, userPrompt);
    } else {
      return await callAnthropic(apiKey, model, userPrompt);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[orchestrator-llm] Call failed:', message);
    return {
      rawText: '',
      provider,
      model,
      success: false,
      error: message,
    };
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<LLMCallResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: SHOPPING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[orchestrator-llm] Anthropic error: %d %s', response.status, text);
    return {
      rawText: '',
      provider: 'anthropic',
      model,
      success: false,
      error: `Anthropic API ${response.status}: ${text.slice(0, 200)}`,
    };
  }

  const data = await response.json();
  const rawText = data.content?.[0]?.text ?? '';

  return { rawText, provider: 'anthropic', model, success: rawText.length > 0 };
}

async function callOpenAI(
  apiKey: string,
  model: string,
  userPrompt: string,
): Promise<LLMCallResult> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [
        { role: 'system', content: SHOPPING_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[orchestrator-llm] OpenAI error: %d %s', response.status, text);
    return {
      rawText: '',
      provider: 'openai',
      model,
      success: false,
      error: `OpenAI API ${response.status}: ${text.slice(0, 200)}`,
    };
  }

  const data = await response.json();
  const rawText = data.choices?.[0]?.message?.content ?? '';

  return { rawText, provider: 'openai', model, success: rawText.length > 0 };
}

// ── JSON Validation ───────────────────────────────────────

const VALID_ROLES = new Set(['best_choice', 'upgrade_choice', 'value_choice']);

/**
 * Parse raw LLM text into ShoppingDecisionOutput.
 * Returns null if the text is not valid JSON or doesn't match the schema.
 */
export function parseShoppingOutput(
  rawText: string,
  candidateNames: string[],
): { parsed: ShoppingDecisionOutput; warnings: string[] } | null {
  const warnings: string[] = [];

  // Strip markdown code fences if present (LLM sometimes wraps JSON)
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }

  let obj: unknown;
  try {
    obj = JSON.parse(cleaned);
  } catch {
    console.error('[orchestrator-llm] JSON parse failed. Raw text:\n%s', rawText.slice(0, 500));
    return null;
  }

  if (!obj || typeof obj !== 'object') return null;
  const data = obj as Record<string, unknown>;

  // Validate preferenceSummary
  const ps = data.preferenceSummary;
  if (!ps || typeof ps !== 'object') return null;
  const psObj = ps as Record<string, unknown>;
  if (!Array.isArray(psObj.values) || psObj.values.length === 0) return null;
  if (!Array.isArray(psObj.avoids)) return null;
  if (typeof psObj.optimizingFor !== 'string') return null;

  // Validate recommendations
  if (!Array.isArray(data.recommendations) || data.recommendations.length === 0) return null;
  const recs = data.recommendations as Array<Record<string, unknown>>;
  if (recs.length > 3) {
    warnings.push(`LLM returned ${recs.length} recommendations, truncating to 3`);
    recs.splice(3);
  }

  const validatedRecs: ShoppingRecommendation[] = [];
  const candidateNameSet = new Set(candidateNames.map((n) => n.toLowerCase()));

  for (const rec of recs) {
    if (typeof rec.role !== 'string' || !VALID_ROLES.has(rec.role)) return null;
    if (typeof rec.productName !== 'string' || rec.productName.length === 0) return null;
    if (typeof rec.whyThisFitsYou !== 'string') return null;
    if (typeof rec.soundCharacter !== 'string') return null;
    if (typeof rec.tradeoffs !== 'string') return null;
    if (typeof rec.buyingNote !== 'string') return null;

    // Verify product name matches a candidate (case-insensitive).
    // Try exact match first, then partial/fuzzy match.
    const recNameLower = rec.productName.toLowerCase();
    let matchedCandidate = candidateNameSet.has(recNameLower);
    if (!matchedCandidate) {
      // Partial match — LLM may have reformatted the name slightly
      matchedCandidate = [...candidateNameSet].some(
        (cn) => cn.includes(recNameLower) || recNameLower.includes(cn),
      );
    }
    if (!matchedCandidate) {
      warnings.push(`LLM recommended "${rec.productName}" which is not in candidate list — DISCARDED`);
      // Reject hallucinated products — do not include in validated output.
      continue;
    }

    validatedRecs.push({
      role: rec.role as ShoppingRecommendation['role'],
      productName: rec.productName,
      whyThisFitsYou: rec.whyThisFitsYou,
      soundCharacter: rec.soundCharacter,
      tradeoffs: rec.tradeoffs,
      buyingNote: rec.buyingNote,
      furtherReading: typeof rec.furtherReading === 'string' ? rec.furtherReading : undefined,
    });
  }

  // If all recommendations were discarded (hallucinated products), fall back
  if (validatedRecs.length === 0) {
    warnings.push('All LLM recommendations were outside candidate set — falling back to deterministic');
    return null;
  }

  // Validate overallGuidance and whatToAvoid
  if (typeof data.overallGuidance !== 'string') return null;
  if (typeof data.whatToAvoid !== 'string') return null;

  const parsed: ShoppingDecisionOutput = {
    preferenceSummary: {
      values: psObj.values as string[],
      avoids: psObj.avoids as string[],
      optimizingFor: psObj.optimizingFor as string,
    },
    recommendations: validatedRecs,
    overallGuidance: data.overallGuidance as string,
    whatToAvoid: data.whatToAvoid as string,
  };

  return { parsed, warnings };
}
