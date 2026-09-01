import { describe, it, expect } from 'vitest';
import { BRAND_PROFILES } from '../consultation';
import { extractSubjectMatches } from '../intent';

/**
 * Structural gate: an authored BrandProfile must be REACHABLE.
 *
 * Found 2026-08-15 while auditing coverage of a dealer's brand list. Three
 * profiles — Auditorium 23, Sugden, SPEC — were dark in production: the
 * editorial prose existed in BRAND_PROFILES, but the brand name was absent
 * from BRAND_NAMES in intent.ts, so subject extraction never produced a
 * brand match and the turn fell through to the unknown-product
 * clarification ("I don't have full catalog data on that specific model
 * yet"). Those three were exactly the Wave 1 "Brands as Containers"
 * editorial priorities — the authored work users could least afford to
 * lose.
 *
 * The cause is drift between two independently maintained lists:
 * recognition vocabulary (intent.ts) and editorial knowledge
 * (consultation.ts). Authoring a profile does not add the name to
 * recognition, and nothing failed when it didn't. This test makes that
 * silence loud: add a profile without a recognition entry and the suite
 * goes red naming the brand.
 */
describe('every authored BrandProfile is reachable from a chat query', () => {
  const recognised = (name: string) =>
    extractSubjectMatches(`tell me about ${name}`).some((m) => m.kind === 'brand');

  for (const bp of BRAND_PROFILES) {
    it(`"${bp.names[0]}" resolves to a brand subject`, () => {
      expect(bp.names.some(recognised)).toBe(true);
    });
  }
});

/**
 * The counter-pressure. Recognition is not free: BRAND_NAMES is matched by
 * substring with word boundaries, so a brand alias that is also an ordinary
 * English word fabricates subjects out of unrelated prose. Bare 'spec' is
 * the live example — it is a BrandProfile alias (SPEC Corporation) that is
 * deliberately NOT in BRAND_NAMES, because "spec sheet" and "what are the
 * specs" are far more common than the brand. The qualified forms carry it.
 *
 * These cases pin that judgment so a later well-meaning "SPEC isn't
 * matching bare" fix cannot land without confronting it.
 */
describe('ambiguous brand aliases do not fabricate subjects from ordinary prose', () => {
  const NON_MATCHES = [
    'what are the specs on this dac',
    'can you send me the spec sheet',
    'the spec sheet says 100 watts',
    'the auditorium was loud',
  ];
  for (const q of NON_MATCHES) {
    it(`"${q}" yields no brand subject`, () => {
      expect(extractSubjectMatches(q).filter((m) => m.kind === 'brand')).toEqual([]);
    });
  }

  const MATCHES: Array<[string, string]> = [
    ['tell me about SPEC Corporation', 'spec corporation'],
    ['tell me about Sugden', 'sugden'],
    ['tell me about Auditorium 23', 'auditorium 23'],
  ];
  for (const [q, expected] of MATCHES) {
    it(`"${q}" resolves to ${expected}`, () => {
      expect(extractSubjectMatches(q).map((m) => m.name)).toContain(expected);
    });
  }
});
