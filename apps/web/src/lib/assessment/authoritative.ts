/**
 * THE ONE AUTHORITATIVE ASSESSMENT.
 *
 * Audio XX had two lanes that could each author user-visible claims:
 *
 *   the EVIDENCE lane — dossiers, licensed relationships, composed review;
 *   the TRAIT/AXIS lane — catalog tendencies expanded into prose.
 *
 * They disagreed, and the trait lane was the one production showed. A Leben
 * CS600X with Klipsch Cornwall IV published "Nothing here needs changing",
 * "Leben CS600X resolves cleanly" and a two-paragraph listening narrative
 * — while Audio XX held ZERO manufacturer facts for the Leben and no
 * listening evidence for either. The evidence lane, asked the same question,
 * correctly reported the relationship as unresolved.
 *
 * Two lanes authoring the same document is not a rendering problem. It is an
 * epistemic one: whichever lane a surface happened to call decided whether
 * D-7 applied. Signed-out users got the weaker path; catalogued systems got a
 * confident essay and uncatalogued ones got restraint, which is precisely
 * backwards — catalog membership was deciding whether evidence was required.
 *
 * So there is now ONE assessment and many surfaces. Everything user-visible
 * passes through `licenseAssessment`, and the trait lane survives only as a
 * subordinate input whose claims must themselves be licensed.
 *
 * WHAT THE TRAIT LANE MAY NO LONGER AUTHOR
 *
 * Its prose is template expansion keyed to axis positions — `composeListening
 * Session` selected between three hard-coded openings by reading
 * `systemAxes`. No source, no conditions, no licensing. That cannot author:
 *
 *   verdicts             — an Evaluate conclusion needs established relations
 *   listening prediction — a sensory claim needs listening evidence
 *   recommendations      — needs an identified, licensed leverage point
 *   system character     — aggregating per-component axes is a rule nobody
 *                          established; difference is not cancellation
 *
 * WHAT SURVIVES
 *
 * Per-component character with its source and conditions attached, in YOUR
 * SYSTEM, where the dossier carries the basis beside it. A catalog claim
 * marked `direct_experience` or `manufacturer_intent` is licensed AS THAT —
 * an attributed claim of that class about ONE component. What it never
 * licensed was a system-level prediction about what a listener will hear.
 */
import type { AssessmentSnapshotV1 } from '../artifact/snapshot';
import type { DossierView } from '../evidence/dossier-presentation';
import { causalCoverage, type InterfaceCoverage } from '../artifact/causal-coverage';
import { verdictFromEvidence } from '../relational-explain';

export interface LicenceInput {
  /** Components in chain order, with roles — no role means no interface. */
  components: Array<{ name: string; role?: string }>;
  dossiers: DossierView[];
  /**
   * True when this snapshot's prose came from the TRAIT/AXIS lane, which
   * cannot license it. The evidence lane's own prose (the D-7 gated inference
   * path) is marked false and survives.
   */
  traitAuthored: boolean;
  /**
   * Relationships the ENGINE established from published data — a power
   * mismatch between a rated amplifier and a rated loudspeaker, for instance.
   *
   * These are licensed findings and must not be discarded. Magnepan's "the
   * amplifier can't drive these speakers" and the flawed reference's problem
   * finding both live here, and both are exactly the conclusions Audio XX
   * should state clearly. Coverage-derived relations are unioned with them.
   */
  engineRelations?: Array<{ kind: 'reinforcement' | 'constraint'; axis: string }>;
}

/**
 * The engine's display label for a role → the role vocabulary interfaces use.
 *
 * The chain carries "Amplifier" and "Speakers" for display; every interface
 * rule matches on 'amplifier' and 'speaker'. The two drifting apart is silent
 * and total — no role matches, so no interface exists, so nothing is examined
 * and nothing is reported missing. One normaliser, used by every caller.
 */
export function normalizeRole(label: string | undefined): string | undefined {
  const l = (label ?? '').toLowerCase().replace(/s$/, '');

  /*
   * PREAMPLIFIER IS TESTED FIRST, and it has to be.
   *
   * "pre-amplifier" CONTAINS "amplifier", so with the amplifier test first
   * every preamplifier was typed as a power amplifier — silently, and with
   * real consequences. In a chain like Nathan's (ARC Reference 5 preamp,
   * Butler Monads power amps) both components then carry the same role, the
   * interface layer takes the FIRST match as the amplification stage, and
   * Audio XX reasons about the preamplifier driving the loudspeakers while
   * ignoring the amplifier that actually does. The strongest finding it holds
   * would never be examined.
   *
   * The hyphen matters too: "pre-amp" matched nothing at all, so the most
   * natural short form produced NO role, and no role means no interface.
   */
  // Underscores count: the stored role values are `preamp` and `power_amp`,
  // and missing the underscore dropped every power amplifier out of the chain
  // — no role, no interface, and the amplifier-to-loudspeaker relationship
  // simply absent from a system that plainly has one.
  const bare = l.replace(/[\s_-]/g, '');
  if (bare.includes('preamp') || bare.includes('preamplifier')) return 'preamplifier';
  if (bare === 'poweramp' || bare.includes('poweramplifier')) return 'amplifier';
  if (l.includes('integrated')) return 'integrated';
  if (l.includes('amplifier') || l === 'amp') return 'amplifier';
  if (l.includes('speaker') || l.includes('loudspeaker')) return 'speaker';
  if (l.includes('headphone')) return 'headphone';
  if (l.includes('streamer')) return 'streamer';
  if (l.includes('dac') || l.includes('source')) return 'dac';
  if (l.includes('turntable')) return 'turntable';
  return undefined;
}

/**
 * Relationships the ENGINE established from published figures.
 *
 * `powerMatchAssessment` is a genuine evidence-licensed finding: it carries
 * `powerSource` and `sensitivitySource` provenance for the two numbers it
 * compares, and its `compatibility` tier is the conclusion drawn from them.
 * `unknown` means a figure was missing, which establishes nothing and must
 * not be read as "fine".
 *
 * Typed structurally rather than by importing the findings module, so the
 * licensing layer keeps no dependency on the engine's internals.
 */
export function engineRelationsFrom(findings: unknown):
Array<{ kind: 'reinforcement' | 'constraint'; axis: string }> {
  const f = findings as {
    bottleneck?: unknown;
    powerMatchAssessment?: { compatibility?: string };
  } | undefined | null;
  if (!f) return [];

  const out: Array<{ kind: 'reinforcement' | 'constraint'; axis: string }> = [];
  if (f.bottleneck) out.push({ kind: 'constraint', axis: 'power_load' });

  switch (f.powerMatchAssessment?.compatibility) {
    case 'optimal':
    case 'adequate':
      out.push({ kind: 'reinforcement', axis: 'power_load' });
      break;
    case 'strained':
    case 'mismatched':
      out.push({ kind: 'constraint', axis: 'power_load' });
      break;
    default:
      // 'unknown' or absent — a missing figure, not a finding.
      break;
  }
  return out;
}

/**
 * Every interface question this chain poses, and what the evidence settled.
 * Exposed so a surface can show its own coverage without recomputing it.
 */
export function coverageFor(input: LicenceInput): InterfaceCoverage[] {
  return causalCoverage({
    components: input.components.map((c) => ({
      displayName: c.name, role: c.role ?? '',
    })),
    dossiers: input.dossiers,
  });
}

/**
 * One paragraph naming what could not be established, and why.
 *
 * Grouped by cause rather than listed per interface: Nathan's two line-level
 * interfaces fail for one reason, and stating it twice reads as padding when
 * it is really a single missing class of evidence. Silence is preferable to
 * decorative explanation, so this is emitted only when something is actually
 * unresolved, and it names figures rather than saying "insufficient evidence".
 */
export function composeUnresolved(
  rows: InterfaceCoverage[],
  /** Interfaces another evidence source already settled. */
  engineCovered = false,
): string | undefined {
  /*
   * An interface another source settled is not unresolved.
   *
   * Coverage reads the DOSSIERS; the engine's power match reads the CATALOG.
   * When the catalog settles the amplifier-to-loudspeaker question and the
   * dossiers hold nothing, reporting both produced a document that
   * contradicted itself in consecutive sentences — "establishes one
   * compatibility finding" above "power output not held" below. Two evidence
   * sources disagreeing about what is known is a real thing to fix, not a
   * thing to print.
   */
  const open = rows.filter((r) => r.state === 'unresolved'
    && !(engineCovered && r.relationScope === 'power_load'));
  if (open.length === 0) return undefined;

  const byCause = new Map<string, InterfaceCoverage[]>();
  for (const r of open) {
    const k = r.cause ?? 'unknown';
    byCause.set(k, [...(byCause.get(k) ?? []), r]);
  }

  const parts: string[] = [];
  for (const [cause, group] of byCause) {
    const pairs = group.map((r) => `${r.from} to ${r.to}`).join(', and ');
    if (cause === 'incompatible_conditions') {
      // A refusal, not a gap. The figures exist; they describe different
      // conditions, and combining them would invent a measurement.
      parts.push(
        `${pairs}: both makers publish, but not under conditions that can be `
        + `compared — ${group.map((r) => r.detail).filter(Boolean).join('; ')}. `
        + `Audio XX does not combine figures measured under different conditions.`,
      );
    } else {
      parts.push(`${pairs}: ${group.map((r) => r.detail).filter(Boolean).join('; ')}.`);
    }
  }

  return `What this assessment could not establish, and the reason in each case — `
    + parts.join(' ');
}

/**
 * The shortest phrase naming the single missing figure, for the verdict.
 *
 * The casing is left alone. An earlier version lower-cased the first
 * character to make the phrase read mid-sentence and produced "leaves leben
 * CS600X power output unresolved" — a product name is a proper noun wherever
 * it appears, and mangling it makes the assessment look careless about the
 * one thing it is most careful about.
 */
function namedGap(rows: InterfaceCoverage[], engineCovered = false): string | undefined {
  // Same suppression as `composeUnresolved`, and for the same reason: naming a
  // figure as missing in the very sentence that reports a finding established
  // from it reads as the document arguing with itself.
  return rows.find((r) => r.missingFact
    && !(engineCovered && r.relationScope === 'power_load'))?.missingFact;
}

/**
 * Gate a snapshot to what the evidence licenses. Idempotent.
 *
 * The verdict is ALWAYS recomposed from established relations, on every path.
 * It is the sentence a listener is most likely to act on, and the one that
 * looks most harmless when unfounded — so it may never be carried over from a
 * payload, an axis reading, or a declared label.
 */
export function licenseAssessment(
  snapshot: AssessmentSnapshotV1,
  input: LicenceInput,
): AssessmentSnapshotV1 {
  const rows = coverageFor(input);
  const established = [
    ...rows.map((r) => r.relation).filter((r): r is NonNullable<typeof r> => !!r),
    ...(input.engineRelations ?? []),
  ];

  /*
   * THE VERDICT RULE — and the scope that goes with it.
   *
   * A relation is licensed FOR SOMETHING. `power_load` establishes what a
   * system can DO; it says nothing about what it sounds like, however many
   * such relations survive. Treating "established" as a single permission
   * was the first version of this gate, and it let a power-compatibility
   * finding license "Leben CS600X resolves cleanly" and "This system reads
   * rhythmically elastic" — tonal character riding in on a wattage
   * comparison, which is the original defect wearing a licence.
   *
   * A CONSTRAINT is the exception that matters. It is specific, it is derived
   * from published figures, and the engine's own wording for it ("the
   * amplifier can't drive these speakers") is more useful to a listener than
   * any generic restatement — so a constrained assessment keeps its verdict
   * and the guidance bounded by that constraint.
   *
   * Everything else on the trait path has its verdict recomposed from what
   * was actually established. For a compatibility-only system that yields a
   * deliberately narrow sentence rather than "Nothing here needs changing",
   * which is the whole point: a power finding is not a whole-system verdict.
   */
  const constrained = established.some((r) => r.kind === 'constraint');
  const engineCovered = (input.engineRelations ?? []).length > 0;
  const gap = namedGap(rows, engineCovered);

  const verdict = input.traitAuthored && !constrained
    ? verdictFromEvidence(undefined, established, gap)
    : snapshot.verdict || verdictFromEvidence(undefined, established, gap);

  const unresolved = composeUnresolved(rows, engineCovered);
  const systemReview = [
    ...(snapshot.systemReview ?? []),
    ...(unresolved ? [unresolved] : []),
  ];

  if (!input.traitAuthored) {
    // The evidence lane authored this prose under D-7 gating and states its
    // sources, so it stands. Its verdict is kept when it established
    // something and recomposed when it did not.
    return {
      ...snapshot,
      verdict: established.length > 0
        ? (snapshot.verdict || verdict)
        : verdictFromEvidence(undefined, [], gap),
      systemReview,
    };
  }

  /*
   * TRAIT-LANE MATERIAL, IN TWO CLASSES.
   *
   * Never licensed by anything this lane holds — removed unconditionally:
   *
   *   tonalSignature   `AxisReading.pole` is documented as "which pole the
   *                    SYSTEM commits to" — the aggregation of per-component
   *                    catalog axes into system character, which no
   *                    established rule licenses.
   *   standfirst       a one-line tonal summary of the whole chain.
   *   recognition      "This system reads rhythmically elastic" — the same
   *                    claim in another register.
   *   sections         Engineering prose, written from axis positions.
   *   operatingCondition  a stacked-trait caution, computed from axis
   *                    profiles — removed even under a constraint, because a
   *                    power finding licenses nothing tonal.
   *
   * Per-component character is NOT removed: it stays in YOUR SYSTEM beside
   * the basis that licenses it.
   *
   * Licensed only by an established CONSTRAINT — the actionable guidance that
   * constraint bounds. A recommendation to resolve a power mismatch is
   * licensed BY the power mismatch; the same sentence with nothing behind it
   * is an assertion.
   *
   * Prose is removed rather than rewritten. No phrasing of an unlicensed
   * claim becomes licensed by being softened, and a softened one is harder to
   * spot.
   */
  return {
    ...snapshot,
    verdict,
    systemReview,
    sections: constrained ? snapshot.sections : [],
    recommendation: constrained ? snapshot.recommendation : undefined,
    cost: constrained ? snapshot.cost : undefined,
    // ALWAYS removed, even under a constraint. `detectStackedTraits` runs on
    // component AXIS PROFILES, so "Stacked warmth may reduce transient
    // precision and spatial clarity" is system character assembled from
    // catalog axes — and a POWER constraint licenses guidance about power,
    // not a tonal caution that happens to sit beside it. This is the scope
    // rule doing its work: established is not a single permission.
    operatingCondition: undefined,
    actionVerdict: constrained ? snapshot.actionVerdict : undefined,
    standfirst: undefined,
    recognition: undefined,
    tonalSignature: undefined,
  };
}
