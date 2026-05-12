/**
 * Tests for the cross-category pairing resolver (Phase 3).
 *
 * The module must:
 *   - detect the pairing-intent shape (amp pairing / amp matching /
 *     partner an amplifier) when a recognized speaker is also named
 *   - resolve the speaker to an authored capsule and return canonical
 *     amp partners with rationales
 *   - fall back to topology-by-sensitivity when no authored capsule exists
 *   - return null when the message does not have the pairing shape
 */

import { describe, it, expect } from 'vitest';
import {
  detectPairingIntent,
  buildPairingSummary,
  topologyFamiliesForSensitivity,
  listAnchorKeys,
} from '../pairing-resolver';

describe('detectPairingIntent — recognized speakers', () => {
  it('"DeVore O/96 amplifier pairing" → authored capsule with Leben first', () => {
    const p = detectPairingIntent('DeVore O/96 amplifier pairing');
    expect(p).not.toBeNull();
    expect(p!.pairedCategory).toBe('amplifier');
    expect(p!.source).toBe('authored');
    expect(p!.recommendations[0].brand).toBe('Leben');
    expect(p!.recommendations[0].model).toBe('CS600X');
    expect(p!.recommendations[0].topology).toBe('push-pull-tube');
  });

  it('"Cube Audio Nenuphar amp matching" → authored capsule with Yamamoto first', () => {
    const p = detectPairingIntent('Cube Audio Nenuphar amp matching');
    expect(p).not.toBeNull();
    expect(p!.recommendations[0].brand).toBe('Yamamoto');
    expect(p!.recommendations[0].topology).toBe('set');
  });

  it('"What amp should I pair with Klipsch Heresy?" → authored', () => {
    const p = detectPairingIntent('What amp should I pair with Klipsch Heresy?');
    expect(p).not.toBeNull();
    expect(p!.anchorBrand).toBe('Klipsch');
  });

  it('"Harbeth Compact 7 amplifier partner suggestions" → authored', () => {
    const p = detectPairingIntent('Harbeth Compact 7 amplifier partner suggestions');
    expect(p).not.toBeNull();
    expect(p!.anchorBrand).toBe('Harbeth');
  });
});

describe('detectPairingIntent — speakers without authored capsules', () => {
  it('returns null when speaker is not in the anchor table', () => {
    // KEF LS50 doesn't have a curated pairing capsule yet — the caller
    // should fall back to the standard shopping pipeline.
    expect(detectPairingIntent('KEF LS50 Meta amp pairing')).toBeNull();
  });
});

describe('detectPairingIntent — pairing shape required', () => {
  it('"DeVore O/96" alone is not a pairing intent', () => {
    expect(detectPairingIntent('DeVore O/96')).toBeNull();
  });

  it('"I love my DeVore O/96" is not a pairing intent', () => {
    expect(detectPairingIntent('I love my DeVore O/96')).toBeNull();
  });

  it('"best amplifier under $5000" without speaker name is not a pairing intent', () => {
    expect(detectPairingIntent('best amplifier under $5000')).toBeNull();
  });
});

describe('topologyFamiliesForSensitivity — rule-based fallback', () => {
  it('100+ dB → SET / horn family', () => {
    const f = topologyFamiliesForSensitivity(101)!;
    expect(f.topologies).toContain('set');
    expect(f.topologies).toContain('horn-high-efficiency');
  });

  it('95 dB → SET or push-pull tube territory', () => {
    const f = topologyFamiliesForSensitivity(95)!;
    expect(f.topologies).toContain('set');
    expect(f.topologies).toContain('push-pull-tube');
  });

  it('89 dB → push-pull tube or Class A solid-state, NOT SET', () => {
    const f = topologyFamiliesForSensitivity(89)!;
    expect(f.topologies).toContain('push-pull-tube');
    expect(f.topologies).toContain('class-a-solid-state');
    expect(f.topologies).not.toContain('set');
  });

  it('84 dB → solid-state authority (Class A, low-feedback)', () => {
    const f = topologyFamiliesForSensitivity(84)!;
    expect(f.topologies).toContain('class-a-solid-state');
    expect(f.topologies).toContain('low-feedback');
    expect(f.topologies).not.toContain('set');
  });

  it('handles non-finite input gracefully', () => {
    expect(topologyFamiliesForSensitivity(NaN)).toBeNull();
  });
});

describe('buildPairingSummary — deterministic prose', () => {
  it('renders DeVore O/96 pairings as a numbered list', () => {
    const p = detectPairingIntent('DeVore O/96 amplifier pairing')!;
    const s = buildPairingSummary(p);
    expect(s).toContain('DeVore Fidelity Orangutan O/96');
    expect(s).toContain('1. Leben CS600X');
    expect(s).toContain('2. Air Tight');
    expect(s).toContain('push-pull-tube');
  });

  it('renders are stable across calls', () => {
    const p = detectPairingIntent('Cube Audio Nenuphar amp matching')!;
    expect(buildPairingSummary(p)).toBe(buildPairingSummary(p));
  });
});

describe('intent integration — pairing intent routes to shopping with payload', () => {
  it('"DeVore O/96 amplifier pairing" → shopping + pairingIntent', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('DeVore O/96 amplifier pairing');
    expect(r.intent).toBe('shopping');
    expect(r.pairingIntent).toBeTruthy();
    expect(r.pairingIntent!.anchorBrand).toBe('DeVore Fidelity');
  });

  it('"Cube Audio Nenuphar amp matching" → shopping + pairingIntent', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('Cube Audio Nenuphar amp matching');
    expect(r.intent).toBe('shopping');
    expect(r.pairingIntent?.recommendations[0].brand).toBe('Yamamoto');
  });

  it('plain "DeVore O/96" without pairing word does not attach pairingIntent', async () => {
    const { detectIntent } = await import('../intent');
    const r = detectIntent('Tell me about the DeVore O/96');
    expect(r.pairingIntent).toBeFalsy();
  });
});

describe('listAnchorKeys', () => {
  it('lists the authored anchor speakers', () => {
    const keys = listAnchorKeys();
    expect(keys).toContain('devore o/96');
    expect(keys).toContain('cube audio nenuphar');
    expect(keys).toContain('harbeth compact 7');
    expect(keys).toContain('klipsch heresy');
  });
});
