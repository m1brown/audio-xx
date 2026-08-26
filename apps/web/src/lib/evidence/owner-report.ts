/**
 * Owner and community evidence — its own class, permanently.
 *
 * A person who has lived with a component for a year knows things no reviewer
 * does, and a person who swapped ONE box in an otherwise unchanged system has
 * run an experiment no publication can afford to run. That is the case for
 * admitting this evidence at all. It is also the whole of the case: an owner
 * report is a report, and the moment it is allowed to read as measurement, as
 * a professional review, or as the maker's own statement, Audio XX has
 * laundered an anecdote into a fact.
 *
 * SO THE CLASS NEVER CONVERTS. There is no promotion path, no confidence
 * threshold at which an owner report becomes a review, and no merge with the
 * `ReviewObservation` store. They are separate types in separate files with
 * separate admission, and the ledger prints them under their own heading. A
 * hundred agreeing owners are a hundred agreeing owners.
 *
 * WHAT FREQUENCY DOES AND DOES NOT BUY. Repetition across genuinely
 * independent people is worth something — it is the difference between one
 * person's room and a pattern — so several independent reports may support an
 * explicitly labelled owner-consensus signal. It does not buy objectivity.
 * Forums select for the enthusiastic, the newly-purchased and the
 * disappointed, and everyone reads everyone else, so agreement is partly
 * evidence about the product and partly evidence about the forum. The label
 * says "owners report" and never "the product is".
 *
 * WHY PAIRING REPORTS ARE THE VALUABLE PART. Audio XX's hardest question is
 * what two components do to one another, and separate reviews of each can
 * never answer it — the relational layer has to say "no reviewer heard these
 * together" every time. An owner who has actually run A into B HAS heard them
 * together. That is directly relevant where a professional review is merely
 * adjacent, and it is why a pairing report can inform SYSTEM REVIEW while
 * still sitting in the lower evidence class. Relevance and reliability are
 * different axes, and this module keeps them different.
 */

/** How the reporter came to hear it. `unclear` is rejected, not discounted. */
export type OwnerBasis =
  /** States they own it. */
  | 'stated_owner'
  /** Heard it at length in a system they describe — a loan, a dealer session. */
  | 'extended_audition'
  /** Ownership or listening not established. */
  | 'unclear';

/**
 * Platforms whose posts carry enough context to be admissible at all.
 *
 * Not a quality ranking — every one of these hosts nonsense alongside expert
 * owners, and this list cannot tell them apart. It records where a post has a
 * durable URL, a persistent author handle and a thread a reader can go and
 * check, which is the minimum for attribution to mean anything.
 */
export const OWNER_PLATFORMS: readonly string[] = [
  'Reddit', 'Audiogon', "What's Best Forum", 'AudioCircle',
  'Steve Hoffman Forums', 'diyAudio', 'Head-Fi', 'PS Audio Forums',
] as const;

export interface OwnerReport {
  platform: string;
  sourceUrl: string;
  /** The handle as posted. Attribution, never an identity claim about a person. */
  author: string;
  /**
   * Every product the claim is about.
   *
   * Two or more entries makes this a PAIRING report — the reporter heard
   * these components together, which is the thing no separate review
   * establishes.
   */
  productKeys: string[];
  productNames: string[];
  basis: OwnerBasis;
  /** The rest of the system, as stated. Required for a pairing claim. */
  associatedEquipment: string[];
  /** Audio XX's faithful paraphrase. */
  claim: string;
  /** A named product they compared against. */
  comparedWith?: string;
  /**
   * They changed ONE thing in an otherwise unchanged system.
   *
   * The strongest form owner evidence takes, and the reason to seek it out:
   * the rest of the chain, the room and the listener are held constant, which
   * is the control a show report and a magazine loan both lack.
   */
  changedWithinSystem?: boolean;
  retrievedAt: number;
}

export type OwnerRejection =
  | 'platform_not_recognised'
  | 'ownership_not_established'
  | 'no_product_identified'
  | 'missing_attribution'
  | 'malformed_source_url'
  | 'pairing_without_system_context';

export type OwnerVerdict =
  | { admitted: true }
  | { admitted: false; reason: OwnerRejection; detail?: string };

/**
 * Whether one report may be stored at all.
 *
 * Stricter than the review gate in the one place that matters: a reviewer's
 * job title establishes that they heard the thing, and an anonymous poster's
 * does not, so ownership has to be stated rather than assumed. Anything that
 * only might be an owner is rejected — "someone on a forum said" is not
 * evidence Audio XX has any business repeating.
 */
export function admitOwnerReport(report: Partial<OwnerReport>): OwnerVerdict {
  const no = (reason: OwnerRejection, detail?: string): OwnerVerdict =>
    ({ admitted: false, reason, detail });

  if (!report.platform || !OWNER_PLATFORMS.includes(report.platform)) {
    return no('platform_not_recognised', report.platform);
  }
  if (!report.sourceUrl || !/^https?:\/\//i.test(report.sourceUrl)) {
    return no('malformed_source_url', report.sourceUrl);
  }
  if (!report.author?.trim()) return no('missing_attribution');
  if (!report.basis || report.basis === 'unclear') {
    return no('ownership_not_established', report.basis);
  }
  if (!report.productKeys?.length || !report.productNames?.length) {
    return no('no_product_identified');
  }
  if (!report.claim?.trim()) return no('no_product_identified', 'empty claim');

  /*
   * A pairing claim without the rest of the system is unusable. "These two
   * sound great together" says nothing when the speakers, the room and the
   * cabling are unknown — those are the variables the claim is implicitly
   * holding constant, and a reader cannot judge whether their own system
   * resembles it.
   */
  if (report.productKeys.length > 1 && !report.associatedEquipment?.length) {
    return no('pairing_without_system_context');
  }
  return { admitted: true };
}

/** A report about two or more components heard together. */
export function isPairingReport(report: OwnerReport): boolean {
  return report.productKeys.length > 1;
}

/**
 * What a single report licenses, phrased so it can never read as fact.
 *
 * The subject is the OWNER, not the product. That is not decoration: "the
 * A100 is dark" and "one owner described the A100 as dark" differ in what
 * they claim about the world, and only the second is supported.
 */
export function ownerStatement(report: OwnerReport): string {
  const who = report.basis === 'stated_owner' ? 'One owner' : 'One listener';
  const where = report.associatedEquipment.length
    ? `, in a system using ${report.associatedEquipment.join(', ')}`
    : '';
  const control = report.changedWithinSystem
    ? ' They reported changing only this component, leaving the rest of the system in place.'
    : '';
  return `${who} of the ${report.productNames.join(' and ')} reported on `
    + `${report.platform} that ${lowerFirst(report.claim)}${where}.${control}`;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export interface OwnerConsensus {
  productKey: string;
  /** Distinct authors. Never fewer than three. */
  authors: string[];
  reports: OwnerReport[];
  statement: string;
}

/**
 * Whether several reports amount to a labelled consensus signal.
 *
 * Three genuinely independent authors is the floor, and independence is
 * checked on both author AND thread: two posts by one person are one opinion,
 * and three replies inside one thread are a conversation rather than three
 * observations. Neither check is sufficient — people do read each other — but
 * without them the count measures nothing at all.
 *
 * Returns undefined rather than a weaker signal. There is no such thing as a
 * two-owner consensus; two reports remain two reports, each attributed.
 */
export function ownerConsensus(
  productKey: string,
  productName: string,
  reports: OwnerReport[],
): OwnerConsensus | undefined {
  const mine = reports.filter((r) => r.productKeys.includes(productKey));
  const authors = [...new Set(mine.map((r) => r.author.toLowerCase().trim()))];
  const threads = [...new Set(mine.map((r) => r.sourceUrl.split('#')[0]))];
  if (authors.length < 3 || threads.length < 2) return undefined;

  return {
    productKey,
    authors: [...new Set(mine.map((r) => r.author))],
    reports: mine,
    statement: `${authors.length} owners of the ${productName}, posting independently across `
      + `${threads.length} threads, describe it in similar terms. This is an owner-consensus `
      + `signal, not a measurement and not a published review: forums select for people with `
      + `something to say, and readers influence one another, so agreement here is partly `
      + `evidence about the product and partly evidence about the forum.`,
  };
}
