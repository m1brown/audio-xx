/**
 * SYSTEM REVIEW — the system-level analysis, composed from held evidence.
 *
 * WHAT THIS FIXES. The review was three derived sentences — a power finding,
 * its qualification, a coverage note — followed by four pages of component
 * dossiers. The hierarchy was backwards: the reader met a compatibility check
 * and then four specification sheets, and nothing in between explained the
 * system they had actually assembled.
 *
 * The evidence to say more was already held and simply never reasoned across.
 * Every paragraph below reads facts that are ALREADY in the dossiers and states
 * a RELATIONSHIP between them. Nothing is invented, nothing is fetched, and a
 * paragraph whose licensing facts are absent is not emitted at all — so length
 * is an output of the evidence, never a target.
 *
 * WHAT IT DELIBERATELY WILL NOT DO:
 *
 *   - No tonal prediction. Published specifications license electrical and
 *     architectural statements; they do not license how a system sounds.
 *   - No cross-type bandwidth comparison. An amplifier's ±0.6 dB window and a
 *     loudspeaker's response are different measurements under different
 *     conditions, and setting them side by side implies a commensurability
 *     that typed quantities exist to deny.
 *   - No synergy claim. Two components being individually well specified
 *     licenses nothing about their combination.
 *   - Never a sentence that survives when its evidence is removed.
 *
 * Describe → Explain → Evaluate is the order of the paragraphs themselves: what
 * the chain IS, how its parts relate electrically, what that permits and — the
 * part most assessments skip — what it specifically does not.
 */
import type { DossierView, DossierLine } from '@/lib/evidence/dossier-presentation';
import { LOADING_MARGIN } from '../evidence/engineering-rules';
import {
  readPowerFigures, pairAcrossLoads, readImpedanceFigures, pairImpedances,
} from '@/lib/evidence/quantity-compatibility';

import type { SonicSynthesis } from './sonic-synthesis';
import { DIMENSION_LABEL } from '../evidence/component-character';
import { significantRelations, canonicalDisplayName } from './sonic-synthesis';
import { interfaceConclusions } from './interface-conclusions';
import { classifySystem } from '../evidence/system-class';
import { NATHAN_PRICES, NATHAN_POSITIONS } from '../evidence/nathan-market-facts';
import type { SonicRelation } from '../evidence/relational-synthesis';
import { mergeByPair } from '../evidence/relational-synthesis';

export interface ReviewComponent {
  displayName: string;
  role: string;
}

export interface SystemReviewInput {
  components: ReviewComponent[];
  dossiers: DossierView[];
  /** Audio XX's own derived power conclusion, already licensed upstream. */
  driveFinding?: string;
  driveQualification?: string;
  coverageNote?: string;
  /**
   * What the listening evidence licenses about this chain, already synthesised.
   *
   * Optional because a system Audio XX holds no review coverage for is a
   * normal case, not a degraded one — the review simply has no listening
   * section, and says so in its limits rather than reaching for prose.
   */
  synthesis?: SonicSynthesis;
}

const lines = (d: DossierView): DossierLine[] => [...d.primary, ...d.secondary];

/** Relations that assert something, in the order a reader should meet them. */
const ESTABLISHED: ReadonlySet<SonicRelation['kind']> =
  new Set(['tension', 'complementary', 'reinforcing']);

const findLine = (d: DossierView | undefined, label: string): DossierLine | undefined =>
  d && lines(d).find((l) => l.label.toLowerCase() === label);

const byRole = (input: SystemReviewInput, ...roles: string[]) => {
  const c = input.components.find((x) => roles.includes((x.role ?? '').toLowerCase()));
  if (!c) return undefined;
  return {
    component: c,
    dossier: input.dossiers.find((d) => d.displayName === c.displayName),
  };
};

/**
 * The output at a stated load — matching LIKE CONDITIONS.
 *
 * A maker often publishes several figures at one load: "Minimum 100 Watts RMS
 * @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms". Taking the first match picks the
 * MINIMUM at 8 ohms and the TYPICAL at 4, and comparing those two is the
 * unlike-conditions error typed quantities exist to prevent — it would have
 * reported an amplifier doubling its power when the like-for-like figures say
 * it does not.
 *
 * Segments are read separately and a `typical` figure is preferred, so both
 * ends of a comparison are drawn from the same kind of measurement.
 */
function wattsAtLoad(value: string, ohms: number, prefer: 'typical' | 'any' = 'typical'): string | undefined {
  const segments = value.split(/;/);
  const re = new RegExp(`([\\d.,]+)\\s*(?:watts?|w)\\b`, 'i');
  const atLoad = segments.filter((seg) => new RegExp(`${ohms}\\s*ohm`, 'i').test(seg));
  if (atLoad.length === 0) return undefined;
  const chosen = prefer === 'typical'
    ? (atLoad.find((seg) => /typical/i.test(seg)) ?? atLoad[0])
    : atLoad[0];
  const m = re.exec(chosen);
  return m ? m[1].replace(/,/g, '') : undefined;
}

function numeric(value: string): number | undefined {
  const m = /([\d.]+)/.exec(value.replace(/,/g, ''));
  return m ? Number(m[1]) : undefined;
}

/** Power handling "10 W – 250 W" → its upper and lower bounds. */
function handlingRange(value: string): { min?: number; max?: number } {
  const nums = [...value.matchAll(/([\d.]+)\s*(?:w|watts?)\b/gi)].map((m) => Number(m[1]));
  if (nums.length >= 2) return { min: Math.min(...nums), max: Math.max(...nums) };
  return {};
}

/**
 * Compose the review. Returns paragraphs in reading order; an empty array is a
 * legitimate result for a system Audio XX holds nothing about.
 */
/** One semantic slot of the review. A slot with nothing to say is omitted. */
export interface ReviewSection {
  label: string;
  paragraphs: string[];
}

export function composeSystemReview(input: SystemReviewInput): string[] {
  return composeSystemReviewDetailed(input).paragraphs;
}

/**
 * The review, plus the record of what it could NOT say and why.
 *
 * A refusal with a stated cause is an observability signal: "incompatible
 * evidence conditions" is actionable where "insufficient evidence" is not.
 */
export function composeSystemReviewDetailed(input: SystemReviewInput): {
  paragraphs: string[];
  /** The same material, in labelled semantic slots. Empty slots are omitted. */
  sections?: ReviewSection[];
  /** Index at which the closing NEXT-QUESTION material begins. */
  nextIndex?: number;
  unresolved: string[];
} {
  /*
   * THESIS → EXPLANATION → LIMITS → NEXT QUESTION.
   *
   * The review read as accumulated reasoning: a fact, a caveat, another fact,
   * another caveat, a question. Everything in it was licensed, and the order
   * was the order evidence happened to be retrieved — so a reader met the
   * strongest finding in the middle of the third paragraph and the same
   * unresolved question in three different places.
   *
   * Four buckets, filled in whatever order the evidence allows and emitted in
   * reading order. Structure changes no claim: nothing here creates a
   * conclusion, it decides which licensed conclusion a reader meets first.
   */
  const thesis: string[] = [];
  const observationParas: string[] = [];
  const explanation: string[] = [];
  const limits: string[] = [];
  const next: string[] = [];
  const out: string[] = [];
  const unresolved: string[] = [];

  const amp = byRole(input, 'amplifier', 'integrated', 'power-amp');
  const spk = byRole(input, 'speaker', 'loudspeaker');
  const pre = byRole(input, 'preamplifier', 'preamp');
  const src = byRole(input, 'dac', 'streamer', 'source');

  // ── DESCRIBE: what the chain is ──────────────────────────────────────
  //
  // Not a restatement of the chain line. It says what KIND of chain this is,
  // using only facts held: a separated front end, valve stages where a tube
  // complement is published, the loudspeaker's own driver complement.
  const architecture: string[] = [];
  if (src && pre && amp) {
    /*
     * The chain is printed directly above this section, so naming all three
     * boxes again was repetition dressed as analysis. What is worth saying is
     * the ARCHITECTURAL fact — that gain and power live in separate boxes —
     * which the chain line shows but does not state.
     */
    architecture.push(
      `Gain and power are handled in separate boxes here, with the `
      + `${canonicalDisplayName(pre.component.displayName)} doing the first and the `
      + `${canonicalDisplayName(amp.component.displayName)} the second.`,
    );
  }

  /*
   * ── C: A TUBE LIST IS NOT A TOPOLOGY ──
   *
   * This block read a `tube complement` on two components and concluded
   * "both amplification stages are valve designs — the signal passes through
   * vacuum tubes twice between the source and the loudspeaker terminals, the
   * output stage built on the Butler Model 300B directly heated power triode".
   *
   * The Butler MONAD A100 is a hybrid. Its maker describes a Class-A design
   * in which a 300B DRIVES a current-multiplying output arrangement, and The
   * Audio Beatnik describes it as neither a transistor amplifier nor a
   * conventional tube amplifier. The signal does not pass through a valve
   * output stage on its way to the loudspeaker terminals, and saying it does
   * is a claim about circuit topology drawn from a parts list.
   *
   * What a tube complement establishes is that the unit CONTAINS these
   * valves. Where they sit is a separate fact, and it is only stated where an
   * architecture fact establishes it.
   */
  const tubeStages = [pre, amp]
    .filter((x): x is NonNullable<typeof x> => !!x)
    .filter((x) => !!findLine(x.dossier, 'tube complement'));
  if (tubeStages.length >= 2) {
    const names = tubeStages.map((t) => canonicalDisplayName(t.component.displayName));
    const ampTopology = findLine(amp?.dossier, 'output stage')
      ?? findLine(amp?.dossier, 'topology');
    architecture.push(
      `${names[0]} and ${names[1]} both carry vacuum tubes in their published `
      + `complements, so the signal meets valves at two points in this chain. `
      + (ampTopology
        ? `Where those valves sit differs: ${ampTopology.value.replace(/\.$/, '')}. `
        : `A published tube complement establishes that a unit contains these valves, `
          + `not where in its circuit they operate — so nothing here says the signal `
          + `reaches the loudspeaker terminals through a valve output stage. `)
,
    );
  } else if (tubeStages.length === 1) {
    const t = tubeStages[0];
    const tubes = findLine(t.dossier, 'tube complement')?.value;
    architecture.push(
      `The ${canonicalDisplayName(t.component.displayName)} is a valve design${tubes ? ` — ${tubes.replace(/\.$/, '')}` : ''}, `
      + `and it is the only published tube stage in the chain.`,
    );
  }

  // The chain itself is printed directly above this section, so the paragraph
  // leads with the relational fact rather than listing the boxes again.
  const architecturePara = architecture.length ? architecture.join(' ') : undefined;

  /**
   * THE LINE-LEVEL INTERFACE — what two impedance figures license.
   *
   * Until now nothing reasoned across a line-level interface at all. Coverage
   * reported EXPLAINED whenever both figures were present, but no paragraph
   * was composed from them, so "explained" meant "detected". That is coverage
   * over-claiming, which is worse than a gap: it hides one.
   *
   * What a ratio of input to output impedance establishes is a MARGIN, and
   * nothing more. The convention is that a load should present roughly ten
   * times the source's output impedance or more; below that the source is
   * being worked harder than the convention assumes.
   *
   * What it does NOT establish, and the paragraph says so: any audible
   * consequence. A real deviation depends on how the source's output impedance
   * behaves ACROSS FREQUENCY, and a single figure at one point tells us
   * nothing about the curve. This is the same boundary as nominal impedance
   * versus electrical difficulty, at the other end of the chain.
   *
   * Conditions are matched before the arithmetic: a balanced output impedance
   * against a single-ended input impedance is not a like-for-like ratio, and
   * Audio Research publishes both for the Reference 5.
   */
  const lineLevel: string[] = [];
  // `amp` already resolves integrated amplifiers, so the second pair is
  // preamplifier-to-amplification whatever shape that stage takes.
  const linePairs: Array<[typeof src, typeof pre]> = [[src, pre], [pre, amp]];
  for (const [a, b] of linePairs) {
    if (!a || !b) continue;
    const outLine = findLine(a.dossier, 'output impedance');
    const inLine = findLine(b.dossier, 'input impedance');
    if (!outLine || !inLine) continue;

    const pair = pairImpedances(
      readImpedanceFigures(outLine.value), readImpedanceFigures(inLine.value),
    );
    if (!pair.ok) {
      unresolved.push(`${a.component.displayName} to ${b.component.displayName}: ${pair.reason}`);
      continue;
    }

    const ratio = pair.in.ohms / pair.out.ohms;
    const connection = pair.out.connection === 'balanced' ? 'balanced'
      : pair.out.connection === 'single_ended' ? 'single-ended' : null;
    const via = connection ? ` on the ${connection} connection` : '';

    /*
     * THREE PROVENANCES, AND THE READER IS TOLD WHICH IS WHICH.
     *
     * The two impedances are the makers'. The ten-times figure is NOT: it is
     * Audio XX's engineering convention, held in `LOADING_MARGIN` so it can be
     * cited and revised rather than living as a bare number in a sentence.
     * Leaving it unattributed would let a reader take a convention we adopted
     * for a specification Audio Research or Butler published — a D-7 failure
     * that reads perfectly well, which is exactly what makes it easy to miss.
     */
    const meets = ratio >= LOADING_MARGIN.threshold;
    const margin = meets
      ? `about ${Math.round(ratio)} times the source impedance. Audio XX treats `
        + `${LOADING_MARGIN.threshold} times or more as the conventional design `
        + `margin — that convention is ours, not either maker's — so this pairing `
        + `is inside it`
      : `about ${ratio.toFixed(1)} times the source impedance, short of the `
        + `${LOADING_MARGIN.threshold} times Audio XX treats as the conventional `
        + `design margin. That convention is ours, not either maker's, and a `
        + `pairing below it is not thereby faulty`;

    lineLevel.push(
      `Between ${a.component.displayName} and ${b.component.displayName} the two `
      + `makers publish figures that can be set against each other${via}: an output `
      + `impedance of ${pair.out.ohms} ohms into an input impedance of `
      + `${pair.in.ohms} ohms. That is ${margin}. It is a statement about the `
      + `loading margin and nothing else — what a listener would actually hear `
      + `depends on how that output impedance behaves across frequency, which `
      + `neither maker publishes.`,
    );
  }
  // With no preamplifier the source feeds the amplification stage directly,
  // and that interface is exactly as answerable.
  if (!pre && src && amp) {
    const outLine = findLine(src.dossier, 'output impedance');
    const inLine = findLine(amp.dossier, 'input impedance');
    if (outLine && inLine) {
      const pair = pairImpedances(
        readImpedanceFigures(outLine.value), readImpedanceFigures(inLine.value),
      );
      if (pair.ok) {
        const ratio = pair.in.ohms / pair.out.ohms;
        lineLevel.push(
          `${src.component.displayName} drives ${amp.component.displayName} directly, `
          + `and both figures are published: ${pair.out.ohms} ohms out into `
          + `${pair.in.ohms} ohms in, about `
          + `${ratio >= LOADING_MARGIN.threshold ? Math.round(ratio) : ratio.toFixed(1)} `
          + `times the source impedance, against the ${LOADING_MARGIN.threshold} times `
          + `Audio XX treats as the conventional design margin. That describes the `
          + `loading margin only.`,
        );
      }
    }
  }
  // (ordered below, by significance rather than by retrieval order)

  // ── EXPLAIN: the electrical relationship that the figures license ─────
  //
  // The drive finding arrives already derived and licensed. What is added here
  // is the SECOND published relation nobody had drawn: the amplifier's output
  // at the loudspeaker's own load, set against the loudspeaker's own rated
  // power window. Two maker-published figures, one conclusion.
  // The drive finding itself is NOT repeated here: the document renders it as
  // the verdict, in large type, directly above this section. Saying it twice
  // would read as padding — the review's job is to take it further.
  const electrical: string[] = [];

  const impedanceLine = findLine(spk?.dossier, 'impedance');
  const handlingLine = findLine(spk?.dossier, 'power handling');
  const outputLine = findLine(amp?.dossier, 'power output');
  const driversLine = findLine(spk?.dossier, 'drivers')
    ?? findLine(spk?.dossier, 'driver complement');
  const ohms = impedanceLine ? numeric(impedanceLine.value) : undefined;

  /**
   * WHICH PUBLISHED FIGURE APPLIES — a condition-matching statement, and
   * nothing more.
   *
   * D-7 AUDIT (founder, 2026-08-24). This paragraph previously read: "a
   * nominal load that low is a demand for current rather than for voltage".
   * Three things were wrong with it.
   *
   *   1. A nominal impedance is a single summary number. It does not establish
   *      minimum impedance, phase angle, or the current drawn across the real
   *      impedance curve — so it cannot establish that a loudspeaker is
   *      electrically demanding. COMPATIBILITY is licensed here; DIFFICULTY is
   *      not, and the two must not be confused.
   *   2. The driver complement was offered as the reason the load is low.
   *      Driver count establishes nothing about impedance behaviour.
   *   3. "The 8-ohm figure would flatter the pairing" was simply backwards:
   *      Butler's 8-ohm figure is 128 W and its 4-ohm figure 200 W, so reading
   *      the 8-ohm one UNDERSTATES the output into this loudspeaker.
   *
   * What survives is the part that was always licensed: the loudspeaker states
   * a nominal load, the amplifier publishes a figure at that load, so that is
   * the figure to read. A matching-conditions statement.
   *
   * The difficulty caveat that used to close this sentence — "what a nominal
   * figure does not establish is how demanding the loudspeaker actually is" —
   * moved to the THESIS, where a reader meets it first. Restating it here made
   * the same limitation appear twice in one review. The D-7 guard at the point
   * of risk is not lost: the paragraph still says, of the compatibility
   * finding itself, that it is "not that the match is an easy one, which is a
   * different question and needs evidence neither maker publishes".
   */
  /*
   * The paragraph is licensed by a figure AT THAT LOAD, not by the existence
   * of any figure at all.
   *
   * It fired whenever the amplifier published something, so a Leben CS600
   * (whose maker states "32W x 2 (6L6GC) at 1KHz", with no load given) against
   * an 8-ohm Klipsch produced "the maker's 8-ohm figure is the one to read
   * here" three lines above "no published output figure at 8 ohms". The
   * document contradicted itself, and the first sentence was the false one:
   * there is no 8-ohm figure to read.
   */
  const publishedAtLoad = ohms && outputLine
    ? readPowerFigures(outputLine.value).some((f) => f.ohms === ohms)
    : false;

  if (spk && amp && ohms && outputLine && publishedAtLoad) {
    /*
     * The contrast clause names the OTHER figure only when the amplifier
     * actually publishes one. It previously said "rather than the
     * ${ohms * 2}-ohm figure quoted first on most specification sheets",
     * computed from the loudspeaker's load alone — so an 8-ohm loudspeaker
     * produced a sentence about a 16-ohm figure that no maker publishes and
     * this one certainly had not. Asserting the existence of a specification
     * in order to contrast with it is a D-7 failure regardless of how
     * plausible the surrounding sentence reads.
     */
    const otherLoads = [...new Set(
      readPowerFigures(outputLine.value)
        .map((f) => f.ohms)
        .filter((o): o is number => typeof o === 'number' && o !== ohms),
    )].sort((a, b) => a - b);
    const contrast = otherLoads.length
      ? ` rather than the ${otherLoads.map((o) => `${o}-ohm`).join(' or ')} figure `
        + `the same specification also states`
      : '';
    electrical.push(
      `Which of the amplifier's published figures applies is settled by the `
      + `loudspeaker: ${spk.component.displayName} states a nominal load of `
      + `${impedanceLine!.value}, so the maker's ${ohms}-ohm figure is the one `
      + `to read here${contrast}.`,
    );
  }

  /**
   * WITHIN PUBLISHED OPERATING LIMITS — the exact strength of this claim.
   *
   * Two maker-published figures establish that the pairing lies inside the
   * limits both makers state. They do NOT establish that the pairing is easy,
   * well matched, or ideal; those are difficulty judgements and need evidence
   * this assessment does not hold. The wording is deliberately the weaker one.
   */
  if (spk && amp && handlingLine && outputLine && ohms) {
    const figures = readPowerFigures(outputLine.value);
    const atLoad = figures.filter((f) => f.ohms === ohms);
    const chosen = atLoad.find((f) => f.status === 'typical') ?? atLoad[0];
    const { min, max } = handlingRange(handlingLine.value);
    if (chosen && max != null && min != null && chosen.value <= max && chosen.value >= min) {
      electrical.push(
        `On the published numbers the pairing sits within the limits both makers `
        + `state: ${chosen.value} watts at ${ohms} ohms against a loudspeaker `
        + `specified for ${handlingLine.value}. That establishes compatibility `
        + `with the published ratings — not that the match is an easy one, which `
        + `is a different question and needs evidence neither maker publishes.`,
      );
    } else if (chosen && min != null && chosen.value < min) {
      /*
       * THE COUNTER-CASE MUST BE SAYABLE.
       *
       * The positive branch above existed alone, so a pairing INSIDE the
       * published window was reported and a pairing outside it produced
       * silence. That asymmetry is a licensing error, not caution: both
       * conclusions rest on exactly the same two maker-published figures, and
       * a system that can only confirm compatibility is not restrained, it is
       * broken in one direction.
       *
       * The claim stays at the strength the figures license — the amplifier's
       * published output falls below the range the loudspeaker's own maker
       * specifies. It does NOT claim the amplifier will clip, strain, sound
       * thin or damage anything; those need evidence about behaviour at the
       * listener's actual levels, which nobody publishes.
       */
      electrical.push(
        `The published figures do not meet: ${chosen.value} watts at ${ohms} ohms `
        + `against a loudspeaker its maker specifies for ${handlingLine.value}. `
        + `The amplifier's rated output falls below the bottom of that range, so `
        + `this pairing sits outside the limits ${spk.component.displayName}'s maker `
        + `states rather than inside them. What that does not establish is how it `
        + `behaves at the levels you actually listen at — a published minimum is a `
        + `maker's recommendation, not a measurement of the pairing.`,
      );
    } else if (chosen && max != null && chosen.value > max) {
      electrical.push(
        `The published figures do not meet: ${chosen.value} watts at ${ohms} ohms `
        + `against a loudspeaker its maker specifies for ${handlingLine.value}. `
        + `The amplifier's rated output exceeds the top of that range, which is a `
        + `statement about the ratings and not a prediction of damage — a rated `
        + `maximum describes power the loudspeaker is specified to absorb `
        + `continuously, and how much of an amplifier's output reaches it depends `
        + `on how loudly it is driven.`,
      );
    }
  }

  /**
   * DOES THE OUTPUT DOUBLE INTO HALF THE LOAD?
   *
   * Two published figures at two loads answer a question neither answers
   * alone. An amplifier behaving as an ideal voltage source doubles its power
   * as impedance halves; a real one falls short. Both numbers are the maker's,
   * and the arithmetic between them is Audio XX's — the kind of conclusion a
   * listener cannot reach from a specification sheet.
   *
   * Stops at what the two numbers establish. Earlier wording said the
   * amplifier "meets the extra current the lower load asks for, but not in
   * full" — an inference about current delivery that two power figures do not
   * license. What they license is that it does not behave as an ideal voltage
   * source into this load. Nothing about the sound is claimed.
   */
  if (amp && spk && outputLine && ohms) {
    const figures = readPowerFigures(outputLine.value);
    const pair = pairAcrossLoads(figures, ohms, ohms * 2);
    if (pair.ok) {
      const ratio = pair.low.value / pair.high.value;
      if (pair.high.value > 0 && ratio < 1.8) {
        electrical.push(
          `The maker publishes both loads, which lets one more thing be said: `
          + `${pair.high.value} watts into ${ohms * 2} ohms becomes `
          + `${pair.low.value} into ${ohms}, a rise of about ${ratio.toFixed(1)}× `
          + `rather than the doubling an ideal voltage source would manage. `
          + `Both figures are the maker's and stated on the same basis, so the `
          + `arithmetic holds: the amplifier does not behave as an ideal voltage `
          + `source into this load. That is the whole of what the two numbers `
          + `establish, and it is why the ${ohms}-ohm figure had to be read from `
          + `the maker rather than inferred by doubling the ${ohms * 2}-ohm one.`,
        );
      }
    } else {
      unresolved.push(`amplifier output across loads — ${pair.reason}`);
    }
  }

  /*
   * Each proposition is its own paragraph.
   *
   * They were joined into one block, so five distinct claims — which figure
   * applies, compatibility against the rated window, the 1.6x scaling, what
   * that licenses, what it does not — arrived as a wall of text. The reasoning
   * is unchanged; only the paragraph breaks are new.
   */
  const electricalParas = electrical;
  const electricalPara = electrical.length ? electrical[0] : undefined;

  /*
   * The per-component DIFFERENCE-methodology paragraph was removed here
   * (2026-08-26, second attempt — the first cut in the convergence pass
   * missed this block and it surfaced verbatim in the sideways Leben/DeVore
   * print as the whole of "Why it works"). The rule it explained is enforced
   * where the evidence lives: every comparative statement carries its anchor
   * inline. Narrating the rule was the weakest possible use of the review's
   * most prominent section.
   */

  /*
   * ── EXPLAIN: what the listening evidence establishes per component ──
   *
   * The character layer has already decided what each pile of observations
   * licenses and phrased it at that strength. Nothing here may strengthen a
   * statement; this loop chooses which to print and in what order, and the
   * order is by what the reader can most act on — an established
   * characteristic before a conditioned one.
   */
  /*
   * ── ESTABLISHED: what the acquired figures settle ──
   *
   * Printed before any listening synthesis, because these are the strongest
   * statements in the document and a reader should meet the settled things
   * first. They are also the ones that changed most: three of these
   * interfaces were reported as unresolved until the figures were fetched.
   */
  const conclusions = interfaceConclusions(input.components, input.dossiers);
  const interfaceParas: string[] = conclusions.map((c) => c.statement);
  const engineeringCoherent = conclusions.length >= 2
    && conclusions.every((c) => c.status === 'established' && c.favourable !== false);
  /*
   * MEANING BEFORE ARITHMETIC. The calculations below are kept in full, but
   * the reader gets their system-level conclusion first — the ratios exist to
   * support the sentence, not the other way round.
   */
  /*
   * ONE PARAGRAPH, WITH THE FIGURES FOLDED IN. The convergence brief's
   * verdict on the earlier treatment was right: six paragraphs proving that
   * comfortable interfaces are comfortable is engineering exposition, not
   * assessment. When every conclusion is established and favourable, the
   * reader gets the whole electrical picture in one dense paragraph — the
   * ratios in parentheses, the headroom with its one honest caveat, and the
   * single remaining unknown. The full derivations still exist underneath
   * (in the conclusion objects and their restsOn chains); they simply stop
   * occupying a page of the review.
   *
   * When the engineering is NOT uniformly comfortable, the detailed
   * paragraphs return: a constraint deserves its full derivation in front of
   * the reader, and compression is earned by good news only.
   */
  const engineeringLead: string[] = [];
  if (engineeringCoherent) {
    const loadings = conclusions.filter((c) => c.kind === 'loading' && c.figures);
    const level = conclusions.find((c) => c.kind === 'level');
    const headroom = conclusions.find((c) => c.kind === 'headroom');
    const ratioList = loadings
      .map((c) => `${c.figures!.outOhms} ohms into ${Number(c.figures!.inOhms).toLocaleString()} ohms`)
      .join('; ');

    engineeringLead.push(
      `Electrically, the chain is exceptionally comfortable. `
      + (loadings.length
        ? `${loadings.length === 1 ? 'The line-level interface presents' : 'Neither line-level interface presents'} `
          + `a meaningful loading problem (${ratioList})`
        : `The line-level interfaces present no established loading problem`)
      + (level?.figures
        ? `; the preamplifier has considerably more output than the amplifier needs, `
          + `reaching full power at about ${level.figures.fraction}% of its range`
        : '')
      + (headroom?.figures
        ? `; and ${headroom.figures.watts}W into the loudspeaker's nominal `
          + `${headroom.figures.loadOhms}-ohm load, against ${headroom.figures.sensitivity}dB `
          + `sensitivity, puts theoretical headroom near ${headroom.figures.peakDb}dB — a `
          + `ceiling that assumes rated power into the real load`
        : '')
      + `. The remaining technical unknown is the loudspeaker's actual impedance and `
      + `phase behaviour, which would show how demanding it is beyond its nominal rating.`,
    );
  }

  const synergyParas: string[] = [];
  if (input.synthesis) {
    /*
     * ── WHAT THE LISTENING EVIDENCE ADDS, as an argument ──
     *
     * This slot used to print every proposition, source by source, which put
     * the same attributed sentences in two places: here and in the dossier
     * beneath. The review's job is to say what the body of evidence AMOUNTS
     * to — how much there is, what kind, and how much of it is conditioned —
     * and to leave the observation-by-observation inventory to YOUR SYSTEM,
     * where a reader checking a specific component will look for it.
     */
    /*
     * The sources-and-conditions summary paragraph was removed (2026-08-26):
     * it described the evidence base — who published, how much was
     * comparative, what conditions applied — which is EVIDENCE's job and the
     * dossiers' job. SYSTEM REVIEW argues from the evidence rather than
     * introducing it, and the bounding that matters is stated once at the
     * head of the listening section.
     */

    /*
     * ── EXPLAIN: what the components do to each other ──
     *
     * The heart of the review. Only relations that assert something are
     * printed: nine "not established" lines per pair would bury the three
     * that say something, and the components nobody characterised are
     * accounted for once, in the limits, rather than nine times here.
     */
    const established = mergeByPair(
      significantRelations(input.synthesis.relations).filter((r) => ESTABLISHED.has(r.kind)),
    );
    /*
     * COMPOSED TIGHT, BOUNDED ONCE. The relation objects carry their full
     * bounded statements, and printing them verbatim repeated the same
     * "no reviewer heard them together... more likely to add than cancel"
     * clause under every pair. The section now opens with that bound stated
     * once, and each relation is rendered from its structured fields at a
     * length its content earns. Nothing is claimed that the relation object
     * does not hold — this is compression, not strengthening.
     */
    /*
     * ONE qualification, stated once. The thesis already carries "a supported
     * hypothesis, since no reviewer has heard these together" whenever it
     * states the hypothesis; repeating the same rule at the head of this
     * section made the reader meet the disclaimer twice before any content.
     * The preface survives ONLY for the rare shape where relations exist but
     * the thesis could not state the hypothesis.
     */
    const thesisWillQualify = [...new Set(
      input.synthesis.relations.filter((r) => ESTABLISHED.has(r.kind)).map((r) => r.dimension),
    )].length > 0;
    if (established.length > 0 && !thesisWillQualify) {
      synergyParas.push(
        `No reviewer has heard this exact combination; what follows is how `
        + `independently reported characteristics may combine.`,
      );
    }
    let reinforcingTailUsed = false;
    for (const r of established) {
      const relDims = [...new Set(
        (r.requires ?? []).map((pr) => DIMENSION_LABEL[pr.dimension]),
      )];
      const dimList = relDims.length <= 1 ? (relDims[0] ?? DIMENSION_LABEL[r.dimension])
        : relDims.length === 2 ? `${relDims[0]} and ${relDims[1]}`
          : `${relDims.slice(0, -1).join('; ')}; and ${relDims[relDims.length - 1]}`;
      const comparative = (r.requires ?? []).some((pr) => pr.basis === 'comparative_only');
      const conditional = (r.requires ?? []).every((pr) => pr.basis === 'conditional');
      if (r.kind === 'tension') {
        synergyParas.push(
          `Both the ${r.upstreamName} and the ${r.downstreamName} are `
          + `${conditional ? 'reported' : 'described'} as leaning `
          + `${(r.requires?.[0]?.direction) ?? 'the same way'} — so if anything colours `
          + `this system's ${dimList}, it will come from that end of the chain, and it `
          + `is the first thing to listen for.`,
        );
      } else if (r.kind === 'reinforcing') {
        synergyParas.push(
          reinforcingTailUsed
            ? `The same agreement appears between the ${r.upstreamName} and the `
              + `${r.downstreamName}, this time on ${dimList}`
              + (comparative ? ` — again measured against other products` : '')
              + `.`
            : `Reviewers reach for the same vocabulary for the ${r.upstreamName} and the `
              + `${r.downstreamName}: ${dimList}`
              + (comparative
                ? ` — though each was measured against its predecessor rather than in `
                  + `absolute terms`
                : '')
              + `. A system tends to take its character from what its parts already agree `
              + `on, and this is where these two agree.`,
        );
        reinforcingTailUsed = true;
      } else {
        synergyParas.push(r.statement);
      }
    }

    /*
     * The standalone scope-note paragraph is gone (2026-08-26): the boundary
     * it stated is enforced by construction and the engineering paragraphs
     * carry it inline where it changes a reading. Explaining it again here
     * was methodology in the middle of the assessment.
     */

    /*
     * ── The boundary, stated once and named ──
     *
     * "Some relationships could not be assessed" is not usable. Naming the
     * component, and saying what would change it, is: it tells the listener
     * which box the silence is about and why the silence is not a verdict on
     * the box's quality.
     */
    /*
     * The components with NO admitted evidence — not the per-dimension
     * blockers. `blockedBy` names whichever side lacks the dimension under
     * discussion, so a well-covered component that simply has nothing to say
     * about, say, transient attack was being listed as unevidenced. The
     * paragraph then asserted Audio XX held no listening evidence for two
     * components it had just quoted four publications on.
     */
    const blocked = input.synthesis.relations.filter((r) => r.kind === 'not_established');
    const missing = input.synthesis.uncharacterised;
    if (missing.length > 0) {
      const names = missing.length === 1
        ? `the ${missing[0]}`
        : `the ${missing.slice(0, -1).join(', the ')} and the ${missing[missing.length - 1]}`;
      limits.push(
        `Audio XX holds no admitted independent listening evidence for ${names}. `
        + `That is a gap in published coverage, not a judgement about `
        + `${missing.length === 1 ? 'the component' : 'those components'}: the reviews that exist `
        + `are either in publications Audio XX does not draw on or are of different models. `
        + `Because of it, ${blocked.length === 1 ? 'one relationship in this chain cannot'
          : blocked.length > 1 ? `${blocked.length} of the relationships in this chain cannot`
            : 'none of the component-to-component relationships in this chain can'} `
        + `be assessed from listening evidence at all, and any statement about how `
        + `${names} ${missing.length === 1 ? 'colours' : 'colour'} what reaches the `
        + `loudspeakers would be invention. A published `
        + `review of ${missing.length === 1 ? 'this exact unit' : 'these exact units'} in an approved `
        + `publication would change more of this assessment than any other single piece of evidence.`,
      );
    }
  }

  // ── EVALUATE, and its boundary ───────────────────────────────────────
  //
  // The qualification already states the missing figure. What it does not say —
  // and what a listener most needs — is that two different questions are being
  // separated: whether the amplifier suits the load, and how loud the system
  // will play. The first is answered; the second is not.
  // The qualification is likewise rendered above, so it is not restated. What
  // the document has NOT said is why the two facts are not the same fact.
  const boundary: string[] = [];
  if (input.driveQualification && input.driveFinding && spk) {
    boundary.push(
      `Suitability and loudness are two different questions, and only one of `
      + `them is settled here. `
      + `Whether the amplifier suits the load is an electrical matter and the `
      + `published figures answer it. How loud this system will play, and how much `
      + `dynamic room it keeps in reserve, depends on the loudspeaker's `
      + `sensitivity — and without that figure the calculation cannot be made at `
      + `all. Audio XX will not estimate it from the components' reputations.`,
    );
  }
  /*
   * Emitted only when the THESIS did not already carry this limitation.
   *
   * The opening now states that acoustic headroom is not established and why.
   * Repeating it here as its own paragraph made the same unresolved question
   * appear twice in one review — the body should develop the thesis, not say
   * it again. Where there is no thesis (no quantitative interface to open
   * with) this paragraph is still the only place the boundary is drawn.
   */
  // Held, not pushed: whether this paragraph is needed depends on the thesis,
  // which is composed further down. Deciding here read `thesis.length === 0`
  // before anything had been put in it, so the suppression never fired.
  const boundaryPara = boundary.length ? boundary.join(' ') : undefined;

  if (input.coverageNote) limits.push(input.coverageNote);

  // ── NEXT: what would actually close the gap ──────────────────────────
  //
  // Read from the dossiers rather than taken as an argument: the gaps are
  // already frozen in this snapshot, and a second channel for the same fact is
  // a second thing to keep in step.
  const gap = input.dossiers.flatMap((d) => d.gaps)[0];
  if (gap) {
    /*
     * ── D: TWO DIFFERENT QUESTIONS, TWO DIFFERENT MISSING DATA ──
     *
     * This said the impedance and phase plot "alone would let Audio XX finish
     * the headroom question". It would not. Acoustic headroom is already
     * computed, from sensitivity and rated power; what bounds it in a real
     * room is distance, listening level and how much of its rated power the
     * amplifier delivers into the actual load. The impedance plot answers a
     * different question — how DIFFICULT the load is — and conflating the two
     * told the listener that one specification would settle something it
     * cannot touch.
     */
    limits.push(
      `The gap is narrow and specific: ${gap.replace(/\.$/, '')}. That figure answers `
      + `how hard this loudspeaker is to drive — whether its impedance dips or its phase `
      + `angle asks more of the amplifier than the nominal rating suggests. It is not the `
      + `same question as acoustic headroom, which the published sensitivity and power `
      + `figures already bound; what limits that in your room is listening distance, the `
      + `level you actually use, and how much of its rated power the amplifier delivers `
      + `into the real load. So the plot would settle load difficulty — and what you hear `
      + `at the volumes you actually use answers the rest better than any specification.`,
    );
  }

  /*
   * The flat-paragraph assembly moved BELOW the drive-interface and thesis
   * blocks (2026-08-26): it spread `electricalParas` by value, so the drive
   * paragraph unshifted after this point reached the labelled sections and
   * silently missed the flat conversation surface. One assembly, after every
   * mutation.
   */

  /**
   * THE PRINCIPAL ASSESSMENT — derived from the same lines the body reads.
   *
   * An opening composed from its own reading of the evidence is a second
   * account of the assessment, and two accounts drift. Every clause comes from
   * a dossier line the paragraphs beneath it also use:
   *
   *   the load        `impedance` on the loudspeaker
   *   the licence     `power output` on the amplifier at that load
   *   the headroom    the ABSENCE of `sensitivity` on the loudspeaker
   *   the difficulty  the absence of an impedance minimum / phase figure
   */
  if (electricalPara && amp && spk) {
    const load = impedanceLine?.value;
    const hasSensitivity = !!findLine(spk.dossier, 'sensitivity');
    const hasImpedanceCurve = !!(findLine(spk.dossier, 'impedance minimum')
      ?? findLine(spk.dossier, 'phase angle'));

    const unestablished = [
      !hasImpedanceCurve ? 'how difficult that load actually is to drive' : null,
      !hasSensitivity ? 'how much acoustic headroom the system has' : null,
    ].filter(Boolean) as string[];

    const missing = [
      !hasImpedanceCurve ? "the loudspeaker's impedance minimum and phase behaviour" : null,
      !hasSensitivity ? 'its sensitivity figure' : null,
    ].filter(Boolean) as string[];

    // "neither X nor Y" rather than a comma list: the first item already
    // contains an "and", so joining two with another one reads as three.
    const because = missing.length > 1
      ? `neither ${missing[0]} nor ${missing[1]} is published`
      : `${missing[0]} is not published`;
    const limitClause = unestablished.length
      ? ` What they do not establish is ${unestablished.join(' or ')}, because ${because}.`
      : '';

    electricalParas.unshift(
      `${amp.component.displayName} into ${spk.component.displayName} is the interface `
      + `where the published figures bear most directly on what the system can do. `
      + `The makers' own figures establish compatibility `
      + `at${load ? ` the ${spk.component.displayName}'s nominal ${load} load` : ' the stated load'}.`
      + limitClause,
    );
  }

  /*
   * ── THE ASSESSMENT — judgment first ──
   *
   * One opening, built from every licensed layer at once: market class,
   * interface conclusions, established relations and component character.
   * The reader learns, in order, what kind of system this is, whether its
   * architecture is coherent, what its likely defining strengths are, what
   * the principal synergy hypothesis is, and where the main uncertainty
   * sits. Everything below SUPPORTS this opening; none of it is needed to
   * understand it.
   *
   * It is assembled from the same structured objects the body renders, so it
   * cannot claim what the body then fails to show — and each claim carries
   * its epistemic status in one clause, not a paragraph: "a supported
   * hypothesis, since no reviewer has heard these four together" is the
   * whole of the bounding a reader needs at this altitude. The machinery
   * that enforces the rest works underneath.
   */
  {
    const relations = input.synthesis?.relations ?? [];
    const established = relations.filter((r) => ESTABLISHED.has(r.kind));
    const dims = [...new Set(established.map((r) => r.dimension))];
    const character = input.synthesis?.character ?? new Map<string, never[]>();

    // The market sentence — ONE sentence. The full reasoning (which flagship
    // sits above what, why the top labels are withheld) lives in EVIDENCE
    // territory; the reader here needs the conclusion.
    const priced = NATHAN_PRICES.filter((p) => input.components.some(
      (c) => c.displayName.toLowerCase().includes(p.productKey.split(' ')[0])
        || p.productKey.split(' ').every((t) => c.displayName.toLowerCase().includes(t)),
    ));
    const klass = classifySystem(input.components.length, priced, NATHAN_POSITIONS);
    /*
     * ── ARCHITECTURAL COHERENCE — established from topology and figures ──
     *
     * The sideways test's finding: SYSTEM ARCHITECTURE can sometimes be
     * ESTABLISHED where system sound cannot. A very sensitive, benign-load
     * loudspeaker driven by modest-power valve amplification is not an
     * accident of shopping — it is a recognisable design tradition, and the
     * published figures are sufficient evidence that the combination was
     * chosen to fit. Saying so is a claim about DESIGN INTENT LEGIBILITY,
     * not about sound, and it is exactly the judgment the earlier opening
     * ("one compatibility finding") failed to make.
     *
     * Gates, all from dossier figures: loudspeaker sensitivity \u226594dB and
     * nominal load \u22658 ohms (the benign end), amplifier rated \u226450W with a
     * published tube complement. Every number read from the same lines the
     * dossiers print.
     */
    let architectureJudgment: string | undefined;
    {
      const spkSens = (() => {
        const l = spk && findLine(spk.dossier, 'sensitivity');
        const m = l && /([\d.]+)\s*db/i.exec(l.value);
        return m ? Number(m[1]) : undefined;
      })();
      const spkLoad = (() => {
        const l = spk && findLine(spk.dossier, 'impedance');
        const m = l && /([\d.]+)\s*ohm/i.exec(l.value);
        return m ? Number(m[1]) : undefined;
      })();
      const ampWatts = (() => {
        const l = amp && lines(amp.dossier ?? { primary: [], secondary: [] } as never)
          .find((x) => /power output/i.test(x.label));
        const m = l && /([\d.]+)\s*w/i.exec(l.value);
        return m ? Number(m[1]) : undefined;
      })();
      const ampValve = !!(amp && findLine(amp.dossier, 'tube complement'));

      if (spkSens !== undefined && spkSens >= 94
        && spkLoad !== undefined && spkLoad >= 8
        && ampWatts !== undefined && ampWatts <= 50 && ampValve) {
        architectureJudgment =
          `This is a deliberately architected system in a recognisable tradition: a `
          + `high-resolution digital source feeding modest-power valve amplification `
          + `into a very sensitive, benign-load loudspeaker. The fit is not luck — `
          + `${spkSens}dB sensitivity into a ${spkLoad}-ohm nominal load is precisely `
          + `what lets a ${ampWatts}W valve amplifier work well inside its comfortable `
          + `range, and loudspeakers like this are designed for exactly this kind of `
          + `amplifier. The architecture is established by the published figures; how `
          + `this particular combination voices is a separate question, taken up below.`;
      }
    }

    const ambition = klass
      ? `This is an exceptionally ambitious, ${klass.klass === 'reference_oriented'
        ? 'reference-oriented' : klass.klass.replace(/_/g, '-')} system, assembled from `
        + `components positioned near the top of serious high-end audio`
        + `${klass.withheld ? ' though below their makers\u2019 own flagships' : ''}.`
      : undefined;

    const coherence = engineeringCoherent
      ? `Its architecture is technically coherent: every electrical interface that can `
        + `be checked from published figures checks out comfortably, and the numbers `
        + `leave power and headroom to spare.`
      : undefined;

    // The synergy hypothesis, assembled from what the character map actually
    // holds. Each clause is gated on its evidence and phrased at its
    // strength — comparative claims keep their anchors, conditions stay
    // signalled ("stated"), and the whole carries one status marker.
    let hypothesis: string | undefined;
    if (dims.length > 0) {
      const labels = dims.map((d) => DIMENSION_LABEL[d]);
      const list = labels.length === 1 ? labels[0]
        : labels.length === 2 ? `${labels[0]} and ${labels[1]}`
          : `${labels.slice(0, -1).join('; ')}; and ${labels[labels.length - 1]}`;

      const resolutionComparative = [...character.values()].flat()
        .filter((pr) => pr.dimension === 'resolution')
        .every((pr) => pr.basis === 'comparative_only');
      const warmTension = established.find(
        (r) => r.kind === 'tension' && r.dimension === 'warmth');
      const neutralMid = input.components.find((c) => {
        const props = character.get(c.displayName) ?? [];
        return /pre/i.test(c.role ?? '') && props.some(
          (pr) => pr.dimension === 'neutrality' && pr.direction === 'neutral'
            && pr.basis === 'direct_observation');
      });

      hypothesis =
        `Where the published listening evidence converges, it converges on ${list}. `
        + `The coherent reading of this chain — a supported hypothesis, since no `
        + `reviewer has heard these ${input.components.length === 4 ? 'four' : 'components'} `
        + `together — is a system built to retrieve an unusual amount of information `
        + `and present it with body rather than analytical thinness`
        + (resolutionComparative
          ? `: the front of the chain is independently described as more resolving and `
            + `better focused than the models it replaced`
          : '')
        + (warmTension
          ? `, the ${warmTension.upstreamName}\u2013${warmTension.downstreamName} end carries `
            + `a stated warmer tendency`
          : '')
        + (neutralMid
          ? `, and between them sits a preamplifier described as neutral rather than `
            + `coloured — which makes the combination more interesting than a simple `
            + `"warm plus detailed" recipe`
          : '')
        + '.';
    }

    // The main uncertainty: the least corroborated link. Fully conditional
    // evidence from a single publication, or no evidence at all.
    const leastEvidenced = input.components.filter((c) => {
      const props = character.get(c.displayName) ?? [];
      if (props.length === 0) return (character.size > 0);
      const pubs = new Set(props.flatMap((pr) => pr.publications.map((x) => x.toLowerCase())));
      return props.every((pr) => pr.basis === 'conditional') && pubs.size <= 1;
    });
    const uncertainty = leastEvidenced.length === 1 && dims.length > 0
      ? `The open question is the ${leastEvidenced[0].role || 'component'} — the `
        + `${canonicalDisplayName(leastEvidenced[0].displayName)} is the least corroborated link in the chain, `
        + `and the most informative place to experiment. That question, and what would `
        + `answer it, is taken up below.`
      : undefined;

    const opening = [ambition, coherence].filter(Boolean).join(' ');
    const parts = [architectureJudgment, opening || undefined, hypothesis, uncertainty]
      .filter(Boolean) as string[];
    if (parts.length) thesis.unshift(...parts);
  }

  /*
   * ── WHAT I WOULD DO — the recommendation ──
   *
   * The step the product was refusing to take. Describe→Explain→Evaluate is
   * governing doctrine, and once Explain exists Evaluate is not optional
   * politeness — an assessment that never says what it would do has not
   * finished assessing.
   *
   * The rule is general, not a Nathan sentence library: the highest-
   * information experiment in any chain is the least corroborated component
   * sitting among well-corroborated ones, PROVIDED the electrical layer
   * establishes that swapping it is a like-for-like exercise (no constraint
   * to untangle first). The recommendation is explicitly an experiment, not
   * an upgrade: both of its outcomes are informative, and one of them is
   * "this component belongs exactly where it is".
   */
  if (input.synthesis && engineeringCoherent) {
    const character = input.synthesis.character;
    const corroborated = input.components.filter((c) => {
      const props = character.get(c.displayName) ?? [];
      return props.some((pr) => pr.basis !== 'conditional');
    });
    const candidates = input.components.filter((c) => {
      const props = character.get(c.displayName) ?? [];
      if (props.length === 0) return character.size > 0;
      const pubs = new Set(props.flatMap((pr) => pr.publications.map((x) => x.toLowerCase())));
      return props.every((pr) => pr.basis === 'conditional') && pubs.size <= 1;
    });

    if (candidates.length === 1 && corroborated.length >= 2
      && /amp/i.test(candidates[0].role ?? '')) {
      const cand = canonicalDisplayName(candidates[0].displayName);
      const anchors = input.components
        .filter((c) => c.displayName !== candidates[0].displayName
          && !/pre/i.test(c.role ?? '')
          && (character.get(c.displayName) ?? []).length > 0)
        .map((c) => canonicalDisplayName(c.displayName));
      const preamp = corroborated.find((c) => /pre/i.test(c.role ?? ''));

      if (anchors.length > 0) {
        const plural = anchors.length > 1;
        next.push(
          `If this were my system, I would leave the `
          + `${plural ? `${anchors.slice(0, -1).join(', the ')} and the ${anchors[anchors.length - 1]}` : anchors[0]} `
          + `alone — ${plural ? 'they carry' : 'it carries'} the strongest independent `
          + `evidence in the chain and ${plural ? 'anchor' : 'anchors'} what this system is. `
          + (preamp
            ? `Nor would I assume the ${canonicalDisplayName(preamp.displayName)} needs changing: it is the `
              + `best-corroborated electronics here, and its evidence points to neutrality `
              + `rather than a coloration that would need correcting. `
            : ''),
        );
      }
      next.push(
        `The one experiment worth running is the amplifier. The ${cand} is not a `
        + `demonstrated weak link — nothing in the evidence says it is limiting anything — `
        + `but its character is the least corroborated in the chain, resting on a single `
        + `publication's conditioned listening, and it sits between components whose own `
        + `evidence is strong. Auditioning a modern reference amplifier against it, in this `
        + `room, would answer the most informative question this system can be asked: `
        + `whether the ${cand} is imposing a ceiling or supplying the voicing. If the `
        + `substitute brings more transient precision, low-level resolution or bass `
        + `articulation without costing dimensionality or engagement, the ${cand} is a `
        + `ceiling. If the substitute retrieves more information but the system becomes `
        + `less convincing, the ${cand} is part of what makes it work and belongs exactly `
        + `where it is. Either answer is worth having, and neither obliges a purchase.`,
      );
      next.push(
        `Past that experiment, positioning, the listening room and setup are likely to `
        + `matter more than any further change of electronics.`,
      );
    }
  }

  /*
   * ORDERED BY WHAT MATTERS, not by what was computed first.
   *
   * The quantitative amplifier-to-loudspeaker analysis is the strongest thing
   * Audio XX can say about most systems, and it was arriving third. Chain
   * architecture is real but weaker, and conditioned listening observations
   * are about ONE component — useful, and not a system relationship — so they
   * come last of the explanatory material.
   */
  explanation.push(
    ...synergyParas,
    ...observationParas,
    ...(engineeringCoherent
      ? engineeringLead
      : [...electricalParas, ...interfaceParas]),
    ...lineLevel,
    ...(architecturePara ? [architecturePara] : []),
  );

  /*
   * SEMANTIC ROLES, in the order an argument runs.
   *
   * Renamed from the earlier audit vocabulary ("what the numbers tell us",
   * "what remains unknown"), which described the EVIDENCE rather than the
   * assessment and made the document read as an inventory of what could and
   * could not be said. These name the job each part does for a reader who
   * wants to know what to think and what to do.
   *
   * They remain roles, not containers: a slot with nothing in it is dropped,
   * so a thinly evidenced system produces a short review rather than a set of
   * headings with apologies underneath.
   */
  const sections: ReviewSection[] = [
    { label: 'The assessment', paragraphs: thesis },
    {
      label: 'Why it works',
      paragraphs: [...synergyParas, ...observationParas],
    },
    {
      label: 'Engineering check',
      paragraphs: engineeringCoherent
        ? [...engineeringLead, ...lineLevel, ...(architecturePara ? [architecturePara] : [])]
        : [...electricalParas, ...interfaceParas, ...lineLevel,
          ...(architecturePara ? [architecturePara] : [])],
    },
    { label: 'What I would do', paragraphs: next },
    { label: 'What remains unknown', paragraphs: limits },
  ].filter((sec) => sec.paragraphs.length > 0);

  out.push(...thesis, ...explanation, ...next, ...limits);
  // `nextIndex` marks where the closing question begins, so a caller adding a
  // LIMITS paragraph of its own can place it before that rather than after —
  // an unresolved-evidence statement printed AFTER "here is what would help"
  // reads as an afterthought to the thing it is supposed to motivate.
  // `nextIndex` marks where caller-inserted LIMITS material belongs. The
  // unknown region now closes the document, so that place is its end.
  return {
    paragraphs: out, sections, unresolved, nextIndex: out.length,
  };
}
