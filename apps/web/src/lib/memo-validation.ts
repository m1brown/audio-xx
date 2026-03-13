/**
 * Structural validation for LLM overlay output.
 *
 * The LLM overlay may rephrase three narrow fields (introSummary,
 * keyObservation, recommendedSequence). This module validates that
 * the LLM's output does not:
 *   - Introduce products not in the allowlist
 *   - Change the number or order of recommended steps
 *   - Exceed length limits
 *   - Contain prohibited patterns (scoring, urgency, affiliate language)
 *
 * All validation is conservative: any failure silently falls back
 * to the deterministic rendering.
 */

import type { MemoFindings } from './memo-findings';

// ── Types ────────────────────────────────────────────

/** The three fields the LLM overlay is allowed to rephrase. */
export interface LlmOverlayFields {
  introSummary?: string;
  keyObservation?: string;
  /** Must preserve step count and order from deterministic sequence. */
  recommendedSequence?: { step: number; action: string }[];
}

export interface ValidationResult {
  valid: boolean;
  /** Which fields passed validation. Only valid fields are applied. */
  accepted: Partial<LlmOverlayFields>;
  /** Reasons for any rejected fields (for drift logging). */
  rejections: string[];
}

// ── Constants ────────────────────────────────────────

/** Max character length for introSummary. */
const MAX_INTRO_LENGTH = 400;

/** Max character length for keyObservation. */
const MAX_KEY_OBS_LENGTH = 400;

/** Max character length per recommended step action. */
const MAX_STEP_ACTION_LENGTH = 200;

/** Prohibited patterns — urgency, scoring, affiliate language. */
const PROHIBITED_PATTERNS = [
  /\b(must|need to|should immediately|urgently|don't wait|act now)\b/i,
  /\b(\d+\/\d+|\d+ out of \d+|score[ds]?\s+\d+)\b/i,
  /\b(click here|buy now|limited time|special offer|discount|deal)\b/i,
  /\b(best|worst|perfect|ideal|ultimate|game.?changer)\b/i,
  /\b(affiliate|sponsored|partner)\b/i,
];

// ── Allowlist extraction ─────────────────────────────

/**
 * Build the product/brand name allowlist from MemoFindings.
 *
 * Sources:
 *   - findings.componentNames (the user's current system)
 *   - findings.upgradePaths[].options[].name (recommended products)
 *   - findings.upgradePaths[].options[].brand (recommended brands)
 *
 * All names are lowercased for case-insensitive matching.
 */
export function buildProductAllowlist(findings: MemoFindings): Set<string> {
  const names = new Set<string>();

  for (const name of findings.componentNames) {
    names.add(name.toLowerCase());
  }

  for (const path of findings.upgradePaths) {
    for (const opt of path.options) {
      names.add(opt.name.toLowerCase());
      names.add(opt.brand.toLowerCase());
    }
  }

  // Also add component verdict names (may differ from componentNames formatting)
  for (const v of findings.componentVerdicts) {
    names.add(v.name.toLowerCase());
  }

  return names;
}

// ── Field validators ─────────────────────────────────

function containsProhibitedPattern(text: string): string | null {
  for (const pattern of PROHIBITED_PATTERNS) {
    const match = text.match(pattern);
    if (match) return `prohibited pattern: "${match[0]}"`;
  }
  return null;
}

/**
 * Check if text contains product/brand names not in the allowlist.
 *
 * Strategy: extract capitalized multi-word phrases (likely proper nouns)
 * and check against the allowlist. This is deliberately conservative —
 * it may miss some product names, but won't false-positive on common words.
 */
function containsUnknownProducts(text: string, allowlist: Set<string>): string | null {
  // Extract capitalized phrases that look like product names
  // Matches sequences like "Chord Hugo TT2", "Denafrips Pontus"
  const candidates = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z0-9]+)+\b/g) ?? [];

  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    // Check if any allowlist entry contains this candidate or vice versa
    const found = [...allowlist].some(
      (allowed) => allowed.includes(lower) || lower.includes(allowed),
    );
    if (!found) {
      return `unknown product reference: "${candidate}"`;
    }
  }
  return null;
}

function validateIntroSummary(
  text: string,
  allowlist: Set<string>,
): { valid: boolean; reason?: string } {
  if (text.length > MAX_INTRO_LENGTH) {
    return { valid: false, reason: `introSummary exceeds ${MAX_INTRO_LENGTH} chars (${text.length})` };
  }
  const prohibited = containsProhibitedPattern(text);
  if (prohibited) return { valid: false, reason: `introSummary: ${prohibited}` };

  const unknown = containsUnknownProducts(text, allowlist);
  if (unknown) return { valid: false, reason: `introSummary: ${unknown}` };

  return { valid: true };
}

function validateKeyObservation(
  text: string,
  allowlist: Set<string>,
): { valid: boolean; reason?: string } {
  if (text.length > MAX_KEY_OBS_LENGTH) {
    return { valid: false, reason: `keyObservation exceeds ${MAX_KEY_OBS_LENGTH} chars (${text.length})` };
  }
  const prohibited = containsProhibitedPattern(text);
  if (prohibited) return { valid: false, reason: `keyObservation: ${prohibited}` };

  const unknown = containsUnknownProducts(text, allowlist);
  if (unknown) return { valid: false, reason: `keyObservation: ${unknown}` };

  return { valid: true };
}

function validateRecommendedSequence(
  steps: { step: number; action: string }[],
  deterministicSteps: { step: number; action: string }[],
  allowlist: Set<string>,
): { valid: boolean; reason?: string } {
  // Step count must match
  if (steps.length !== deterministicSteps.length) {
    return {
      valid: false,
      reason: `recommendedSequence step count mismatch: LLM=${steps.length}, deterministic=${deterministicSteps.length}`,
    };
  }

  // Step numbers must match in order
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].step !== deterministicSteps[i].step) {
      return {
        valid: false,
        reason: `recommendedSequence step order mismatch at index ${i}: LLM=${steps[i].step}, deterministic=${deterministicSteps[i].step}`,
      };
    }
  }

  // Validate each step action
  for (const step of steps) {
    if (step.action.length > MAX_STEP_ACTION_LENGTH) {
      return {
        valid: false,
        reason: `recommendedSequence step ${step.step} exceeds ${MAX_STEP_ACTION_LENGTH} chars`,
      };
    }
    const prohibited = containsProhibitedPattern(step.action);
    if (prohibited) return { valid: false, reason: `recommendedSequence step ${step.step}: ${prohibited}` };

    const unknown = containsUnknownProducts(step.action, allowlist);
    if (unknown) return { valid: false, reason: `recommendedSequence step ${step.step}: ${unknown}` };
  }

  return { valid: true };
}

// ── Main validator ───────────────────────────────────

/**
 * Validate LLM overlay output against the deterministic baseline.
 *
 * Each field is validated independently. Valid fields are accepted;
 * invalid fields are rejected with reasons (for drift logging).
 * The caller applies only accepted fields.
 */
export function validateLlmOverlay(
  llmOutput: LlmOverlayFields,
  findings: MemoFindings,
  deterministicSequence: { step: number; action: string }[],
): ValidationResult {
  const allowlist = buildProductAllowlist(findings);
  const accepted: Partial<LlmOverlayFields> = {};
  const rejections: string[] = [];

  // Validate introSummary
  if (llmOutput.introSummary !== undefined) {
    const result = validateIntroSummary(llmOutput.introSummary, allowlist);
    if (result.valid) {
      accepted.introSummary = llmOutput.introSummary;
    } else {
      rejections.push(result.reason!);
    }
  }

  // Validate keyObservation
  if (llmOutput.keyObservation !== undefined) {
    const result = validateKeyObservation(llmOutput.keyObservation, allowlist);
    if (result.valid) {
      accepted.keyObservation = llmOutput.keyObservation;
    } else {
      rejections.push(result.reason!);
    }
  }

  // Validate recommendedSequence
  if (llmOutput.recommendedSequence !== undefined) {
    const result = validateRecommendedSequence(
      llmOutput.recommendedSequence,
      deterministicSequence,
      allowlist,
    );
    if (result.valid) {
      accepted.recommendedSequence = llmOutput.recommendedSequence;
    } else {
      rejections.push(result.reason!);
    }
  }

  return {
    valid: rejections.length === 0,
    accepted,
    rejections,
  };
}
