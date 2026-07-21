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
import type { ArtifactPayload } from '@/lib/artifact/types';

export interface PipelineResult {
  payload: ArtifactPayload;
  contradictions: string[];
}

/** Run the full artifact pipeline. Null when the text does not resolve. */
export function runArtifactPipeline(systemText: string): PipelineResult | null {
  const subjects = extractSubjectMatches(systemText);
  const { desires } = detectIntent(systemText);
  const result = buildSystemAssessment(systemText, subjects, null, desires);
  if (!result || result.kind !== 'assessment') return null;
  const { payload, contradictions } = synthesizeArtifact(result);
  return { payload, contradictions };
}

/**
 * Engine version recorded on every snapshot. On Vercel this is the git
 * commit; locally 'dev'. Snapshots from different engine versions are
 * how "updated assessments as the engine evolves" stays honest.
 */
export function engineVersion(): string {
  return process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev';
}
