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
import {
  licensedRelations, permittedQuestionType, questionViolations, stripOverclaims,
  OPEN_DIAGNOSTIC_QUESTION,
  type ActionVerdict, type AttributeRecord, type RelationKind, type RelationSet,
  type EvidenceTier,
} from './relational-explain';

// ── Configuration ────────────────────────────────────

const INFERENCE_TIMEOUT_MS = 20000; // Longer than product inference — system analysis is more complex

// ── System prompt ────────────────────────────────────

const SYSTEM_PROMPT = `You are Audio XX, a private audio advisory system. You provide calm, structured system assessments — never hype, never urgency, never affiliate tone.

You are being asked to assess a hi-fi system where some or all components are NOT in your verified catalog. You must produce a useful provisional assessment based on your general knowledge of these components, but you MUST:

1. VERDICT FIRST. Reach a system-level judgment before describing anything.
   Is the system coherent, tonally consistent, constrained, materially
   mismatched, or genuinely indeterminate on the evidence you have? Say which,
   in one sentence, at the top. Do not manufacture a defect because an
   assessment was requested, and do not withhold one that the evidence
   supports.

2. DESCRIBE the system, not the parts. State the net character of the chain as
   a whole. Component observations are SUPPORTING EVIDENCE for that character
   — never four independent mini-reviews. If a paragraph could be lifted out
   and published as a standalone product blurb, it is in the wrong shape.

2b. THE QUESTION. If your verdict is that nothing needs changing, your
   question must be OPEN: ask what, if anything, the listener is dissatisfied
   with, and name no candidate fault. Do not ask whether they hear fatigue,
   harshness, thinness, or a lack of warmth. Naming a problem you did not find
   is a recommendation wearing a question mark. Where you DID establish a
   specific concern, the question may address that concern and nothing else.

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

BE SHORT. Four or five paragraphs for the whole assessment. A reader should
finish it, not survey it. Say each thing ONCE: if you have observed that two
components establish resolution while two supply density, that IS the thesis —
do not restate it in the character paragraph, again in the trade-off, and again
in a summary. Repetition reads as padding and spends the trust you need for the
parts that matter.

NEVER pad with:
  - which genres or recordings the system "excels with";
  - room size, room treatment, speaker placement, or "critical listening
    environments";
  - what kind of listener would "appreciate" or "value" it;
  - restatements of something you already said in different words.
A list of components licenses none of that. Say it only if the listener raised
it or the evidence forces it. An assessment that stops when it runs out of
licensed things to say is stronger than one that fills the space.

7. Use the Audio XX 4-axis model for characterization where you can:
   - warm ↔ bright (tonal balance)
   - smooth ↔ detailed (resolution character)
   - elastic ↔ controlled (dynamic behavior)
   - airy ↔ closed (spatial presentation)

Format your response as JSON with exactly these fields:
{
  "verdict": "ONE sentence. Coherent / deliberately voiced / constrained / mismatched / indeterminate — and why.",
  "systemThesis": "ONE paragraph. What this system as a whole is FOR — the single idea that explains the choices. Not a component list.",

  "attributes": [
    { "component": "exact component name", "axis": "warm_bright|smooth_detailed|elastic_controlled|power_load", "value": "the position on that axis" }
  ],
  "relationStatus": "established" | "none_establishable",
  "relations": [
    { "components": ["A", "B"], "axis": "the SHARED axis", "kind": "reinforcement|counterweight|constraint", "premises": [0, 1] }
  ],

  "interactionExplanation": "ONE or TWO paragraphs expressing the relations above in natural prose. Do not restate them mechanically and do not spell out the counterfactual — just say what the arrangement does.",
  "tradeoff": "ONE paragraph. What the listener gains and gives up BECAUSE OF the relations above. Omit entirely if relationStatus is none_establishable.",
  "actionVerdict": "no_change" | "constraint" | "indeterminate",
  "action": "ONE short paragraph. Does anything need changing? Distinguish an architectural choice from a deficiency.",
  "nextQuestion": "ONE question. See the QUESTION RULE below — its permitted kind is fixed by actionVerdict.",

  "componentKnowledge": [
    { "name": "exact component name", "specific": true }
  ],
  "characterized": ["exact names of components you actually characterised"]
}

RELATIONS ARE THE POINT OF THE EXPLANATION.

An interaction is a claim that two components stand in a relationship on ONE
SHARED axis. It is not two descriptions with a connective between them.
"A is precise, B is warm, and B complements A" is three assertions, not a
relation — the word "complements" is doing work the evidence has not done.

Each relation must:
  - name TWO different components;
  - cite ONE axis both of them sit on (warm vs powerful is not a relation);
  - reference in "premises" the two "attributes" indices it is built from, one
    per component;
  - be of a kind that is actually true of them:
      reinforcement — both push the system the same way
      counterweight — they pull in opposite directions on that axis
      constraint    — one physically bounds what the other can do

If you cannot establish any such relationship from what you actually know, set
"relationStatus": "none_establishable" and return an empty relations array.
That is a legitimate, unpenalised answer. Do NOT invent a counterweight because
a system "ought" to have one — a chain whose components all push the same
direction is a real and common finding, and saying so is more useful than
manufacturing a tension that is not there.

QUESTION RULE. The permitted kind of question is fixed by actionVerdict:
  no_change     -> DIAGNOSTIC. Ask what they are actually hearing. You may NOT
                   suggest a change, upgrade, cable, tube rolling, or ask
                   whether they would "like more" of anything — the evaluation
                   just found no deficiency, and proposing a remedy silently
                   retracts it.
  constraint    -> DIRECTIONAL, and only about the constraint you established.
  indeterminate -> ask for the specific evidence that would settle it.
Address the listener directly, in the second person. Never "the listener".

There is deliberately NO field for describing each component in turn. The
component identities, roles and evidence tiers are already shown to the reader
beside this text. A paragraph per component is the failure mode this schema
exists to prevent: it reads as four product blurbs stapled together and never
arrives at a judgment. Component observations belong inside
interactionExplanation, and only where they carry the argument.

There is also no field for context, environment or listener type. Room size,
room treatment, placement, genre suitability and "who would appreciate this"
are not licensed by a list of components. If the listener raised one, address
it in the relevant field; otherwise it does not appear.

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

/**
 * A component's evidence basis, computed from EVIDENCE ALONE.
 *
 * GOVERNING INVARIANT (founder, 2026-08-17):
 *
 *   Evidence determines prose authority; prose never determines evidence.
 *
 * This function used to take `characterized` and require BOTH corroboration
 * AND a mention in the generated prose before granting `model`. Production
 * proved that architecturally wrong: across three consecutive runs of the same
 * beta system, with all four products corroborating every time, the basis came
 * out
 *
 *   run 1  ARC=model  Butler=model  Acora=model
 *   run 2  ARC=user   Butler=user   Acora=user
 *   run 3  ARC=model  Butler=model  Acora=user
 *
 * The evidence never moved. What moved was whether the model happened to write
 * a sentence about each component — so the label reported what was SAID rather
 * than what was HELD, and a listener's corroborated loudspeaker was reported as
 * "your description only".
 *
 * The self-report is gone too, for the same reason. `componentKnowledge.specific
 * === false` is generation output: letting it demote a corroborated product
 * makes prose determine evidence, which is exactly the invariant above.
 * Corroboration is the independent signal that replaced the self-report, and it
 * is sufficient on its own.
 *
 * Note what this does NOT claim. `model` basis means Audio XX holds independent
 * evidence that the product is real and Expanded Reasoning is therefore
 * permitted. It does not claim the assessment discussed the component. Whether
 * a component was covered is a separate question and deserves its own state
 * rather than being smuggled into this one.
 */
export function computeComponentProvenance(
  componentNames: string[],
  knownDescriptions: { name: string; source: 'product' | 'brand' }[],
  corroborated?: string[],
): ComponentProvenance[] {
  const curated = new Map(knownDescriptions.map((k) => [k.name, k.source]));
  const real = new Set((corroborated ?? []).map((c) => c.toLowerCase().trim()));
  return componentNames.map((name) => {
    const c = curated.get(name);
    if (c === 'product') return { name, basis: 'catalog' as const };
    if (c === 'brand') return { name, basis: 'brand' as const };
    if (real.has(name.toLowerCase().trim())) return { name, basis: 'model' as const };
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

/**
 * The verdict line, composed from the structured judgment alone.
 *
 * Used when the model's own verdict sentence was dropped for overclaiming. It
 * states only what Audio XX actually decided — the action verdict and the
 * shape of the surviving relations — and never why the listener chose
 * anything, which is the claim that got the original sentence removed.
 */
export function verdictForVerdictLine(
  verdict: ActionVerdict | undefined,
  relationShape: string | undefined,
): string {
  const tail = relationShape ? `, and on the evidence available ${relationShape}` : '';
  switch (verdict) {
    case 'constraint':
      return `One licensed constraint stands out in this chain${tail}.`;
    case 'indeterminate':
      return `The evidence does not yet support a system-level judgment${tail}.`;
    case 'no_change':
    default:
      return `Nothing here obviously needs changing${tail}.`;
  }
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
/**
 * Build the provisional prompt from the authoritative evidence state.
 *
 * Exported so the contract can be asserted directly rather than inferred from
 * finished prose. Returns the provenance alongside the prompt because they are
 * the same fact: the caller must not recompute it.
 */
export function buildProvisionalPrompt(
  query: string,
  componentNames: string[],
  knownDescriptions: { name: string; character: string; source: 'product' | 'brand' }[],
  unresolved?: { name: string; role: string }[],
  corroborated?: string[],
  lookupUnknown?: string[],
): { userPrompt: string; provenance: ComponentProvenance[] } {
  // ── THE AUTHORITATIVE EVIDENCE STATE ────────────────────────────
  //
  // GOVERNING INVARIANT (founder, 2026-08-17):
  //
  //   The prose may not reason from an evidence state different from the one
  //   used to compute component provenance.
  //
  // This array is computed FIRST and is the only thing the prompt is built
  // from. Previously the prompt was assembled from "is it in the catalog?",
  // which is a different question, and the two answers diverged in public:
  // with all four beta components corroborated and labelled Expanded
  // Reasoning, the assessment still opened
  //
  //   "the ultimate coherence is indeterminate due to unknown components"
  //
  // because the closing instruction said, unconditionally, to "state
  // explicitly which system-level questions cannot be answered until the
  // unresolved components are identified" — and `unresolved` meant "no catalog
  // row", which was true of three components we had just verified against
  // their manufacturers.
  const provenance = computeComponentProvenance(componentNames, knownDescriptions, corroborated);
  const basisOf = new Map(provenance.map((p) => [p.name, p.basis]));
  const unknownLookupSet = new Set((lookupUnknown ?? []).map((c) => c.toLowerCase().trim()));
  const unresolvedByName = new Map((unresolved ?? []).map(u => [u.name, u.role]));
  const roleSuffix = (n: string) =>
    unresolvedByName.has(n) ? `, listener says: ${unresolvedByName.get(n)}` : '';

  const catalogued = componentNames.filter((n) => basisOf.get(n) === 'catalog');
  const brandOnly = componentNames.filter((n) => basisOf.get(n) === 'brand');
  const corroboratedNames = componentNames.filter((n) => basisOf.get(n) === 'model');
  // `user` splits by WHY. Both get identity only; only one may be described to
  // the listener as unverified.
  const userBasis = componentNames.filter((n) => basisOf.get(n) === 'user');
  const incomplete = userBasis.filter((n) => unknownLookupSet.has(n.toLowerCase().trim()));
  const uncorroborated = userBasis.filter((n) => !unknownLookupSet.has(n.toLowerCase().trim()));

  const characterFor = (n: string) =>
    knownDescriptions.find((d) => d.name === n)?.character ?? '';

  const catalogContext = catalogued.length > 0
    ? `\n\nCATALOG-VERIFIED — Audio XX holds its own data on these:\n`
      + catalogued.map((n) => `- ${n}: ${characterFor(n)}`).join('\n')
    : '';

  // Brand evidence licenses a brand-scoped claim, never a product-scoped one.
  const brandContext = brandOnly.length > 0
    ? `\n\nBRAND EVIDENCE — Audio XX holds evidence about the MAKER, not this model:\n`
      + brandOnly.map((n) => `- ${n}: ${characterFor(n)}`).join('\n')
      + `\nAttribute these tendencies to the brand's designs, not to this specific `
      + `product as measured fact.`
    : '';

  // Corroborated: identity independently established, Expanded Reasoning
  // permitted. The old wording invited the model to opt out — "omit them where
  // you do not know them" — and it took the invitation.
  const modelContext = corroboratedNames.length > 0
    ? `\n\nIDENTITY VERIFIED — Audio XX independently confirmed these products exist `
      + `against the manufacturer's own page. They are OUTSIDE the curated catalog, so `
      + `use your general knowledge and Audio XX will label the provenance itself:\n`
      + corroboratedNames.map((n) => `- ${n} [expanded reasoning${roleSuffix(n)}]`).join('\n')
      + `\nThese are IDENTIFIED components. Do not describe them as unknown, `
      + `unidentified or unverified, do not say the system cannot be assessed until `
      + `they are identified, and do not ask the listener to identify them.`
    : '';

  const uncorroboratedContext = uncorroborated.length > 0
    ? `\n\nIDENTITY NOT VERIFIED — Audio XX could not confirm these products exist:\n`
      + `${uncorroborated.map((n) => `- ${n}${roleSuffix(n)}`).join('\n')}\n`
      + `Name them and state the role the listener gave, and NOTHING else. Do not `
      + `describe their sound, design, build or maker. Do not say what they are "known `
      + `for". Do not include them in "characterized". If a chain conclusion depends on `
      + `how one behaves, say that it cannot be assessed until the product is identified. `
      + `Treating an unverified product as real is the worst error you can make here.`
    : '';

  const incompleteContext = incomplete.length > 0
    ? `\n\nIDENTITY CHECK DID NOT COMPLETE for these products:\n`
      + `${incomplete.map((n) => `- ${n}${roleSuffix(n)}`).join('\n')}\n`
      + `This is a failure on our side, NOT a finding about the product. Name them `
      + `and state the role the listener gave, and do not describe their sound, `
      + `design or maker. Do NOT say the product is unidentified, unknown or `
      + `unverified, do NOT ask the listener to identify or describe it, and do `
      + `NOT ask them to confirm it exists. If a chain conclusion depends on one `
      + `of them, say that this part of the reading is incomplete on our side.`
    : '';

  // The closing instruction is now CONDITIONAL on the authoritative state
  // actually containing something unresolved. When every component carries
  // evidence there is nothing to defer, and inviting the model to find
  // something is how "indeterminate due to unknown components" appeared over a
  // fully corroborated chain.
  const anyUnresolved = uncorroborated.length + incomplete.length > 0;
  const closing = anyUnresolved
    ? `Produce an Audio XX provisional system assessment. Assess the components you `
      + `have evidence for, describe the chain structure including the unresolved `
      + `positions, and state which system-level questions cannot be answered until `
      + `those specific components are resolved.`
    : `Produce an Audio XX provisional system assessment. Every component in this `
      + `chain carries evidence, so assess the system as a whole and reach a verdict. `
      + `Do not describe the assessment as provisional, partial or indeterminate for `
      + `want of component identification — nothing here is unidentified.`;

  const userPrompt = `The user asked: "${query}"

The system chain includes: ${componentNames.join(' → ')}
${catalogContext}${brandContext}${modelContext}${uncorroboratedContext}${incompleteContext}

When describing each component in the philosophy section:
- Catalog-verified: reference the verified data above and assess in full.
- Brand evidence: reason from the maker's design tendencies, attributed as such.
- Identity verified: characterise normally from your own knowledge. Do not
  apologise for the source — Audio XX labels provenance itself.
- Identity not verified, or check incomplete: name the component and its role,
  and claim nothing about how it sounds.

${closing}`;

  return { userPrompt, provenance };
}

export async function inferProvisionalSystemAssessment(
  query: string,
  componentNames: string[],
  knownDescriptions: { name: string; character: string; source: 'product' | 'brand' }[],
  unresolved?: { name: string; role: string }[],
  corroborated?: string[],
  /**
   * Components whose identity check did not COMPLETE — timeout, upstream
   * error, malformed reply. Distinct from uncorroborated, which is a finding
   * about the product. Conflating the two told a real listener that their
   * Acora QRC-2 could not be identified, and asked them to describe it, on a
   * turn where the lookup had simply failed. Audio XX identifies that product
   * correctly on demand.
   */
  lookupUnknown?: string[],
): Promise<ConsultationResponse | null> {
  const { userPrompt, provenance } = buildProvisionalPrompt(
    query, componentNames, knownDescriptions, unresolved, corroborated, lookupUnknown,
  );

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

    const parsedResponse = parseSystemInferenceResponse(
      content, componentNames, knownDescriptions, corroborated ?? [],
    );
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
    // Provenance is computed from EVIDENCE, before and independently of the
    // prose. Everything that used to stand here — scanning the generated text
    // for each component's name, and honouring the model's own
    // `componentKnowledge` self-report — let generation decide what evidence
    // Audio XX holds. That inverted the licensing chain, and production showed
    // the same corroborated components landing on three different bases across
    // three identical runs.
    //
    // `characterized` and `componentKnowledge` still travel on the response.
    // They describe COVERAGE — what this assessment discussed — which is worth
    // knowing and is not the same question as what evidence exists.
    // Literally the same array the prompt was built from, not a recomputation.
    // Two derivations of one fact are two chances to disagree.
    parsedResponse.componentProvenance = provenance;
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
  verdict?: string;
  systemThesis?: string;
  interactionExplanation?: string;
  tradeoff?: string;
  action?: string;
  actionVerdict?: ActionVerdict;
  nextQuestion?: string;
  attributes?: Array<{ component?: string; axis?: string; value?: string }>;
  relationStatus?: 'established' | 'none_establishable';
  relations?: Array<{
    components?: [string, string];
    axis?: string;
    kind?: RelationKind;
    premises?: [number, number];
  }>;
}

function parseSystemInferenceResponse(
  raw: string,
  componentNames: string[],
  knownDescriptions: { name: string; source: 'product' | 'brand' }[] = [],
  corroborated: string[] = [],
): ConsultationResponse | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const parsed: SystemInferenceJSON = JSON.parse(cleaned);

    // Content check follows the new schema: an assessment exists when it has a
    // thesis or an explanation, not when a prose bucket happens to be filled.
    if (!parsed.systemThesis && !parsed.interactionExplanation && !parsed.verdict) {
      console.warn('[llm-system-inference] Parsed response has no content');
      return null;
    }

    // Display copy only. The component identities the reader acts on come from
    // the component cards, never from this joined string.
    const subject = componentNames.join(', ');

    let tendenciesOut = [parsed.tradeoff, parsed.action].filter(Boolean).join('\n\n') || undefined;
    let questionOut = parsed.nextQuestion
      || OPEN_DIAGNOSTIC_QUESTION;

    // ── D-12 enforcement ──────────────────────────────────────────
    // The model proposes attributes and relations; Audio XX assigns the TIERS
    // and decides which relations survive. A model-declared tier is a claim,
    // and claims get checked — the corroboration work established that its
    // account of its own knowledge cannot be the gate.
    const provenanceTier = new Map<string, EvidenceTier>();
    for (const k of knownDescriptions) {
      provenanceTier.set(k.name.toLowerCase().trim(), k.source === 'product' ? 'catalog' : 'brand');
    }
    const corroboratedSetForTier = new Set((corroborated ?? []).map((c) => c.toLowerCase().trim()));

    const attributes: AttributeRecord[] = (parsed.attributes ?? [])
      .filter((a) => a?.component && a?.axis && a?.value)
      .map((a) => {
        const key = (a.component as string).toLowerCase().trim();
        const curated = provenanceTier.get(key);
        // Tier comes from what WE hold, never from the model. A component we
        // could not corroborate contributes user-tier attributes, which bound
        // every relation they enter.
        const tier: EvidenceTier = curated
          ?? (corroboratedSetForTier.has(key) ? 'model' : 'user');
        return {
          component: a.component as string,
          axis: a.axis as string,
          value: a.value as string,
          tier,
          scope: curated === 'brand' ? 'brand' as const : 'product' as const,
        };
      });

    const declaredSet: RelationSet = parsed.relationStatus === 'none_establishable'
      ? { status: 'none_establishable', relations: [] }
      : {
        status: 'established',
        relations: (parsed.relations ?? [])
          .filter((r) => r?.components?.length === 2 && r.axis && r.kind && r.premises?.length === 2)
          .map((r) => ({
            components: r.components as [string, string],
            axis: r.axis as string,
            kind: r.kind as RelationKind,
            premises: r.premises as [number, number],
          })),
      };

    const surviving = licensedRelations(declaredSet, attributes);
    const systemRelations = surviving.map((r) => ({
      components: r.components, axis: r.axis, kind: r.kind, tier: r.licensedTier,
    }));

    // Evaluate consumes Explain. With no licensed relation there is nothing to
    // trade off, and a trade-off generated anyway would be adjective
    // arithmetic — "clarity at the cost of warmth" is true of hundreds of
    // unrelated systems precisely because it was never derived from this one.
    if (surviving.length === 0 && tendenciesOut) {
      const actionOnly = parsed.action?.trim();
      tendenciesOut = actionOnly || undefined;
      console.warn('[llm-system-inference] no licensed relation — trade-off withheld');
    }

    // ── D-12 §6 — structural and evaluative overclaiming ──────────
    // The rule existed as a tested library and was never called, so every
    // production verdict opened "the system appears deliberately voiced, with
    // components chosen to maximize resolution" — a claim about why the
    // listener bought what they bought, which no evidence in this pipeline can
    // license. Enforcement runs HERE, after relations are known, because an
    // importance claim is licensed exactly when a surviving relation names the
    // component it is about.
    const componentsInRelations = surviving.flatMap((r) => r.components);
    const overclaims: Array<{ kind: string; sentence: string }> = [];
    const clean = (prose: string | undefined) => {
      const { prose: out, removed } = stripOverclaims(prose, { componentsInRelations });
      overclaims.push(...removed);
      return out;
    };

    let verdictOut = clean(parsed.verdict || undefined);
    const philosophyOut = clean(
      [parsed.systemThesis, parsed.interactionExplanation].filter(Boolean).join('\n\n') || undefined,
    );
    tendenciesOut = clean(tendenciesOut);

    // The verdict is the one field that may not simply vanish: it is the
    // judgment the whole assessment hangs from, and a blank first line reads as
    // a failure rather than as restraint. It is also the one field that can be
    // rebuilt without inventing anything, because the judgment itself is
    // already structured — `actionVerdict` plus the relations that survived.
    if (!verdictOut) {
      const kinds = new Set(surviving.map((r) => r.kind));
      const shape = kinds.has('constraint') ? 'one component bounds what the others can do'
        : kinds.has('counterweight') && kinds.has('reinforcement')
          ? 'the chain both reinforces and counterweights itself'
          : kinds.has('counterweight') ? 'the chain counterweights itself'
            : kinds.has('reinforcement') ? 'the chain reinforces its own direction'
              : undefined;
      verdictOut = verdictForVerdictLine(parsed.actionVerdict, shape);
    }
    if (overclaims.length > 0) {
      console.warn('[llm-system-inference] D-12 §6 — dropped %d overclaiming sentence(s): %s',
        overclaims.length, overclaims.map((o) => `${o.kind}: ${o.sentence.slice(0, 70)}`).join(' | '));
    }

    // The action verdict fixes the permitted question kind. A directional
    // question under a no-change verdict retracts the verdict it follows.
    const verdictForQuestion: ActionVerdict = parsed.actionVerdict ?? 'no_change';
    const required = permittedQuestionType(verdictForQuestion);
    const qIssues = questionViolations(questionOut, required);
    if (qIssues.length > 0) {
      console.warn('[llm-system-inference] question violated %s: %s', required, qIssues.join('; '));
      questionOut = required === 'missing_evidence'
        ? 'What would help most is knowing more about the components I could not identify — do you have the exact models to hand?'
        // The old fallback named four candidate faults and was itself
        // hypothesis-seeding under a no-change verdict.
        : OPEN_DIAGNOSTIC_QUESTION;
    }

    return {
      source: 'llm_inferred',
      subject,
      title: 'Provisional System Assessment',
      advisoryMode: 'system_review',
      // Structured fields map onto the renderer's existing slots. The old
      // `philosophy` / `tendencies` / `systemContext` buckets are gone: the
      // first invited a paragraph per component and the last invited room and
      // genre advice, so both defects were shapes in the schema rather than
      // habits in the prose.
      systemSignature: verdictOut,
      characterized: Array.isArray(parsed.characterized) ? parsed.characterized : [],
      componentKnowledge: Array.isArray(parsed.componentKnowledge) ? parsed.componentKnowledge : [],
      philosophy: philosophyOut,
      tendencies: tendenciesOut,
      actionVerdict: parsed.actionVerdict,
      systemRelations,
      systemContext: undefined,
      followUp: questionOut || (undefined) ||  'What are you exploring — is there something you\'d like to change about this balance, or are you looking to understand what a specific upgrade path might shift?',
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
