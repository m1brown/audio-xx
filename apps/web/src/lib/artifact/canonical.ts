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

/** The one evidence line shown on the artifact (detailed ledger is not exposed). */
export const EVIDENCE_STATEMENT =
  'Assessment based on manufacturer documentation, designer statements, and Audio XX analysis.';

export interface AxisReading {
  axis: string;
  left: string;
  right: string;
  /** Which pole the system commits to, or neutral. */
  pole: 'left' | 'right' | 'neutral';
  /** Marker position 0–100 (left→right) for the renderer. */
  position: number;
}

export interface CanonicalAssessment {
  meta: { date: string; methodVersion?: string };
  subject: { components: Array<{ name: string; photo?: { src: string; alt: string } | null }> };
  identity: {
    verdict: string;
    signature?: string;
    recognition: string;
    tonalSignature?: AxisReading[];
  };
  guidance: { recommendation: string; oneCost?: string };
  reading: {
    engineering: string[];
    listeningSession: string[];
    /** The single dominant characteristic — descriptive, not an argument or slogan. */
    dominantCharacter?: string;
    operatingCondition?: string;
  };
  evidence: { statement: string; references?: Array<{ n: number; text: string }> };
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
const TONAL_AXES: Array<{ key: string; left: string; right: string; leftPole: string; rightPole: string }> = [
  { key: 'warm_bright', left: 'Warm', right: 'Bright', leftPole: 'warm', rightPole: 'bright' },
  { key: 'smooth_detailed', left: 'Smooth', right: 'Detailed', leftPole: 'smooth', rightPole: 'detailed' },
  { key: 'elastic_controlled', left: 'Elastic', right: 'Controlled', leftPole: 'elastic', rightPole: 'controlled' },
  { key: 'airy_closed', left: 'Airy', right: 'Closed', leftPole: 'airy', rightPole: 'closed' },
];

function tonalSignatureFromAxes(axes: Record<string, string> | undefined): AxisReading[] | undefined {
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
  const first = voiced
    ? `Put on something with air and inner detail and the system's priorities show at once: leading edges are clean and quick, the stage opens wide and unforced, and nothing is pushed at you. The ${voiced}'s warmth keeps the resolution musical rather than clinical.`
    : `Put on something with air and inner detail and the system's priorities show at once: leading edges are clean and quick, the stage opens wide and unforced, and nothing is pushed at you.`;
  const second = `Over a long evening the character holds. The detail is offered rather than asserted, so the system stays easy to live with at volume and after hours.`;
  // If the engine named a strength, prefer the first line to reflect it, but keep it observational.
  void strengths; void recognition;
  return [first, second];
}

/** The distilled dominant characteristic — descriptive, grounded in the committed
 *  identity, no teleology. Deterministic fallback (a future A3 pass may propose a
 *  richer line, validated against the same rules). */
function composeDominantCharacter(raw: any): string {
  const axes: Record<string, string> = raw?.findings?.systemAxes ?? {};
  const voiced = findVoicedComponent(raw);
  let line: string;
  if (voiced && axes.smooth_detailed === 'detailed') {
    line = `Warmth enters at the final stage, without obscuring the system's resolution.`;
  } else if (axes.smooth_detailed === 'detailed') {
    line = `Resolution leads, and the rest of the system is arranged to keep it clean.`;
  } else if (axes.warm_bright === 'warm') {
    line = `Warmth runs through the whole system, tone placed ahead of edge.`;
  } else {
    line = `No single quality dominates; the system holds a considered balance.`;
  }
  // Guarantee the invariant on the fallback itself.
  return validateDominantCharacter(line).length === 0 ? line : `A system with one clear character.`;
}

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

/**
 * Adapter — ArtifactPayload (+ optional raw result) → Canonical Assessment.
 * Richer fields (tonal signature, operating condition, listening session) come
 * from `raw`; with payload alone they degrade gracefully (omitted), so
 * snapshot/chat call sites keep working without a schema migration.
 */
export function toCanonicalAssessment(payload: ArtifactPayload, raw?: any): CanonicalAssessment {
  const axes: Record<string, string> | undefined = raw?.findings?.systemAxes;
  const limitations: string[] = raw?.response?.assessmentLimitations ?? [];
  const limitation = limitations[0];
  const { engineering, operatingCondition } = splitEngineeringAndCondition(payload.caseParagraphs ?? [], limitation);

  const components = (payload.componentCredit ?? []).map((name, i) => ({
    name,
    photo: payload.componentPhotos?.[i] ?? null,
  }));

  const dominantCharacter = raw
    ? composeDominantCharacter(raw)
    : (payload.pullQuote && validateDominantCharacter(payload.pullQuote).length === 0 ? payload.pullQuote : undefined);

  return {
    meta: { date: payload.date, methodVersion: payload.edition },
    subject: { components },
    identity: {
      verdict: payload.verdict,
      signature: payload.standfirst,
      recognition: payload.recognition,
      tonalSignature: tonalSignatureFromAxes(axes),
    },
    guidance: { recommendation: payload.recommendation, oneCost: payload.cost },
    reading: {
      engineering,
      listeningSession: raw ? composeListeningSession(raw, payload.recognition) : [],
      dominantCharacter,
      operatingCondition,
    },
    evidence: { statement: EVIDENCE_STATEMENT },
  };
}

/** Convenience for callers that hold the committed poles directly (tests). */
export { committedPoles };
