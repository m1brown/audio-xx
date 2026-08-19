/**
 * Independent-review acquisition — slice 3.
 *
 * Discover and admit observations into the store. Nothing consumes them yet:
 * no D-12 use, no assessments, no product pages, no comparisons, no Critical
 * Consensus.
 *
 * The network half is a thin wrapper in the route. THIS module is the part
 * that decides anything, and it is pure so the whole pipeline can be proved
 * without a network: resolve the publication, admit under slice 1, store under
 * slice 2, and report which of the three outcomes occurred.
 *
 * The distinction that matters most here is between the two kinds of nothing:
 *
 *   ZERO COVERAGE   the search completed and no approved publication has
 *                   written about this product. A finding.
 *   LOOKUP FAILURE  the search did not complete usefully. A fact about our
 *                   request, and never evidence about the product.
 *
 * Collapsing them is the defect the corroboration layer already paid for once,
 * where a timeout became "your loudspeaker cannot be identified".
 */

import {
  canonicalPublicationName, publicationForHost,
} from './source-whitelist';
import {
  admitReviewObservation, type ReviewObservation, type RejectionReason,
} from './independent-review';
import { writeObservations } from './independent-review-store';

/** What acquisition returns. Three states, never two. */
export type AcquisitionOutcome =
  | { status: 'observations'; observations: ReviewObservation[]; rejected: RejectedCandidate[] }
  /** Search completed; no approved publication covers this product. A finding. */
  | { status: 'no_coverage'; rejected: RejectedCandidate[] }
  /** Search did not complete usefully. Not evidence. Never stored. */
  | { status: 'lookup_unknown'; detail: string };

export interface RejectedCandidate {
  productName?: string;
  publication?: string;
  sourceUrl?: string;
  reason: RejectionReason | 'publication_unresolvable' | 'publication_mismatch';
  detail?: string;
}

/** The shape a search result must arrive in. Everything is a claim until checked. */
export interface ReviewCandidate {
  productName?: string;
  publication?: string;
  reviewer?: string;
  sourceUrl?: string;
  publishedAt?: string;
  observationType?: string;
  claim?: string;
  quote?: string;
  axis?: string;
  direction?: string;
  condition?: { kind?: string; description?: string };
  appliesAcrossVariants?: boolean;
}

/**
 * Resolve a candidate's publication to its canonical whitelist name.
 *
 * The host is authoritative and the returned name is a claim about it. A model
 * may write "Hi-Fi+" where the registry says "HiFi+", and storing both would
 * split one publication's evidence into two identities — making a single
 * source look like two agreeing voices, which is exactly the kind of false
 * corroboration this regime exists to prevent.
 *
 * Where both resolve and disagree, the candidate is rejected rather than
 * silently trusting either: a Stereophile byline on a SoundStage! URL is a
 * malformed result, not a judgement call.
 */
export function resolveCandidatePublication(
  candidate: ReviewCandidate,
): { publication: string } | { reason: RejectedCandidate['reason']; detail?: string } {
  const byHost = candidate.sourceUrl ? publicationForHost(candidate.sourceUrl) : undefined;
  const byName = candidate.publication ? canonicalPublicationName(candidate.publication) : undefined;

  if (byHost && byName && byHost !== byName) {
    return { reason: 'publication_mismatch', detail: `${byName} claimed on ${byHost}'s domain` };
  }
  // Host first. A mirror carrying a publication's text resolves to nothing
  // here and is then rejected by admission's own domain check.
  if (byHost) return { publication: byHost };
  if (byName) return { publication: byName };
  return { reason: 'publication_unresolvable', detail: candidate.publication ?? candidate.sourceUrl };
}

const CONDITION_KINDS = new Set(
  ['break_in', 'setup', 'mode', 'associated_equipment', 'level', 'other']);

/**
 * Turn search candidates into stored observations.
 *
 * Storage happens only after slice-1 admission passes, and only for what
 * passed — a partially admissible batch stores its admissible half rather than
 * failing whole, because one bad candidate is not evidence about the others.
 */
export async function admitAndStore(
  canonicalProductName: string,
  productKey: string,
  candidates: ReviewCandidate[],
  now: number,
): Promise<AcquisitionOutcome> {
  const admitted: ReviewObservation[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const c of candidates) {
    const resolved = resolveCandidatePublication(c);
    if (!('publication' in resolved)) {
      rejected.push({ productName: c.productName, publication: c.publication,
        sourceUrl: c.sourceUrl, reason: resolved.reason, detail: resolved.detail });
      continue;
    }

    // A condition whose kind we do not recognise is dropped to `other` rather
    // than discarded: losing the condition entirely would be worse than
    // filing it imprecisely, because the condition is part of the licence.
    const condition = c.condition?.description?.trim()
      ? {
        kind: (CONDITION_KINDS.has(String(c.condition.kind))
          ? c.condition.kind : 'other') as ReviewObservation['condition'] extends undefined
          ? never : NonNullable<ReviewObservation['condition']>['kind'],
        description: c.condition.description.trim(),
      }
      : undefined;

    const observation: Partial<ReviewObservation> = {
      productKey,
      productName: c.productName?.trim(),
      publication: resolved.publication,
      reviewer: c.reviewer?.trim() || undefined,
      sourceUrl: c.sourceUrl,
      publishedAt: c.publishedAt,
      observationType: c.observationType as ReviewObservation['observationType'],
      claim: c.claim?.trim(),
      quote: c.quote?.trim() || undefined,
      axis: c.axis,
      direction: c.direction,
      condition,
      appliesAcrossVariants: c.appliesAcrossVariants === true,
      retrievedAt: now,
    };

    const verdict = admitReviewObservation(canonicalProductName, observation);
    if (verdict.admitted) {
      admitted.push(observation as ReviewObservation);
    } else {
      rejected.push({ productName: c.productName, publication: resolved.publication,
        sourceUrl: c.sourceUrl, reason: verdict.reason, detail: verdict.detail });
    }
  }

  if (admitted.length === 0) return { status: 'no_coverage', rejected };

  await writeObservations(admitted);
  return { status: 'observations', observations: admitted, rejected };
}
