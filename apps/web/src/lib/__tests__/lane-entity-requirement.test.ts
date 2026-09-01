import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

/**
 * A lane may not claim a turn without the entity that lane requires.
 *
 * Three production failures, one cause. Each lane's predicate admitted a
 * message that lacked the thing the lane exists to reason about, and the
 * downstream builder then invented the missing entity rather than failing:
 *
 *   "i want a new dac, and upgrade from a chord hugo - more resolution"
 *     → comparison, with no second product. The comparison branch printed
 *       four sentences about "the other product" and asked the user what
 *       drew them to it.
 *
 *   "tell me about shindo"
 *     → product_assessment, with no product. Shindo was rendered as a device
 *       with a spec subtitle ("the Shindo sits in that family"), and because
 *       page.tsx blocks product_assessment from the consultation path, the
 *       curated brand profile became unreachable by construction.
 *
 * The rule these tests pin is deliberately narrow: a comparison needs
 * something to compare against, and a product assessment needs a product.
 * Neither is a judgement about answer quality — both are about whether the
 * turn carries the entity the lane's reasoning depends on.
 */

describe('comparison requires a target', () => {
  it('does not treat a one-sided upgrade request as a comparison', () => {
    // The reported failure. One product named, a direction wanted, no target.
    const result = detectIntent('i want a new dac, and upgrade from a chord hugo - more resolution');
    expect(result.intent).not.toBe('comparison');
  });

  it('does not treat "upgrade my X" as a comparison when no target is named', () => {
    const result = detectIntent('should i upgrade my dac');
    expect(result.intent).not.toBe('comparison');
  });

  it('still treats "upgrade from X to Y" as a comparison', () => {
    // The phrasing the pattern was written for must keep working.
    const result = detectIntent('upgrade from a chord hugo to a qutest');
    expect(result.intent).toBe('comparison');
  });

  it('still treats "upgrade my X to Y" as a comparison', () => {
    const result = detectIntent('upgrade my hugo to a qutest');
    expect(result.intent).toBe('comparison');
  });

  it('leaves the sibling replacement patterns untouched', () => {
    expect(detectIntent('replace my hugo with a qutest').intent).toBe('comparison');
    expect(detectIntent('swap my hugo for a qutest').intent).toBe('comparison');
  });
});

describe('product assessment requires a product', () => {
  it('does not route a bare brand name to product_assessment', () => {
    // Shindo is a brand. There is no product called "the Shindo".
    const result = detectIntent('tell me about shindo');
    expect(result.intent).not.toBe('product_assessment');
  });

  it('routes a bare brand somewhere the consultation path can reach', () => {
    // page.tsx blocks product_assessment and system_assessment from the
    // consultation path, and the curated brand profile lives behind it.
    // Whatever lane a bare brand takes, it must not be one of those two.
    const result = detectIntent('tell me about shindo');
    expect(['product_assessment', 'system_assessment']).not.toContain(result.intent);
    expect(result.subjectMatches.some((m) => m.kind === 'brand')).toBe(true);
  });

  it('still routes a named product to product_assessment', () => {
    // The lane keeps its real job: a product was named, so assess it.
    const result = detectIntent('thoughts on job integrated amplifier');
    expect(result.intent).toBe('product_assessment');
    expect(result.subjectMatches.some((m) => m.kind === 'product')).toBe(true);
  });
});
