/**
 * The one assessment pipeline (MVP M2).
 *
 * Canonical text → engine → synthesized ArtifactPayload. This is exactly
 * what /artifact renders and exactly what a saved snapshot preserves —
 * a single code path, so the saved assessment is byte-identical to the
 * one the user just read.
 */
import { buildSystemAssessment } from '@/lib/consultation';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import { toCanonicalAssessment, type CanonicalAssessment } from '@/lib/artifact/canonical';
import type { ArtifactPayload } from '@/lib/artifact/types';
import type { EvidenceItem } from '@/lib/evidence/evidence-types';

export interface PipelineResult {
  payload: ArtifactPayload;
  contradictions: string[];
  /** The presentation-neutral Canonical Assessment Model — the boundary the
   *  shared Assessment Renderer consumes. Built from the same result, so the
   *  renderer never re-derives identity. */
  canonical: CanonicalAssessment;
}

/**
 * Run the full artifact pipeline. Null when the text does not resolve.
 *
 * `manufacturerEvidence` is the same site-level evidence the web assessment
 * consumes, passed in rather than read here so this stays synchronous and
 * testable. Omitting it is what the artifact path did before, and it is why
 * the printed assessment could report a pairing as unassessable while the web
 * assessment of the identical system named the constraint — one canonical
 * assessment cannot mean two answers depending on which surface asked.
 */
export function runArtifactPipeline(
  systemText: string,
  manufacturerEvidence: EvidenceItem[] = [],
): PipelineResult | null {
  const subjects = extractSubjectMatches(systemText);
  const { desires } = detectIntent(systemText);
  const result = buildSystemAssessment(systemText, subjects, null, desires, null, manufacturerEvidence);
  if (!result || result.kind !== 'assessment') return null;
  const { payload, contradictions } = synthesizeArtifact(result);
  const canonical = toCanonicalAssessment(payload, result);
  return { payload, contradictions, canonical };
}

/**
 * Engine version recorded on every snapshot. On Vercel this is the git
 * commit; locally 'dev'. Snapshots from different engine versions are
 * how "updated assessments as the engine evolves" stays honest.
 */
export function engineVersion(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
}
