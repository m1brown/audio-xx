/**
 * CAUSAL COVERAGE — does Audio XX know WHY it cannot say more?
 *
 * This is an observability tool, not a score. Sparse evidence should produce
 * sparse explanation, and optimising toward full coverage would be optimising
 * toward fabrication. What matters is the REASON attached to a gap:
 *
 *   "unresolved — loudspeaker sensitivity not published"   is actionable.
 *   "unresolved — insufficient evidence"                   is not.
 *
 * The difference is the whole point. A system that knows which figure is
 * missing can ask the listener for it; a system that only knows it is short of
 * evidence can do nothing but hedge.
 *
 * The interfaces are the unit of work, replacing the component as the thing
 * Audio XX reasons about. Two components with excellent dossiers and nothing
 * connecting them is a system Audio XX does not understand.
 */
import type { DossierView, DossierLine } from '@/lib/evidence/dossier-presentation';
import { readPowerFigures, pairAcrossLoads } from '@/lib/evidence/quantity-compatibility';

export type CoverageState =
  /** A causal relationship is established and stated. */
  | 'explained'
  /** Something is established; a material part of the question is not. */
  | 'partially_explained'
  /** A real question Audio XX cannot answer — with a reason. */
  | 'unresolved'
  /** No causal question worth asking at this interface. */
  | 'no_question';

/** Why an interface is unresolved. The taxonomy IS the diagnostic value. */
export type UnresolvedCause =
  /** Audio XX has no rule for this interface — an architecture gap. */
  | 'no_interaction_rule'
  /** The rule exists; a component's evidence is missing. */
  | 'missing_product_evidence'
  /** Evidence exists on both sides but cannot legally be combined. */
  | 'incompatible_conditions'
  /** Nobody publishes what would be needed. */
  | 'not_publicly_established';

/**
 * A relationship the coverage pass established between two components.
 *
 * This is what licenses an EVALUATIVE conclusion. A verdict composed without
 * consulting these is Evaluate bypassing Explain, which is why the verdict
 * is derived from this set rather than from a declared label or an axis.
 */
export interface LicensedRelation {
  kind: 'reinforcement' | 'constraint';
  axis: 'power_load';
}

export interface InterfaceCoverage {
  from: string;
  to: string;
  /** The causal question this interface poses, in the reader's terms. */
  question: string;
  state: CoverageState;
  cause?: UnresolvedCause;
  /** The specific thing missing — never "insufficient evidence". */
  detail?: string;
  /** Present only where held evidence established a real relationship. */
  relation?: LicensedRelation;
  /** The single missing figure, named for a verdict that reports the gap. */
  missingFact?: string;
  /**
   * Which question this interface answers, so another evidence source that
   * already settled it can be recognised. Only the amplifier-to-loudspeaker
   * interface carries one today; line-level interfaces have no second source.
   */
  relationScope?: 'power_load';
}

/** The loudspeaker's rated power window, when the maker states a range. */
function handlingWindow(value: string): { min: number; max: number } | undefined {
  const nums = [...value.matchAll(/([\d.,]+)\s*(?:W|watts?)\b/gi)]
    .map((m) => Number(m[1].replace(/,/g, '')));
  if (nums.length < 2) return undefined;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

const lines = (d?: DossierView): DossierLine[] => d ? [...d.primary, ...d.secondary] : [];
const has = (d: DossierView | undefined, label: string) =>
  lines(d).some((l) => l.label.toLowerCase() === label);
const get = (d: DossierView | undefined, label: string) =>
  lines(d).find((l) => l.label.toLowerCase() === label);

export interface CoverageInput {
  components: Array<{ displayName: string; role: string }>;
  dossiers: DossierView[];
}

const roleOf = (input: CoverageInput, ...roles: string[]) =>
  input.components.find((c) => roles.includes((c.role ?? '').toLowerCase()));

const dossierOf = (input: CoverageInput, name?: string) =>
  name ? input.dossiers.find((d) => d.displayName === name) : undefined;

/**
 * Classify every interface the chain actually contains.
 *
 * An interface that does not exist in this system is not reported at all —
 * a matrix padded with absent interfaces would measure the ontology rather
 * than the assessment.
 */
export function causalCoverage(input: CoverageInput): InterfaceCoverage[] {
  const out: InterfaceCoverage[] = [];

  const src = roleOf(input, 'dac', 'streamer', 'source');
  const pre = roleOf(input, 'preamplifier', 'preamp');
  const amp = roleOf(input, 'amplifier', 'power-amp');
  const integrated = roleOf(input, 'integrated');
  const spk = roleOf(input, 'speaker', 'loudspeaker');

  const amplification = amp ?? integrated;

  // ── source → preamplifier, and preamplifier → amplifier ────────────
  //
  // The honest state for both today. Audio XX holds frequency response, input
  // lists and tube complements — none of which relate two line-level stages.
  // What would: output impedance against input impedance, and output level
  // against input sensitivity. Neither is held, and for most of this catalog
  // neither is published.
  /*
   * The line-level chain is derived from the components PRESENT, not from a
   * fixed list of pairs. Hardcoding source→preamp and preamp→amp meant a
   * system with no preamplifier had no line-level interface examined at all,
   * even though source→integrated is exactly the interface such a system
   * turns on. Consecutive stages are paired, whatever the chain contains.
   */
  const stages = [src, pre, amplification].filter(Boolean);
  const lineLevel: Array<[typeof src, typeof pre, string]> = [];
  for (let i = 0; i + 1 < stages.length; i++) {
    const a = stages[i]!;
    const b = stages[i + 1]!;
    lineLevel.push([a, b, `Can ${a.displayName} drive ${b.displayName} without loss?`]);
  }
  for (const [a, b, question] of lineLevel) {
    if (!a || !b) continue;
    const da = dossierOf(input, a.displayName);
    const db = dossierOf(input, b.displayName);
    const haveOut = has(da, 'output impedance');
    const haveIn = has(db, 'input impedance');
    if (haveOut && haveIn) {
      out.push({ from: a.displayName, to: b.displayName, question, state: 'explained' });
    } else {
      const missing = [
        !haveOut ? `${a.displayName} output impedance` : null,
        !haveIn ? `${b.displayName} input impedance` : null,
      ].filter(Boolean).join(' and ');
      out.push({
        from: a.displayName, to: b.displayName, question,
        state: 'unresolved',
        cause: 'missing_product_evidence',
        detail: `${missing} not held`,
      });
    }
  }

  // ── amplification → loudspeaker ───────────────────────────────────
  //
  // The one interface where the catalog routinely holds both sides.
  if (amplification && spk) {
    const da = dossierOf(input, amplification.displayName);
    const db = dossierOf(input, spk.displayName);
    const output = get(da, 'power output');
    const impedance = get(db, 'impedance');
    const sensitivity = get(db, 'sensitivity');
    const question = 'Does the amplifier suit this loudspeaker, and how loud will it play?';

    if (!output || !impedance) {
      const missing = [
        !output ? `${amplification.displayName} power output` : null,
        !impedance ? `${spk.displayName} nominal impedance` : null,
      ].filter(Boolean).join(' and ');
      out.push({
        from: amplification.displayName, to: spk.displayName, question, relationScope: 'power_load',
        state: 'unresolved', cause: 'missing_product_evidence', detail: `${missing} not held`,
        missingFact: missing,
      });
    } else {
      const ohms = Number(/([\d.]+)/.exec(impedance.value)?.[1]);
      const figures = readPowerFigures(output.value);
      const atLoad = figures.filter((f) => f.ohms === ohms);
      if (atLoad.length === 0) {
        out.push({
          from: amplification.displayName, to: spk.displayName, question, relationScope: 'power_load',
          state: 'unresolved', cause: 'incompatible_conditions',
          detail: `no published output figure at ${ohms} ohms — the maker states `
            + `${figures.map((f) => `${f.value}W@${f.ohms ?? '?'}Ω`).join(', ')}`,
        });
      } else {
        /*
         * The interface poses TWO questions and needs a different figure for
         * each: power handling answers "is this within the published limits",
         * sensitivity answers "how loud will it play". Reporting EXPLAINED on
         * sensitivity alone overstated coverage for any loudspeaker whose
         * power handling is unpublished — the limits question was simply not
         * asked. Each missing figure is named with the question it blocks.
         */
        const handling = get(db, 'power handling');
        const missing = [
          !handling ? `${spk.displayName} power handling is not published, so the `
            + `pairing cannot be placed inside or outside the maker's stated limits` : null,
          !sensitivity ? `${spk.displayName} sensitivity is not published, so acoustic `
            + `headroom cannot be estimated` : null,
        ].filter(Boolean);
        /*
         * WHICH RELATIONSHIP THE FIGURES ESTABLISH.
         *
         * Within the loudspeaker's rated window the pairing is a compatibility
         * finding; outside it, a constraint. Both rest on the same two
         * maker-published numbers and both are equally licensed (D-12b), so
         * the verdict derived from them can say either.
         */
        const window = handling ? handlingWindow(handling.value) : undefined;
        const chosen = atLoad.find((f) => f.status === 'typical') ?? atLoad[0];
        const relation: LicensedRelation | undefined =
          window && chosen
            ? {
              kind: chosen.value >= window.min && chosen.value <= window.max
                ? 'reinforcement' : 'constraint',
              axis: 'power_load',
            }
            : undefined;

        out.push(missing.length === 0
          ? {
            from: amplification.displayName, to: spk.displayName, question, relationScope: 'power_load',
            state: 'explained', relation,
          }
          : {
            from: amplification.displayName, to: spk.displayName, question, relationScope: 'power_load',
            state: 'partially_explained',
            cause: 'missing_product_evidence',
            detail: `output at the stated load is established; ${missing.join('; ')}`,
            relation,
            missingFact: !sensitivity
              ? `the ${spk.displayName} sensitivity figure`
              : `the ${spk.displayName} power handling figure`,
          });
      }

      // A separate, narrower question: does output scale across loads?
      if (ohms) {
        const pair = pairAcrossLoads(figures, ohms, ohms * 2);
        if (!pair.ok && !/no published figure at both/.test(pair.reason)) {
          out.push({
            from: amplification.displayName, to: spk.displayName,
            question: 'How does the amplifier behave into the lower load?',
            relationScope: 'power_load',
            state: 'unresolved', cause: 'incompatible_conditions', detail: pair.reason,
          });
        }
      }
    }
  }

  return out;
}

/** A compact line per interface, for the observability artifact. */
export function formatCoverage(rows: InterfaceCoverage[]): string[] {
  return rows.map((r) => {
    const head = `${r.from} → ${r.to}: ${r.state.toUpperCase().replace(/_/g, ' ')}`;
    return r.detail ? `${head} — ${r.detail}` : head;
  });
}
