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
import { readPowerFigures, pairAcrossLoads } from '@/lib/evidence/quantity-compatibility';

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
  unresolved: string[];
} {
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
    architecture.push(
      `The chain keeps every stage separate: ${src.component.displayName} as source, `
      + `${pre.component.displayName} handling gain and switching, and `
      + `${amp.component.displayName} driving the loudspeakers directly.`,
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

  if (architecture.length) out.push(architecture.join(' '));

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
   */
  if (spk && amp && ohms && outputLine && findLine(amp.dossier, 'power output')) {
    electrical.push(
      `Which of the amplifier's published figures applies is settled by the `
      + `loudspeaker: ${spk.component.displayName} states a nominal load of `
      + `${impedanceLine!.value}, so the maker's ${ohms}-ohm figure is the one `
      + `to read here rather than the ${ohms * 2}-ohm figure quoted first on most `
      + `specification sheets. What a nominal figure does not establish is how `
      + `demanding the loudspeaker actually is — that would need its impedance `
      + `minimum and phase behaviour, which are not published.`,
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

  if (electrical.length) out.push(electrical.join(' '));

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
    out.push(
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
  if (boundary.length) out.push(boundary.join(' '));

  if (input.coverageNote) out.push(input.coverageNote);

  // ── NEXT: what would actually close the gap ──────────────────────────
  //
  // Read from the dossiers rather than taken as an argument: the gaps are
  // already frozen in this snapshot, and a second channel for the same fact is
  // a second thing to keep in step.
  const gap = input.dossiers.flatMap((d) => d.gaps)[0];
  if (gap) {
    out.push(
      `The gap is narrow and specific: ${gap.replace(/\.$/, '')}. If you hold that `
      + `figure — it is usually on the specification sheet or in the back of the `
      + `manual — it alone would let Audio XX finish the headroom question. `
      + `Failing that, what you hear at the volumes you actually use is the `
      + `better evidence, which is why the question below is worth answering.`,
    );
  }

  return { paragraphs: out, unresolved };
}
