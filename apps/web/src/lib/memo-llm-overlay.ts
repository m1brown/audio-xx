/**
 * LLM memo overlay — async rephrasing layer for system assessment memos.
 *
 * The deterministic renderer produces a complete, correct memo. This module
 * optionally requests an LLM to rephrase three narrow prose fields:
 *   1. introSummary — 1–2 sentence system overview
 *   2. keyObservation — listener taste pattern insight
 *   3. recommendedSequence — upgrade step phrasing (preserving count/order)
 *
 * Design:
 *   - Input: MemoFindings (structured contract only — no raw reasoning)
 *   - Output: validated LlmOverlayFields (partial — only accepted fields)
 *   - Hard timeout with silent fallback to deterministic
 *   - Structural validation via memo-validation.ts
 *   - Fire-and-forget from the caller's perspective
 *
 * The LLM MUST NOT:
 *   - Invent facts or introduce products not in the allowlist
 *   - Change bottleneck identification or upgrade rankings
 *   - Add sections, scores, or urgency language
 *   - Exceed field length limits
 */

import type { MemoFindings } from './memo-findings';
import { LISTENER_PRIORITY_LABELS } from './memo-findings';
import type { LlmOverlayFields } from './memo-validation';
import { validateLlmOverlay } from './memo-validation';

// ── Configuration ────────────────────────────────────

/** Hard timeout for the LLM call in milliseconds. */
const LLM_TIMEOUT_MS = 8000;

// ── Prompt construction ──────────────────────────────

/**
 * Build the system prompt for the LLM overlay.
 * Establishes the narrow contract and behavioral constraints.
 */
function buildSystemPrompt(): string {
  return `You are a prose refinement layer for an audio equipment advisory system.

You receive a structured MemoFindings object describing a user's audio system assessment. Your job is to produce natural, advisor-quality prose for exactly three fields:

1. introSummary — A 1–2 sentence overview of the system. Mention the key components by name and the system's overall character. Max 400 characters.

2. keyObservation — A 1–2 sentence insight about what the listener seems to value, based on the system's axis positions and inferred listener priorities. Max 400 characters.

3. recommendedSequence — Rephrase each upgrade step for natural reading. You MUST preserve the exact number of steps and their order. Each step max 200 characters.

STRICT CONSTRAINTS:
- Use ONLY product and brand names present in the SYSTEM COMPONENTS list. Do not introduce ANY new products, brands, or models — not even well-known ones. If a component is not in SYSTEM COMPONENTS, it does not exist for this assessment.
- ONLY describe component characteristics that are explicitly stated in the provided data (axis values, tendency descriptions, trait scores). Do NOT infer or assume characteristics based on brand reputation, general knowledge, or common associations. If the data says a component is warm and elastic, do not describe it as controlled or powerful. A 20W vintage receiver is not "powerful" — describe only what the data provides.
- Do not claim a component has high damping, high power, tight control, or similar characteristics unless those are explicitly present in the axis or tendency data. When elastic_controlled is negative (elastic), do NOT describe the component as controlled or damped.
- Do not change the bottleneck identification, upgrade ranking order, or component verdicts.
- Do not add scoring, ratings, urgency language, or superlatives (best, worst, perfect, ideal, ultimate).
- Do not add affiliate language or purchase pressure.
- Do not introduce contradictions — if the data describes a system as elastic, do not later describe it as tightly controlled.
- Write in a calm, knowledgeable, non-performative advisory tone.
- Keep prose concise. Prefer clarity over flourish.

Respond with a JSON object containing exactly these fields:
{
  "introSummary": "...",
  "keyObservation": "...",
  "recommendedSequence": [{ "step": 1, "action": "..." }, ...]
}`;
}

/**
 * Build the user prompt from MemoFindings.
 * Only structured data — no prose, no raw reasoning.
 */
function buildUserPrompt(findings: MemoFindings): string {
  const sections: string[] = [];

  // System identity
  sections.push(`SYSTEM COMPONENTS: ${findings.componentNames.join(', ')}`);
  sections.push(`SIGNAL CHAIN: ${findings.systemChain.names.join(' → ')}`);

  // System axes
  const axes = findings.systemAxes;
  const axisLines: string[] = [];
  if (axes.warm_bright) axisLines.push(`warm↔bright: ${axes.warm_bright}`);
  if (axes.smooth_detailed) axisLines.push(`smooth↔detailed: ${axes.smooth_detailed}`);
  if (axes.elastic_controlled) axisLines.push(`elastic↔controlled: ${axes.elastic_controlled}`);
  if (axes.airy_closed) axisLines.push(`airy↔closed: ${axes.airy_closed}`);
  sections.push(`SYSTEM AXES: ${axisLines.join(', ')}`);

  // Stacked traits
  if (findings.stackedTraits.length > 0) {
    const traits = findings.stackedTraits.map(
      (t) => `${t.property} (${t.contributors.join(', ')})`,
    );
    sections.push(`STACKED TRAITS: ${traits.join('; ')}`);
  }

  // Bottleneck
  if (findings.bottleneck) {
    sections.push(
      `PRIMARY CONSTRAINT: ${findings.bottleneck.component} (${findings.bottleneck.role}) — ${findings.bottleneck.category}, severity ${findings.bottleneck.severity}`,
    );
  }

  // Component verdicts
  const verdicts = findings.componentVerdicts.map(
    (v) => `${v.name} (${v.role}): ${v.verdict} — strengths: ${v.strengths.join(', ')}; weaknesses: ${v.weaknesses.join(', ')}`,
  );
  sections.push(`COMPONENT VERDICTS:\n${verdicts.join('\n')}`);

  // Upgrade paths
  if (findings.upgradePaths.length > 0) {
    const paths = findings.upgradePaths.map((p) => {
      const opts = p.options.map((o) => `${o.name} (${o.brand}, ${o.priceRange})`).join(', ');
      return `Rank ${p.rank}: ${p.targetRole} [${p.impact}] — options: ${opts}`;
    });
    sections.push(`UPGRADE PATHS:\n${paths.join('\n')}`);
  }

  // Keeps
  if (findings.keeps.length > 0) {
    const keeps = findings.keeps.map((k) => `${k.name} (${k.role})`);
    sections.push(`KEEP: ${keeps.join(', ')}`);
  }

  // Recommended sequence (deterministic baseline)
  if (findings.recommendedSequence.length > 0) {
    const steps = findings.recommendedSequence.map(
      (s) => `Step ${s.step}: ${s.action}`,
    );
    sections.push(`DETERMINISTIC UPGRADE SEQUENCE:\n${steps.join('\n')}`);
  }

  // Listener priorities
  if (findings.listenerPriorities.length > 0) {
    const labels = findings.listenerPriorities.map((p) => LISTENER_PRIORITY_LABELS[p]);
    sections.push(`LISTENER PRIORITIES: ${labels.join(', ')}`);
  }

  // Deliberateness
  sections.push(`DELIBERATE BUILD: ${findings.isDeliberate ? 'yes' : 'no'}`);
  if (findings.deliberatenessSignals.length > 0) {
    sections.push(`DELIBERATENESS SIGNALS: ${findings.deliberatenessSignals.join(', ')}`);
  }

  return sections.join('\n\n');
}

// ── LLM call ─────────────────────────────────────────

/**
 * Parse the LLM response JSON into LlmOverlayFields.
 * Returns null if parsing fails.
 */
function parseLlmResponse(raw: string): LlmOverlayFields | null {
  try {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();
    const parsed = JSON.parse(cleaned);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const result: LlmOverlayFields = {};

    if (typeof parsed.introSummary === 'string') {
      result.introSummary = parsed.introSummary;
    }

    if (typeof parsed.keyObservation === 'string') {
      result.keyObservation = parsed.keyObservation;
    }

    if (Array.isArray(parsed.recommendedSequence)) {
      const steps = parsed.recommendedSequence
        .filter(
          (s: unknown): s is { step: number; action: string } =>
            typeof s === 'object' &&
            s !== null &&
            typeof (s as Record<string, unknown>).step === 'number' &&
            typeof (s as Record<string, unknown>).action === 'string',
        );
      if (steps.length > 0) {
        result.recommendedSequence = steps;
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Call the LLM overlay endpoint with timeout.
 *
 * Returns validated overlay fields, or null on any failure
 * (timeout, parse error, validation rejection).
 *
 * The caller should fire this asynchronously after dispatching
 * the deterministic memo. On success, dispatch UPDATE_ADVISORY
 * with the merged advisory.
 */
export async function requestLlmOverlay(
  findings: MemoFindings,
): Promise<{
  fields: Partial<LlmOverlayFields>;
  rejections: string[];
} | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch('/api/memo-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: buildSystemPrompt(),
        userPrompt: buildUserPrompt(findings),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data.content !== 'string') return null;

    const llmFields = parseLlmResponse(data.content);
    if (!llmFields) return null;

    // Build deterministic baseline for sequence validation
    const deterministicSequence = findings.recommendedSequence.map((s) => ({
      step: s.step,
      action: s.action,
    }));

    const validation = validateLlmOverlay(llmFields, findings, deterministicSequence);

    return {
      fields: validation.accepted,
      rejections: validation.rejections,
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

// ── Exports for testing ──────────────────────────────

export { buildSystemPrompt as _buildSystemPrompt };
export { buildUserPrompt as _buildUserPrompt };
export { parseLlmResponse as _parseLlmResponse };
