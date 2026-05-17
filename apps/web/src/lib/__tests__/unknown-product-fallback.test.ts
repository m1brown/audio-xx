/**
 * QA C1 — unknown product fallback (trust calibration).
 *
 * Audio XX previously left a silent-empty path when:
 *   - the curated consultation builder returned null, AND
 *   - LLM inference returned null (no API key, timeout, network
 *     error, degenerate output), AND
 *   - the user's message produced no extracted subjectName.
 *
 * The page.tsx consumer gated its hedged fallback behind
 * `if (subjectName)`, so the third case fell through to a downstream
 * gear-inquiry/shopping/diagnosis path that wasn't designed for an
 * unknown subject. Users experienced an empty or generic response
 * that read as the advisor failing rather than being appropriately
 * uncertain.
 *
 * The fix: `buildUnknownProductFallback(subjectName?)` is a named,
 * unit-testable template the consumer now invokes unconditionally
 * when inference returns null. These tests guard:
 *
 *   1. Unknown product (subject extracted) does not return empty;
 *      the response is non-trivial and references the subject.
 *   2. Unknown product (no subject extracted) does not return empty;
 *      the response asks the user for the missing information.
 *   3. The fallback is hedged — it does not claim catalog-verified
 *      status, does not declare a "best" or top-pick verdict.
 *   4. No fabricated specifics — no $price tokens, no measurement
 *      units (dB / W / Hz / Ω), no review-style summary verbs
 *      ("according to / reviewers say / consensus is").
 *   5. The known-product path is untouched — this fallback never
 *      runs for a successful inference result and is structurally
 *      separate from the curated catalog path.
 */

import { describe, it, expect } from 'vitest';
import {
  buildUnknownProductFallback,
} from '../llm-product-inference';
import type { ConsultationResponse } from '../consultation';

// ── Helpers ──────────────────────────────────────────────

function joinResponseText(r: ConsultationResponse): string {
  return [r.subject, r.philosophy, r.tendencies, r.systemContext, r.followUp]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join(' ');
}

const FABRICATION_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  // Price tokens — no dollar amounts in a fallback that admits no data.
  { name: 'price token', pattern: /\$\s?\d/ },
  // Measurement units — fabricated specs are the prime trust risk.
  { name: 'decibel spec', pattern: /\b\d{1,3}\s?dB\b/i },
  { name: 'watt spec', pattern: /\b\d{1,4}\s?W\b/ },
  { name: 'hertz spec', pattern: /\b\d{1,5}\s?Hz\b/i },
  { name: 'impedance spec', pattern: /\b\d{1,4}\s?(?:Ω|ohms?)\b/i },
  // Reviewer-style consensus — Audio XX positioning forbids this voice.
  { name: 'reviewer consensus', pattern: /\b(?:according to (?:reviewers?|critics?)|reviewers? say|consensus (?:is|holds)|widely (?:praised|regarded))\b/i },
  // Authoritative ranking — uncertainty fallback must not declare bests.
  { name: 'best/top ranking', pattern: /\b(?:best|top[- ]rated|highest[- ]rated|number one|#\s?1)\b/i },
];

// ── 1. Unknown product (subject extracted) ──────────────

describe('QA C1 — unknown product with extracted subject', () => {
  const SUBJECTS = ['Auralic Vega', 'Topping E70', 'foo-bar-baz-9000'];

  it.each(SUBJECTS)('produces a non-empty hedged response for %s', (subject) => {
    const r = buildUnknownProductFallback(subject);
    expect(r).not.toBeNull();
    expect(r.subject).toBe(subject);

    // Each rendered field must be present and non-trivial. A passing
    // response here is what closes the silent-empty path — the same
    // failure mode the bug originally produced.
    expect(typeof r.philosophy).toBe('string');
    expect(r.philosophy!.length).toBeGreaterThan(40);
    expect(typeof r.tendencies).toBe('string');
    expect(r.tendencies!.length).toBeGreaterThan(40);
    expect(typeof r.followUp).toBe('string');
    expect(r.followUp!.length).toBeGreaterThan(10);
  });

  it('mentions the extracted subject in the response body', () => {
    const subject = 'Auralic Vega';
    const r = buildUnknownProductFallback(subject);
    const text = joinResponseText(r);
    expect(text).toContain(subject);
  });

  it('marks provenance as llm_inferred so the UI hedges the trust indicator', () => {
    const r = buildUnknownProductFallback('Auralic Vega');
    expect(r.source).toBe('llm_inferred');
  });
});

// ── 2. Unknown product (no subject extracted) ───────────

describe('QA C1 — unknown product with no extracted subject', () => {
  it.each([undefined, '', '   '])(
    'still produces a non-empty hedged response when subjectName is %p',
    (sn) => {
      const r = buildUnknownProductFallback(sn);
      expect(r).not.toBeNull();
      expect(typeof r.philosophy).toBe('string');
      expect(r.philosophy!.length).toBeGreaterThan(40);
      expect(typeof r.tendencies).toBe('string');
      expect(r.tendencies!.length).toBeGreaterThan(40);
      expect(typeof r.followUp).toBe('string');
      expect(r.followUp!.length).toBeGreaterThan(0);
    },
  );

  it('asks the user to name the product or brand when none was extracted', () => {
    const r = buildUnknownProductFallback(undefined);
    const text = joinResponseText(r).toLowerCase();
    // Must explicitly request the missing information — not just
    // restate the limit.
    expect(text).toMatch(/which (?:product|brand)|name(?:\s+the)?\s+(?:product|brand)|naming (?:the )?(?:product|brand)/);
  });

  it('does not fabricate a subject when none was supplied', () => {
    const r = buildUnknownProductFallback(undefined);
    // Subject should be a placeholder, not invented; "Unknown Product"
    // (used elsewhere in this module) or a deictic like "that one" is
    // acceptable. What's not acceptable is naming an invented brand.
    expect(r.subject.length).toBeLessThan(40);
    expect(r.subject).not.toMatch(/\b(?:Auralic|Topping|Chord|Denafrips|Harbeth|DeVore|Shindo|Leben|Pass)\b/);
  });
});

// ── 3. Hedging ──────────────────────────────────────────

describe('QA C1 — fallback is appropriately hedged', () => {
  it('acknowledges the limit ("don\'t have", "not sure", or equivalent)', () => {
    const named = buildUnknownProductFallback('Auralic Vega');
    expect(joinResponseText(named).toLowerCase()).toMatch(
      /don'?t have|not sure|couldn'?t|don'?t want to guess|won'?t (?:fabricate|invent)/,
    );

    const unnamed = buildUnknownProductFallback(undefined);
    expect(joinResponseText(unnamed).toLowerCase()).toMatch(
      /don'?t have|not sure|couldn'?t|don'?t want to guess|won'?t (?:fabricate|invent)/,
    );
  });

  it('does not claim catalog-verified status', () => {
    const r = buildUnknownProductFallback('Auralic Vega');
    const text = joinResponseText(r).toLowerCase();
    expect(text).not.toMatch(/\b(?:catalog[- ]verified|verified (?:in|by) (?:the )?catalog|in my verified)/);
  });
});

// ── 4. No fabricated specifics ──────────────────────────

describe('QA C1 — fallback contains no fabricated specifics', () => {
  it.each([
    'Auralic Vega',
    'Topping E70',
    'foo-bar-baz-9000',
    undefined,
    '',
  ])('contains no fabrication patterns for subjectName=%p', (sn) => {
    const r = buildUnknownProductFallback(sn);
    const text = joinResponseText(r);
    for (const { name, pattern } of FABRICATION_PATTERNS) {
      if (pattern.test(text)) {
        throw new Error(`Fabrication pattern "${name}" matched in fallback for subjectName=${JSON.stringify(sn)}: ${text}`);
      }
    }
  });
});

// ── 5. Known-product behavior unchanged ─────────────────

describe('QA C1 — fallback does not run on the known-product path', () => {
  it('buildUnknownProductFallback is structurally separate from the curated catalog path', () => {
    // This is a contract guard, not a runtime test. The fallback is
    // imported as a standalone export with no dependency on the
    // catalog. If a refactor later imports catalog-resolution into
    // this module, that's a structural drift worth catching.
    const r = buildUnknownProductFallback('Anything');
    // No product fields from the catalog should appear in the
    // fallback shape.
    expect(r).not.toHaveProperty('product');
    expect(r).not.toHaveProperty('matchedProducts');
    expect(r).not.toHaveProperty('catalogEntry');
    // No deterministic ranking / score / verdict fields either.
    expect(r).not.toHaveProperty('score');
    expect(r).not.toHaveProperty('verdict');
    expect(r).not.toHaveProperty('rank');
  });
});
