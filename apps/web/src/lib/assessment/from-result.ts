/**
 * ONE ASSESSMENT, MANY SURFACES — the single entry point.
 *
 * The conversation, the shared artifact, the saved snapshot and the signed-in
 * system page were each free to render the engine result their own way. Three
 * of them rendered the trait/axis payload directly, so the licensing gate that
 * lives in the snapshot builders never ran on the surfaces most people saw.
 *
 * Every one of them now calls this. It is deliberately the ONLY way to turn an
 * engine result into something renderable: a surface that wants to display an
 * assessment has exactly one function to call, and that function returns a
 * licensed assessment or nothing at all.
 *
 * It performs no reasoning. `synthesizeArtifact` and `toCanonicalAssessment`
 * are presentation adapters over a completed result, and `snapshotFromCanonical`
 * applies the licence. Nothing here reassesses, resolves a product, or reads a
 * catalog.
 */
import { synthesizeArtifact } from '../artifact/synthesizeArtifact';
import { toCanonicalAssessment } from '../artifact/canonical';
import { snapshotFromCanonical, type AssessmentSnapshotV1 } from '../artifact/snapshot';
import type { DossierView } from '../evidence/dossier-presentation';

export interface FromResultOptions {
  /** Component dossiers as the presentation layer resolved them. */
  dossiers?: DossierView[];
  /** Provenance only. Never a re-run key. */
  engineVersion?: string;
  createdAt?: string;
  coverageNote?: string;
}

/**
 * A licensed assessment from a completed engine result, or null when the
 * result is not an assessment at all.
 *
 * `findings` is passed through so the gate can see which relationships the
 * engine established. Without it a genuine constraint — a rated power mismatch
 * — would read as "nothing established" and be discarded as unlicensed. The
 * gate fails closed, which is the safe direction, but the finding is real and
 * must survive.
 */
export function authoritativeAssessment(
  raw: unknown,
  options: FromResultOptions = {},
): AssessmentSnapshotV1 | null {
  const result = raw as { kind?: string; findings?: unknown } | null | undefined;
  if (!result) return null;

  let payload;
  try {
    ({ payload } = synthesizeArtifact(result) as { payload: unknown });
  } catch {
    // A result the synthesizer cannot read is not an assessment to render.
    // Returning null lets the surface fall back to its own prose rather than
    // render half a document.
    return null;
  }
  if (!payload) return null;

  const cam = toCanonicalAssessment(payload as never, result as never);

  return snapshotFromCanonical(cam, {
    engineVersion: options.engineVersion ?? 'live',
    createdAt: options.createdAt ?? new Date().toISOString(),
    componentDossiers: options.dossiers,
    coverageNote: options.coverageNote,
    findings: result.findings,
  });
}
