/**
 * LLM System Inference — Provisional System Assessment Mode
 *
 * When a system assessment encounters too many unknown components
 * (i.e. the deterministic axis model lacks sufficient coverage),
 * this module produces a provisional whole-system assessment via
 * the LLM, clearly labeled so the user knows it is not based on
 * verified catalog data.
 *
 * The LLM is given the full component chain and asked to reason
 * about each component's likely sonic character and the chain
 * interaction as a whole. It follows the Audio XX advisory voice
 * and assessment structure.
 *
 * This does NOT replace the deterministic model. It is a fallback
 * that fires only when the deterministic model cannot produce a
 * reliable system-level reading.
 */

import type { ConsultationResponse } from './consultation';

// ── Configuration ────────────────────────────────────

const INFERENCE_TIMEOUT_MS = 20000; // Longer than product inference — system analysis is more complex

// ── System prompt ────────────────────────────────────

const SYSTEM_PROMPT = `You are Audio XX, a private audio advisory system. You provide calm, structured system assessments — never hype, never urgency, never affiliate tone.

You are being asked to assess a hi-fi system where some or all components are NOT in your verified catalog. You must produce a useful provisional assessment based on your general knowledge of these components, but you MUST:

1. Assess EACH component individually first — describe its likely sonic character, design philosophy, and role in the chain.
2. Then assess the CHAIN INTERACTION — how the components work together, what complements, what compounds, what the overall system character is likely to be.
3. Identify strengths and limitations of the system as a whole.
4. Suggest 1-2 directional paths if the user wants to explore changes. "Do nothing" is always valid.
5. Be honest about uncertainty. If you don't know a specific component well, say so.
6. Never fabricate specifications. Use known design heritage and community consensus.
7. Use the Audio XX 4-axis model for characterization where you can:
   - warm ↔ bright (tonal balance)
   - smooth ↔ detailed (resolution character)
   - elastic ↔ controlled (dynamic behavior)
   - airy ↔ closed (spatial presentation)

Format your response as JSON with exactly these fields:
{
  "subject": "System name or component list",
  "systemSignature": "One sentence describing the overall system character",
  "philosophy": "2-4 paragraphs assessing each component's character and the system interaction. Separate paragraphs with \\n\\n. Start with the source, then amplification, then speakers. End with how they interact as a chain.",
  "tendencies": "1-2 paragraphs on the system's overall sonic tendencies — what it does well, what it trades away. Separate paragraphs with \\n\\n.",
  "systemContext": "1-2 paragraphs on what this system is good for, what music it suits, and what room/use context matters. Separate paragraphs with \\n\\n.",
  "followUp": "A single follow-up question to help narrow next steps.",
  "directionalPaths": [
    {
      "label": "Short path name",
      "description": "What this path optimizes and what it trades"
    }
  ]
}

Return ONLY valid JSON, no markdown fences, no commentary.`;

// ── Confidence computation ───────────────────────────

export interface SystemConfidenceResult {
  /** Overall confidence — 'sufficient' means deterministic model is reliable. */
  level: 'sufficient' | 'low';
  /** Number of components with catalog or brand profile data. */
  knownCount: number;
  /** Number of components with no catalog or brand data (defaulted to neutral). */
  unknownCount: number;
  /** Total components in the chain. */
  totalCount: number;
  /** Names of unknown components for display. */
  unknownComponents: string[];
}

/**
 * Determine whether the system assessment has enough catalog coverage
 * for the deterministic model to produce a reliable reading.
 *
 * Threshold logic:
 * - If more than half the components are unknown → low confidence
 * - If the amplifier AND speaker are both unknown → low confidence
 * - If only one minor component (source/cable) is unknown → sufficient
 */
export function computeSystemConfidence(
  profiles: { name: string; source: 'product' | 'brand' | 'inferred' }[],
  roles: string[],
): SystemConfidenceResult {
  const unknownComponents: string[] = [];
  let knownCount = 0;
  let unknownCount = 0;
  let ampKnown = true;
  let speakerKnown = true;

  for (let i = 0; i < profiles.length; i++) {
    if (profiles[i].source === 'inferred') {
      unknownCount++;
      unknownComponents.push(profiles[i].name);
      if (roles[i] === 'amplifier' || roles[i] === 'integrated') ampKnown = false;
      if (roles[i] === 'speaker') speakerKnown = false;
    } else {
      knownCount++;
    }
  }

  const total = profiles.length;

  // More than half unknown → low confidence
  if (unknownCount > total / 2) {
    return { level: 'low', knownCount, unknownCount, totalCount: total, unknownComponents };
  }

  // Both amp and speaker unknown → low confidence (the two highest-weight roles)
  if (!ampKnown && !speakerKnown) {
    return { level: 'low', knownCount, unknownCount, totalCount: total, unknownComponents };
  }

  return { level: 'sufficient', knownCount, unknownCount, totalCount: total, unknownComponents };
}

// ── Public API ───────────────────────────────────────

/**
 * Call the LLM to produce a provisional whole-system assessment.
 *
 * @param query - the user's original message describing their system
 * @param componentNames - display names of all components in the chain
 * @param knownDescriptions - descriptions of known components (from catalog/brand profiles)
 * @returns ConsultationResponse with source: 'llm_inferred', or null on failure
 */
export async function inferProvisionalSystemAssessment(
  query: string,
  componentNames: string[],
  knownDescriptions: { name: string; character: string; source: 'product' | 'brand' }[],
): Promise<ConsultationResponse | null> {
  const knownContext = knownDescriptions.length > 0
    ? `\n\nThe following components ARE in the Audio XX catalog with verified data:\n${knownDescriptions.map(d => `- ${d.name}: ${d.character}`).join('\n')}\n\nUse this verified data as anchor points. For unknown components, use your general knowledge.`
    : '';

  const userPrompt = `The user asked: "${query}"

The system chain includes: ${componentNames.join(' → ')}
${knownContext}

Produce a full Audio XX provisional system assessment. Assess each component's likely character, then the chain interaction, strengths, limitations, and directional paths.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS);

    const response = await fetch('/api/memo-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 503) return null;
      console.warn('[llm-system-inference] API returned', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.content;
    if (!content || typeof content !== 'string') return null;

    return parseSystemInferenceResponse(content, componentNames);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[llm-system-inference] Timed out after', INFERENCE_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[llm-system-inference] Failed:', err);
    }
    return null;
  }
}

// ── Response parsing ─────────────────────────────────

interface SystemInferenceJSON {
  subject?: string;
  systemSignature?: string;
  philosophy?: string;
  tendencies?: string;
  systemContext?: string | null;
  followUp?: string;
  directionalPaths?: { label: string; description: string }[];
}

function parseSystemInferenceResponse(
  raw: string,
  componentNames: string[],
): ConsultationResponse | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed: SystemInferenceJSON = JSON.parse(cleaned);

    if (!parsed.philosophy && !parsed.tendencies) {
      console.warn('[llm-system-inference] Parsed response has no content');
      return null;
    }

    const subject = parsed.subject || componentNames.join(', ');

    return {
      source: 'llm_inferred',
      subject,
      title: 'Provisional System Assessment',
      advisoryMode: 'system_review',
      systemSignature: parsed.systemSignature || undefined,
      philosophy: parsed.philosophy || undefined,
      tendencies: parsed.tendencies || undefined,
      systemContext: parsed.systemContext || undefined,
      followUp: parsed.followUp || 'What are you exploring — is there something you\'d like to change about this balance, or are you looking to understand what a specific upgrade path might shift?',
    };
  } catch (err) {
    console.warn('[llm-system-inference] Failed to parse JSON:', err);

    // Fallback: treat raw text as prose
    if (raw.length > 100) {
      return {
        source: 'llm_inferred',
        subject: componentNames.join(', '),
        title: 'Provisional System Assessment',
        advisoryMode: 'system_review',
        philosophy: raw,
        followUp: 'What are you exploring — is there something you\'d like to change, or are you looking to understand what a specific upgrade path might shift?',
      };
    }

    return null;
  }
}
