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
import type { EvidenceItem } from './evidence/evidence-types';
import type { ReviewObservation } from './evidence/independent-review';
import {
  toAttributeRecords, findDisagreements, contextObservations,
} from './evidence/independent-review-consumption';
import { selectPremises, type PremiseCandidate } from './evidence/premise-selection';
import {
  parseQuantities, assessDriveCapability, driveConclusionFor, transferFor,
  type QuantityPremise,
} from './evidence/physical-quantities';
import {
  licensedRelations, validateRelations, permittedQuestionType, questionViolations,
  stripOverclaims,
  filterUnlicensedRelationalProse, OPEN_DIAGNOSTIC_QUESTION,
  type LicensedRelation, type ComponentRole,
  type ActionVerdict, type AttributeRecord, type RelationKind, type RelationSet,
  type EvidenceTier,
} from './relational-explain';

// ── Configuration ────────────────────────────────────

const INFERENCE_TIMEOUT_MS = 20000; // Longer than product inference — system analysis is more complex

// ── System prompt ────────────────────────────────────

/**
 * Exported so the output CONTRACT is testable. Which slots may be omitted is a
 * product decision, not prompt wording — the essay shape lived here, and the
 * only way to pin that it is gone is to assert against this string.
 */
export const SYSTEM_PROMPT = `You are Audio XX, a private audio advisory system. You provide calm, structured system assessments — never hype, never urgency, never affiliate tone.

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

2c. EXPLAIN ONLY WHAT YOU DECLARED. Every sentence asserting that two
   components act on one another must correspond to an entry in "relations".
   If you cannot declare a relation between two components on ONE shared axis,
   do not write a sentence claiming they interact — describe each on its own
   instead. Relations you declare are checked; sentences that assert an
   interaction you did not declare, or that we reject, are removed.

2d. BRAND EVIDENCE STAYS BRAND-SCOPED. Where an attribute comes from what is
   known of the MAKER rather than of this specific unit, say so — "dCS designs
   are associated with…", "Harbeth's house sound tends toward…". Do not convert
   it into a claim about the individual product.

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

LENGTH IS AN OUTPUT, NOT A TARGET. Write as many paragraphs as you have
licensed things to say, and no more. Four or five is a CEILING for a
richly-evidenced system, not a quota for a sparse one. A one-finding assessment
is one finding, its unresolved question and a diagnostic question — four
sentences, and complete. Every optional field below may be omitted entirely,
and omitting one is a correct answer, never a failure to try. Nothing is
reconstructed to fill the space you leave. Say each thing ONCE: if you have observed that two
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
  "systemThesis": "OPTIONAL. ONE paragraph — what this system as a whole is FOR, the single idea that explains the choices. Not a component list. OMIT ENTIRELY unless you hold product-specific evidence for MOST of the chain: without it, any thesis is a sentence that would fit any system, and a sentence that fits any system tells this listener nothing.",

  "attributes": [
    { "component": "exact component name", "axis": "warm_bright|smooth_detailed|elastic_controlled|power_load", "value": "the position on that axis" }
  ],
  "relationStatus": "established" | "none_establishable",
  "relations": [
    { "components": ["A", "B"], "axis": "the SHARED axis", "kind": "reinforcement|counterweight|constraint", "premises": [0, 1] }
  ],

  "interactionExplanation": "OPTIONAL. ONE or TWO paragraphs expressing the relations above in natural prose. Do not restate them mechanically and do not spell out the counterfactual — just say what the arrangement does. OMIT ENTIRELY if you declared no relations, and keep it to ONE paragraph if you declared one: a single narrow compatibility finding does not fill two paragraphs, and stretching it is how a licensed fact turns into an unlicensed generalisation.",
  "tradeoff": "OPTIONAL. ONE paragraph. What the listener gains and gives up BECAUSE OF the relations above. OMIT ENTIRELY if relationStatus is none_establishable, or if your relations are physical-compatibility findings only — watts into a load establishes what a system can do, not what it sounds like, and no tonal trade-off follows from it.",
  "actionVerdict": "no_change" | "constraint" | "indeterminate",
  "action": "OPTIONAL. ONE short paragraph. Does anything need changing? Distinguish an architectural choice from a deficiency. OMIT ENTIRELY if the verdict already answers it — a second sentence saying nothing needs changing is padding, not emphasis.",
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

/**
 * Rebuild the verdict from what Evaluate ACTUALLY established.
 *
 * THE DEFECT THIS FIXES. Nathan's verdict read "One licensed constraint stands
 * out in this chain, and on the evidence available the chain reinforces its own
 * direction." The only surviving relation was a REINFORCEMENT, and the only
 * thing established was that an amplifier's published output covers a
 * loudspeaker's published load. The line announced a constraint that did not
 * exist and then implied a system-wide coherence finding from one narrow
 * compatibility fact.
 *
 * The cause was that `actionVerdict` and the relation set were two independent
 * accounts of the same judgment: the model supplied the first and the licensing
 * layer computed the second, and nothing reconciled them. The relations are the
 * evidence, so they win — and where they disagree with the model's own verdict,
 * the relations are what the line reports.
 *
 * SCOPE IS THE SECOND RULE. A relation on `power_load` establishes what a system
 * can DO, not what it sounds like. It may never produce a sentence about the
 * chain's voicing, however many such relations survive, because no number of
 * compatibility findings adds up to a tonal one.
 */
export function verdictFromEvidence(
  declared: ActionVerdict | undefined,
  relations: Array<{ kind: RelationKind; axis: string }>,
  /** A named gap Audio XX holds, e.g. an unpublished sensitivity figure. */
  openGap?: string,
): string {
  if (relations.length === 0) {
    return openGap
      ? `No system-level interaction is established on the evidence held, and `
        + `${openGap} remains unresolved.`
      : 'No system-level interaction is established on the evidence held.';
  }

  const kinds = new Set(relations.map((r) => r.kind));
  const physicalOnly = relations.every((r) => r.axis === 'power_load');

  // A constraint is the only finding that reorders a listener's priorities, so
  // it leads whenever one survives — regardless of what the model declared.
  if (kinds.has('constraint')) {
    return 'One constraint in this chain bounds what the rest of it can do.';
  }

  if (physicalOnly) {
    // Deliberately narrow. This is the Nathan case, and the whole point is that
    // the line claims exactly the compatibility finding and nothing beyond it.
    const lead = relations.length === 1
      ? 'The evidence establishes one compatibility finding in this chain'
      : `The evidence establishes ${relations.length} compatibility findings in this chain`;
    return openGap
      ? `${lead}, and leaves ${openGap} unresolved.`
      : `${lead}, and nothing in it points to a mismatch.`;
  }

  const shape = kinds.has('counterweight') && kinds.has('reinforcement')
    ? 'the chain both reinforces and counterweights itself'
    : kinds.has('counterweight') ? 'the chain counterweights itself'
      : 'the chain reinforces its own direction';

  if (declared === 'indeterminate') {
    return `The evidence does not yet support a system-level judgment, though ${shape}.`;
  }
  return `Nothing here obviously needs changing, and on the evidence available ${shape}.`;
}

/** Mirrors `productKeyFor` in the evidence layer, without importing the store. */
function productKeyish(name: string): string {
  return name.toLowerCase().replace(/[^\w\s/-]/g, ' ').replace(/\s+/g, ' ').trim();
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
/**
 * Counts prompt builds. One assessment should build exactly one prompt; a
 * second build means either a duplicate inference call or a duplicate submit,
 * and the two have very different costs.
 */
let promptBuildCount = 0;

export function buildProvisionalPrompt(
  query: string,
  componentNames: string[],
  knownDescriptions: { name: string; character: string; source: 'product' | 'brand' }[],
  unresolved?: { name: string; role: string }[],
  corroborated?: string[],
  lookupUnknown?: string[],
  manufacturerEvidence?: EvidenceItem[],
  reviewObservations?: Record<string, ReviewObservation[]>,
): {
  userPrompt: string;
  provenance: ComponentProvenance[];
  /** The premises the model was told to index. Leading positions, stable order. */
  suppliedPremises: AttributeRecord[];
  supersededCandidates: PremiseCandidate[];
  unresolvedAxes: Array<{ component: string; axis: string; positions: PremiseCandidate[] }>;
  /** Audio XX's own drive conclusion, already licensed. See below. */
  driveRelation?: LicensedRelation;
  /** That conclusion as prose, written by Audio XX rather than the model. */
  driveConclusion?: string;
  /** A specific unpublished figure that would resolve what is still open. */
  openGap?: string;
  /** The question that gap makes worth asking. Outranks the model's own. */
  gapQuestion?: string;
  /** What Audio XX does not hold, derived from evidence rather than asserted. */
  coverageNote?: string;
} {
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

  // Manufacturer evidence, quoted. This is the strongest evidence Audio XX
  // holds for an uncatalogued product: attributable, checkable, and published
  // by the people who built the thing. It outranks the model's own memory,
  // which is why it is presented as fact rather than as a hint.
  const factsByComponent = new Map<string, EvidenceItem[]>();
  for (const item of manufacturerEvidence ?? []) {
    const owner = componentNames.find((n) => productKeyish(n) === item.productKey);
    if (!owner) continue;
    factsByComponent.set(owner, [...(factsByComponent.get(owner) ?? []), item]);
  }
  const manufacturerContext = factsByComponent.size > 0
    ? `\n\nMANUFACTURER-PUBLISHED FACTS — Audio XX read these from the maker's own `
      + `page. They are established, not inferred. You may reason from them and state `
      + `them plainly. Do NOT restate them as your own estimate, and do not contradict `
      + `them from memory:\n`
      + [...factsByComponent.entries()].map(([name, items]) =>
        `- ${name}:\n` + items.map((i) => `    ${i.field}: ${i.value}`).join('\n')).join('\n')
    : '';

  // Independent-review evidence. Attribution and conditions are stated here
  // because they must survive into the prose: an unattributed review claim
  // reads as Audio XX's own finding, and a conditioned claim stated flat is a
  // claim the publication never made.
  const reviewLines: string[] = [];
  const disagreementLines: string[] = [];
  for (const name of componentNames) {
    const held = reviewObservations?.[name] ?? [];
    if (held.length === 0) continue;
    reviewLines.push(`- ${name}:`);
    for (const o of held) {
      const cond = o.condition ? ` [ONLY ${o.condition.description}]` : '';
      const who = o.reviewer ? `${o.publication}, ${o.reviewer}` : o.publication;
      reviewLines.push(`    (${o.observationType}) ${who}: ${o.claim}${cond}`);
    }
    for (const d of findDisagreements(name, held)) {
      disagreementLines.push(`- ${name} on ${d.axis}: `
        + d.positions.map((p) => `${p.publication} reports ${p.direction}`).join('; '));
    }
  }

  const reviewContext = reviewLines.length > 0
    ? `\n\nINDEPENDENT REVIEW EVIDENCE — published observations from approved `
      + `publications about THESE EXACT products. Stronger than your own memory `
      + `because it is attributable and checkable:\n${reviewLines.join('\n')}\n`
      + `Where you rely on one of these, NAME THE PUBLICATION in the sentence. Where `
      + `an observation carries a condition, state that condition in the same `
      + `sentence — a conditioned finding reported flat is a claim the publication `
      + `did not make. Do not aggregate, score, average or rank them.`
    : '';

  const disagreementContext = disagreementLines.length > 0
    ? `\n\nSOURCES DISAGREE on the following. Do NOT pick a side, average them or `
      + `resolve by majority. Say that approved sources differ, name them, and treat `
      + `the axis as indeterminate:\n${disagreementLines.join('\n')}`
    : '';

  // ── THE PREMISE SET AUDIO XX SUPPLIES ────────────────────────────
  //
  // The model may reason over evidence Audio XX holds. It may not manufacture
  // the evidentiary premises that then license its own reasoning — which is
  // what happened until now: relation premises indexed an attribute list the
  // model invented, and review-derived records appended afterwards occupied
  // indices nothing could reference.
  //
  // These premises therefore occupy the LEADING indices, stated explicitly, so
  // the model can point at them. Anything it adds continues the numbering.
  // Physical facts become TYPED QUANTITIES, not axis positions. "100 W RMS @
  // 8 ohms" and "4 ohms" are not two points on one scale; conflating them is
  // what licensed a drive conclusion the evidence never established.
  const quantities: QuantityPremise[] = [];
  for (const item of manufacturerEvidence ?? []) {
    const owner = componentNames.find((n) => productKeyish(n) === item.productKey);
    if (!owner) continue;
    // Plural: one published field routinely states a whole power table, and
    // the figure at the listener's own load is usually not the first one.
    quantities.push(...parseQuantities(owner, item.field, item.value,
      { sourceUrl: item.attribution?.sourceUrl }));
  }

  const reviewCandidates: PremiseCandidate[] = [];
  for (const name of componentNames) {
    for (const rec of toAttributeRecords(name, reviewObservations?.[name] ?? [])) {
      reviewCandidates.push({
        component: rec.component, axis: rec.axis, value: rec.value,
        source: 'independent_review', tier: rec.tier, scope: rec.scope,
        publication: rec.attribution?.publication,
        sourceUrl: rec.attribution?.sourceUrl,
        condition: rec.attribution?.condition,
      });
    }
  }
  const selection = selectPremises(reviewCandidates);

  // The one combining rule, run by Audio XX rather than proposed by the model.
  // Every power figure the amplifier publishes is offered, so the rule can pick
  // the one specified into THIS loudspeaker's load rather than the first listed.
  const ampSubject = quantities.find((q) => q.quantity === 'power_output')?.subject;
  const ampPowers = quantities.filter((q) => q.quantity === 'power_output'
    && q.subject === ampSubject);
  const spkImpedance = quantities.find((q) => q.quantity === 'nominal_impedance'
    && q.subject !== ampSubject);
  const spkSensitivity = quantities.find((q) => q.quantity === 'sensitivity'
    && q.subject !== ampSubject);
  const drive = assessDriveCapability(ampPowers, spkImpedance, spkSensitivity);

  const quantityLines = quantities.map((q) =>
    `  - ${q.subject}: ${q.quantity} = ${q.value} ${q.unit}`
    + (q.specifiedIntoOhms != null ? ` (specified into ${q.specifiedIntoOhms}Ω)` : '')
    + (q.qualifier && q.qualifier !== `${q.value} ${q.unit}` ? ` — as published: "${q.qualifier}"` : ''));

  const driveLine = drive.status === 'load_mismatch'
    ? `\n\nAMPLIFIER / LOUDSPEAKER DRIVE — NOT ESTABLISHED. The amplifier's `
      + `${drive.watts} W figure is specified into ${drive.specifiedIntoOhms}Ω, and the `
      + `loudspeaker presents ${drive.loadOhms}Ω. Power into one load does NOT establish `
      + `power into another, so what this amplifier delivers into ${drive.loadOhms}Ω is `
      + `unknown from what we hold. Say this plainly as a gap in the evidence and name `
      + `what would close it (${drive.missing}). Do NOT estimate it, do NOT call the `
      + `pairing synergistic, effective, authoritative or well matched, and do NOT `
      + `describe drive as adequate or inadequate.`
    : drive.status === 'assessable'
      ? `\n\nAMPLIFIER / LOUDSPEAKER DRIVE — ESTABLISHED AT THE RELEVANT LOAD. The `
        + `amplifier publishes ${drive.watts} W`
        + (drive.intoOhms != null ? ` into ${drive.intoOhms}Ω` : '')
        + `, which is the load this loudspeaker presents, and the loudspeaker is rated `
        + `${drive.sensitivityDb} dB. YOU MUST STATE THIS in "signature", CITING BOTH `
        + `FIGURES AND THE LOAD in the same sentence. Do not extrapolate beyond them: `
        + `this establishes power delivery, not tonal synergy, and says nothing about `
        + `how the pairing sounds.`
      : drive.status === 'incomplete' && drive.watts != null
        ? `\n\nAMPLIFIER / LOUDSPEAKER DRIVE — PARTLY ESTABLISHED. The amplifier `
          + `publishes ${drive.watts} W`
          + (drive.intoOhms != null ? ` into ${drive.intoOhms}Ω` : '')
          + `, which is the load this loudspeaker presents, so output at the relevant `
          + `load IS established. YOU MUST STATE THIS in "signature", citing the figure `
          + `and the load together. What is missing is ${drive.missing}, which is what `
          + `would be needed to estimate acoustic headroom reliably — name that `
          + `specific gap in the same breath rather than calling drive unknown. Do not `
          + `characterise the pairing as synergistic or well matched.\n`
          + `A MISSING FIGURE IS NOT A FAULT. Do not call this system mismatched, `
          + `constrained, compromised or at risk because a specification is `
          + `unpublished, and do not say the speakers "may or may not" be driven `
          + `properly. Absence of evidence is not evidence of a defect; it is an open `
          + `question, and Audio XX asks the listener about it directly.`
        : drive.status === 'incomplete'
          ? `\n\nAMPLIFIER / LOUDSPEAKER DRIVE — NOT ESTABLISHED. Missing: `
            + `${drive.missing}. Do not characterise drive capability in either direction.`
          : '';

  const quantityContext = quantityLines.length > 0
    ? `\n\nPUBLISHED PHYSICAL QUANTITIES — exact figures with the conditions they were `
      + `specified under. A figure means nothing without its condition; never combine two `
      + `of these unless Audio XX has told you the conclusion below:\n${quantityLines.join('\n')}`
      + driveLine
    : '';

  const premiseLines = selection.premises.map((p, i) =>
    `  P${i}. ${p.component} — ${p.axis} = ${p.value}`
    + (p.attribution?.publication ? ` [${p.attribution.publication}]` : '')
    + (p.attribution?.condition ? ` [ONLY ${p.attribution.condition}]` : ''));

  // Premise visibility. The premise set is the whole contract between Audio XX
  // and the model, and a premise that is selected but never referenced looks
  // identical from the outside to one that was never selected — which is
  // exactly how review evidence sat structurally unreachable for a whole slice.
  console.warn('[d12] premises: %s', premiseLines.length
    ? premiseLines.map((l) => l.trim()).join(' || ') : 'none');

  const premiseContext = premiseLines.length > 0
    ? `\n\nPREMISES AUDIO XX SUPPLIES — these are established evidence, already `
      + `selected as the best applicable for their component and axis. Reference them `
      + `BY INDEX in "relations".premises:\n${premiseLines.join('\n')}\n`
      + `Do NOT restate these as your own attributes. Any attribute you add continues `
      + `the numbering from P${selection.premises.length}. Where a premise names a `
      + `publication, NAME THAT PUBLICATION in any sentence that uses it; where it `
      + `carries a condition, state that condition in the same sentence.\n`
      + `A premise marked TRANSFER-LIMITED was heard through DIFFERENT electronics than `
      + `this listener owns. Tonal findings from it transfer weakly and must be stated as `
      + `what that reviewer heard in that system, never as what this system does. Findings `
      + `about the product's own behaviour under level or load transfer better. Say which `
      + `you are relying on.`
    : '';

  const unresolvedContext = selection.unresolved.length > 0
    ? `\n\nAXES WHERE APPROVED SOURCES DISAGREE with no condition separating them. `
      + `Treat these as INDETERMINATE. Do not pick a side, average them, or resolve by `
      + `majority:\n`
      + selection.unresolved.map((u) => `  - ${u.component} on ${u.axis}: `
        + u.positions.map((p) => `${p.publication ?? 'a source'} reports ${p.value}`).join('; ')).join('\n')
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

  // What Audio XX actually holds per component, counted rather than asserted.
  // Step 4's coverage statement and the prompt's own length guidance both read
  // from this one derivation, so the prose the model writes and the limitation
  // the listener is shown cannot disagree.
  const sonicPremiseHolders = new Set(selection.premises
    .filter((p) => p.axis !== 'power_load')
    .map((p) => p.component.toLowerCase().trim()));
  const characterised = componentNames.filter((n) => {
    const k = n.toLowerCase().trim();
    return sonicPremiseHolders.has(k)
      || knownDescriptions.some((d) => d.name.toLowerCase().trim() === k);
  });
  // A component whose IDENTITY was never confirmed is a different state from
  // one that is confirmed but carries no sonic evidence, and it already has its
  // own section and its own language. Sweeping the two together would have the
  // coverage note assert "verified identity" for a product Audio XX could not
  // confirm exists — the exact conflation the corroboration work was built to
  // prevent, one layer along. Caught by the parity gate, not by inspection.
  const identityUnconfirmed = new Set([
    ...uncorroborated.map((n) => n.toLowerCase().trim()),
    ...(lookupUnknown ?? []).map((n) => n.toLowerCase().trim()),
  ]);
  const thinlyEvidenced = componentNames.filter((n) =>
    !characterised.includes(n) && !identityUnconfirmed.has(n.toLowerCase().trim()));

  const coverageDirective = thinlyEvidenced.length > componentNames.length / 2
    ? `\n\nEVIDENCE COVERAGE — ${thinlyEvidenced.length} of ${componentNames.length} `
      + `components carry no product-specific sonic evidence: `
      + `${thinlyEvidenced.join(', ')}. Audio XX holds their published `
      + `specifications and has verified they exist, and nothing about how they `
      + `sound. You may NOT characterise this system's tonal balance.\n`
      + `OMIT "systemThesis", "tradeoff" AND "action" ENTIRELY. All three require `
      + `tonal evidence this assessment does not have, and filling them means `
      + `writing sentences that would fit any system — which is what this rule `
      + `exists to prevent. Keep "interactionExplanation" to the compatibility `
      + `findings themselves, or omit it too.\n`
      + `In particular: do not say the system delivers resolution, control, `
      + `clarity, transparency, staging, warmth, depth or authority, and do not `
      + `call any of it deliberate. Those are claims about how it SOUNDS, and `
      + `nothing here licenses one. Report the physical and compatibility `
      + `findings you do hold, and stop. Audio XX states this limitation to the `
      + `listener itself — do not apologise for it and do not describe any search.`
    : '';

  /**
   * What Audio XX does not hold, stated to the listener.
   *
   * Derived from evidence and premise participation — never from search
   * behaviour. Audio XX does not know whether a review of the Butler MONAD
   * A100 exists; it knows only that it holds none. "We searched and found
   * nothing" is a claim about the world that this state cannot support, and
   * `lookupUnknown` is the separate field that tracks a check which did not
   * complete.
   *
   * Stated only when it is MATERIAL — more than half the chain — because a
   * limitation attached to one component in four is a footnote, and printing
   * it every time would train the reader to skip it.
   */
  const coverageNote = thinlyEvidenced.length > componentNames.length / 2
    ? `Audio XX does not hold enough product-specific listening evidence for `
      + `${thinlyEvidenced.length === componentNames.length ? 'this chain'
        : 'most of this chain'} — `
      + `${thinlyEvidenced.join(', ')} — to make a defensible system-wide tonal `
      + `judgment. What it holds for ${thinlyEvidenced.length === 1 ? 'it' : 'them'} `
      + `is published specifications and verified identity.`
    : undefined;

  const userPrompt = `The user asked: "${query}"

The system chain includes: ${componentNames.join(' → ')}
${catalogContext}${brandContext}${modelContext}${manufacturerContext}${quantityContext}${reviewContext}${premiseContext}${unresolvedContext}${disagreementContext}${uncorroboratedContext}${incompleteContext}${coverageDirective}

When describing each component in the philosophy section:
- Catalog-verified: reference the verified data above and assess in full.
- Brand evidence: reason from the maker's design tendencies, attributed as such.
- Identity verified: characterise normally from your own knowledge. Do not
  apologise for the source — Audio XX labels provenance itself.
- Identity not verified, or check incomplete: name the component and its role,
  and claim nothing about how it sounds.

  WHERE AUDIO XX HAS DERIVED A CONCLUSION ABOVE, THAT CONCLUSION IS THE MOST
  USEFUL THING YOU HOLD. A specific figure at a specific load tells a listener
  something about their own system that they could not have got from a
  paragraph of adjectives. State it before you reach for tonal character, and
  never let it be crowded out by prose about smoothness, detail or musicality.

${closing}`;

  // Audio XX's OWN conclusion, derived by the drive rule from published
  // figures rather than proposed by the model. It has to be handed to the
  // licensing layer explicitly: without it, D-12 sees an amplifier and a
  // loudspeaker named in one sentence with no relation between them and
  // deletes the very conclusion the prompt just authorised. The engine
  // computing a result and then censoring it is worse than either alone.
  const driveRelation: LicensedRelation | undefined =
    (drive.status === 'assessable' || (drive.status === 'incomplete' && drive.watts != null))
      && ampSubject && spkImpedance
      ? {
        components: [ampSubject, spkImpedance.subject],
        axis: 'power_load',
        kind: 'reinforcement',
        premises: [0, 0],
        licensedTier: 'manufacturer',
        licensedScope: 'product',
        brandScoped: [],
        citedPublications: [],
        conditions: [],
      }
      : undefined;

  const driveProse = (ampSubject && spkImpedance)
    ? driveConclusionFor(drive, ampSubject, spkImpedance.subject) : undefined;
  const driveConclusion = driveProse?.sentence;

  // Production visibility for the derived conclusion. `console.log` is stripped
  // from the production bundle and `console.warn` is not, which is why this is
  // a warn: a path that reports nothing in the only environment that matters is
  // how a ReferenceError once shipped raw JSON through four replays.
  console.warn('[drive] build#%d quantities=%d amp=%s load=%s status=%s conclusion=%s',
    ++promptBuildCount,
    quantities.length, ampSubject ?? 'none', spkImpedance?.value ?? 'none',
    drive.status, driveConclusion ? 'yes' : 'no');

  return {
    userPrompt, provenance,
    driveConclusion,
    openGap: driveProse?.gap,
    gapQuestion: driveProse?.question,
    coverageNote,
    suppliedPremises: selection.premises,
    supersededCandidates: selection.candidates.filter((c) => c.selected === false),
    unresolvedAxes: selection.unresolved,
    driveRelation,
  };
}

/**
 * Attach Audio XX's own derived prose — the drive conclusion and the coverage
 * statement — to a response that has already cleared every gate.
 *
 * Applied AFTER the D-7 gate, deliberately, and this is load-bearing for BOTH
 * values. The coverage note names every thinly-evidenced component, so run
 * through the gate it reads as unlicensed characterisation of products we said
 * we cannot characterise, and the entire assessment collapses into the licensed
 * fallback. That happened in production the first time it was wired in. That gate audits what the MODEL
 * wrote against the evidence we hold, and this sentence was not written by the
 * model — it was computed by the drive rule from published figures. Running it
 * through first is the engine auditing itself: the gate matches prose against
 * the literal published string, our sentence normalises "200 Watts, RMS
 * typical @ 4 Ohms" to "200 watts into 4 ohms", and the whole assessment
 * collapses into the fallback over a restatement of its own evidence.
 */
function applyDerivedProse(
  response: ConsultationResponse,
  driveConclusion?: string,
  coverageNote?: string,
): ConsultationResponse {
  const existing = response.systemSignature?.trim();
  const philosophy = [response.philosophy, coverageNote].filter(Boolean).join('\n\n')
    || undefined;
  return {
    ...response,
    systemSignature: driveConclusion
      ? (existing ? `${driveConclusion} ${existing}` : driveConclusion)
      : response.systemSignature,
    philosophy,
  };
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
  /**
   * Manufacturer evidence held for these components, read from the
   * site-level store. The assessment CONSUMES this; it never acquires or
   * populates it — a fact about the Acora QRC-2 belongs to the QRC-2, not to
   * one listener's turn.
   */
  manufacturerEvidence?: EvidenceItem[],
  /**
   * Independent-review observations ALREADY HELD for these components, read
   * from the site-level store. Read-only: the assessment never acquires. A
   * first encounter with a product legitimately has none, and that absence is
   * not a failure to identify it.
   */
  reviewObservations?: Record<string, ReviewObservation[]>,
  /**
   * Each component's role in the chain, so the publication boundary can resolve
   * "the amplifier" to the product filling that role. Without it, a sentence
   * that points at a second component by its job rather than its name escapes
   * relational licensing entirely.
   */
  componentRoles?: ComponentRole[],
): Promise<ConsultationResponse | null> {
  const {
    userPrompt, provenance, suppliedPremises, driveRelation, driveConclusion,
    openGap, gapQuestion, coverageNote,
  } = buildProvisionalPrompt(
    query, componentNames, knownDescriptions, unresolved, corroborated, lookupUnknown,
    manufacturerEvidence, reviewObservations,
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
    // Truncation is not a parse problem and must not be treated as one. A
    // partial object is a partial ASSESSMENT — half a licensing chain, some
    // relations missing, a verdict that never arrived. Recovering what
    // survived would publish reasoning whose premises were cut off.
    if (data.finishReason && data.finishReason !== 'stop') {
      console.warn('[llm-system-inference] generation did not complete (%s, %s tokens) — declining',
        data.finishReason, data.completionTokens ?? '?');
      return null;
    }
    if (!content || typeof content !== 'string') return null;

    const parsedResponse = parseSystemInferenceResponse(
      content, componentNames, knownDescriptions, corroborated ?? [],
      manufacturerEvidence ?? [], suppliedPremises, provenance, driveRelation,
      openGap, gapQuestion, coverageNote, componentRoles ?? [],
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
          // A published specification we hold is evidence, not an invention.
          // Without this the D-7 gate reads "100 Watts RMS" as a fabricated
          // figure and collapses the whole answer into the fallback — the
          // exact defect the Magnepan sensitivity case established.
          ...(manufacturerEvidence ?? []).map((m) => m.value),
          // A figure a publication measured and we cited is evidence we hold.
          ...Object.values(reviewObservations ?? {}).flat().map((o) => o.claim),
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
        // The derived conclusion survives the fallback. A listener whose gear
        // we cannot characterise is exactly the one for whom a published
        // figure at their own load is the most useful thing we have.
        return applyDerivedProse(
          buildLicensedProvisionalResponse(componentNames, knownDescriptions, unresolvedRoster),
          driveConclusion, coverageNote);
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
    return applyDerivedProse(parsedResponse, driveConclusion, coverageNote);
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
  manufacturerEvidence: EvidenceItem[] = [],
  /**
   * The premises Audio XX supplied, in the order the model was told to index.
   * They occupy the LEADING positions of the combined attribute array, so a
   * relation can reference them — which is precisely what the old contract
   * made impossible.
   */
  suppliedPremises: AttributeRecord[] = [],
  /**
   * The authoritative basis per component, passed in rather than recomputed.
   * Tier-bounded intensity needs it, and deriving it here would be a second
   * derivation of a fact the caller already holds.
   */
  provenance: ComponentProvenance[] = [],
  /**
   * Audio XX's own drive conclusion, derived by the combining rule rather than
   * proposed by the model. Passed EXPLICITLY: reaching for the builder's local
   * through a closure is how `provenance` once became a ReferenceError that the
   * parser's own catch swallowed, publishing raw JSON to production for four
   * replays. A value this function needs is a value it takes.
   */
  driveRelation?: LicensedRelation,
  /** A named, unpublished figure that would resolve what is still open. */
  openGap?: string,
  /**
   * The question that gap makes worth asking.
   *
   * OUTRANKS the model's own `nextQuestion`. Audio XX knows precisely what it
   * could not establish; the model is guessing at what the listener might want
   * to be asked, and a guess should not displace a known open question.
   */
  gapQuestion?: string,
  /** What Audio XX does not hold, derived from evidence rather than asserted. */
  coverageNote?: string,
  /** Chain roles, so role references resolve before the licence check. */
  componentRoles: ComponentRole[] = [],
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
    // A known open question beats a guessed one. Where Audio XX established
    // exactly which figure is missing, that is the question worth asking, and
    // the model's generic alternative is not a competitor to it.
    let questionOut = gapQuestion
      || parsed.nextQuestion
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

    const modelAttributes: AttributeRecord[] = (parsed.attributes ?? [])
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

    // OURS FIRST. Index stability is the whole contract: the prompt numbered
    // these P0..Pn-1, so a relation pointing at P0 resolves to the same premise
    // here. Model-supplied attributes continue the numbering.
    const attributes: AttributeRecord[] = [...suppliedPremises, ...modelAttributes];

    // A model attribute on an axis Audio XX already selected evidence for is
    // SUPERSEDED — the weaker of two answers to one question — and relations
    // built on it are rejected rather than quietly preferred. This is the
    // fail-closed half of applicability: better evidence does not merely rank
    // higher, it displaces.
    const supersededIndices = new Set<number>();
    modelAttributes.forEach((m, i) => {
      const displaced = suppliedPremises.some((p) =>
        p.component.toLowerCase().trim() === m.component.toLowerCase().trim()
        && p.axis === m.axis);
      if (displaced) supersededIndices.add(suppliedPremises.length + i);
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

    // Drop relations resting on displaced evidence before licensing runs.
    const usable: RelationSet = declaredSet.status === 'none_establishable'
      ? declaredSet
      : {
        status: 'established',
        relations: declaredSet.relations.filter((r) => {
          const leans = r.premises.some((i) => supersededIndices.has(i));
          if (leans) {
            console.warn('[llm-system-inference] relation dropped — premise superseded by '
              + 'stronger applicable evidence: %s', r.components.join(' x '));
          }
          return !leans;
        }),
      };

    // Audio XX's derived drive conclusion joins the model's surviving
    // relations. It bypasses `licensedRelations` deliberately: that function
    // validates premises the MODEL proposed, and this one was computed by our
    // own rule from manufacturer figures. It is not a claim awaiting a check.
    const surviving = [
      ...licensedRelations(usable, attributes),
      ...(driveRelation ? [driveRelation] : []),
    ];
    const systemRelations = surviving.map((r) => ({
      components: r.components, axis: r.axis, kind: r.kind, tier: r.licensedTier,
    }));
    console.warn('[d12] surviving relations: %s', surviving.length
      ? surviving.map((r) =>
        `${r.components.join(' \u00d7 ')} [${r.axis}/${r.kind}/${r.licensedTier}]`).join(' || ')
      : 'none');
    const refused = validateRelations(usable, attributes);
    if (refused.length > 0) {
      console.warn('[d12] relations refused: %s',
        refused.map((v) => `${v.rule}: ${v.detail}`).join(' || '));
    }

    // Evaluate consumes Explain. With no licensed relation there is nothing to
    // trade off, and a trade-off generated anyway would be adjective
    // arithmetic — "clarity at the cost of warmth" is true of hundreds of
    // unrelated systems precisely because it was never derived from this one.
    if (surviving.length === 0 && tendenciesOut) {
      const actionOnly = parsed.action?.trim();
      tendenciesOut = actionOnly || undefined;
      console.warn('[llm-system-inference] no licensed relation — trade-off withheld');
    }

    // The same rule, one step further: with no licensed SONIC relation there is
    // no tonal trade-off either. A compatibility finding establishes what a
    // system can do, and no number of them adds up to what it sounds like.
    //
    // Deterministic rather than instructed. The contract tells the model to
    // omit `tradeoff` and `action` when coverage is thin and it complies only
    // sometimes — Nathan kept publishing "prioritizes a clean and precise
    // sound… at the expense of full-bodied warmth" directly beneath the note
    // saying Audio XX holds no listening evidence for three of its four
    // components. That is the drive-conclusion lesson again: where Audio XX
    // already knows the answer, asking for it is the wrong instrument.
    //
    // The verdict line already carries the judgment, so nothing is lost.
    if (tendenciesOut && surviving.length > 0
      && surviving.every((r) => r.axis === 'power_load')) {
      tendenciesOut = undefined;
      console.warn('[llm-system-inference] compatibility findings only — tonal trade-off withheld');
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
    const basisByComponent = Object.fromEntries(provenance.map((p) => [p.name, p.basis]));
    const clean = (prose: string | undefined) => {
      const { prose: out, removed } = stripOverclaims(prose, { componentsInRelations, basisByComponent });
      overclaims.push(...removed);
      return out;
    };

    // ── Explain is DOWNSTREAM of licensing, not parallel to it ────
    //
    // GOVERNING INVARIANT (founder, 2026-08-17): no Explain prose may survive
    // unless the relation it expresses survived deterministic licensing.
    //
    // The production failure: the model proposed dCS x Acora and Butler x ARC,
    // validation rejected BOTH for commensurability, and both were published
    // anyway — because this field was assembled from `interactionExplanation`
    // regardless of what survived. Validation decided what Audio XX may
    // believe; the prose decided what it would say.
    //
    // Every layer that can express an interaction goes through the same
    // filter, so Describe cannot smuggle one in and Evaluate cannot rebuild a
    // rejected relation out of the attribute bag.
    const relationalDrops: Array<{ sentence: string; reason: string }> = [];
    const scopeRepairs: Array<{ from: string; to: string }> = [];
    const licenseRelational = (prose: string | undefined) => {
      const { prose: out, dropped, normalized } = filterUnlicensedRelationalProse(
        prose, surviving, componentNames, componentRoles, attributes);
      relationalDrops.push(...dropped);
      scopeRepairs.push(...normalized);
      return out;
    };

    let verdictOut = clean(licenseRelational(parsed.verdict || undefined));
    const modelProse = clean(licenseRelational(
      [parsed.systemThesis, parsed.interactionExplanation].filter(Boolean).join('\n\n') || undefined,
    ));
    // Audio XX's own coverage statement is NOT added here. It names every
    // thinly-evidenced component, so it fails two checks it was never subject
    // to: the positional default-deny rule inside this function, and the D-7
    // licensing gate that runs on the returned prose in the caller. Adding it
    // here sent the whole assessment to the licensed fallback — the engine
    // censoring its own derived prose, which is the same mistake the drive
    // conclusion already paid for once and which I repeated here.
    //
    // It is applied by `applyDerivedProse` in the caller, after every gate.
    const philosophyOut = modelProse;
    tendenciesOut = clean(licenseRelational(tendenciesOut));

    if (scopeRepairs.length > 0) {
      console.log('[llm-system-inference] D-12 — restated %d premise(s) at brand scope',
        scopeRepairs.length);
    }
    if (relationalDrops.length > 0) {
      console.warn('[llm-system-inference] D-12 — dropped %d unlicensed relational sentence(s): %s',
        relationalDrops.length,
        relationalDrops.map((d) => `${d.reason}`).join(' | '));
    }

    // The verdict is the one field that may not simply vanish: it is the
    // judgment the whole assessment hangs from, and a blank first line reads as
    // a failure rather than as restraint. It is also the one field that can be
    // rebuilt without inventing anything, because the judgment itself is
    // already structured — `actionVerdict` plus the relations that survived.
    // The verdict is the one field that may not simply vanish: it is the
    // judgment the whole assessment hangs from, and a blank first line reads as
    // a failure rather than as restraint. It is also the one field that can be
    // rebuilt without inventing anything, because the judgment itself is
    // already structured — the relations that survived, plus any named gap.
    //
    // Rebuilt from the RELATIONS, not from the model's `actionVerdict`. Those
    // were two independent accounts of one judgment and nothing reconciled
    // them, which is how Nathan announced a constraint that did not exist.
    // Rebuilt when the model supplied nothing — and ALSO when Audio XX holds an
    // open gap and the surviving relations are physical only. In that state the
    // model reliably mistakes a missing figure for a fault: Nathan's first run
    // under this contract led with "This system is materially mismatched due to
    // the lack of sensitivity information", which asserts a defect from an
    // absence and is a worse failure than the padding it replaced. Audio XX
    // knows exactly what it established, so Audio XX states it.
    const physicalOnly = surviving.length > 0
      && surviving.every((r) => r.axis === 'power_load');
    if (!verdictOut || (openGap && physicalOnly)) {
      verdictOut = verdictFromEvidence(parsed.actionVerdict, surviving, openGap);
    }

    if (overclaims.length > 0) {
      console.warn('[llm-system-inference] D-12 §6 — dropped %d overclaiming sentence(s): %s',
        overclaims.length, overclaims.map((o) => `${o.kind}: ${o.sentence.slice(0, 70)}`).join(' | '));
    }

    // The action verdict fixes the permitted question kind. A directional
    // question under a no-change verdict retracts the verdict it follows.
    const verdictForQuestion: ActionVerdict = parsed.actionVerdict ?? 'no_change';
    const required = permittedQuestionType(verdictForQuestion);
    // A question generated from a licensed gap is exempt from the
    // open-diagnostic rule. That rule exists to stop a question NAMING a fault
    // the assessment did not find; here Audio XX established precisely what it
    // could not settle, so asking about it is reporting a finding rather than
    // seeding a hypothesis.
    const qIssues = questionOut === gapQuestion
      ? [] : questionViolations(questionOut, required);
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
