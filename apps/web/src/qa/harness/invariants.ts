/**
 * QA harness — invariant engine.
 *
 * TIER 1 deterministic invariants and TIER 2 semantic expectations, evaluated
 * over structured observations. Every evaluator is a pure function of
 * (case, observation), so the historical-failure proofs can feed constructed
 * bad observations and show exactly which invariant would have fired.
 */
import { wattsAtStatedLoad } from '@/lib/artifact/interface-conclusions';
import {
  parseQuantities, assessDriveCapability, driveConclusionFor,
} from '@/lib/evidence/physical-quantities';
import { sentences, sonicLeadRequiresListening } from '@/lib/evidence/model-character-guard';
import type { Failure, GoldenCase, Observation } from './schema';

const fold = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function fail(
  o: Observation, layer: Failure['layer'], invariant: string,
  expected: string, actual: string, owningStage: string,
): Failure {
  return { caseId: o.caseId, mutation: o.mutation, layer, invariant, expected, actual, owningStage };
}

const INGESTION = 'system ingestion (detectSystemDescription / graph seeding)';
const QUANTITIES = 'evidence parse / provenance (physical-quantities, store values)';
const COMPOSITION = 'assessment composition (system-review / interface-conclusions)';

// ── TIER 1 · identity ──────────────────────────────────────────────────

/** Every identity token must originate in the input, on digit-run boundaries. */
function tokenOriginates(token: string, input: string): boolean {
  const t = fold(token);
  if (t.length < 2) return true;
  const hay = fold(input);
  let idx = hay.indexOf(t);
  while (idx !== -1) {
    const before = idx === 0 ? '' : hay[idx - 1];
    const after = idx + t.length >= hay.length ? '' : hay[idx + t.length];
    const boundary = (ch: string) => ch === '' || !/[a-z0-9]/.test(ch);
    // a digit-run boundary: "a3" inside "a35" is NOT an occurrence
    if (boundary(before) && boundary(after)) return true;
    idx = hay.indexOf(t, idx + 1);
  }
  return false;
}

export function evaluateIdentity(
  c: GoldenCase, o: Observation, opts: { roles?: boolean } = {},
): Failure[] {
  const checkRoles = opts.roles ?? true;
  const out: Failure[] = [];
  const ids = o.identities;
  const expectedCount = c.physicalUnits ?? c.components.length;

  // I-COUNT — the physical unit count.
  if (ids.length !== expectedCount) {
    out.push(fail(o, 'identity', 'I-COUNT · physical unit count preserved',
      String(expectedCount), `${ids.length} (${ids.join(' | ')})`, INGESTION));
  }
  // I-SET — every expected component present exactly once.
  for (const re of c.components) {
    const hits = ids.filter((id) => re.test(id));
    if (hits.length !== 1) {
      out.push(fail(o, 'identity', 'I-SET · all explicit components preserved',
        `exactly one identity matching ${re}`, hits.length === 0
          ? `missing (got: ${ids.join(' | ')})` : `duplicated: ${hits.join(' | ')}`, INGESTION));
    }
  }
  // I-PHANTOM — no forbidden identity, and every identity originates in input.
  for (const re of c.forbidden ?? []) {
    const hit = ids.find((id) => re.test(id));
    if (hit) {
      out.push(fail(o, 'identity', 'I-PHANTOM · no phantom components',
        `no identity matching ${re}`, hit, INGESTION));
    }
  }
  for (const id of ids) {
    const tokens = id.split(/\s+/).filter((t) => t.length >= 2);
    const alien = tokens.find((t) => !tokenOriginates(t, o.input));
    if (alien) {
      out.push(fail(o, 'identity', 'I-ORIGIN · identity tokens originate in the input',
        `"${alien}" (of "${id}") appears in the input on token boundaries`,
        `not found in: ${o.input.slice(0, 80)}`, INGESTION));
    }
  }
  // I-ROLE — listener-material roles preserved. Skipped for mutations whose
  // wording drops the role words (role is then catalog-inferred, and its
  // order-sensitivity is a logged P2, not an identity failure).
  if (!checkRoles) return out;
  for (const [idxStr, re] of Object.entries(c.roles ?? {})) {
    const compRe = c.components[Number(idxStr)];
    const at = ids.findIndex((id) => compRe.test(id));
    if (at >= 0 && re && !re.test(o.categories[at] ?? '')) {
      out.push(fail(o, 'identity', 'I-ROLE · listener-entered role semantics preserved',
        `category of ${compRe} matches ${re}`, o.categories[at] ?? '(none)', INGESTION));
    }
  }
  return out;
}

/** Metamorphic stability: a non-lossy mutation preserves the physical set. */
export function evaluateMutationStability(
  c: GoldenCase, mut: Observation, lossy: boolean | undefined,
): Failure[] {
  const roles = mut.mutation.startsWith('role_words');
  if (!lossy) return evaluateIdentity(c, mut, { roles });
  // Lossy mutation: full preservation OR honest end-to-end degradation.
  const fullyPreserved = evaluateIdentity(c, mut, { roles }).length === 0;
  if (fullyPreserved) return [];
  if (mut.kind === 'clarification' || mut.kind === 'low_confidence') return [];
  return [fail(mut, 'identity', 'I-LOSSY · preserve or ask, never silently reduce',
    'full component set, or clarification / low_confidence',
    `kind=${mut.kind ?? 'unobserved'} over ${mut.identities.join(' | ')}`, INGESTION)];
}

/** End-to-end admission: kind allowed; an assessment carries the whole system. */
export function evaluateKind(c: GoldenCase, o: Observation): Failure[] {
  if (o.kind === undefined) return [];
  const allowed = c.allowedKinds ?? ['assessment'];
  const out: Failure[] = [];
  if (!allowed.includes(o.kind as never)) {
    out.push(fail(o, 'identity', 'K-KIND · allowed degradation only',
      allowed.join(' | '), o.kind, INGESTION));
  }
  if (o.kind === 'assessment' && o.chainNames) {
    for (const re of c.components) {
      if (!o.chainNames.some((n) => re.test(n))) {
        out.push(fail(o, 'identity', 'K-CHAIN · assessment carries every component first-class',
          `chain name matching ${re}`, o.chainNames.join(' | ') || '(empty)', INGESTION));
      }
    }
    for (const re of c.forbidden ?? []) {
      const hit = o.chainNames.find((n) => re.test(n));
      if (hit) {
        out.push(fail(o, 'identity', 'K-CHAIN-PHANTOM · no phantom in the assessed chain',
          `no chain name matching ${re}`, hit, INGESTION));
      }
    }
  }
  return out;
}

// ── TIER 1 · evidence / provenance ─────────────────────────────────────

const QUAL_DESCRIPTOR = /\b(?:easy|effortless|benign|difficult|hard|friendly|forgiving|smooth|stable)\b/i;

export function evaluateEvidence(c: GoldenCase, o: Observation): Failure[] {
  const out: Failure[] = [];
  const text = o.composedText ?? '';
  const evidence = o.evidence ?? [];

  // E-QUANT-CLEAN — a quantitative field value must not carry qualitative prose.
  for (const l of evidence) {
    if (/impedance|power|sensitivity/i.test(l.label) && QUAL_DESCRIPTOR.test(l.value)) {
      out.push(fail(o, 'evidence',
        'E-QUANT-CLEAN · qualitative language must not contaminate a quantitative value',
        `"${l.label}" holds only the quantitative datum`,
        `${l.component}: "${l.value}"`, QUANTITIES));
    }
  }
  if (!text) return out;

  // E-LOAD-PROVENANCE — every "N watts into M ohms" claim must be derivable
  // from a declared power line AT THAT STATED LOAD. Catches the 30W@6Ω relabel.
  const claimRe = /(\d+(?:\.\d+)?)\s*watts?\s+into\s+(?:the\s+)?(\d+(?:\.\d+)?)(?:\s*|-)ohms?/gi;
  let m: RegExpExecArray | null;
  while ((m = claimRe.exec(text)) !== null) {
    const watts = Number(m[1]);
    const load = Number(m[2]);
    const derivable = evidence.some((l) =>
      /power/i.test(l.label) && wattsAtStatedLoad(l.value, load) === watts);
    if (!derivable) {
      out.push(fail(o, 'evidence', 'E-LOAD-PROVENANCE · no wrong-load relabelling',
        `a maker power line stating ${watts}W at ${load} ohms`,
        `claim "${m[0]}" has no evidence at that load`, QUANTITIES));
    }
  }

  // E-WATT-ORIGIN — every wattage figure in prose exists in some evidence value.
  const wattRe = /(\d+(?:\.\d+)?)\s*(?:W\b|watts?\b)/gi;
  while ((m = wattRe.exec(text)) !== null) {
    const figure = m[1];
    const known = evidence.some((l) => l.value.includes(figure));
    if (!known) {
      out.push(fail(o, 'evidence', 'E-WATT-ORIGIN · calculations do not invent input values',
        `${figure}W present in declared evidence`, `claim "${m[0]}" is unsourced`, QUANTITIES));
    }
  }

  // E-SENS-BASIS — prose must not claim a per-watt figure when the source
  // states a voltage basis (conversion needs the load premise, and the
  // basis itself is provenance).
  const statesVoltageBasis = evidence.some((l) =>
    /sensitivity/i.test(l.label) && /2\.83\s*V/i.test(l.value));
  const statesWattBasis = evidence.some((l) =>
    /sensitivity/i.test(l.label) && /\/\s*W\s*\/|\b1\s*W\b|\bW\s*\/\s*1?m\b/i.test(l.value));
  if (statesVoltageBasis && !statesWattBasis && /\d\s*dB\s*\/\s*W/i.test(text)) {
    out.push(fail(o, 'evidence', 'E-SENS-BASIS · sensitivity basis preserved',
      'no dB/W claim from a 2.83V-basis source without the load premise',
      (text.match(/[^.]*\d\s*dB\s*\/\s*W[^.]*/i) ?? ['dB/W claim'])[0].trim(), QUANTITIES));
  }

  // E-SONIC-LICENCE — a sonic/synergy assertion needs admitted listening
  // evidence; the runtime guard is the arbiter, applied sentence-by-sentence.
  if (!c.hasListeningEvidence) {
    for (const s of sentences(text)) {
      if (sonicLeadRequiresListening(s, false) === undefined) {
        out.push(fail(o, 'evidence',
          'E-SONIC-LICENCE · sonic assertions require listening evidence',
          'no sonic-direction assertion without admitted listening evidence',
          s.slice(0, 140), COMPOSITION));
      }
    }
  }
  return out;
}

// ── TIER 1/2 · reasoning consistency ───────────────────────────────────

const STATE_RE = {
  generous: /amply powered|substantial acoustic headroom/i,
  constrained: /genuinely power-constrained|a live constraint/i,
  'condition-dependent': /depends on how far you sit/i,
  unresolved: /stated loads do not include|not published, so drive cannot be established|does not infer output across loads/i,
} as const;

export function headroomStates(text: string): string[] {
  return Object.entries(STATE_RE).filter(([, re]) => re.test(text)).map(([k]) => k);
}

export function evaluateReasoning(c: GoldenCase, o: Observation): Failure[] {
  const text = o.composedText ?? '';
  if (!text) return [];
  const out: Failure[] = [];
  const states = headroomStates(text);

  // R-EXCLUSIVE — the two verdict poles can never coexist for one page.
  if (states.includes('generous') && states.includes('constrained')) {
    out.push(fail(o, 'reasoning', 'R-EXCLUSIVE · one coherent headroom judgment',
      'at most one of {generous, constrained}', states.join(' + '), COMPOSITION));
  }
  // R-STATE — the declared relationship state holds and its opposites are absent.
  if (c.headroom && c.headroom !== 'none') {
    if (!states.includes(c.headroom)) {
      out.push(fail(o, 'reasoning', 'R-STATE · expected relationship state present',
        c.headroom, states.join(' + ') || '(no headroom state expressed)', COMPOSITION));
    }
    const opposites: Record<string, string[]> = {
      generous: ['constrained', 'condition-dependent'],
      constrained: ['generous'],
      'condition-dependent': ['generous', 'constrained'],
      unresolved: ['generous', 'constrained'],
      workable: ['constrained'],
    };
    for (const opp of opposites[c.headroom] ?? []) {
      if (states.includes(opp)) {
        out.push(fail(o, 'reasoning', 'R-STATE · opposing state absent',
          `no "${opp}" beside expected "${c.headroom}"`, states.join(' + '), COMPOSITION));
      }
    }
  }
  // R-COMPAT — no-obvious-problem cannot coexist with the-match-is-the-problem.
  if (/no obvious mismatch/i.test(text)
    && /the match is the problem|mismatch is established/i.test(text)) {
    out.push(fail(o, 'reasoning', 'R-COMPAT · compatibility states exclusive',
      'one compatibility state per relationship', 'no-obvious-problem + mismatch', COMPOSITION));
  }
  // R-RESTRAINT — change-nothing cannot coexist with an immediate replacement.
  if (/wouldn'?t make a change|nothing here needs changing/i.test(text)
    && /\breplace (?:the|your|it) (?:\w+ )?now\b|you should buy/i.test(text)) {
    out.push(fail(o, 'reasoning', 'R-RESTRAINT · restraint and replacement exclusive',
      'no simultaneous change-nothing and replace-now', 'both present', COMPOSITION));
  }
  return out;
}

// ── TIER 2 · semantic expectations ─────────────────────────────────────

export function evaluateSemantic(c: GoldenCase, o: Observation): Failure[] {
  const text = o.composedText ?? '';
  if (!text) return [];
  const out: Failure[] = [];
  for (const { id, re } of c.must ?? []) {
    if (!re.test(text)) {
      out.push(fail(o, 'advisory', `M-${id}`, `text matching ${re}`, 'absent', COMPOSITION));
    }
  }
  for (const { id, re } of c.mustNot ?? []) {
    const m = text.match(re);
    if (m) {
      out.push(fail(o, 'advisory', `N-${id}`, `no text matching ${re}`,
        `"${m[0].slice(0, 100)}"`, COMPOSITION));
    }
  }
  return out;
}

// ── TIER 1 · deterministic drive-lane check ────────────────────────────

export function evaluateDrive(c: GoldenCase): Failure[] {
  if (!c.drive) return [];
  const d = c.drive;
  const o: Observation = {
    caseId: c.id, mutation: 'drive', input: c.input, identities: [], categories: [],
  };
  const out: Failure[] = [];
  const pw = parseQuantities(d.power[0], 'power_output', d.power[1]);
  const imp = parseQuantities(d.impedance[0], 'nominal_impedance', d.impedance[1])[0]
    ?? parseQuantities(d.impedance[0], 'impedance', d.impedance[1])[0];
  const sens = parseQuantities(d.sensitivity[0], 'sensitivity', d.sensitivity[1])[0];
  const a = assessDriveCapability(pw, imp, sens);
  if (a.status !== d.expectStatus) {
    out.push(fail(o, 'evidence', 'D-STATUS · drive assessability preserved',
      d.expectStatus, a.status, QUANTITIES));
    return out;
  }
  const prose = driveConclusionFor(a, d.power[0], d.impedance[0]).sentence ?? '';
  for (const re of d.must ?? []) {
    if (!re.test(prose)) {
      out.push(fail(o, 'reasoning', 'D-MUST · drive conclusion holds its state',
        `prose matching ${re}`, prose.slice(0, 140) || '(no sentence)', COMPOSITION));
    }
  }
  for (const re of d.mustNot ?? []) {
    const m = prose.match(re);
    if (m) {
      out.push(fail(o, 'reasoning', 'D-MUSTNOT · forbidden drive conclusion absent',
        `no prose matching ${re}`, `"${m[0]}"`, COMPOSITION));
    }
  }
  return out;
}
