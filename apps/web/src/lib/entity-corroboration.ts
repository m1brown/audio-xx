/**
 * Entity corroboration — does this product actually exist?
 *
 * Audio XX cannot curate every legitimate audio product, and it should not
 * have to before it can discuss one. Expanded Reasoning exists to supply that
 * breadth. But Control 4 established that the model cannot be the one to say
 * whether it knows a product: on identical input, the fictional "Qwibble Q1"
 * alternated between correctly unknown and confidently characterised. A model
 * may not grant itself permission to use model knowledge.
 *
 * Corroboration is the missing independent signal. It answers exactly one
 * question — "is this a real identifiable audio product?" — and nothing else.
 *
 *   CURATED       catalog / brand evidence inside Audio XX
 *   CORROBORATED  independently shown to exist → Expanded Reasoning permitted
 *   USER-SUPPLIED listener named it, nothing corroborates it → node only
 *   UNKNOWN       no usable identity → fail closed
 *
 * IMPORTANT SCOPE LIMIT: corroboration establishes IDENTITY, never QUALITY.
 * That a product exists says nothing about whether a later claim about how it
 * sounds is true. Corroborated components remain at Expanded Reasoning
 * authority and are labelled as such; corroboration never promotes a claim.
 *
 * This module holds the deterministic half — what counts as acceptable
 * evidence. The network lookup is isolated behind a single injected fetcher so
 * the policy can be tested without a network, and so a search failure can
 * never do anything except fail closed.
 */

/**
 * THREE STATES, NOT TWO.
 *
 * A real listener's loudspeaker was labelled "your description only" and the
 * assessment asked them to identify a product Audio XX identifies correctly on
 * demand. The lookup had simply failed on that turn — and a failed lookup was
 * indistinguishable from a completed one that found nothing.
 *
 *   corroborated    the lookup completed and the evidence was accepted
 *   uncorroborated  the lookup COMPLETED and genuinely failed to verify —
 *                   the product was not found, the only source was
 *                   third-party, or the page does not name this product
 *   lookup_unknown  the lookup did not complete usefully — timeout, upstream
 *                   error, missing key, unparseable reply, malformed source
 *
 * The distinction is epistemic, not cosmetic. `uncorroborated` is a claim
 * about the PRODUCT; `lookup_unknown` is a fact about OUR REQUEST. Only the
 * first is evidence, and only the first may be cached as an answer.
 *
 * `unavailable` is retained as a deprecated alias so stored records and older
 * clients keep parsing; it means exactly `lookup_unknown`.
 */
export type CorroborationStatus =
  | 'corroborated'
  | 'uncorroborated'
  | 'lookup_unknown'
  /** @deprecated Same meaning as `lookup_unknown`. Retained for stored records. */
  | 'unavailable';

/** Does this status describe the product, or only our attempt to look it up? */
export function isEvidentialStatus(status: CorroborationStatus | undefined): boolean {
  return status === 'corroborated' || status === 'uncorroborated';
}

export type SourceKind = 'official' | 'manufacturer' | 'retailer' | 'other';

/** The only shape allowed back from a lookup. No prose, ever. */
export interface CorroborationRecord {
  /** Listener's text, normalised for cache keying. */
  normalizedName: string;
  status: CorroborationStatus;
  /** Manufacturer's own designation, when the source supports one. */
  canonicalName?: string;
  brand?: string;
  sourceUrl?: string;
  sourceKind?: SourceKind;
  /** How well the cited source matches the requested product, 0–1. */
  matchQuality?: number;
  checkedAt: number;
}

/** Cache lifetimes. A product's existence is near-static; its absence is not. */
export const POSITIVE_TTL_MS = 180 * 24 * 60 * 60 * 1000; // ~6 months, revalidate
export const NEGATIVE_TTL_MS = 14 * 24 * 60 * 60 * 1000;  // 2 weeks — new gear appears

/** Minimum match quality accepted in this first implementation. */
export const MIN_MATCH_QUALITY = 0.7;

export function normalizeProductName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^\w\s/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Distinctive tokens a citing page must actually contain.
 *
 * Category words carry no identifying weight — every amplifier page contains
 * "amplifier" — so a source that merely proves the CATEGORY exists is not
 * evidence that the PRODUCT does. This is the check that separates a genuine
 * manufacturer page from a plausible-looking URL.
 */
const CATEGORY_WORDS = new Set([
  'audio', 'hifi', 'hi-fi', 'stereo', 'amp', 'amps', 'amplifier', 'amplifiers',
  'dac', 'dacs', 'speaker', 'speakers', 'loudspeaker', 'loudspeakers',
  'streamer', 'streamers', 'preamp', 'preamplifier', 'turntable', 'headphone',
  'headphones', 'monoblock', 'monoblocks', 'system', 'series', 'the', 'and',
]);

export function identifyingTokens(name: string): string[] {
  return normalizeProductName(name)
    .split(/[\s/-]+/)
    // A short token containing a digit is kept: "QRC-9" vs "QRC-1" turns
// entirely on the digit, and dropping it let an invented model match a real
// neighbouring one in production.
    .filter((t) => (t.length >= 2 || /\d/.test(t)) && !CATEGORY_WORDS.has(t));
}

/**
 * Does the cited source actually identify the requested product?
 *
 * A returned URL is not evidence. The model can produce a plausible link for
 * anything, including a product that does not exist, so acceptance is decided
 * here rather than by the model's say-so.
 *
 * First implementation is deliberately strict: an official or manufacturer
 * source, a match quality at or above the floor, and the page's own title or
 * canonical name must carry the product's distinctive tokens. Weaker evidence
 * fails closed rather than widening policy — a listener is better served by
 * "your description only" than by a confident paragraph resting on a retailer
 * listing for something adjacent.
 */
/**
 * Why a candidate was rejected.
 *
 * The POLICY is unchanged and deliberately frozen — every decision below is
 * byte-for-byte the one it was before. What is new is that the caller can now
 * see WHY, because two different kinds of failure were being recorded as the
 * same epistemic claim:
 *
 *   genuine      the lookup completed and the evidence genuinely does not
 *                establish this product
 *   malformed    the reply was not usable — chiefly a `sourceUrl` that is not
 *                a URL. Production returned
 *                "https://www.acoraacoustics.com/ (via indication of QRC-2 on
 *                their site)" — a real address with commentary glued on. That
 *                is a defective response, not evidence about a loudspeaker,
 *                and it must be retried rather than believed.
 */
export type RejectionReason =
  | 'not_found'
  | 'source_missing'
  | 'source_kind'
  | 'match_quality'
  | 'malformed_url'
  | 'not_first_party'
  | 'token_mismatch';

/** Which rejections are defects in the REPLY rather than facts about the product. */
export function isMalformedRejection(reason: RejectionReason): boolean {
  return reason === 'malformed_url' || reason === 'source_missing';
}

export type CorroborationVerdict =
  | { accepted: true }
  | { accepted: false; reason: RejectionReason };

export function evaluateCorroboration(
  requestedName: string,
  candidate: {
    exists?: boolean;
    canonicalName?: string;
    sourceUrl?: string;
    sourceKind?: SourceKind;
    matchQuality?: number;
    sourceTitle?: string;
  },
): CorroborationVerdict {
  const no = (reason: RejectionReason): CorroborationVerdict => ({ accepted: false, reason });

  if (!candidate?.exists) return no('not_found');
  // `exists: true` with no source is an internally inconsistent reply: the
  // model asserted the product is real and then cited nothing. Treated as a
  // defective response, not as a finding.
  if (!candidate.sourceUrl) return no('source_missing');
  if (candidate.sourceKind !== 'official' && candidate.sourceKind !== 'manufacturer') return no('source_kind');
  if ((candidate.matchQuality ?? 0) < MIN_MATCH_QUALITY) return no('match_quality');

  // The URL must be a real absolute http(s) address, not a bare string.
  //
  // The whitespace check is not pedantry. Production returned
  //
  //   "https://www.acoraacoustics.com/ (via indication of QRC-2 on their site)"
  //
  // and `new URL()` accepted it — the constructor percent-encodes spaces
  // rather than throwing, so the commentary became part of the path and the
  // candidate was ACCEPTED. The stored source URL was then a 404, surfaced to
  // the listener as the page proving their loudspeaker exists. A URL
  // containing whitespace is a URL with prose attached: a defective reply, to
  // be retried rather than believed.
  if (/\s/.test(candidate.sourceUrl)) return no('malformed_url');
  let host: string;
  try {
    const u = new URL(candidate.sourceUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return no('malformed_url');
    host = u.host;
  } catch {
    return no('malformed_url');
  }
  if (!host) return no('malformed_url');

  // FIRST-PARTY DOMAIN CHECK. `sourceKind` is the model's own claim, and the
  // live stress test showed it labelling ecoustics.com and hifiverse.io as
  // "manufacturer". Publications and aggregators are not first-party evidence
  // of existence, so the host must itself carry an identifying token from the
  // requested product — acoraacoustics.com, butleraudio.com, dcsaudio.com,
  // audioresearch.com all do; ecoustics.com does not. This is decided here,
  // never by the model.
  const hostKey = host.toLowerCase().replace(/[^a-z0-9]/g, '');
  const brandTokens = identifyingTokens(requestedName).filter((t) => !/^\d+$/.test(t));
  if (!brandTokens.some((t) => hostKey.includes(t))) return no('not_first_party');

  // The source must name the product, not merely its category.
  const tokens = identifyingTokens(requestedName);
  if (tokens.length === 0) return no('token_mismatch');
  const haystack = [
    candidate.canonicalName ?? '',
    candidate.sourceTitle ?? '',
    candidate.sourceUrl,
  ].join(' ').toLowerCase();

  // EVERY identifying token must appear. A majority rule is not enough, and
  // the live stress test proved it twice:
  //
  //   "Qwibble Q1"        -> matched a real "Activo x DITA Q1" page. The token
  //                          "qwibble" never appeared, yet "q1" carried the
  //                          match. An invented product borrowed a real one's
  //                          model number.
  //   "dCS Rossini Zenith"-> matched the real "Rossini APEX" page. "dcs" and
  //                          "rossini" matched; "zenith" — the only token that
  //                          distinguishes the invented model — did not.
  //
  // In both cases the DISTINGUISHING token was the one missing, which is the
  // only token that matters. Brand existence, or a neighbouring model, must
  // never corroborate a model that does not exist.
  // A plural is the same identifier, not a different one. The listener wrote
  // "Butler Monads"; the manufacturer's product is the MONAD. Requiring the
  // literal string rejected a real product over an "s" — a morphology gap, not
  // a genuine mismatch. This does NOT loosen the rule: an invented token still
  // has to appear in some form, so "qwibble" is no closer to matching an
  // Activo page than it was before.
  const present = (t: string) =>
    haystack.includes(t)
    || (t.endsWith('s') && t.length > 3 && haystack.includes(t.slice(0, -1)))
    || haystack.includes(`${t}s`);

  const unmatched = tokens.filter((t) => !present(t));
  if (unmatched.length > 0) return no('token_mismatch');

  return { accepted: true };
}

/**
 * Boolean form of `evaluateCorroboration`.
 *
 * Kept because the frozen acceptance suite is written against it, and that
 * suite is the record that this policy did not move while the surrounding
 * failure handling was rebuilt.
 */
export function isCorroborationAcceptable(
  requestedName: string,
  candidate: Parameters<typeof evaluateCorroboration>[1],
): boolean {
  return evaluateCorroboration(requestedName, candidate).accepted;
}

/**
 * Is a cached record still usable?
 *
 * Only evidential states are cacheable at all — see `isEvidentialStatus`.
 * Caching a timeout would turn one bad minute into two weeks of a listener
 * being told their loudspeaker cannot be identified.
 */
export function isCacheFresh(record: CorroborationRecord, now: number): boolean {
  const age = now - record.checkedAt;
  if (record.status === 'corroborated') return age < POSITIVE_TTL_MS;
  if (record.status === 'uncorroborated') return age < NEGATIVE_TTL_MS;
  return false;
}

/** Records that may be written to the durable store. Never infrastructure failure. */
export function isCacheable(record: CorroborationRecord): boolean {
  return isEvidentialStatus(record.status);
}

/**
 * Decide a component's evidence tier.
 *
 * Curated evidence always wins — corroboration is only consulted when Audio XX
 * holds nothing of its own. Anything that is not corroborated stays at the
 * user-supplied tier, which is the fail-closed default for every error path:
 * timeout, ambiguity, malformed response, or search unavailable.
 */
export function tierFor(
  hasProduct: boolean,
  hasBrandProfile: boolean,
  corroboration: CorroborationStatus | undefined,
): 'catalog' | 'brand' | 'model' | 'user' {
  if (hasProduct) return 'catalog';
  if (hasBrandProfile) return 'brand';
  if (corroboration === 'corroborated') return 'model';
  // `lookup_unknown` lands here too, and correctly: without corroboration
  // there is no licence to describe the product. What changes is what may be
  // SAID about the silence — see the prompt contract in llm-system-inference.
  // A failed lookup is not permission to tell a listener their product could
  // not be identified.
  return 'user';
}
