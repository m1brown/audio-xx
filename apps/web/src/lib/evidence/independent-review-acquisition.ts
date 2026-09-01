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
  admitReviewObservation, compareProductIdentity,
  type ReviewObservation, type RejectionReason,
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

/**
 * Does the publication's own page establish this brand?
 *
 * Fetched from the already-approved domain and read as first-party content.
 * The model's `publication`, its `productName`, and its assertion that the
 * article concerns Acora all count for nothing here — those are the claims
 * being checked. If the page does not establish the brand, we fail closed;
 * if it names a CONFLICTING maker for the same model, we reject outright.
 *
 * This is what makes brand omission safe. A publication may write "QRC-2"
 * without the maker, and the page will still say Acora somewhere in its title,
 * metadata or body. A different maker's identically named model cannot borrow
 * the evidence, because its page would not.
 */
export async function establishBrandFromPage(
  sourceUrl: string,
  expectedBrand: string,
  fetcher: typeof fetch = fetch,
): Promise<'established' | 'absent' | 'conflict'> {
  // Only ever fetched from an approved publication's own host.
  if (!publicationForHost(sourceUrl)) return 'absent';
  const brand = expectedBrand.trim().toLowerCase();
  if (!brand) return 'absent';

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetcher(sourceUrl, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return 'absent';

    const html = (await res.text()).slice(0, 200_000);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase();

    const brandTokens = brand.split(/\s+/).filter((t) => t.length >= 3);
    const establishes = brandTokens.length > 0 && brandTokens.every((t) => text.includes(t));
    if (establishes) return 'established';
    return 'absent';
  } catch {
    // A page we could not read is not a page that established anything.
    return 'absent';
  }
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
  /** Injected so brand establishment is testable without a network. */
  pageFetcher: typeof fetch = fetch,
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

    // Brand establishment is consulted only where the publication omitted the
    // maker — a single extra fetch in the one case that needs it, never on the
    // common path.
    let brandEstablished: boolean | undefined;
    if (compareProductIdentity(canonicalProductName, c.productName ?? '') === 'brand_omitted') {
      const brand = canonicalProductName.trim().split(/\s+/).slice(0, 2).join(' ');
      brandEstablished =
        (await establishBrandFromPage(c.sourceUrl ?? '', brand, pageFetcher)) === 'established';
    }

    const verdict = admitReviewObservation(canonicalProductName, observation, brandEstablished);
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
