/**
 * System thesis — the validated judgment the prose EXPRESSES, derived first.
 *
 * The prose layer previously determined the assessment: whichever paragraphs
 * survived their local licences became the document, and a system with thin
 * listening coverage led with its evidence gaps rather than its verdict. The
 * thesis inverts that. It is a typed, deterministic structure derived from
 * held evidence, active component roles and governed domain knowledge, and
 * every conclusion in it carries three things:
 *
 *   its EPISTEMIC CLASS   established_fact | attributed_observation |
 *                         governed_inference — never blurred;
 *   its CONFIDENCE        conclusion-specific, not document-wide;
 *   what it RESTS ON      so provenance survives synthesis.
 *
 * GOVERNED INFERENCE is a licensed class, not a euphemism for invention. A
 * conclusion may be inferred from established facts, attributed observations,
 * converging independent observations, active topology, functional roles and
 * engineering relationships — expressed at inference strength ("Given X and
 * Y, Z is unlikely to be…"), never promoted to fact, and never reaching for
 * sensory claims no observation supports. Confidence ≠ licence: the licence
 * is the derivation; the confidence is how firmly it holds.
 *
 * Judgments are categorical (strong / promising / mixed / uncertain / weak)
 * — Audio XX does not manufacture numerical precision it cannot ground.
 *
 * Uncertainty is LOCAL. An unknown about a bypassed circuit is recorded as
 * immaterial rather than allowed to suppress the system-level verdict;
 * an unknown at the amplifier/loudspeaker interface is material and says so.
 */

import type { DossierView } from '@/lib/evidence/dossier-presentation';
import type { SonicSynthesis } from '../artifact/sonic-synthesis';
import type { InterfaceConclusion } from '../artifact/interface-conclusions';
import type { InterfaceCoverage } from '../artifact/causal-coverage';
import {
  type ActiveRoleModel, type ActiveComponentRole,
  interfaceMateriality, LEVERAGE_WEIGHT,
} from './active-roles';

export type EpistemicClass =
  | 'established_fact'
  | 'attributed_observation'
  | 'governed_inference';

export type Judgment = 'excellent' | 'strong' | 'promising' | 'mixed' | 'uncertain' | 'weak';
export type Confidence = 'high' | 'moderate' | 'low';

export interface ThesisConclusion {
  statement: string;
  epistemicClass: EpistemicClass;
  confidence: Confidence;
  /** What this rests on — provenance survives synthesis. */
  restsOn: string[];
}

export interface SystemThesis {
  /** Absent only when not even governed inference is licensed. */
  overall?: { judgment: Judgment; confidence: Confidence; basis: EpistemicClass; restsOn: string[] };
  /** The relationship that most determines this system's performance. */
  primaryRelationship?: { from: string; to: string };
  strengths: ThesisConclusion[];
  limitations: ThesisConclusion[];
  /** Unknowns that materially bear on the assessment. */
  materialUnknowns: string[];
  /** Unknowns about bypassed or low-leverage functions — recorded, not contagious. */
  immaterialUnknowns: string[];
  roles: ActiveComponentRole[];
  upgradePressure?: 'low' | 'moderate' | 'high';
}

export interface ThesisInput {
  components: Array<{ displayName: string; role: string }>;
  dossiers: DossierView[];
  model: ActiveRoleModel;
  conclusions: InterfaceConclusion[];
  coverage?: InterfaceCoverage[];
  synthesis?: SonicSynthesis;
  /** The engine's drive/power finding, already licensed upstream. */
  driveFinding?: string;
}

const JUDGMENT_LABEL: Record<Judgment, string> = {
  excellent: 'Excellent match',
  strong: 'Strong match',
  promising: 'Promising match',
  mixed: 'Mixed',
  uncertain: 'Uncertain',
  weak: 'Poorly matched',
};

export function judgmentLabel(j: Judgment): string { return JUDGMENT_LABEL[j]; }

/** The two highest-leverage adjacent stages — the relationship that matters most. */
function primaryRelationship(model: ActiveRoleModel):
{ from: string; to: string } | undefined {
  const amp = model.roles.find((r) => r.activeFunction === 'amplification');
  const spk = model.roles.find((r) => r.activeFunction === 'loudspeaker'
    || r.activeFunction === 'headphone');
  if (amp && spk) return { from: amp.name, to: spk.name };
  return undefined;
}

export function deriveSystemThesis(input: ThesisInput): SystemThesis {
  const { model, conclusions, synthesis, driveFinding } = input;

  const established = conclusions.filter((c) => c.status === 'established');
  const constraints = established.filter((c) => c.favourable === false);
  const favourable = established.filter((c) => c.favourable !== false);

  const strengths: ThesisConclusion[] = [];
  const limitations: ThesisConclusion[] = [];

  for (const c of favourable) {
    strengths.push({
      statement: c.statement,
      epistemicClass: 'established_fact',
      confidence: 'high',
      restsOn: c.restsOn,
    });
  }
  for (const c of constraints) {
    limitations.push({
      statement: c.statement,
      epistemicClass: 'established_fact',
      confidence: 'high',
      restsOn: c.restsOn,
    });
  }

  // Convergent or direct listening observations that speak FOR the pairing.
  const listeningRelations = (synthesis?.relations ?? [])
    .filter((r) => r.kind === 'complementary' || r.kind === 'reinforcing');
  for (const r of listeningRelations.slice(0, 2)) {
    strengths.push({
      statement: r.statement,
      epistemicClass: 'attributed_observation',
      confidence: r.confidence === 'high' ? 'high' : 'moderate',
      restsOn: [r.rule],
    });
  }

  // The drive finding is the canonical governed inference: reported
  // sensitivity + a maker-stated power reference → constraint unlikelihood.
  if (driveFinding && constraints.length === 0) {
    strengths.push({
      statement: driveFinding,
      epistemicClass: 'governed_inference',
      confidence: 'moderate',
      restsOn: ['reported figures combined under Audio XX engineering rules'],
    });
  }

  /*
   * OVERALL JUDGMENT — derived, conclusion-specific, honestly classed.
   *
   *   constraint established        → mixed (the constraint IS the finding)
   *   ≥2 favourable established     → strong, high confidence
   *   1 favourable established      → strong, moderate
   *   listening relations only      → promising, moderate (attributed)
   *   drive inference only          → promising, moderate (inferred)
   *   nothing                       → undefined; the composer states the
   *                                   evidence position rather than a verdict.
   *
   * A minor local gap must not suppress this: material gaps lower CONFIDENCE
   * on the conclusions they touch; they do not veto the judgment the rest of
   * the evidence licenses.
   */
  let overall: SystemThesis['overall'];
  if (constraints.length > 0) {
    overall = {
      judgment: 'mixed',
      confidence: 'high',
      basis: 'established_fact',
      restsOn: constraints.map((c) => c.statement),
    };
  } else if (favourable.length >= 2) {
    overall = {
      judgment: 'strong',
      confidence: 'high',
      basis: 'established_fact',
      restsOn: favourable.flatMap((c) => c.restsOn),
    };
  } else if (favourable.length === 1) {
    overall = {
      judgment: 'strong',
      confidence: 'moderate',
      basis: 'established_fact',
      restsOn: favourable[0].restsOn,
    };
  } else if (listeningRelations.length > 0) {
    overall = {
      judgment: 'promising',
      confidence: 'moderate',
      basis: 'attributed_observation',
      restsOn: listeningRelations.map((r) => r.rule),
    };
  } else if (driveFinding) {
    overall = {
      judgment: 'promising',
      confidence: 'moderate',
      basis: 'governed_inference',
      restsOn: ['reported figures combined under Audio XX engineering rules'],
    };
  }

  /*
   * UNKNOWNS, weighted by causal importance — never merely counted.
   *
   * A gap concerning a bypassed conversion stage or a transport-only source
   * is immaterial to what the listener hears and is filed as such; a gap at
   * a first-order interface is material and belongs in the assessment.
   */
  const materialUnknowns: string[] = [];
  const immaterialUnknowns: string[] = [];
  const lvOf = (name: string) => model.roles.find((r) => r.name === name);

  for (const row of input.coverage ?? []) {
    if (row.state !== 'unresolved' || !row.detail) continue;
    const m = interfaceMateriality(model, row.from, row.to);
    if (m === 'low') immaterialUnknowns.push(row.detail);
    else materialUnknowns.push(row.detail);
  }
  for (const name of synthesis?.uncharacterised ?? []) {
    const role = lvOf(name);
    const w = role ? LEVERAGE_WEIGHT[role.leverage] : 0.4;
    const note = `no admitted independent listening evidence for the ${name}`;
    if (w < 0.4) immaterialUnknowns.push(`${note} (${role?.activeFunction === 'digital_transport'
      ? 'transport-only in this system — low bearing on audible character' : 'low-leverage role'})`);
    else materialUnknowns.push(note);
  }

  const upgradePressure: SystemThesis['upgradePressure'] =
    constraints.length > 0 ? 'high'
      : overall && (overall.judgment === 'strong' || overall.judgment === 'promising') ? 'low'
        : undefined;

  return {
    overall,
    primaryRelationship: primaryRelationship(model),
    strengths,
    limitations,
    materialUnknowns,
    immaterialUnknowns,
    roles: model.roles,
    upgradePressure,
  };
}

/**
 * The verdict paragraph — the sentence the listener came for, first.
 *
 * Expressed at the strength of its class: an established verdict states; an
 * observed one attributes; an inferred one shows its derivation ("Given …").
 * When even inference is unlicensed it returns undefined and the composer
 * falls back to stating the evidence position — but it never leads with the
 * gap report where a defensible judgment exists.
 */
export function composeVerdictLead(thesis: SystemThesis): string | undefined {
  const o = thesis.overall;
  if (!o) return undefined;

  const conf = o.confidence === 'high' ? 'high confidence'
    : o.confidence === 'moderate' ? 'moderate confidence' : 'low confidence';
  const head = `${JUDGMENT_LABEL[o.judgment]} — ${conf}.`;

  const rel = thesis.primaryRelationship;
  const relClause = rel
    ? ` The relationship that most determines this system's performance is the `
      + `${rel.from} into the ${rel.to}.`
    : '';

  const basisClause = o.basis === 'governed_inference'
    ? ' That is a reasoned reading of the figures and roles in this chain — an inference this '
      + 'assessment shows its working for below, not an established fact.'
    : o.basis === 'attributed_observation'
      ? ' That rests on attributed listening evidence, cited below.'
      : '';

  const roleClauses = thesis.roles
    .filter((r) => r.bypassed.length > 0 || r.activeFunction === 'digital_transport')
    .map((r) => (r.activeFunction === 'digital_transport'
      ? `the ${r.name} serves as streaming infrastructure here${r.bypassed.length
        ? ' — its own conversion and analogue stages carry no signal' : ''}`
      : `the ${r.name}'s ${r.bypassed.join(' and ').replace(/_/g, ' ')} `
        + `${r.bypassed.length > 1 ? 'are' : 'is'} bypassed in this configuration`));
  const rolesSentence = roleClauses.length > 0
    ? ` As configured, ${roleClauses.join('; ')}.`
    : '';

  return `${head}${relClause}${basisClause}${rolesSentence}`;
}
