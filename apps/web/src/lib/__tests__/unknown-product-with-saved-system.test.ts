/**
 * Regression: unknown-product routing must not collapse into
 * system_assessment or diagnosis when a saved system is attached.
 *
 * Smoke-tested observation on production (2026-05-18) — a tester
 * with a saved-system context asking "thoughts on the Buchardt A700"
 * received a generic SYSTEM REVIEW diagnosis of their saved chain
 * rather than a product assessment of the named product.
 *
 * Hard requirement: if the user explicitly asks about a product or
 * brand, the system addresses that product first, even when a saved
 * system is active. The saved system is preserved as context but
 * must not override the product inquiry.
 *
 * Downstream behavior under test (page.tsx:2421+):
 *   - intent === 'product_assessment' → buildProductAssessment runs
 *   - if the product isn't catalogued, the safety-check block at
 *     page.tsx:2473 emits a hedged "I don't have full catalog data
 *     on that specific model yet" clarification grounded in the
 *     synthesized subject name.
 */

import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

describe('P1 — unknown-product routing with saved system attached', () => {
  // Case 1 — the exact prompt that surfaced the bug on production.
  it('"thoughts on the Buchardt A700" routes to product_assessment with saved system attached', () => {
    const result = detectIntent('thoughts on the Buchardt A700', { hasActiveSavedSystem: true });
    expect(result.intent).toBe('product_assessment');
    expect(result.subjectMatches).toHaveLength(1);
    expect(result.subjectMatches[0].name).toBe('Buchardt A700');
    expect(result.subjectMatches[0].kind).toBe('product');
  });

  // Case 2 — known catalogued product must still address the product first.
  it('known-product inquiry still routes to product_assessment with saved system attached', () => {
    const result = detectIntent('thoughts on the Leben CS600X', { hasActiveSavedSystem: true });
    expect(result.intent).toBe('product_assessment');
    expect(result.subjectMatches.length).toBeGreaterThan(0);
    // Catalogued product, lower-cased canonical match
    expect(result.subjectMatches[0].name.toLowerCase()).toContain('leben');
  });

  // Case 3 — genuine diagnosis prompt must still route to diagnosis, even
  // with a saved system attached. The unknown-product gate must not over-fire.
  it('genuine diagnosis prompt still routes to diagnosis with saved system attached', () => {
    const result = detectIntent('why does my system sound fatiguing?', { hasActiveSavedSystem: true });
    expect(result.intent).toBe('diagnosis');
  });

  // Case 4 — generic "thoughts on this" / "tell me about the system" must
  // NOT collapse into product_assessment. The saved-system context can
  // still dominate when no specific product is named.
  it('generic non-product assessment phrases do not over-fire product_assessment', () => {
    const cases = [
      'thoughts on this',
      'tell me about the system',
      'what do you think of this setup',
      'thoughts on the rig',
    ];
    for (const prompt of cases) {
      const r = detectIntent(prompt, { hasActiveSavedSystem: true });
      expect(r.intent, `"${prompt}" should NOT route to product_assessment`).not.toBe('product_assessment');
    }
  });

  // Case 5 — multiple unknown-product trigger shapes route correctly.
  it('multiple unknown-product trigger shapes route to product_assessment with the user-typed name', () => {
    const cases: Array<[string, string]> = [
      ['what do you think of the Buchardt A700?', 'Buchardt A700'],
      ['tell me about the Buchardt A700',         'Buchardt A700'],
      ['is the Buchardt A700 a good fit?',        'Buchardt A700'],
      ['curious about the Buchardt A700',         'Buchardt A700'],
    ];
    for (const [prompt, expectedName] of cases) {
      const r = detectIntent(prompt, { hasActiveSavedSystem: true });
      expect(r.intent, `"${prompt}" should route to product_assessment`).toBe('product_assessment');
      expect(r.subjectMatches[0]?.name, `subject for "${prompt}"`).toBe(expectedName);
    }
  });

  // Case 6 — alphanumeric-only model identifier (no capitalized brand
  // word) still counts as a product candidate.
  it('alphanumeric model identifier alone triggers product_assessment', () => {
    const r = detectIntent('thoughts on the A700', { hasActiveSavedSystem: true });
    expect(r.intent).toBe('product_assessment');
    expect(r.subjectMatches[0]?.name).toBe('A700');
  });

  // Case 7 — saved system state does NOT change the routing outcome:
  // the same prompt routes the same way logged-in (saved) or logged-out.
  // This proves saved-system context does not override product inquiry.
  it('saved-system attachment does not change routing for unknown-product prompts', () => {
    const prompt = 'thoughts on the Buchardt A700';
    const withSaved = detectIntent(prompt, { hasActiveSavedSystem: true });
    const noSaved   = detectIntent(prompt, { hasActiveSavedSystem: false });
    expect(withSaved.intent).toBe(noSaved.intent);
    expect(withSaved.subjectMatches[0]?.name).toBe(noSaved.subjectMatches[0]?.name);
  });
});
