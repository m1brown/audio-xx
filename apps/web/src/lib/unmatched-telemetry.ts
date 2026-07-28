/**
 * H1 — unmatched-model demand telemetry (bounded, privacy-safe).
 *
 * Given a system-assessment result, returns the `unmatched_model` events to
 * emit so the most-frequently-submitted UNSUPPORTED gear can be ranked after
 * beta. This is pure demand telemetry — it inspects an already-computed result
 * and NEVER changes recognition, routing, confidence, graph integrity, or the
 * assessment.
 *
 * Event fires only on non-assessing outcomes:
 *   - clarification  → the unresolved model token(s) the resolver flagged
 *   - low_confidence → the unknown component token(s)
 * A successful assessment produces no events. Duplicate tokens within a single
 * submission are collapsed (each distinct token logged once).
 *
 * Privacy: `model` is a single product/brand token the user typed — never the
 * full submitted system string.
 *
 * Scope note: a component whose brand was not recognized at all is "dropped"
 * upstream and carries no token here, so it is not captured. Capturing raw
 * un-extracted text is a deliberate future step, gated on whether this
 * (brand-known / low-confidence) signal proves insufficient.
 */

export type UnmatchedModelReason = 'clarification' | 'low_confidence';

export interface UnmatchedModelEvent {
  /** A single product/brand token the user typed (never the full string). */
  model: string;
  reason: UnmatchedModelReason;
}

/** Minimal structural view of the assessment result (avoids import coupling). */
type ResultLike =
  | { kind: 'clarification'; clarification?: { unresolved?: Array<string | undefined> } | null }
  | { kind: 'low_confidence'; unknownComponents?: Array<string | undefined> }
  | { kind: string }
  | null
  | undefined;

export function collectUnmatchedModels(result: ResultLike): UnmatchedModelEvent[] {
  if (!result) return [];
  let tokens: Array<string | undefined> = [];
  let reason: UnmatchedModelReason;

  if (result.kind === 'clarification') {
    tokens = (result as { clarification?: { unresolved?: Array<string | undefined> } }).clarification?.unresolved ?? [];
    reason = 'clarification';
  } else if (result.kind === 'low_confidence') {
    tokens = (result as { unknownComponents?: Array<string | undefined> }).unknownComponents ?? [];
    reason = 'low_confidence';
  } else {
    return [];
  }

  const seen = new Set<string>();
  const events: UnmatchedModelEvent[] = [];
  for (const t of tokens) {
    const model = (t ?? '').trim();
    if (!model) continue;
    const key = model.toLowerCase();
    if (seen.has(key)) continue; // de-dupe within a single submission
    seen.add(key);
    events.push({ model, reason });
  }
  return events;
}
