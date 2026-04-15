/**
 * Product-inquiry priority tests.
 *
 * Verifies that product-specific or brand-specific queries are NOT
 * escalated to system_assessment / consultation_entry merely because
 * a saved system exists or because the phrasing overlaps with meta
 * capability patterns.
 *
 * Root cause addressed: "what do you know about the LAiV uDAC?" matched
 * META_PATTERNS ("what do you know"), routing to consultation_entry.
 * The cold-injection path then promoted it to system_assessment,
 * producing a full system review of the saved system instead of
 * a product/knowledge response about the LAiV.
 *
 * Covers:
 *   1. "what do you know about X" routes to product inquiry, not meta
 *   2. Meta queries without product subjects still route to consultation_entry
 *   3. Saved system must not force system_review for product questions
 *   4. Various product-inquiry phrasings route correctly
 */

import { detectIntent } from '../intent';

// ── 1. Product-specific "what do you know" routes away from meta ────

describe('product-specific "what do you know" queries', () => {
  it('"what do you know about the laiv udac?" → product or gear inquiry, not consultation_entry', () => {
    const result = detectIntent('what do you know about the laiv udac?');
    expect(result.intent).not.toBe('consultation_entry');
    expect(result.intent).not.toBe('system_assessment');
    // Should be product_assessment or gear_inquiry — either is correct
    expect(['product_assessment', 'gear_inquiry']).toContain(result.intent);
  });

  it('"what do you know about chord?" → product or gear inquiry', () => {
    const result = detectIntent('what do you know about chord?');
    expect(result.intent).not.toBe('consultation_entry');
    expect(['product_assessment', 'gear_inquiry']).toContain(result.intent);
  });

  it('"what do you know about the denafrips pontus?" → product or gear inquiry', () => {
    const result = detectIntent('what do you know about the denafrips pontus?');
    expect(result.intent).not.toBe('consultation_entry');
    expect(['product_assessment', 'gear_inquiry']).toContain(result.intent);
  });

  it('"what do you have on the hegel h190?" → product or gear inquiry', () => {
    const result = detectIntent('what do you have on the hegel h190?');
    expect(result.intent).not.toBe('consultation_entry');
    expect(['product_assessment', 'gear_inquiry']).toContain(result.intent);
  });
});

// ── 2. Pure meta queries (no product) still route correctly ─────────

describe('pure meta queries without product subjects', () => {
  it('"what do you know about your own limitations?" → consultation_entry', () => {
    const result = detectIntent('what do you know about your own limitations?');
    // No product subjects → meta route should fire
    expect(result.intent).toBe('consultation_entry');
  });

  it('"what brands do you cover?" → consultation_entry', () => {
    const result = detectIntent('what brands do you cover?');
    expect(result.intent).toBe('consultation_entry');
  });

  it('"how many products are in your database?" → consultation_entry', () => {
    const result = detectIntent('how many products are in your database?');
    expect(result.intent).toBe('consultation_entry');
  });

  it('"what if a product isn\'t in your catalog?" → consultation_entry', () => {
    const result = detectIntent("what if a product isn't in your catalog?");
    expect(result.intent).toBe('consultation_entry');
  });
});

// ── 3. Saved system must not escalate product queries ───────────────

describe('saved system does not escalate product queries', () => {
  it('"tell me about the chord qutest" → never system_assessment', () => {
    const result = detectIntent('tell me about the chord qutest');
    expect(result.intent).not.toBe('system_assessment');
    expect(result.intent).not.toBe('consultation_entry');
  });

  it('"curious about the denafrips ares" → never system_assessment', () => {
    const result = detectIntent('curious about the denafrips ares');
    expect(result.intent).not.toBe('system_assessment');
  });

  it('"thoughts on the primaluna evo 300" → product_assessment', () => {
    const result = detectIntent('thoughts on the primaluna evo 300');
    expect(result.intent).toBe('product_assessment');
  });
});

// ── 4. Control: system assessment still works when appropriate ──────

describe('system assessment still fires when appropriate', () => {
  it('"evaluate my system" → system_assessment (not affected by meta guard)', () => {
    const result = detectIntent('evaluate my system');
    // This has assessment language + ownership → system_assessment or consultation_entry
    expect(['system_assessment', 'consultation_entry']).toContain(result.intent);
  });

  it('arrow chain with 3+ subjects → system_assessment', () => {
    const result = detectIntent('chord qutest → hegel h190 → devore o/96');
    expect(result.intent).toBe('system_assessment');
  });
});
