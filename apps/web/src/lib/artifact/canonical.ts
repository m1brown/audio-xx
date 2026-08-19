/**
 * Canonical Assessment Model (CAM) — Audio XX.
 *
 * The presentation-neutral assessment *content and provenance*. This is NOT the
 * finished artifact — the finished artifacts are the rendered expressions (Web
 * Artifact, Print Artifact, Share Projection). The CAM is the single typed
 * normalization boundary between the engine payload and the shared Assessment
 * Renderer, so one assessment renders many ways without two implementations.
 *
 * Phase 1 scope: only the semantic structure the approved Audio XX assessment
 * needs. Built by an ADAPTER from the existing ArtifactPayload (+ the raw
 * assessment result where richer fields are needed), not a schema migration.
 */
import type { ArtifactPayload } from './types';
import { committedPoles } from '../a3-artifact-case';

/**
 * The one evidence line shown on the artifact (detailed ledger is not exposed).
 *
 * Kept as the fully-evidenced wording and NO LONGER emitted unconditionally.
 * It was a constant: every artifact claimed "manufacturer documentation,
 * designer statements" whether or not a single manufacturer fact was held, so
 * the most prominent provenance statement in the product was the one thing in
 * it not derived from evidence. `evidenceStatementFor` replaces the constant
 * with the actual state; this remains the wording for the case where the claim
 * is true.
 */
export const EVIDENCE_STATEMENT =
  'Assessment based on manufacturer documentation, designer statements, and Audio XX analysis.';

/**
 * Describe the evidence this assessment actually stood on.
 *
 * Reads the same provenance the engine reasoned from — per-component axis
 * source, and the provenance recorded on the physical figures — so the label
 * and the reasoning can never disagree. One derivation, no second opinion.
 */
export function evidenceStatementFor(raw?: {
  findings?: {
    perComponentAxes?: Array<{ source?: string }>;
    powerMatchAssessment?: {
      ampPowerProvenance?: string; speakerSensitivityProvenance?: string;
    };
  };
}): string {
  const axes = raw?.findings?.perComponentAxes ?? [];
  const catalog = axes.filter((a) => a?.source === 'product').length;
  const brand = axes.filter((a) => a?.source === 'brand').length;
  const unread = axes.filter((a) => a?.source === 'inferred').length;

  const pm = raw?.findings?.powerMatchAssessment;
  const usedManufacturer = pm?.ampPowerProvenance === 'manufacturer'
    || pm?.speakerSensitivityProvenance === 'manufacturer';

  const parts: string[] = [];
  if (catalog > 0) parts.push('Audio XX’s curated catalogue');
  if (usedManufacturer) parts.push('manufacturer-published specifications');
  if (brand > 0) parts.push('documented maker design philosophy');

  const list = (xs: string[]) => xs.length === 1
    ? xs[0]
    : xs.length === 2
      ? `${xs[0]} and ${xs[1]}`
      : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;

  // With no sourced evidence at all, say that plainly rather than dressing
  // interpretation up as a basis.
  const basis = parts.length === 0
    ? 'Audio XX analysis alone, with no verified product evidence'
    : `${list(parts)}, interpreted by Audio XX`;

  // Naming what was NOT established is the half that makes the rest credible.
  const caveat = unread > 0
    ? ` ${unread === 1 ? 'One component' : `${unread} components`} could not be `
      + `identified; nothing here characterises ${unread === 1 ? 'it' : 'them'}.`
    : '';
  return `Assessment based on ${basis}.${caveat}`;
}

export interface AxisReading {
  axis: string;
  left: string;
  right: string;
  /** Which pole the system commits to, or neutral. */
  pole: 'left' | 'right' | 'neutral';
  /** Marker position 0–100 (left→right) for the renderer. */
  position: number;
}

/** A primary-source reference (manufacturer / designer / manual). Never a
 *  third-party reviewer, retailer, forum, or encyclopedia. */
export interface PrimarySource {
  label: string;
  url: string;
  /** manufacturer | designer | manual | technical */
  evidenceClass: 'manufacturer' | 'designer' | 'manual' | 'technical';
}

/** Editorial provenance of an educational fragment. INTERNAL — for QA and
 *  governance only; never rendered into the public artifact. Interpretation
 *  must read as interpretation (philosophy / likely consequence), not as a
 *  technical assertion. */
export type EditorialClass = 'manufacturer-fact' | 'designer-statement' | 'audio-xx-interpretation';
export interface EditorialFragment {
  text: string;
  editorialClass: EditorialClass;
  /** Which component the fragment concerns; absent for system-level synthesis. */
  component?: string;
}

export interface CanonicalAssessment {
  meta: { date: string; methodVersion?: string };
  subject: {
    components: Array<{
      name: string;
      photo?: { src: string; alt: string } | null;
      /** One concise origin/philosophy clause — primary-sourced or absent. */
      origin?: string;
      /** The primary source that licenses the origin clause. */
      source?: PrimarySource;
    }>;
  };
  identity: {
    verdict: string;
    signature?: string;
    recognition: string;
    tonalSignature?: AxisReading[];
  };
  guidance: { recommendation: string; oneCost?: string };
  /**
   * The single quantified figure the assessment turns on, when one exists —
   * the headroom ceiling on a power-matched pairing, for instance.
   *
   * It was reaching the web artifact and stopping there, so the printed and
   * shared assessment lost the most concrete thing in it: "≈ 87 dB — the most
   * this pairing plays cleanly" simply vanished. A canonical model that drops
   * the number is not the same assessment rendered differently.
   */
  keyDatum?: { value: string; caption: string };
  reading: {
    engineering: string[];
    listeningSession: string[];
    /** The single dominant characteristic — descriptive, not an argument or slogan. */
    dominantCharacter?: string;
    operatingCondition?: string;
  };
  evidence: { statement: string; primarySources?: PrimarySource[] };
  /** INTERNAL editorial provenance ledger — NOT rendered. Every educational
   *  fragment classified for QA/governance (manufacturer fact / designer
   *  statement / Audio XX interpretation). The renderer must never read this. */
  editorial?: EditorialFragment[];
}

// ── Dominant Character invariant ─────────────────────────
// The distilled dominant characteristic someone remembers after reading — a
// single sentence that ELABORATES the immutable identity. It may not argue,
// explain itself, or infer unverified designer/listener intent (teleology).
const DC_JUSTIFICATION_RE =
  /\b(because|therefore|thus|hence|consequently|as a result|which is why|that['’]s why|so that|in order to)\b/i;
// Teleological claims — intended outcome / designer intent — are not licensed
// without a cited primary source, which the artifact does not carry inline.
const DC_TELEOLOGY_RE =
  /\b(meant to|meant for|intended to|intended for|designed to|built to|made to|aims to|wants to|so you (?:can|hear|get)|for you to|the way it['’]s meant)\b/i;

/** Returns the failed-check names; empty array = a valid Dominant Character. */
export function validateDominantCharacter(line: string | undefined | null): string[] {
  const fails: string[] = [];
  const t = (line ?? '').trim();
  if (!t) { fails.push('empty'); return fails; }
  if (DC_JUSTIFICATION_RE.test(t)) fails.push('justifies');
  if (DC_TELEOLOGY_RE.test(t)) fails.push('teleology');
  // One characteristic, one sentence: reject a second full sentence.
  const sentences = t.split(/[.!?](?:\s+|$)/).map((s) => s.trim()).filter(Boolean);
  if (sentences.length > 1) fails.push('multi-sentence');
  return fails;
}

// ── tonal signature ──────────────────────────────────────
// Three-axis Tonal Signature (v1). `airy_closed` is intentionally NOT plotted —
// airiness is largely an emergent property (room, placement, recording), not a
// stable system coordinate. The engine keeps `airy_closed` internally for prose
// and future reasoning; spatial character is carried in words where the evidence
// supports it, never as a fixed chart coordinate.
const TONAL_AXES: Array<{ key: string; left: string; right: string; leftPole: string; rightPole: string }> = [
  { key: 'warm_bright', left: 'Warm', right: 'Bright', leftPole: 'warm', rightPole: 'bright' },
  { key: 'smooth_detailed', left: 'Smooth', right: 'Detailed', leftPole: 'smooth', rightPole: 'detailed' },
  { key: 'elastic_controlled', left: 'Elastic', right: 'Controlled', leftPole: 'elastic', rightPole: 'controlled' },
];

/** Numeric → marker position. resolveAxisIntensity values are ±1 from
 *  categorical leanings (±2 where explicit intensities exist); the plot
 *  clamps at ±1.5 so a strong lean sits near — never on — the pole.
 *  Within the ±0.35 balanced band (the same band the signature prose
 *  uses) the marker reads as neutral. */
function numericToReading(a: (typeof TONAL_AXES)[number], n: number): AxisReading {
  const clamped = Math.max(-1.5, Math.min(1.5, n));
  const position = Math.round(50 + clamped * 24);
  const pole = n < -0.35 ? ('left' as const) : n > 0.35 ? ('right' as const) : ('neutral' as const);
  return { axis: a.key, left: a.left, right: a.right, pole, position };
}

function tonalSignatureFromAxes(
  axes: Record<string, string> | undefined,
  numeric?: Record<string, number>,
): AxisReading[] | undefined {
  // Unified path (2026-08-13): plot the same role-weighted numeric averages
  // the signature prose reads — one aggregation, so graph and prose cannot
  // contradict each other, and the marker carries degree, not just direction.
  if (numeric && TONAL_AXES.every((a) => typeof numeric[a.key] === 'number')) {
    return TONAL_AXES.map((a) => numericToReading(a, numeric[a.key]));
  }
  // Legacy payloads (saved snapshots predating systemAxisNumeric): the
  // original categorical three-position mapping.
  if (!axes) return undefined;
  return TONAL_AXES.map((a) => {
    const v = axes[a.key];
    if (v === a.leftPole) return { axis: a.key, left: a.left, right: a.right, pole: 'left' as const, position: 24 };
    if (v === a.rightPole) return { axis: a.key, left: a.left, right: a.right, pole: 'right' as const, position: 78 };
    return { axis: a.key, left: a.left, right: a.right, pole: 'neutral' as const, position: 50 };
  });
}

// ── deterministic composers (Phase 1; A3 enhancement is a later envelope) ──
// These read real engine facts. They are the fallback that must always exist;
// a future A3 pass may propose richer prose, validated against the same rules.

/** The single voiced (non-neutral warm/smooth) component, if the system has one. */
function findVoicedComponent(raw: any): string | undefined {
  const per: any[] = raw?.findings?.perComponentAxes ?? [];
  const voiced = per.find((c) => c?.axes?.warm_bright === 'warm' || c?.axes?.smooth_detailed === 'smooth');
  return voiced?.name;
}

function composeListeningSession(raw: any, recognition: string): string[] {
  const strengths: string[] = raw?.response?.assessmentStrengths ?? [];
  const voiced = findVoicedComponent(raw);
  const base = `Put on something with air and inner detail and the system's priorities are audible immediately: leading edges are clean and quick, and the image extends wide without being pushed forward.`;
  const first = voiced
    ? `${base} The ${voiced}'s warmth keeps that resolution from reading as clinical.`
    : base;
  // Phase 3 (cohesive voice): the closing observation must belong to THIS
  // system's character — the previous universal "detail offered rather than
  // asserted" line appeared verbatim on every assessment, including tone-first
  // systems where it was not the story.
  const axesForClose: Record<string, string> = raw?.findings?.systemAxes ?? {};
  let second: string;
  if (axesForClose.warm_bright === 'warm' || axesForClose.smooth_detailed === 'smooth') {
    second = `Over a long evening the character holds. The warmth stays present without turning soft, and the system remains easy to live with at volume and after hours.`;
  } else if (axesForClose.smooth_detailed === 'detailed') {
    second = `Over a long evening the character holds. The detail is offered rather than asserted, so the system stays easy to live with at volume and after hours.`;
  } else {
    second = `Over a long evening the character holds. Nothing pushes forward and nothing falls away, so the system stays easy to live with at volume and after hours.`;
  }
  // If the engine named a strength, prefer the first line to reflect it, but keep it observational.
  void strengths; void recognition;
  return [first, second];
}

/* composeDominantCharacter() removed 2026-08-13.
 *
 * It selected between four hard-coded sentences keyed to the CATEGORICAL
 * systemAxes, which made it the last consumer of the pre-unification
 * aggregation: whenever a categorical pole sat inside the numeric balanced
 * band, the rendered line contradicted the Tonal Signature graph and the
 * standfirst on the same page (observed live on production, FRANCE system).
 *
 * The replacement is specified in docs/backlog/machine-voice-editorial.md:
 * name the component responsible for the character, computed from
 * per-component intensity x role weight against findings.systemAxisNumeric,
 * emitted only when one component clearly dominates a committed axis.
 * validateDominantCharacter() above is retained for that rebuild.
 */

/** Split the engine's case paragraphs from the operating-condition paragraph. */
function splitEngineeringAndCondition(
  caseParagraphs: string[],
  limitation: string | undefined,
): { engineering: string[]; operatingCondition?: string } {
  if (!limitation) return { engineering: caseParagraphs };
  const key = limitation.toLowerCase().slice(0, 24);
  const engineering = caseParagraphs.filter((p) => !p.toLowerCase().includes('placement') && !p.toLowerCase().includes(key));
  return { engineering: engineering.length ? engineering : caseParagraphs, operatingCondition: limitation };
}

// ── Educational layer (France only) ──────────────────────
// Origin/philosophy clauses, keyed by product, licensed ONLY by primary sources
// (manufacturer / designer). Products without a secured primary source get no
// clause (graceful degradation) — never a reviewer/retailer/forum/consensus fact.
// Entries exist only for the four France components; any other system degrades to
// absent until its own primary sources are secured.
// Each origin is authored as classified fragments (manufacturer fact / designer
// statement / Audio XX interpretation). Interpretation is worded as design
// philosophy or likely consequence — never a bare technical assertion. The
// rendered `origin` is the fragments joined; the classification is QA-only.
interface EduEntry { match: RegExp; fragments: EditorialFragment[]; source: PrimarySource; }
const FRANCE_EDU: EduEntry[] = [
  {
    match: /eversolo/i,
    source: { label: 'Eversolo — DMP-A6', url: 'https://www.eversolo.com/Product/index/model/DMP-A6/target/7abWHw++oHhKKmVViAFMcQ==.html', evidenceClass: 'manufacturer' },
    fragments: [
      { text: 'An all-in-one streaming DAC and preamplifier —', editorialClass: 'manufacturer-fact' },
      { text: 'the modern convergence idea, bringing source, conversion and control into one box.', editorialClass: 'audio-xx-interpretation' },
    ],
  },
  {
    match: /hugo/i,
    source: { label: 'Chord Electronics — Hugo', url: 'https://chordelectronics.co.uk/product/hugo', evidenceClass: 'designer' },
    fragments: [
      { text: 'A DAC and headphone amplifier from Chord Electronics (England), converting with a custom FPGA and WTA filters,', editorialClass: 'manufacturer-fact' },
      { text: 'custom-coded by Rob Watts —', editorialClass: 'designer-statement' },
      { text: 'a design philosophy that appears to prioritise timing and transient reconstruction.', editorialClass: 'audio-xx-interpretation' },
    ],
  },
  {
    match: /\bjob\b/i,
    source: { label: 'JOB / JobSys', url: 'https://jobsys.com/', evidenceClass: 'manufacturer' },
    fragments: [
      { text: 'An integrated amplifier from JOB Electronics, built around the JOB 225 power stage.', editorialClass: 'manufacturer-fact' },
    ],
  },
  {
    match: /wlm|diva/i,
    source: { label: 'Wiener Lautsprecher Manufaktur', url: 'https://www.wiener-lautsprecher-manufaktur.com/en-speaker', evidenceClass: 'manufacturer' },
    fragments: [
      { text: 'A high-efficiency monitor from Wiener Lautsprecher Manufaktur (Austria) —', editorialClass: 'manufacturer-fact' },
      { text: 'in the Austrian tradition of easy-to-drive designs, it should sit comfortably with low-power and tube amplification.', editorialClass: 'audio-xx-interpretation' },
    ],
  },
];
function franceEduFor(name: string): EduEntry | undefined {
  return FRANCE_EDU.find((e) => e.match.test(name));
}
function originText(e: EduEntry): string {
  return e.fragments.map((f) => f.text).join(' ');
}
function dedupeSources(list: PrimarySource[]): PrimarySource[] {
  const seen = new Set<string>();
  return list.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
}
// Reinforce/oppose — Audio XX interpretation (synthesis). Framed explicitly as a
// reading ("Read together…"), naming only primary-sourced schools; no Goldmund/
// Swiss claim; identity-consistent (affirms resolution; does not claim detail is
// traded away).
const FRANCE_REINFORCE_OPPOSE: EditorialFragment = {
  editorialClass: 'audio-xx-interpretation',
  text: 'Two design ideas meet here: a front end oriented to timing and resolution — the Chord Hugo’s custom FPGA is aimed at transient reconstruction — and a speaker in the musicality-first, high-efficiency Austrian tradition. Read together, they appear to pull in different directions — resolution against ease — and the system resolves that by letting the front end set detail and timing while the single warm-voiced component sets the final tonal balance.',
};

/**
 * Adapter — ArtifactPayload (+ optional raw result) → Canonical Assessment.
 * Richer fields (tonal signature, operating condition, listening session) come
 * from `raw`; with payload alone they degrade gracefully (omitted), so
 * snapshot/chat call sites keep working without a schema migration.
 */
export function toCanonicalAssessment(payload: ArtifactPayload, raw?: any): CanonicalAssessment {
  // Tonal axes: prefer the raw engine result, fall back to the copy carried in
  // the payload (Stabilization Gate 1). The three-axis Tonal Signature graph is
  // structurally required; it must render on payload-only surfaces (chat embed,
  // saved snapshots) — not only where a call site happens to thread `raw`.
  const axes: Record<string, string> | undefined = raw?.findings?.systemAxes ?? payload.systemAxes;
  const axesNumeric: Record<string, number> | undefined =
    raw?.findings?.systemAxisNumeric ?? payload.systemAxisNumeric;
  const limitations: string[] = raw?.response?.assessmentLimitations ?? [];
  const limitation = limitations[0];
  const { engineering, operatingCondition } = splitEngineeringAndCondition(payload.caseParagraphs ?? [], limitation);

  const components = (payload.componentCredit ?? []).map((name, i) => {
    const edu = franceEduFor(name);
    return { name, photo: payload.componentPhotos?.[i] ?? null, origin: edu ? originText(edu) : undefined, source: edu?.source };
  });
  const primarySources = dedupeSources(components.map((c) => c.source).filter(Boolean) as PrimarySource[]);

  // Reinforce/oppose only when both primary-sourced schools are present (France pairing).
  const hasChord = components.some((c) => /hugo/i.test(c.name));
  const hasWlm = components.some((c) => /wlm|diva/i.test(c.name));
  const reinforceOppose = hasChord && hasWlm;
  const engineeringOut = reinforceOppose ? [...engineering, FRANCE_REINFORCE_OPPOSE.text] : engineering;

  // INTERNAL editorial ledger (never rendered): every educational fragment classified.
  const editorial: EditorialFragment[] = [];
  for (const name of payload.componentCredit ?? []) {
    const edu = franceEduFor(name);
    if (edu) for (const f of edu.fragments) editorial.push({ ...f, component: name });
  }
  if (reinforceOppose) editorial.push(FRANCE_REINFORCE_OPPOSE);

  // Correction: the Diva Monitor bookshelf is not a passive-radiator design
  // (founder-confirmed; primary sources indicate bass-reflex). Strip the
  // unverified catalog detail rather than render a false claim.
  const operatingConditionOut = operatingCondition
    ? operatingCondition.replace(/\s*from the passive radiator\b/gi, '').replace(/\s{2,}/g, ' ')
    : operatingCondition;

  // No dominant-character line until the rebuild lands (see note above).
  const dominantCharacter: string | undefined = undefined;

  return {
    meta: { date: payload.date, methodVersion: payload.edition },
    subject: { components },
    identity: {
      verdict: payload.verdict,
      signature: payload.standfirst,
      recognition: payload.recognition,
      tonalSignature: tonalSignatureFromAxes(axes, axesNumeric),
    },
    guidance: { recommendation: payload.recommendation, oneCost: payload.cost },
    keyDatum: payload.heroDatum,
    reading: {
      engineering: engineeringOut,
      listeningSession: raw ? composeListeningSession(raw, payload.recognition) : [],
      dominantCharacter,
      operatingCondition: operatingConditionOut,
    },
    evidence: {
      // Payload first: a saved snapshot or chat embed holds the payload and no
      // engine findings, and re-deriving there would understate the evidence
      // the assessment actually used. `raw` is the fallback for callers that
      // build a CAM from a payload predating the field.
      statement: payload.evidenceStatement ?? evidenceStatementFor(raw),
      primarySources: primarySources.length ? primarySources : undefined,
    },
    editorial: editorial.length ? editorial : undefined,
  };
}

/** Convenience for callers that hold the committed poles directly (tests). */
export { committedPoles };
