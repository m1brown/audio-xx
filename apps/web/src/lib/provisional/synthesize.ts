/**
 * Synthesis Pipeline — Transforms curated evidence into ProvisionalProduct records.
 *
 * This module provides the orchestration layer between the evidence store
 * and the provisional product store. It:
 *
 *   1. Takes a sufficient EvidenceRecord
 *   2. Builds a synthesis prompt (via synthesis-prompt.ts)
 *   3. Calls the LLM to produce structured JSON
 *   4. Validates and converts the output into a ProvisionalProduct
 *   5. Returns the result with a complete provenance block
 *
 * ── Usage ─────────────────────────────────────────────────────
 *
 *   import { synthesizeProduct } from './synthesize';
 *   import { findEvidence } from '../evidence/store';
 *
 *   const evidence = findEvidence('kinki-studio-ex-m1');
 *   if (evidence && evidence.status === 'sufficient') {
 *     const result = await synthesizeProduct(evidence);
 *     if (result.success) {
 *       // result.product is a complete ProvisionalProduct
 *     } else {
 *       // result.errors describes what went wrong
 *     }
 *   }
 *
 * ── Integration note ──────────────────────────────────────────
 *
 * This module does NOT call any specific LLM SDK. Instead, it accepts
 * an LLM caller function as a parameter, making it testable and
 * provider-agnostic. The caller is responsible for:
 *   - Choosing the model (Claude, GPT, etc.)
 *   - Managing API keys and rate limits
 *   - Handling retries and timeouts
 */

import type { EvidenceRecord } from '../evidence/types';
import type { ProvisionalProduct, ProductProvenance, AgreementLevel } from './types';
import { buildSynthesisPrompt, buildSynthesisSystemMessage, validateSynthesisOutput } from './synthesis-prompt';

// ── Types ────────────────────────────────────────────

/**
 * Function signature for the LLM caller.
 *
 * Accepts a system message and user prompt, returns the raw string
 * response from the model. The caller handles all transport concerns.
 */
export type LlmCaller = (systemMessage: string, userPrompt: string) => Promise<string>;

/**
 * Successful synthesis result.
 */
export interface SynthesisSuccess {
  success: true;
  product: ProvisionalProduct;
  /** The raw JSON string returned by the LLM (for debugging). */
  rawOutput: string;
}

/**
 * Failed synthesis result.
 */
export interface SynthesisFailure {
  success: false;
  errors: string[];
  /** The raw output from the LLM, if any (for debugging). */
  rawOutput?: string;
}

export type SynthesisResult = SynthesisSuccess | SynthesisFailure;

// ── Pipeline ─────────────────────────────────────────

/**
 * Synthesize a ProvisionalProduct from a sufficient EvidenceRecord.
 *
 * @param evidence — The evidence record to synthesize from (must be 'sufficient')
 * @param callLlm — Provider-agnostic LLM caller function
 * @param options  — Optional overrides for provenance metadata
 * @returns SynthesisResult with either the product or error details
 */
export async function synthesizeProduct(
  evidence: EvidenceRecord,
  callLlm: LlmCaller,
  options?: {
    /** Override the model ID recorded in provenance. */
    modelId?: string;
    /** Override the synthesis date (ISO string). Defaults to today. */
    synthesizedAt?: string;
  },
): Promise<SynthesisResult> {
  // ── 1. Validate evidence readiness ────────────────
  if (evidence.status !== 'sufficient') {
    return {
      success: false,
      errors: [`Evidence status is "${evidence.status}" — must be "sufficient"`],
    };
  }

  if (evidence.sources.length < 2) {
    return {
      success: false,
      errors: [`Only ${evidence.sources.length} source(s) — minimum 2 required`],
    };
  }

  // ── 2. Build prompt ──────────────────────────────
  const systemMessage = buildSynthesisSystemMessage();
  const userPrompt = buildSynthesisPrompt(evidence);

  // ── 3. Call LLM ──────────────────────────────────
  let rawOutput: string;
  try {
    rawOutput = await callLlm(systemMessage, userPrompt);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      errors: [`LLM call failed: ${message}`],
    };
  }

  // ── 4. Parse JSON ────────────────────────────────
  let parsed: unknown;
  try {
    // Strip markdown fencing if present (common LLM behavior)
    const cleaned = rawOutput
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/i, '')
      .trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      success: false,
      errors: ['Failed to parse LLM output as JSON'],
      rawOutput,
    };
  }

  // ── 5. Validate structure ────────────────────────
  const validationErrors = validateSynthesisOutput(parsed);
  if (validationErrors.length > 0) {
    return {
      success: false,
      errors: validationErrors,
      rawOutput,
    };
  }

  // ── 6. Build provenance ──────────────────────────
  const synthesizedAt = options?.synthesizedAt ?? new Date().toISOString().slice(0, 10);

  const provenance: ProductProvenance = {
    sourceType: 'review_synthesis',
    confidence: deriveConfidence(evidence),
    validationStatus: 'provisional',
    evidenceCount: evidence.sources.length,
    agreementLevel: evidence.agreementLevel,
    references: evidence.sources.map((s) => ({
      label: s.title,
      url: s.url,
    })),
    synthesizedAt,
    rationale: buildRationale(evidence),
    ...(options?.modelId ? { modelId: options.modelId } : {}),
  };

  // ── 7. Assemble ProvisionalProduct ───────────────
  const o = parsed as Record<string, unknown>;

  const product: ProvisionalProduct = {
    id: o.id as string,
    brand: o.brand as string,
    name: o.name as string,
    category: o.category as ProvisionalProduct['category'],
    description: o.description as string,

    // Optional identity fields
    ...(o.price != null ? { price: o.price as number } : {}),
    ...(o.priceCurrency ? { priceCurrency: o.priceCurrency as string } : {}),
    ...(o.architecture ? { architecture: o.architecture as string } : {}),
    ...(o.priceTier ? { priceTier: o.priceTier as ProvisionalProduct['priceTier'] } : {}),
    ...(o.brandScale ? { brandScale: o.brandScale as ProvisionalProduct['brandScale'] } : {}),
    ...(o.region ? { region: o.region as ProvisionalProduct['region'] } : {}),
    ...(o.country ? { country: o.country as string } : {}),

    // Trait model
    primaryAxes: o.primaryAxes as ProvisionalProduct['primaryAxes'],
    traits: o.traits as Record<string, number>,
    tendencyProfile: o.tendencyProfile as ProvisionalProduct['tendencyProfile'],
    tendencies: o.tendencies as ProvisionalProduct['tendencies'],
    fatigueAssessment: o.fatigueAssessment as ProvisionalProduct['fatigueAssessment'],

    // Source attribution
    sourceReferences: o.sourceReferences as ProvisionalProduct['sourceReferences'],

    // Provenance
    provenance,
  };

  return {
    success: true,
    product,
    rawOutput,
  };
}

// ── Internal helpers ─────────────────────────────────

/**
 * Derive confidence from evidence quality signals.
 *
 * Heuristic:
 *   - 3+ sources with at least one high-reliability → 'high'
 *   - 2+ sources with strong agreement → 'medium'
 *   - Otherwise → 'low'
 */
function deriveConfidence(
  evidence: EvidenceRecord,
): 'high' | 'medium' | 'low' {
  const hasHighReliability = evidence.sources.some((s) => s.reliability === 'high');
  const sourceCount = evidence.sources.length;

  if (sourceCount >= 3 && hasHighReliability) return 'high';
  if (sourceCount >= 2 && evidence.agreementLevel === 'strong') return 'medium';
  return 'low';
}

/**
 * Build a rationale string from evidence metadata.
 */
function buildRationale(evidence: EvidenceRecord): string {
  const sourceNames = evidence.sources.map((s) => s.publication ?? s.title).join(', ');
  const domainsCovered = new Set(
    evidence.sources.flatMap((s) => s.observations.map((o) => o.domain)),
  );

  const agreementText =
    evidence.agreementLevel === 'strong'
      ? 'Sources broadly agree on sonic character.'
      : evidence.agreementLevel === 'mixed'
        ? 'Some disagreement between sources — axis positions reflect majority direction.'
        : 'Weak agreement — positions should be treated with caution.';

  return `Synthesized from ${evidence.sources.length} sources (${sourceNames}). Domains covered: ${[...domainsCovered].join(', ')}. ${agreementText}`;
}

// ── Dry-run helper ───────────────────────────────────

/**
 * Generate the synthesis prompt without calling the LLM.
 *
 * Useful for:
 *   - Reviewing the prompt before committing API credits
 *   - Testing prompt quality with different evidence records
 *   - Manual synthesis via copy-paste into an LLM interface
 */
export function dryRunSynthesis(evidence: EvidenceRecord): {
  systemMessage: string;
  userPrompt: string;
} {
  return {
    systemMessage: buildSynthesisSystemMessage(),
    userPrompt: buildSynthesisPrompt(evidence),
  };
}
