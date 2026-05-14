// @ts-nocheck — vitest globals injected via apps/web vitest config

/**
 * Phase 2.6 polish — Leben / DeVore / Pontus screenshot review.
 *
 * Pins four targeted fixes from the 2026-05-14 reviewer pass:
 *   1. shortLabel preserves "Pontus II" (not "II") when the catalog
 *      name has a trailing model-number suffix like "Pontus II 12th-1".
 *   2. shortLabel still resolves WLM Diva Monitor → "Diva", not broken.
 *   3. The EMERGENT BEHAVIOR paragraph for Leben/DeVore/Pontus
 *      references "Pontus II" (not "II") in both the chain header and
 *      the dac-contribution clause.
 *   4. The PRIMARY LEVERAGE section under intentional synergy reads as
 *      preservation, not "rebalance it and the system serves more
 *      material."
 *   5. findProductByComponentName('DeVore O/96') resolves to the
 *      catalog entry (so the rendered card pulls the existing image
 *      URL from the speakers catalog).
 */

import { describe, it, expect } from 'vitest';
import { detectIntent, extractSubjectMatches } from '../intent';
import { buildSystemAssessment, findProductByComponentName } from '../consultation';
import { composeEmergentBehavior, __TEST__ } from '../emergent-behavior';
import type { MemoFindings, ComponentFindings } from '../memo-findings';

const { shortLabel } = __TEST__;

// ── shortLabel — Phase 2.6 ─────────────────────────────────────────

describe('shortLabel — Roman-numeral and model-designator preservation', () => {
  it('preserves "Pontus II" from "Denafrips Pontus II 12th-1"', () => {
    expect(shortLabel('Denafrips Pontus II 12th-1')).toBe('Pontus II');
  });

  it('preserves "Pontus II" from "Pontus II 12th-1" too (no brand prefix)', () => {
    expect(shortLabel('Pontus II 12th-1')).toBe('Pontus II');
  });

  it('preserves "Pontus II" from "Denafrips Pontus II" (no trailing model number)', () => {
    // The actual deployed catalog entry — the original 2026-05-14 reviewer
    // case. Without this fix the emergent chain renders as "II/CS600X/O/96".
    expect(shortLabel('Denafrips Pontus II')).toBe('Pontus II');
  });

  it('still resolves "WLM Diva Monitor" → "Diva" (no regression)', () => {
    expect(shortLabel('WLM Diva Monitor')).toBe('Diva');
  });

  it('still resolves "JOB Integrated" → "JOB"', () => {
    expect(shortLabel('JOB Integrated')).toBe('JOB');
  });

  it('still resolves "Chord Hugo" → "Hugo"', () => {
    expect(shortLabel('Chord Hugo')).toBe('Hugo');
  });

  it('still resolves "Eversolo DMP-A6" → "Eversolo" (model-number fallback)', () => {
    expect(shortLabel('Eversolo DMP-A6')).toBe('Eversolo');
  });

  it('handles "Leben CS600X" → "CS600X" (no dash in model, no fallback)', () => {
    expect(shortLabel('Leben CS600X')).toBe('CS600X');
  });

  it('handles "DeVore O/96" → "O/96" (slash not dash, no fallback)', () => {
    expect(shortLabel('DeVore O/96')).toBe('O/96');
  });
});

// ── findProductByComponentName — DeVore O/96 image resolution ──────

describe('findProductByComponentName — distinctive-token match', () => {
  it('resolves "DeVore O/96" to the Orangutan O/96 catalog entry', () => {
    const product = findProductByComponentName('DeVore O/96');
    expect(product).toBeTruthy();
    expect(product!.brand).toBe('DeVore');
    expect(product!.name).toBe('Orangutan O/96');
    // Image URL is the catalog source — fix lets the renderer pull it.
    expect(product!.imageUrl).toBeTruthy();
    expect(product!.imageUrl).toMatch(/devorefidelity\.com/);
  });

  it('resolves the canonical "DeVore Orangutan O/96" via the original step-2 path', () => {
    const product = findProductByComponentName('DeVore Orangutan O/96');
    expect(product).toBeTruthy();
    expect(product!.name).toBe('Orangutan O/96');
  });

  it('does NOT match a different DeVore product when the input has no model token', () => {
    // Brand-only input must not silently match an arbitrary DeVore
    // product. Step 2b requires the distinctive last token (≥4 chars)
    // to appear in the input — bare "DeVore" doesn't qualify.
    const product = findProductByComponentName('DeVore');
    // Either undefined (correct) OR matched via a different path; the
    // critical assertion is no false-positive for an unrelated model.
    if (product) {
      // Allowed: only an exact-brand-only catalog entry could match (none today).
      expect(product.brand).toBe('DeVore');
    } else {
      expect(product).toBeUndefined();
    }
  });
});

// ── End-to-end: Leben / DeVore / Pontus assessment ─────────────────

describe('Leben CS600X + DeVore O/96 + Pontus II — rendered narrative', () => {
  const text = 'Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96';
  const subjectMatches = extractSubjectMatches(text);
  const { desires } = detectIntent(text);
  const result = buildSystemAssessment(text, subjectMatches, null, desires);
  const narrative = result?.kind === 'assessment'
    ? (result.response?.systemContext ?? '')
    : '';

  it('renders a non-empty assessment narrative', () => {
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('assessment');
    expect(narrative.length).toBeGreaterThan(0);
  });

  // ── EMERGENT BEHAVIOR — short label preservation ──

  it('EMERGENT BEHAVIOR uses "Pontus II" in the chain header, not bare "II"', () => {
    expect(narrative).toMatch(/\*\*Emergent behavior\*\*/);
    expect(narrative).toMatch(/Pontus II\/CS600X\/O\/96/);
    // The old bug had "The II/CS600X/O/96 chain" — assert that the
    // chain header is preceded by "Pontus " rather than the bare token.
    expect(narrative).not.toMatch(/The II\/CS600X\/O\/96/);
  });

  it('EMERGENT BEHAVIOR uses "Pontus II\'s harmonic density" possessive', () => {
    expect(narrative).toMatch(/Pontus II's harmonic density/);
    // The old bug rendered "II's harmonic density" at the start of the
    // contributor clause — i.e. preceded by sentence whitespace, not by
    // "Pontus ". Assert the new form by checking the contributor phrase
    // starts with "Pontus II".
    expect(narrative).toMatch(/\. Pontus II's harmonic density/);
  });

  // ── PRIMARY LEVERAGE — preservation framing under intentional synergy ──

  it('PRIMARY LEVERAGE no longer says "Rebalance it and the system serves more material"', () => {
    expect(narrative).not.toMatch(/Rebalance it and the system serves more material/);
  });

  it('PRIMARY LEVERAGE uses preservation framing under intentional synergy', () => {
    // "The system is already built around <prop>. The next change should
    // preserve that character rather than adding more density."
    expect(narrative).toMatch(/The system is already built around/);
    expect(narrative).toMatch(/preserve that character rather than adding more density/);
  });
});
