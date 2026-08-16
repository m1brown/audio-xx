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

1. VERDICT FIRST. Reach a system-level judgment before describing anything.
   Is the system coherent, deliberately voiced, constrained, materially
   mismatched, or genuinely indeterminate on the evidence you have? Say which,
   in one sentence, at the top. Do not manufacture a defect because an
   assessment was requested, and do not withhold one that the evidence
   supports.

2. DESCRIBE the system, not the parts. State the net character of the chain as
   a whole. Component observations are SUPPORTING EVIDENCE for that character
   — never four independent mini-reviews. If a paragraph could be lifted out
   and published as a standalone product blurb, it is in the wrong shape.

3. EXPLAIN the division of labour. Why is the chain likely to behave the way
   you just described? Which components materially establish that behaviour
   and which merely participate? Look for complementary and opposing
   characteristics — a component chosen to counterweight another is a
   different fact from two components that merely coexist. This causal layer
   is the point of the assessment; without it you have written a list.

4. EVALUATE. State the meaningful trade-off: what the system gives the
   listener and what it gives up. Then answer the question directly — does
   anything appear to need changing? Distinguish an ARCHITECTURAL CHOICE from
   a DEFICIENCY: a system that trades one quality for another deliberately is
   not broken. Where the evidence shows no material problem, say plainly that
   nothing here obviously needs changing. That is a complete and respectable
   answer, and it is often the correct one.

7. Use the Audio XX 4-axis model for characterization where you can:
   - warm ↔ bright (tonal balance)
   - smooth ↔ detailed (resolution character)
   - elastic ↔ controlled (dynamic behavior)
   - airy ↔ closed (spatial presentation)

Format your response as JSON with exactly these fields:
{
  "subject": "System name or component list",
  "systemSignature": "The VERDICT — one sentence: coherent / deliberately voiced / constrained / mismatched / indeterminate, and why",
  "philosophy": "DESCRIBE then EXPLAIN. 2-4 paragraphs. First the net character of the system as a whole; then the division of labour — which components establish that character, which counterweight which, and why the chain behaves this way. Component detail appears only in service of that argument. Separate paragraphs with \\n\\n.",
  "tendencies": "EVALUATE. The meaningful trade-off, and an explicit change/no-change judgment. If nothing needs changing, say so plainly. Separate paragraphs with \\n\\n.",
  "systemContext": "1-2 paragraphs on what this system is good for, what music it suits, and what room/use context matters. Separate paragraphs with \\n\\n.",
  "componentKnowledge": [
    { "name": "exact component name", "specific": true }
  ],
  "characterized": ["exact names of components you actually characterised"],
  "followUp": "ONE question, asked only if its answer could materially change the judgment — an actual dissatisfaction, desired direction, room problem or listening preference. If nothing would change the judgment, ask what they are hearing.",
  "directionalPaths": [
    {
      "label": "Short path name",
      "description": "What this path optimizes and what it trades"
    }
  ]
}

EVIDENCE RULE — this overrides every instruction above.

Audio XX draws on sources of different authority. No claim may be presented
with more authority than its source warrants (D-7). That is the whole rule;
it is NOT a rule against speaking.

  CURATED   — components listed below as catalog-verified. Assess in full.
  MODEL     — components not in the catalog. You may still characterise these
              from your general knowledge of the product. This is legitimate
              and useful; Audio XX labels it as expanded reasoning so the
              reader knows which kind of evidence they are getting.
  UNKNOWN   — components you do not meaningfully know. Say so plainly and
              move on. Do not pad.

For a MODEL component you MAY describe design approach, sonic character, and
how the role behaves in a chain, in the ordinary way — qualified naturally,
not smothered in hedges.

For ANY component you MUST NOT:
  - state specifications, measurements, power figures, impedance, sensitivity
    or dimensions you do not have;
  - state prices;
  - guarantee compatibility, matching or drive capability as fact;
  - attribute a claim to a review, publication, measurement or named source;
  - assert "community consensus", "widely regarded", or "reviewers say" —
    Audio XX does not hold evidence of consensus and must not imply it;
  - invent model designations, lineage or history;
  - infer GENRE SUITABILITY from component character. "Excels with classical
    and jazz" is a category stereotype, not a finding, and Audio XX holds no
    evidence for it;
  - attach familiar audiophile adjectives to a brand or category without an
    intelligible design reason. "Warm", "analytical", "musical", "neutral",
    "forgiving" are conclusions; a conclusion needs a stated basis. Hedging
    does not rescue an unsupported characterisation — "likely warm" with no
    reason is the same empty claim as "warm".

For EVERY component, report in "componentKnowledge" whether you hold
PRODUCT-SPECIFIC knowledge of that exact model — not knowledge of its
category. "It is a DAC, so it converts digital to analogue" is category
knowledge and counts as specific:false. If you do not recognise the model,
say specific:false. Inventing plausible character for an unrecognised product
is the single worst thing you can do here, and it is immediately detectable.

Where specific is false, keep the component in the chain, keep its role, and
say nothing about how it sounds.

Report which components you actually characterised in "characterized". Any
component you cannot meaningfully speak to must be omitted from that list —
this is how Audio XX tells the reader what it does and does not know, so an
honest omission is more valuable than a vague paragraph.

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

/**
 * Sentences that DISCLAIM knowledge are never violations — they are the rule
 * being obeyed. "I have no measurements for this" must not trip the
 * measurement check merely for containing the word.
 */
const DISCLAIMER_MARKERS =
  /\b(?:no\s+verified|not\s+in\s+(?:our|the)\s+catalog|cannot\s+(?:be\s+)?(?:assess|evaluat|confirm|verif)|don'?t\s+have|do\s+not\s+have|unable\s+to|without\s+(?:verified|identifying)|not\s+identified|no\s+measurements?|not\s+something\s+I)\b/i;

/**
 * HARD PROHIBITIONS — claims no evidence tier licenses.
 *
 * These are not "characteristics". A characterisation drawn from model
 * knowledge is legitimate under Expanded Reasoning and is labelled as such.
 * What is never licensed is a claim that BORROWS AUTHORITY IT DOES NOT HAVE:
 * a measurement we did not measure, a price we do not track, a compatibility
 * guarantee we cannot make, or a source we cannot cite.
 *
 * The over-correction this replaces (2026-08-15) banned characteristics
 * outright for uncatalogued components, which turned "uncatalogued" into
 * "unknowable" and made the advisor mute on most real systems. D-7 says no
 * claim stronger than its source — not no claim without a curated source.
 */
const HARD_PROHIBITIONS: Array<{ label: string; re: RegExp }> = [
  {
    label: 'fabricated source attribution',
    re: /\b(?:community\s+consensus|widely\s+(?:regarded|considered|held)|reviewers?\s+(?:say|report|note|agree)|according\s+to\s+(?:reviews?|measurements?)|stereophile|absolute\s+sound|asr\b|measurements?\s+show)\b/i,
  },
  {
    label: 'unsupported specification or measurement',
    re: /\b\d+(?:\.\d+)?\s?(?:watts?|w\b|db\b|hz\b|khz\b|ohms?|Ω|volts?|v\b|kg\b|lbs?\b)/i,
  },
  {
    label: 'price claim',
    re: /(?:\$|£|€)\s?\d|\b\d+\s?(?:usd|gbp|eur)\b|\bretails?\s+(?:for|at)\b|\bcosts?\s+(?:around|about)?\s?(?:\$|£|€)/i,
  },
  {
    label: 'genre-suitability stereotype',
    re: /\b(?:excels?|shines?|thrives?|is\s+(?:well[-\s])?suited|handles?|perfect)\b[^.]{0,60}\b(?:classical|jazz|rock|electronic|acoustic|vocal|orchestral|metal|hip[-\s]?hop)\b/i,
  },
  {
    label: 'compatibility guarantee',
    re: /\b(?:will\s+(?:drive|match|pair)|is\s+(?:fully\s+)?compatible|guaranteed\s+to|perfect(?:ly)?\s+match(?:ed)?|ideal\s+match)\b/i,
  },
];

/**
 * Specification tokens Audio XX independently holds.
 *
 * Curated descriptions carry real figures — the Magnepan LRS entry states
 * "4Ω/86dB" because that is catalog evidence. When the provisional model uses
 * those figures as PREMISES ("a 5-watt SET will struggle into an 86dB, 4Ω
 * load") it is reasoning with supported facts, not inventing specifications —
 * and that sentence is often the most valuable in the whole assessment,
 * because it is where a real mismatch gets named.
 *
 * Rather than infer legitimacy from wording, we collect the figures our own
 * evidence contains and treat exactly those as licensed premises. Anything
 * numeric left over after they are accounted for is an invention.
 */
const SPEC_TOKEN_RE = /\d+(?:\.\d+)?\s?(?:watts?|w\b|db\b|hz\b|khz\b|ohms?|Ω|volts?|v\b|kg\b|lbs?\b)/gi;

export function collectLicensedFacts(
  curatedText: string[],
): string[] {
  const facts = new Set<string>();
  for (const text of curatedText) {
    if (!text) continue;
    for (const m of text.matchAll(SPEC_TOKEN_RE)) {
      facts.add(m[0].toLowerCase().replace(/\s+/g, ''));
    }
  }
  return [...facts];
}

/**
 * Find claims that exceed what any evidence tier licenses.
 *
 * Scope changed 2026-08-15 (restoration): this no longer asks "is this a
 * characteristic?" — model knowledge may characterise. It asks "does this
 * claim borrow authority it does not have?" Exported for the regression suite.
 */
export function findLicensingViolations(
  prose: string,
  _unresolvedNames: string[] = [],
  curatedNames: string[] = [],
  licensedFacts: string[] = [],
): { component: string; sentence: string }[] {
  if (!prose) return [];
  const violations: { component: string; sentence: string }[] = [];
  // A specification is licensed when it comes from the catalog. The Magnepan
  // LRS entry legitimately carries "4Ω/86dB"; scanning finished prose
  // indiscriminately made Audio XX's own curated evidence trip Audio XX's own
  // prohibition, collapsing good assessments into the fallback. D-7 again:
  // permitted strength depends on SOURCE, so a sentence about a curated
  // component is judged by curated rules — i.e. not by these.
  const curatedTokens = curatedNames.flatMap((n) =>
    n.split(/\s+/).map((t) => t.replace(/[^\w-]/g, '')).filter((t) => t.length >= 3));
  const mentionsCurated = (sentence: string) =>
    curatedTokens.some((t) => new RegExp(`\\b${t}\\b`, 'i').test(sentence));

  // A component NAME is a user-supplied fact, not a claim. "Zorblax ZX1 5 watt
  // SET" contains "5 watt", and matching it made Audio XX trip over the
  // listener's own words and refuse to answer. Mask every known name before
  // testing, so prohibitions apply to what the answer ASSERTS, never to what
  // the listener called their gear.
  const allNames = [...curatedNames, ..._unresolvedNames].filter(Boolean);
  const maskNames = (sentence: string) =>
    allNames.reduce(
      (acc, n) => acc.replace(new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '),
      sentence,
    );

  for (const raw of prose.split(/(?<=[.!?])\s+/)) {
    if (DISCLAIMER_MARKERS.test(raw)) continue;
    if (mentionsCurated(raw)) continue;
    // Mask the listener's own component names AND the specifications our own
    // evidence licenses. What remains is what the ANSWER asserts on its own
    // authority — which is the only thing these prohibitions should judge.
    let sentence = maskNames(raw);
    for (const fact of licensedFacts) {
      const loose = fact.replace(/(\d)([a-zΩ])/i, '$1\\s?$2');
      sentence = sentence.replace(new RegExp(loose, 'gi'), ' ');
    }
    for (const { label, re } of HARD_PROHIBITIONS) {
      if (re.test(sentence)) {
        violations.push({ component: label, sentence: raw.trim() });
        break;
      }
    }
  }
  return violations;
}

/**
 * Provenance for every node, computed by Audio XX rather than claimed by the
 * model. This is what makes the distinction trustworthy: the model cannot
 * promote itself to curated authority, because we decide the tier from what
 * we actually hold, and the renderer displays that.
 */
export type EvidenceBasis = 'catalog' | 'brand' | 'model' | 'user';

export interface ComponentProvenance {
  name: string;
  basis: EvidenceBasis;
}

export function computeComponentProvenance(
  componentNames: string[],
  knownDescriptions: { name: string; source: 'product' | 'brand' }[],
  characterized: string[],
  corroborated?: string[],
): ComponentProvenance[] {
  const curated = new Map(knownDescriptions.map((k) => [k.name, k.source]));
  const spoken = new Set(characterized.map((c) => c.toLowerCase().trim()));
  // Independent corroboration — the ONLY thing that may raise an uncatalogued
  // component to Expanded Reasoning. The model's own account of what it knows
  // was falsified in testing (a fictional product alternated between unknown
  // and confidently described), so it can no longer promote anything by
  // itself: it may only speak about what corroboration has already admitted.
  const real = new Set((corroborated ?? []).map((c) => c.toLowerCase().trim()));
  return componentNames.map((name) => {
    const key = name.toLowerCase().trim();
    const c = curated.get(name);
    if (c === 'product') return { name, basis: 'catalog' as const };
    if (c === 'brand') return { name, basis: 'brand' as const };
    if (real.has(key) && spoken.has(key)) return { name, basis: 'model' as const };
    return { name, basis: 'user' as const };
  });
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
  corroborated?: string[],
): Promise<ConsultationResponse | null> {
  const knownNames = new Set(knownDescriptions.map(d => d.name));
  const knownContext = knownDescriptions.length > 0
    ? `\n\nThe following components ARE in the Audio XX catalog with verified data:\n${knownDescriptions.map(d => `- ${d.name} [catalog-verified]: ${d.character}`).join('\n')}`
    : '';
  const unknownNames = componentNames.filter(n => !knownNames.has(n));
  const unresolvedByName = new Map((unresolved ?? []).map(u => [u.name, u.role]));
  const unknownContext = unknownNames.length > 0
    ? `\n\nThese components are NOT in the Audio XX catalog. Characterise them `
      + `from your general knowledge where you meaningfully know them, and omit `
      + `them from \`characterized\` where you do not:\n`
      + `${unknownNames.map(n => `- ${n} [model-knowledge${unresolvedByName.has(n) ? `, listener says: ${unresolvedByName.get(n)}` : ''}]`).join('\n')}`
    : '';

  const userPrompt = `The user asked: "${query}"

The system chain includes: ${componentNames.join(' → ')}
${knownContext}${unknownContext}

When describing each component in the philosophy section:
- Catalog-verified components: reference the verified data above and assess in full.
- Model-knowledge components: characterise them normally where you know them. Do
  not apologise for the source — Audio XX labels provenance itself.
- Components you do not know: say so once, briefly, and omit them from "characterized".

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
      const violations = findLicensingViolations(
        prose,
        unresolvedRoster.map((u) => u.name),
        knownDescriptions.map((k) => k.name),
        collectLicensedFacts([
          ...knownDescriptions.map((k) => k.character),
          // The listener's own component names are facts THEY asserted. Someone
          // who writes "Zorblax ZX1 5 watt SET" has told us the power rating,
          // and reasoning from it is legitimate even though the product is
          // uncatalogued. Masking the literal name was not enough: the model
          // paraphrases ("the Zorblax ZX1 ... providing 5 watts"), and the
          // figure then read as an invention. Tier 3 licenses identity, and a
          // number inside the identity is part of it.
          ...componentNames,
        ]),
      );
      if (violations.length > 0) {
        console.warn(
          '[llm-system-inference] licensing violation — falling back to the licensed answer:',
          violations.map((v) => `${v.component}: ${v.sentence.slice(0, 80)}`).join(' | '),
        );
        return buildLicensedProvisionalResponse(componentNames, knownDescriptions, unresolvedRoster);
      }
    }
    // Which components were actually characterised is determined from the
    // PROSE, not from the model's self-report. Relying on the report labelled
    // a fully characterised system "your description only" the moment the
    // model omitted the field — a false label in the opposite direction, and
    // just as damaging to trust as overstating. If the answer discusses a
    // component, that component was characterised; the self-report is only a
    // hint that can add, never subtract.
    const proseForBasis = [
      parsedResponse.systemSignature,
      parsedResponse.philosophy,
      parsedResponse.tendencies,
      parsedResponse.systemContext,
    ].filter(Boolean).join('\n\n');
    const reported = (parsedResponse as { characterized?: string[] }).characterized ?? [];
    const declared = ((parsedResponse as { componentKnowledge?: Array<{ name: string; specific?: boolean }> })
      .componentKnowledge ?? []);
    // Structural, not lexical. A component the model admits it does not know
    // is demoted to user-supplied identity no matter how confidently the prose
    // reads. This fails closed on invented products WITHOUT disabling genuine
    // model knowledge of real ones — which is the entire point of Expanded
    // Reasoning.
    const noProductKnowledge = new Set(
      declared.filter((d) => d.specific === false).map((d) => d.name.toLowerCase().trim()),
    );
    const spokenTo = componentNames.filter((name) => {
      if (noProductKnowledge.has(name.toLowerCase().trim())) return false;
      if (reported.some((r) => r.toLowerCase().trim() === name.toLowerCase().trim())) return true;
      // A distinctive token of the name appearing in the prose is sufficient.
      const tokens = name.split(/\s+/).filter((t) => t.length >= 3);
      return tokens.length > 0
        && tokens.some((t) => new RegExp(`\\b${t.replace(/[^\w-]/g, '')}\\b`, 'i').test(proseForBasis));
    });
    parsedResponse.componentProvenance = computeComponentProvenance(
      componentNames,
      knownDescriptions,
      spokenTo,
      corroborated,
    );
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
  characterized?: string[];
  componentKnowledge?: Array<{ name: string; specific?: boolean }>;
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
      characterized: Array.isArray(parsed.characterized) ? parsed.characterized : [],
      componentKnowledge: Array.isArray(parsed.componentKnowledge) ? parsed.componentKnowledge : [],
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
