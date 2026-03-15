/**
 * LLM Product Inference — generates advisory responses for products
 * not found in the Audio XX catalog.
 *
 * When a user asks about a product or brand that has no catalog entry
 * or curated brand profile, this module calls the LLM to produce a
 * structured consultation response grounded in the Audio XX advisory
 * voice and format.
 *
 * The response is clearly labeled as `source: 'llm_inferred'` so the
 * UI can display a provenance indicator. The LLM is instructed to:
 *   - Use the Audio XX advisory tone (calm, non-performative, no hype)
 *   - Acknowledge uncertainty where appropriate
 *   - Provide architectural context and trade-offs, not ratings
 *   - Never invent specifications or measurements
 *   - Never claim catalog-verified status
 *
 * Falls back silently to null if the LLM call fails or times out.
 */

import type { ConsultationResponse } from './consultation';

// ── Configuration ────────────────────────────────────

/** Hard timeout for the inference call. */
const INFERENCE_TIMEOUT_MS = 15000;

// ── System prompt ────────────────────────────────────

const SYSTEM_PROMPT = `You are Audio XX, a private audio advisory system. You provide calm, structured guidance about audio equipment — never hype, never urgency, never affiliate tone.

You are being asked about a product or brand that is NOT in your verified catalog. You must generate a helpful advisory response based on your general knowledge, but you MUST:

1. Be honest about the limits of your knowledge — never fabricate specifications or measurements.
2. Focus on design philosophy, architectural approach, and general sonic tendencies as reported by the listening community.
3. Describe trade-offs, not ratings. No scores, no "best" claims.
4. Use the advisory structure: philosophy (what it prioritizes), tendencies (how it tends to sound), system context (where it works well).
5. Keep the tone calm, slightly analytical, confident but not absolute.
6. If you genuinely don't know enough about a product, say so clearly rather than guessing.

Format your response as JSON with exactly these fields:
{
  "subject": "Brand Product Name",
  "philosophy": "1-3 paragraphs on design philosophy and architecture. Separate paragraphs with \\n\\n.",
  "tendencies": "1-3 paragraphs on sonic character and tendencies. Separate paragraphs with \\n\\n.",
  "systemContext": "1-2 paragraphs on system pairing and context. Separate paragraphs with \\n\\n. Null if unknown.",
  "followUp": "A single follow-up question to help narrow the user's needs."
}

Return ONLY valid JSON, no markdown fences, no commentary.`;

// ── Public API ───────────────────────────────────────

/**
 * Call the LLM to infer advisory content for an unknown product or brand.
 *
 * @param query - the user's original message (e.g. "tell me about the Auralic Vega")
 * @param subjectName - extracted subject name if available (e.g. "Auralic Vega")
 * @returns ConsultationResponse with source: 'llm_inferred', or null on failure
 */
export async function inferUnknownProduct(
  query: string,
  subjectName?: string,
): Promise<ConsultationResponse | null> {
  const userPrompt = subjectName
    ? `The user asked: "${query}"\n\nThe subject appears to be: ${subjectName}\n\nProvide an Audio XX advisory response for this product or brand. If this is a specific product, focus on that product. If only a brand name, provide a brand-level overview.`
    : `The user asked: "${query}"\n\nProvide an Audio XX advisory response. Identify the product or brand being discussed and respond accordingly.`;

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
      // 503 = no API key configured — silent fallback
      if (response.status === 503) return null;
      console.warn('[llm-inference] API returned', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.content;
    if (!content || typeof content !== 'string') return null;

    return parseInferenceResponse(content, subjectName);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[llm-inference] Timed out after', INFERENCE_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[llm-inference] Failed:', err);
    }
    return null;
  }
}

// ── Response parsing ─────────────────────────────────

interface InferenceJSON {
  subject?: string;
  philosophy?: string;
  tendencies?: string;
  systemContext?: string | null;
  followUp?: string;
}

function parseInferenceResponse(
  raw: string,
  fallbackSubject?: string,
): ConsultationResponse | null {
  try {
    // Strip markdown code fences if the LLM wrapped the JSON
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed: InferenceJSON = JSON.parse(cleaned);

    if (!parsed.philosophy && !parsed.tendencies) {
      console.warn('[llm-inference] Parsed response has no content');
      return null;
    }

    return {
      source: 'llm_inferred',
      subject: parsed.subject || fallbackSubject || 'Unknown Product',
      philosophy: parsed.philosophy || undefined,
      tendencies: parsed.tendencies || undefined,
      systemContext: parsed.systemContext || undefined,
      followUp: parsed.followUp || 'What draws you to this, and what system would it join?',
    };
  } catch (err) {
    console.warn('[llm-inference] Failed to parse JSON:', err);

    // Fallback: treat the raw text as a prose response
    if (raw.length > 50) {
      return {
        source: 'llm_inferred',
        subject: fallbackSubject || 'Unknown Product',
        philosophy: raw,
        followUp: 'What draws you to this, and what system would it join?',
      };
    }

    return null;
  }
}
