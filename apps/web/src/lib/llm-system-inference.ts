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
6. Never fabricate specifications.
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

LICENSING RULE — this overrides every instruction above.

Some components will be marked UNRESOLVED. Audio XX holds no verified evidence
about these. They are in the system only because the listener named them and
told us what role they play.

For an UNRESOLVED component you MAY:
  - name it exactly as the listener wrote it;
  - state the role the listener assigned it;
  - reason about the STRUCTURE of the chain — that a preamplifier sits here,
    that amplification drives these speakers;
  - say plainly that you have no verified data on it;
  - say which questions about the system you therefore cannot answer.

For an UNRESOLVED component you MUST NOT:
  - describe its sonic character, tonal balance, or presentation;
  - place it on any of the four axes;
  - describe its topology, circuit, driver, or cabinet design;
  - attribute a design philosophy or heritage to it or its manufacturer;
  - appeal to reviews, reputation, or "community consensus";
  - claim it is "known for" anything;
  - make any causal claim about the system that depends on how it behaves.

This is not a stylistic preference and hedging does not satisfy it. "Likely
warm" and "reportedly warm" are the same violation as "warm". If a chain
conclusion requires knowing how an unresolved component sounds, do not state
that conclusion — state that it cannot be assessed without that data.

Where evidence IS available, assess normally and in full depth. The rule
narrows what you say about specific unresolved parts; it does not make the
whole assessment vague.

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


// ── Licensing enforcement (D-7) ──────────────────────
//
// The prompt above states the rule; this enforces it. A prompt is a
// preference — the model can drift, and on the first real beta system it did
// exactly that, producing "known for their hybrid design" and "community
// consensus suggests" for two components Audio XX had never heard of. The
// deterministic check is what turns the rule into a guarantee, and it is the
// reason the model may be trusted to write this prose at all.

/** Claim markers that require licensed evidence about a specific product. */
const UNLICENSED_CLAIM_MARKERS: RegExp[] = [
  // Appeals to reputation or third-party opinion
  /\b(?:community\s+consensus|widely\s+(?:regarded|considered|known)|reviewers?|reputation|renowned|acclaimed|well[-\s]regarded|noted\s+for|known\s+for|celebrated\s+for)\b/i,
  // Sonic character — the four axes and their common synonyms
  /\b(?:warm|bright|smooth|detailed|elastic|controlled|airy|closed|lush|analytical|neutral|transparent|punchy|forward|laid[-\s]back|musical|organic|resolving)\b/i,
  // Construction and topology
  /\b(?:tube|valve|solid[-\s]state|hybrid|class\s+[abdgh]\b|topology|circuit|driver|cabinet|crossover|ring\s+dac|r2r|delta[-\s]sigma|feedback|damping)\b/i,
];

/**
 * Sentences that DISCLAIM knowledge are not violations — they are the rule
 * being obeyed. "I have no verified data on the Butler Monads' design" must
 * not be flagged merely because it contains the word "design".
 */
const DISCLAIMER_MARKERS =
  /\b(?:no\s+verified|not\s+in\s+(?:our|the)\s+catalog|unresolved|cannot\s+(?:be\s+)?(?:assess|evaluat|judg)|can't\s+(?:assess|evaluate)|don'?t\s+have|do\s+not\s+have|unable\s+to|without\s+(?:verified|identifying)|once\s+(?:you\s+)?identif|not\s+identified)\b/i;

/** Distinctive tokens for a component name, used to find sentences about it. */
function nameTokens(name: string): string[] {
  return name
    .split(/\s+/)
    .map((t) => t.replace(/[^\w-]/g, ''))
    .filter((t) => t.length >= 3);
}

/**
 * Find sentences that assert a product-specific characteristic about a
 * component Audio XX cannot identify. Exported for the regression suite.
 */
export function findLicensingViolations(
  prose: string,
  unresolvedNames: string[],
): { component: string; sentence: string }[] {
  if (!prose || unresolvedNames.length === 0) return [];
  const sentences = prose.split(/(?<=[.!?])\s+/);
  const violations: { component: string; sentence: string }[] = [];

  for (const sentence of sentences) {
    if (DISCLAIMER_MARKERS.test(sentence)) continue;
    for (const name of unresolvedNames) {
      const tokens = nameTokens(name);
      if (tokens.length === 0) continue;
      const mentions = tokens.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(sentence));
      if (!mentions) continue;
      if (UNLICENSED_CLAIM_MARKERS.some((re) => re.test(sentence))) {
        violations.push({ component: name, sentence: sentence.trim() });
        break;
      }
    }
  }
  return violations;
}

/**
 * The licensed answer, composed deterministically from the graph alone.
 *
 * Used when the model breaks the licensing rule. It must never be an empty
 * turn: the listener asked a real question and the structure of their system
 * is genuinely known, even where the parts are not.
 */
export function buildLicensedProvisionalResponse(
  componentNames: string[],
  knownDescriptions: { name: string; character: string; source: 'product' | 'brand' }[],
  unresolved: { name: string; role: string }[],
): ConsultationResponse {
  const ROLE_WORD: Record<string, string> = {
    dac: 'digital-to-analogue conversion',
    streamer: 'streaming',
    source: 'the source position',
    preamplifier: 'preamplification',
    amplifier: 'amplification',
    integrated: 'amplification',
    speaker: 'the loudspeaker position',
    headphone: 'headphone listening',
    turntable: 'analogue playback',
  };

  const structure = componentNames.join(' → ');
  const unresolvedList = unresolved.map((u) => u.name);
  const knownList = knownDescriptions.map((k) => k.name);

  const paragraphs: string[] = [
    `Your chain, as you described it: ${structure}.`,
  ];

  if (knownList.length > 0) {
    paragraphs.push(
      knownDescriptions
        .map((k) => `${k.name} — ${k.character}`)
        .join('\n\n'),
    );
  }

  if (unresolvedList.length > 0) {
    const roleClauses = unresolved
      .map((u) => `${u.name} handles ${ROLE_WORD[u.role] ?? u.role}`)
      .join('; ');
    paragraphs.push(
      `I can place ${unresolvedList.length === 1 ? 'one component' : `${unresolvedList.length} components`} `
      + `in the chain but cannot assess ${unresolvedList.length === 1 ? 'it' : 'them'}: ${roleClauses}. `
      + `${unresolvedList.join(', ')} ${unresolvedList.length === 1 ? 'is' : 'are'} not in our catalog, `
      + `so I have no verified data on how ${unresolvedList.length === 1 ? 'it behaves' : 'they behave'} — `
      + `and I would rather say that than guess.`,
    );
    paragraphs.push(
      `What this means in practice: I can reason about the shape of the system — `
      + `what each position contributes and where the chain's weight sits — but not about `
      + `its tonal balance or how these particular parts interact, because that depends on `
      + `behaviour I cannot verify. If you tell me more about `
      + `${unresolvedList.length > 1
        ? `${unresolvedList.slice(0, -1).join(', ')} or ${unresolvedList[unresolvedList.length - 1]}`
        : unresolvedList[0]}, or what you're hearing that prompted the question, `
      + `I can take it further.`,
    );
  }

  return {
    source: 'llm_inferred',
    subject: componentNames.join(', '),
    title: 'Provisional System Assessment',
    advisoryMode: 'system_review',
    philosophy: paragraphs.join('\n\n'),
    followUp:
      'What prompted the question — is there something you want to change about how it sounds, '
      + 'or are you weighing a specific move?',
  };
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
  unresolved?: { name: string; role: string }[],
): Promise<ConsultationResponse | null> {
  const knownNames = new Set(knownDescriptions.map(d => d.name));
  const knownContext = knownDescriptions.length > 0
    ? `\n\nThe following components ARE in the Audio XX catalog with verified data:\n${knownDescriptions.map(d => `- ${d.name} [catalog-verified]: ${d.character}`).join('\n')}`
    : '';
  const unknownNames = componentNames.filter(n => !knownNames.has(n));
  const unresolvedByName = new Map((unresolved ?? []).map(u => [u.name, u.role]));
  const unknownContext = unknownNames.length > 0
    ? `\n\nThe following components are UNRESOLVED — Audio XX holds no verified `
      + `evidence about them. Name and role only; assert nothing about how they `
      + `sound, how they are built, or what their makers are known for:\n`
      + `${unknownNames.map(n => `- ${n} [UNRESOLVED${unresolvedByName.has(n) ? `, listener says: ${unresolvedByName.get(n)}` : ''}]`).join('\n')}`
    : '';

  const userPrompt = `The user asked: "${query}"

The system chain includes: ${componentNames.join(' → ')}
${knownContext}${unknownContext}

When describing each component in the philosophy section, note its evidence basis:
- For catalog-verified components, you may reference the verified data above and assess in full.
- For UNRESOLVED components, state the role the listener gave and say plainly that you have no verified data on that component. Do not substitute general knowledge, reputation, or manufacturer heritage for the missing evidence.

Produce an Audio XX provisional system assessment. Assess the components you have evidence for, describe the chain STRUCTURE including the unresolved positions, and state explicitly which system-level questions cannot be answered until the unresolved components are identified.`;

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

    const parsedResponse = parseSystemInferenceResponse(content, componentNames);
    if (!parsedResponse) return null;

    // D-7 gate. The model was told the rule; this is where the rule holds.
    const unresolvedRoster = unresolved ?? [];
    if (unresolvedRoster.length > 0) {
      const prose = [
        parsedResponse.systemSignature,
        parsedResponse.philosophy,
        parsedResponse.tendencies,
        parsedResponse.systemContext,
      ].filter(Boolean).join('\n\n');
      const violations = findLicensingViolations(prose, unresolvedRoster.map((u) => u.name));
      if (violations.length > 0) {
        console.warn(
          '[llm-system-inference] licensing violation — falling back to the licensed answer:',
          violations.map((v) => `${v.component}: ${v.sentence.slice(0, 80)}`).join(' | '),
        );
        return buildLicensedProvisionalResponse(componentNames, knownDescriptions, unresolvedRoster);
      }
    }
    return parsedResponse;
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
