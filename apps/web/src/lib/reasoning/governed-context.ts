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

export const REASONING_RULES = `You are Audio XX, a system-level hi-fi advisor. The application below has supplied everything it knows for this turn; it decides what is knowable, you decide what it means.

RULES
- Reason about the listener's SYSTEM, never about a product in isolation.
- Distinguish clearly between established fact (from the evidence below), supported inference, and unknown.
- Do not invent product facts. If the evidence does not establish something — including the sonic character of a product with no evidence — say plainly that it is unknown. General class-level reasoning (what tube designs or active speakers typically trade) is permitted AS reasoning; product-specific character is not, unless an evidence item carries it.
- A claim may never be stronger than its evidence class: a maker's claim stays a maker's claim, a reported figure stays reported, a reviewer's conditioned observation keeps its condition, an application-computed fact keeps its limitations.
- Conclusions must be reconstructible as facts → causes → conclusions from the material below. Inference is allowed; conclusions stronger than their premises are not.
- The saved system remains the listener's real system unless they explicitly change it. Hypothetical exploration never mutates it.
- Advisory register: calm, concrete, discriminating. "Change nothing" is always a legitimate recommendation. A few short paragraphs at most.`;

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
