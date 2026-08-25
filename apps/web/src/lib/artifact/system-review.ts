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
}

const lines = (d: DossierView): DossierLine[] => [...d.primary, ...d.secondary];

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
      `Gain and power are handled in separate boxes here, with `
      + `${pre.component.displayName} doing the first and `
      + `${amp.component.displayName} the second.`,
    );
  }

  const tubeStages = [pre, amp]
    .filter((x): x is NonNullable<typeof x> => !!x)
    .filter((x) => !!findLine(x.dossier, 'tube complement'));
  if (tubeStages.length >= 2) {
    const ampTubes = findLine(amp?.dossier, 'tube complement')?.value;
    architecture.push(
      `Both amplification stages are valve designs — the signal passes through `
      + `vacuum tubes twice between the source and the loudspeaker terminals`
      + (ampTubes ? `, the output stage built on the ${ampTubes.replace(/\.$/, '').replace(/^Butler Model /, 'Butler Model ')}` : '')
      + `. That is an architectural fact about the chain, not a prediction about `
      + `how it sounds; Audio XX does not hold listening evidence for these units.`,
    );
  } else if (tubeStages.length === 1) {
    const t = tubeStages[0];
    const tubes = findLine(t.dossier, 'tube complement')?.value;
    architecture.push(
      `${t.component.displayName} is a valve design${tubes ? ` — ${tubes.replace(/\.$/, '')}` : ''}, `
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

  // ── EXPLAIN: what independent observations do and do not establish ────
  //
  // Every Stereophile line Audio XX holds for the Rossini Apex carries a stated
  // comparison. That is worth saying out loud: a conditioned observation is
  // evidence about a DIFFERENCE, not about absolute character, and a reader who
  // is not told the condition will read it as the latter.
  for (const d of input.dossiers) {
    const obs = lines(d).filter((l) => l.sourceClass === 'listening_observation');
    if (obs.length === 0) continue;
    const conditioned = obs.filter((l) => / — only /.test(l.value));
    if (conditioned.length === 0) continue;
    const pub = obs[0].publication ?? 'the reviewer';
    observationParas.push(
      `The listening evidence Audio XX holds for ${d.displayName} comes from `
      + `${pub}, and ${conditioned.length === obs.length ? 'every one of those observations' : 'most of it'} `
      + `is stated under a specific comparison — against the earlier model, or `
      + `between one input and another. That makes it evidence about a DIFFERENCE `
      + `heard under a named condition, not a description of how the unit sounds `
      + `on its own, and it is reported that way in the dossier below. It supports `
      + `nothing about the other components in this chain.`,
    );
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
    next.push(
      `The gap is narrow and specific: ${gap.replace(/\.$/, '')}. If you hold that `
      + `figure — it is usually on the specification sheet or in the back of the `
      + `manual — it alone would let Audio XX finish the headroom question. `
      + `Failing that, what you hear at the volumes you actually use is the `
      + `better evidence, which is why the question below is worth answering.`,
    );
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
    ...electricalParas,
    ...lineLevel,
    ...(architecturePara ? [architecturePara] : []),
    ...observationParas,
  );

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

    thesis.push(
      `${amp.component.displayName} into ${spk.component.displayName} is the one `
      + `interface in this system that the published evidence lets Audio XX `
      + `assess quantitatively. The makers' own figures establish compatibility `
      + `at${load ? ` the ${spk.component.displayName}'s nominal ${load} load` : ' the stated load'}.`
      + limitClause,
    );
  }

  /*
   * SEMANTIC SLOTS, suppressed when empty.
   *
   * The thesis existed but arrived after several weaker paragraphs, so a
   * reader met the argument's conclusion last. These are the roles the
   * material already plays; naming them lets the document lead with the
   * finding and lets a sparsely evidenced system stay short — a heading with
   * nothing under it is filler, and filler is what the licensing work spent
   * this month removing.
   */
  const sections: ReviewSection[] = [
    { label: 'The main finding', paragraphs: thesis },
    { label: 'What the numbers tell us', paragraphs: electricalParas },
    {
      label: 'How the system fits together',
      paragraphs: [...lineLevel, ...(architecturePara ? [architecturePara] : [])],
    },
    { label: 'What the listening evidence adds', paragraphs: observationParas },
    { label: 'What remains unknown', paragraphs: limits },
    { label: 'What would help next', paragraphs: next },
  ].filter((sec) => sec.paragraphs.length > 0);

  out.push(...thesis, ...explanation, ...limits, ...next);
  // `nextIndex` marks where the closing question begins, so a caller adding a
  // LIMITS paragraph of its own can place it before that rather than after —
  // an unresolved-evidence statement printed AFTER "here is what would help"
  // reads as an afterthought to the thing it is supposed to motivate.
  return {
    paragraphs: out, sections, unresolved, nextIndex: out.length - next.length,
  };
}
