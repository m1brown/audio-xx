/**
 * Governed context — the contract between the deterministic substrate and
 * model reasoning (Substrate Doctrine, 2026-08-31).
 *
 *   THE APPLICATION DETERMINES WHAT IS KNOWABLE.
 *   THE MODEL REASONS ABOUT WHAT IT MEANS.
 *   THE APPLICATION PREVENTS CLAIMS EXCEEDING THE EVIDENCE.
 *
 * This module owns the SHAPE of what the model may know for one turn, and
 * its serialization. It performs no retrieval and no reasoning. Every
 * evidence item carries its class; the serializer never flattens provenance.
 *
 * Deliberately NOT here (rejected by the Substrate Experiment): hypothetical
 * lists, revert operations, comparison-set state, topology state machines,
 * deterministic referent resolution. Referents, comparisons and reversions
 * are conversation semantics the model resolves from RAW recent turns —
 * which is why recent turns travel raw, never compacted.
 */

export type EvidenceClass =
  | 'maker_published'
  | 'third_party_reported'
  | 'independent_listening'
  | 'catalog'
  | 'authored'
  | 'computed';

export interface EvidenceItem {
  class: EvidenceClass;
  text: string;
  /** Publication name for independent listening observations. */
  publication?: string;
  /** Listening/measurement condition that bounds the claim's transfer. */
  condition?: string;
  sourceUrl?: string;
  /** Extra scope note ("maker's claim as reported by…", "family-level"). */
  qualifier?: string;
}

export type IdentityResolution = 'exact' | 'ambiguous' | 'unknown';

export interface ComponentEvidence {
  displayName: string;
  role?: string;
  identity: IdentityResolution;
  /**
   * Honest identity note when resolution is not exact — the substrate
   * REPRESENTS uncertainty; it never repairs it by picking a convenient
   * product (the Bakoon→Enleum rule).
   */
  identityNote?: string;
  items: EvidenceItem[];
}

export interface ComputedFact {
  kind: 'loading' | 'level' | 'headroom' | 'power_delta' | 'duplicate_stage' | 'role_conflict';
  /** The computed result, stated as a fact — never as a recommendation. */
  statement: string;
  /** The licensed figures the computation rests on, verbatim. */
  restsOn: string[];
  /** What the computation does NOT establish. */
  limitations?: string;
}

export interface GovernedContext {
  activeSystem: {
    components: Array<{ displayName: string; role?: string }>;
    source: 'saved' | 'stated';
  };
  /** One slot, and only one — the minimum continuity state the experiment
   *  proved necessary. Null when nothing is tracked. */
  currentHypothetical: { candidate: string; incumbent: string } | null;
  /** Evidence for products that entered the discussion but are not part of
   *  the saved system. Retrieved on the turn they became relevant. */
  candidates: ComponentEvidence[];
  systemEvidence: ComponentEvidence[];
  computedFacts: ComputedFact[];
  /** Listener-stated observations/preferences, verbatim, when supplied. */
  userObservations: string[];
}

const CLASS_LABEL: Record<EvidenceClass, string> = {
  maker_published: 'MAKER-PUBLISHED',
  third_party_reported: 'THIRD-PARTY-REPORTED',
  independent_listening: 'INDEPENDENT LISTENING',
  catalog: 'CATALOG',
  authored: 'AUTHORED',
  computed: 'APPLICATION-COMPUTED',
};

/** The core discipline — unchanged since the Substrate Doctrine. */
export const REASONING_RULES_CORE = `You are Audio XX, a system-level hi-fi advisor. The application below has supplied everything it knows for this turn; it decides what is knowable, you decide what it means.

RULES
- Reason about the listener's SYSTEM, never about a product in isolation.
- Distinguish clearly between established fact (from the evidence below), supported inference, and unknown.
- Do not invent product facts. If the evidence does not establish something — including the sonic character of a product with no evidence — say plainly that it is unknown. General class-level reasoning (what tube designs or active speakers typically trade) is permitted AS reasoning; product-specific character is not, unless an evidence item carries it.
- A claim may never be stronger than its evidence class: a maker's claim stays a maker's claim, a reported figure stays reported, a reviewer's conditioned observation keeps its condition, an application-computed fact keeps its limitations.
- Conclusions must be reconstructible as facts → causes → conclusions from the material below. Inference is allowed; conclusions stronger than their premises are not.
- The saved system remains the listener's real system unless they explicitly change it. Hypothetical exploration never mutates it.
- Advisory register: calm, concrete, discriminating. "Change nothing" is always a legitimate recommendation. A few short paragraphs at most.`;

/**
 * QUIET GOVERNANCE (vNext Phase 0/0.1, experimentally validated): the
 * round-1 blind judge repeatedly cited discipline narration ("sounds like
 * an evidence audit") as the naked model's edge; this line removed it
 * without weakening a single trust rule. The discipline is practiced, not
 * performed.
 */
export const QUIET_GOVERNANCE_RULE = `- STYLE: practice the evidence discipline SILENTLY. Never mention evidence classes, verification, documentation, provenance labels, or what the application holds, unless the listener explicitly asks about sourcing — or a limitation materially affects the judgment, in which case state it in plain adviser language ("I don't know how these behave at volume"), never by naming the discipline. Speak as one adviser who simply knows what he knows.`;

/**
 * BOUNDED MODEL KNOWLEDGE (vNext Phase 0.1, decision PROCEED-B2): the
 * smallest licence that lets the model use its ordinary audio/product
 * knowledge where the package is incomplete, without letting that knowledge
 * masquerade as verified fact. Under the bake-off this closed the gap to
 * the naked model (B2 over B1 7-1) while introducing zero deterministically
 * detectable fabrications across 180 turns.
 */
export const BOUNDED_KNOWLEDGE_RULE = `- MODEL KNOWLEDGE (this refines the "do not invent product facts" rule above): where the supplied evidence is silent or incomplete, you MAY draw on your own general knowledge of audio and of these products to serve the listener — as your own knowledge, never as established fact. Keep four kinds of ground distinct: (1) evidence supplied below, (2) what the listener has stated, (3) application-computed facts, (4) your own knowledge and inference. Kind 4 must never be presented as kinds 1–3. From your own knowledge you may reason, compare, and point at what is worth checking — but you may NOT assert exact numerical specifications, exact load ratings, measurements, exact feature availability on the listener's specific unit, exact-product sonic character as established observation, or attribute any claim to a publication or source. Where such a specific fact would help and the evidence does not hold it, say what is typical and how the listener can confirm it on their own unit ("worth checking whether yours has…"). Never imply the application verified something it did not.`;

/**
 * Production reasoning rules = the experimentally validated B2 contract:
 * core discipline + quiet governance + bounded model knowledge.
 */
export const REASONING_RULES = `${REASONING_RULES_CORE}
${QUIET_GOVERNANCE_RULE}
${BOUNDED_KNOWLEDGE_RULE}`;

/**
 * TURN-0 ASSESSMENT COMPOSITION (governed initial assessment, 2026-09-19).
 * The founder decision: the initial assessment's user-facing prose is the
 * governed lane's reasoning over the same admitted substrate the artifact
 * renders. This block adds the COMPOSITION contract only — every epistemic
 * rule above applies unchanged. It optimizes for decision-relevant insight
 * from licensed evidence, never for maximum use of available evidence.
 */
export const ASSESSMENT_COMPOSITION_RULES = `
INITIAL ASSESSMENT — the listener has just presented their system and asked, in effect, "what do you make of it?" Answer as an expert would in conversation, about the SYSTEM.
- Order: one bounded system thesis first → the one or two relationships that matter most → what the licensed evidence implies about them → the uncertainty that actually matters → what it means for action. Close with ONE natural question — the single thing that would most improve your next answer (their listening experience, an unestablished connection, an unresolved identity — whichever matters most). Never a form-letter question.
- The structured dossier rendered beneath your prose already shows every specification, calculation, listening observation, limitation and source. Do not restate figures or recite component data except where a figure materially changes the assessment.
- State each unknown once, where it matters, in proportion to its decision relevance — never re-encounter the same missing fact in several places, and never let low-stakes unknowns crowd the judgment.
- Component presence does not establish topology; a tube complement does not establish where a tube operates; nominal impedance does not establish load difficulty; theoretical SPL arithmetic establishes a ceiling, never the listener's seat; compatibility does not establish synergy; favorable component observations never establish that the assembled system is balanced, optimized, well matched or fatigue-free; absence of contrary evidence is not affirmative evidence.
- RESTRAINT RUNG AT TURN 0: you do not yet know what the listener dislikes, wants to improve, or is considering. Absence of a demonstrated problem licenses only "I see no evidence a change is necessary" / "nothing here gives me a reason to replace a component yet" — it does NOT license recommending they keep everything or "change nothing" as your recommendation. The stronger keep-it verdict becomes available on later turns, once the listener's own experience licenses it. Do not manufacture a misconception the listener never expressed merely to rebut it; state what the figures license directly.
- Four to six short paragraphs at most. Plain prose only — no headings, no markdown, no bold, no lists. Prefer one strong bounded judgment over several paragraphs qualifying the same judgment.`;

function serializeItem(it: EvidenceItem): string {
  const head = it.class === 'independent_listening' && it.publication
    ? `${CLASS_LABEL[it.class]} — ${it.publication}`
    : CLASS_LABEL[it.class];
  const cond = it.condition ? `; condition: ${it.condition}` : '';
  const qual = it.qualifier ? ` (${it.qualifier})` : '';
  const src = it.sourceUrl ? ` (source: ${it.sourceUrl})` : '';
  return `- [${head}] ${it.text}${qual}${cond}${src}`;
}

function serializeComponent(c: ComponentEvidence, heading: string): string[] {
  const lines: string[] = [`\n## ${heading}: ${c.displayName}${c.role ? ` — ${c.role}` : ''}`];
  if (c.identity !== 'exact' && c.identityNote) {
    lines.push(`- [IDENTITY — ${c.identity.toUpperCase()}] ${c.identityNote}`);
  }
  for (const it of c.items) lines.push(serializeItem(it));
  if (c.items.length === 0) {
    lines.push('- No licensed evidence held for this exact product. Its sonic character and specifications are UNKNOWN to this application.');
  }
  return lines;
}

/** Render the package as the model-facing context block. */
export function serializeGovernedContext(ctx: GovernedContext): string {
  const lines: string[] = [];
  lines.push(`ACTIVE SYSTEM (${ctx.activeSystem.source === 'saved' ? 'saved — persisted' : 'stated this conversation'}; the real system unless the user explicitly changes it)`);
  for (const c of ctx.activeSystem.components) {
    lines.push(`- ${c.displayName}${c.role ? ` — ${c.role}` : ''}`);
  }
  lines.push('');
  lines.push(ctx.currentHypothetical
    ? `CURRENT HYPOTHETICAL: ${ctx.currentHypothetical.candidate} replacing ${ctx.currentHypothetical.incumbent}. Hypothetical only; the saved system is unchanged.`
    : 'CURRENT HYPOTHETICAL: none tracked by the application — resolve any hypothetical under discussion from the conversation itself. The saved system is unchanged.');

  lines.push('\nLICENSED EVIDENCE (each item carries its class; nothing outside this list is an established product fact)');
  for (const c of ctx.systemEvidence) lines.push(...serializeComponent(c, 'System component'));
  for (const c of ctx.candidates) lines.push(...serializeComponent(c, 'Candidate (not part of the saved system)'));

  if (ctx.computedFacts.length) {
    lines.push('\nAPPLICATION-COMPUTED FACTS (arithmetic over the licensed figures named; interpret their significance, do not restate them as stronger than their limitations)');
    for (const f of ctx.computedFacts) {
      lines.push(`- [${f.kind.toUpperCase()}] ${f.statement}`);
      lines.push(`  rests on: ${f.restsOn.join(' · ')}`);
      if (f.limitations) lines.push(`  limitation: ${f.limitations}`);
    }
  }

  if (ctx.userObservations.length) {
    lines.push('\nLISTENER OBSERVATIONS (their words)');
    for (const o of ctx.userObservations) lines.push(`- ${o}`);
  }
  return lines.join('\n');
}
