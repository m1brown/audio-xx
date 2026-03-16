/**
 * Audio Knowledge & Audio Assistant builders.
 *
 * Lane 2 (Knowledge): General audio questions — technology explanations,
 * product opinions, sound signatures. The LLM generates prose, but
 * receives structured context as input. System-aware commentary is
 * deterministically composed from the user's profile.
 *
 * Lane 3 (Assistant): Practical hobby tasks — negotiation, translation,
 * message writing, travel/audition logistics. Open LLM generation
 * with Audio XX tone guardrails.
 *
 * Architecture:
 *   - These builders prepare the structured context payload that the
 *     LLM will receive as input for prose generation.
 *   - System-aware notes are deterministic (derived from system chain
 *     and taste profile), not LLM-invented.
 *   - The LLM boundary: it generates the explanation/body text, but
 *     does not invent system context, product specs, or factual claims.
 */

import type { ActiveSystemContext } from './system-types';
import type { TasteProfile } from './taste-profile';
import { topTraits } from './taste-profile';
import type { KnowledgeResponse, AssistantResponse, ShoppingAdvisoryContext } from './advisory-response';
import type { SubjectMatch } from './intent';

// ── Knowledge Builder ──────────────────────────────────

export interface KnowledgeContext {
  currentMessage: string;
  subjectMatches: SubjectMatch[];
  activeSystem?: ActiveSystemContext | null;
  tasteProfile?: TasteProfile | null;
  advisoryCtx?: ShoppingAdvisoryContext;
}

/**
 * Builds a KnowledgeResponse from structured context.
 *
 * Returns a deterministic shell immediately. Call `requestKnowledgeLlm()`
 * to populate the explanation with LLM-generated prose.
 */
export function buildKnowledgeResponse(ctx: KnowledgeContext): KnowledgeResponse {
  const topic = extractTopic(ctx.currentMessage, ctx.subjectMatches);

  // Build the deterministic system-aware note (if user has system context)
  const systemNote = buildSystemNote(topic, ctx.activeSystem, ctx.tasteProfile);

  return {
    topic,
    // Placeholder — will be replaced by LLM-generated prose
    explanation: `Thinking about ${topic}…`,
    systemNote: systemNote ?? undefined,
    keyPoints: undefined,
  };
}

// ── LLM timeout ─────────────────────────────────────
const LANE_LLM_TIMEOUT_MS = 12000;

/**
 * Request the LLM to generate a knowledge explanation.
 *
 * Returns the generated text, or null on failure (timeout, API error).
 * The caller should replace the placeholder explanation with this text.
 */
export async function requestKnowledgeLlm(
  ctx: KnowledgeContext,
): Promise<{ explanation: string; keyPoints?: string[] } | null> {
  const topic = extractTopic(ctx.currentMessage, ctx.subjectMatches);
  const systemNote = buildSystemNote(topic, ctx.activeSystem, ctx.tasteProfile);

  const systemPrompt = `You are a knowledgeable audio advisor answering general audio questions.

TONE: Calm, confident, educational. No hype, no brand worship, no urgency.
Write as a well-read friend who happens to know a lot about audio equipment.

CONSTRAINTS:
- Answer the question directly and thoroughly.
- When comparing items (e.g., tube brands, topologies, design philosophies), explain the sonic character of each and the practical trade-offs.
- Use concrete sonic descriptions (warm, bright, airy, dense, fast, slow) rather than vague praise.
- If the topic relates to the user's system context, note how it connects — but keep the focus on the general question.
- Keep the total response to 200–400 words. No bullet points unless the question specifically asks to list things.
- Do not use markdown formatting (no **bold**, no # headers, no bullet lists). Write in natural prose.
- If you are uncertain about something, say so rather than guessing.

FORMAT:
Return a JSON object with two fields:
{
  "explanation": "Your prose explanation here (200–400 words, plain text, no markdown)",
  "keyPoints": ["Optional array of 2–4 key takeaway phrases"]
}`;

  const userPrompt = `Question: ${ctx.currentMessage}${systemNote ? `\n\nUser's system context: ${systemNote}` : ''}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LANE_LLM_TIMEOUT_MS);

    const response = await fetch('/api/memo-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('[knowledge-lane] LLM call failed:', response.status);
      return null;
    }

    const data = await response.json();
    const raw = data.content ?? '';

    // Try to parse JSON response
    try {
      const parsed = JSON.parse(raw);
      return {
        explanation: typeof parsed.explanation === 'string' ? parsed.explanation : raw,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : undefined,
      };
    } catch {
      // If not valid JSON, use the raw text as explanation
      return { explanation: raw };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[knowledge-lane] Timed out after', LANE_LLM_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[knowledge-lane] Failed:', err);
    }
    return null;
  }
}

/**
 * Request the LLM to generate an assistant response (translations,
 * messages, negotiation help, etc.).
 *
 * Returns the generated body text, or null on failure.
 */
export async function requestAssistantLlm(
  ctx: AssistantContext,
): Promise<{ body: string; tips?: string[] } | null> {
  const taskType = classifyAssistantTask(ctx.currentMessage);

  const systemPrompt = `You are a practical audio hobby assistant. You help with tasks like writing messages to sellers, translating audio-related correspondence, helping with negotiations, and providing logistics advice for equipment purchases.

TONE: Friendly, helpful, professional. You are a knowledgeable audiophile helping a fellow enthusiast.

TASK TYPE: ${taskType}

CONSTRAINTS:
- Complete the requested task directly. If asked to write a message, write the message. If asked to translate, translate.
- When writing messages to sellers, be polite and specific. Ask the right questions about condition, history, and shipping.
- For translations, produce natural-sounding text in the target language.
- For negotiations, be fair and realistic about pricing.
- Keep Audio XX advisory tone — no hype, no desperation, calm and informed.
- If the task involves a specific product, you may reference known characteristics to make the message more informed.

FORMAT:
Return a JSON object:
{
  "body": "The completed task output (the message, translation, or advice)",
  "tips": ["Optional array of 1–3 practical tips related to the task"]
}`;

  const userPrompt = ctx.currentMessage;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), LANE_LLM_TIMEOUT_MS);

    const response = await fetch('/api/memo-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt, userPrompt }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn('[assistant-lane] LLM call failed:', response.status);
      return null;
    }

    const data = await response.json();
    const raw = data.content ?? '';

    try {
      const parsed = JSON.parse(raw);
      return {
        body: typeof parsed.body === 'string' ? parsed.body : raw,
        tips: Array.isArray(parsed.tips) ? parsed.tips : undefined,
      };
    } catch {
      return { body: raw };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('[assistant-lane] Timed out after', LANE_LLM_TIMEOUT_MS, 'ms');
    } else {
      console.warn('[assistant-lane] Failed:', err);
    }
    return null;
  }
}

/**
 * Extract the topic from the user's message and any subject matches.
 * Prefers recognized product/brand names; falls back to the full question.
 */
function extractTopic(message: string, subjectMatches: SubjectMatch[]): string {
  // If we have recognized subjects, use them as the topic
  if (subjectMatches.length > 0) {
    return subjectMatches.map((m) => m.name).join(' vs ');
  }

  // Try to extract a clean topic from common question patterns
  const patterns = [
    /what\s+is\s+(.+?)(?:\?|$)/i,
    /explain\s+(?:the\s+)?(?:difference\s+between\s+)?(.+?)(?:\?|$)/i,
    /how\s+(?:does|do)\s+(.+?)(?:\s+work|\s+sound|\s+compare|\s+differ)?(?:\?|$)/i,
    /tell\s+me\s+about\s+(.+?)(?:\?|$)/i,
    /what\s+(?:are|is)\s+(?:the\s+)?(?:pros?\s+and\s+cons?\s+of\s+|advantages?\s+of\s+|disadvantages?\s+of\s+)?(.+?)(?:\?|$)/i,
  ];

  for (const p of patterns) {
    const match = message.match(p);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return message.slice(0, 80).trim();
}

/**
 * Build a deterministic system-aware note connecting the topic
 * to the user's system and listening preferences.
 *
 * Returns null if no system context is available.
 */
function buildSystemNote(
  topic: string,
  activeSystem?: ActiveSystemContext | null,
  tasteProfile?: TasteProfile | null,
): string | null {
  if (!activeSystem && !tasteProfile) return null;

  const parts: string[] = [];

  if (activeSystem) {
    const chain = activeSystem.components
      .map((c) => `${c.brand} ${c.name}`)
      .join(' → ');
    parts.push(`In your system (${chain})`);
  }

  if (tasteProfile) {
    const top = topTraits(tasteProfile, 3);
    if (top.length > 0) {
      const traitNames = top.map((t) => t.label).join(', ');
      parts.push(
        activeSystem
          ? `given your preference for ${traitNames}`
          : `Given your preference for ${traitNames}`,
      );
    }
  }

  if (parts.length === 0) return null;

  // Join with a comma — the rendering layer can append topic-specific
  // commentary generated by the LLM.
  return parts.join(', ') + ':';
}

// ── Assistant Builder ──────────────────────────────────

export interface AssistantContext {
  currentMessage: string;
  subjectMatches: SubjectMatch[];
  activeSystem?: ActiveSystemContext | null;
}

/**
 * Classifies the assistant task type and builds an AssistantResponse.
 *
 * The body field is a structured prompt for the LLM. In the initial
 * implementation this is a pass-through; the LLM integration layer
 * will expand it into full prose.
 */
export function buildAssistantResponse(ctx: AssistantContext): AssistantResponse {
  const taskType = classifyAssistantTask(ctx.currentMessage);
  const languages = detectLanguages(ctx.currentMessage);

  return {
    taskType,
    body: ctx.currentMessage,
    sourceLanguage: languages.source,
    targetLanguage: languages.target,
    tips: undefined,
  };
}

/**
 * Classify the assistant task type from the message.
 */
function classifyAssistantTask(message: string): AssistantResponse['taskType'] {
  const lower = message.toLowerCase();

  if (/\b(?:negotiat|haggl|offer|low[- ]?ball|counter[- ]?offer)\b/.test(lower)) {
    return 'negotiation';
  }
  if (/\b(?:translat|in\s+(?:french|german|italian|spanish|polish|japanese|chinese|dutch|portuguese|swedish|norwegian|danish))\b/.test(lower)) {
    return 'translation';
  }
  if (/\b(?:write|draft)\s+(?:a\s+)?(?:message|email|reply|response|note)\b/.test(lower)) {
    return 'message';
  }
  if (/\b(?:where\s+can\s+i|dealer|retailer|showroom|audition|demo|shipping|customs|import)\b/.test(lower)) {
    return 'logistics';
  }
  if (/\b(?:listing|ad\b|post\b|description)\b.*\b(?:evaluat|assess|review|check)\b/.test(lower) ||
      /\b(?:evaluat|assess|review|check)\b.*\b(?:listing|ad\b|post\b|description)\b/.test(lower)) {
    return 'listing_evaluation';
  }
  if (/\b(?:good|fair|reasonable)\s+(?:price|deal)\b/.test(lower) ||
      /\bhow\s+much\s+(?:should|to)\b/.test(lower)) {
    return 'negotiation';
  }

  return 'general';
}

/**
 * Detect source and target languages from the message.
 * Returns undefined for both if no translation intent is detected.
 */
function detectLanguages(message: string): { source?: string; target?: string } {
  const languageMap: Record<string, string> = {
    french: 'French',
    german: 'German',
    italian: 'Italian',
    spanish: 'Spanish',
    polish: 'Polish',
    japanese: 'Japanese',
    chinese: 'Chinese',
    dutch: 'Dutch',
    portuguese: 'Portuguese',
    swedish: 'Swedish',
    norwegian: 'Norwegian',
    danish: 'Danish',
  };

  const lower = message.toLowerCase();

  // "in French" → target is French, source is English (assumed)
  for (const [key, label] of Object.entries(languageMap)) {
    if (new RegExp(`\\bin\\s+${key}\\b`, 'i').test(lower)) {
      return { source: 'English', target: label };
    }
    if (new RegExp(`\\bto\\s+${key}\\b`, 'i').test(lower)) {
      return { source: 'English', target: label };
    }
    if (new RegExp(`\\bfrom\\s+${key}\\b`, 'i').test(lower)) {
      return { source: label, target: 'English' };
    }
  }

  return {};
}
