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

export type CorroborationStatus = 'corroborated' | 'uncorroborated' | 'unavailable';

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
export function isCorroborationAcceptable(
  requestedName: string,
  candidate: {
    exists?: boolean;
    canonicalName?: string;
    sourceUrl?: string;
    sourceKind?: SourceKind;
    matchQuality?: number;
    sourceTitle?: string;
  },
): boolean {
  if (!candidate?.exists) return false;
  if (!candidate.sourceUrl) return false;
  if (candidate.sourceKind !== 'official' && candidate.sourceKind !== 'manufacturer') return false;
  if ((candidate.matchQuality ?? 0) < MIN_MATCH_QUALITY) return false;

  // The URL must be a real absolute http(s) address, not a bare string.
  let host: string;
  try {
    const u = new URL(candidate.sourceUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    host = u.host;
  } catch {
    return false;
  }
  if (!host) return false;

  // FIRST-PARTY DOMAIN CHECK. `sourceKind` is the model's own claim, and the
  // live stress test showed it labelling ecoustics.com and hifiverse.io as
  // "manufacturer". Publications and aggregators are not first-party evidence
  // of existence, so the host must itself carry an identifying token from the
  // requested product — acoraacoustics.com, butleraudio.com, dcsaudio.com,
  // audioresearch.com all do; ecoustics.com does not. This is decided here,
  // never by the model.
  const hostKey = host.toLowerCase().replace(/[^a-z0-9]/g, '');
  const brandTokens = identifyingTokens(requestedName).filter((t) => !/^\d+$/.test(t));
  if (!brandTokens.some((t) => hostKey.includes(t))) return false;

  // The source must name the product, not merely its category.
  const tokens = identifyingTokens(requestedName);
  if (tokens.length === 0) return false;
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
  if (unmatched.length > 0) return false;

  return true;
}

/** Is a cached record still usable? */
export function isCacheFresh(record: CorroborationRecord, now: number): boolean {
  const age = now - record.checkedAt;
  if (record.status === 'corroborated') return age < POSITIVE_TTL_MS;
  if (record.status === 'uncorroborated') return age < NEGATIVE_TTL_MS;
  return false; // 'unavailable' is never cached as an answer
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
  return 'user';
}
