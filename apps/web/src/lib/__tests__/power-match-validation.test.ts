/**
 * Runtime validation of amp/speaker power-match assessment.
 *
 * Tests realistic multi-component systems to verify:
 *   1. Power match classification is correct
 *   2. Interaction notes surface when available
 *   3. Edge cases (incomplete systems, no product data) are safe
 *   4. Regression: systems without power data produce 'unknown' (invisible)
 *
 * Scenarios:
 *   A. SET amp (2W) + high-efficiency speaker (96dB) → adequate/optimal
 *   B. SET amp (2W) + low-sensitivity speaker (86dB) → mismatched
 *   C. High-power SS (150W) + low-sensitivity speaker (86dB) → optimal
 *   D. Moderate tube (15W) + moderate speaker (93dB) → optimal
 *   E. Moderate tube (15W) + low-sensitivity (83dB) → strained
 *   F. Incomplete system (no speaker) → unknown, no crash
 *   G. Uncataloged components (no product) → unknown, no crash
 */

import { assessPowerMatch } from '../consultation';
import type { SystemComponent } from '../consultation';

// ── Helper ────────────────────────────────────────────

function makeComp(
  name: string,
  role: string,
  roles: string[],
  product?: Record<string, any>,
): SystemComponent {
  return {
    displayName: name,
    role,
    roles,
    character: `${name} test character`,
    product: product as any,
  };
}

// ── Scenario A: SET + high-efficiency ─────────────────

describe('Scenario A: Decware SE84UFO (2W) + Cube Audio Nendo (96dB)', () => {
  const components = [
    makeComp('WiiM Pro', 'streamer', ['streamer', 'dac']),
    makeComp('Decware SE84UFO', 'amplifier', ['amplifier'], {
      power_watts: 2,
      tendencies: {
        interactions: [
          { condition: 'paired with high-efficiency speakers (94dB+)', effect: 'the low wattage comes alive — full dynamic range and spatial scale from minimal power', valence: 'positive', basis: 'listener_consensus' },
          { condition: 'paired with speakers below 90dB efficiency', effect: 'dynamic compression and bass control suffer — the amp is out of its comfort zone', valence: 'caution', basis: 'editorial_inference' },
        ],
      },
    }),
    makeComp('Cube Audio Nendo', 'speaker', ['speaker'], { sensitivity_db: 96 }),
  ];

  it('classifies as adequate (99 dB SPL)', () => {
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('adequate');
    expect(result.estimatedMaxCleanSPL).toBeCloseTo(99.01, 0);
  });

  it('surfaces positive interaction note', () => {
    const result = assessPowerMatch(components);
    expect(result.relevantInteraction).toContain('full dynamic range');
  });
});

// ── Scenario B: SET + low-sensitivity ─────────────────

describe('Scenario B: Decware SE84UFO (2W) + Amphion Argon3S (86dB)', () => {
  const components = [
    makeComp('Chord Qutest', 'dac', ['dac']),
    makeComp('Decware SE84UFO', 'amplifier', ['amplifier'], {
      power_watts: 2,
      tendencies: {
        interactions: [
          { condition: 'paired with high-efficiency speakers (94dB+)', effect: 'full dynamic range', valence: 'positive', basis: 'listener_consensus' },
          { condition: 'paired with speakers below 90dB efficiency', effect: 'dynamic compression and bass control suffer', valence: 'caution', basis: 'editorial_inference' },
        ],
      },
    }),
    makeComp('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
  ];

  it('classifies as mismatched (89 dB SPL)', () => {
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('mismatched');
    expect(result.estimatedMaxCleanSPL).toBeLessThan(90);
  });

  it('surfaces caution interaction', () => {
    const result = assessPowerMatch(components);
    expect(result.relevantInteraction).toContain('dynamic compression');
  });
});

// ── Scenario C: High-power SS + low-sensitivity ───────

describe('Scenario C: Hegel H190 (150W) + Amphion Argon3S (86dB)', () => {
  const components = [
    makeComp('Hegel H190', 'amplifier', ['amplifier'], { power_watts: 150 }),
    makeComp('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
  ];

  it('classifies as optimal (108 dB SPL)', () => {
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('optimal');
    expect(result.estimatedMaxCleanSPL).toBeGreaterThan(100);
  });

  it('no interaction surfaced (amp has no matching interaction data)', () => {
    const result = assessPowerMatch(components);
    expect(result.relevantInteraction).toBeNull();
  });
});

// ── Scenario D: Moderate tube + moderate speaker ──────

describe('Scenario D: Leben CS300 (15W) + DeVore O/93 (93dB)', () => {
  const components = [
    makeComp('Denafrips Ares II', 'dac', ['dac']),
    makeComp('Leben CS300', 'amplifier', ['amplifier'], {
      power_watts: 15,
      tendencies: {
        interactions: [
          { condition: 'paired with efficient speakers (88dB+)', effect: 'the 15 watts deliver full dynamic range with natural warmth', valence: 'positive', basis: 'listener_consensus' },
        ],
      },
    }),
    makeComp('DeVore O/93', 'speaker', ['speaker'], { sensitivity_db: 93 }),
  ];

  it('classifies as optimal (105 dB SPL)', () => {
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('optimal');
    expect(result.estimatedMaxCleanSPL).toBeGreaterThan(100);
  });

  it('surfaces positive interaction note', () => {
    const result = assessPowerMatch(components);
    expect(result.relevantInteraction).toContain('15 watts deliver full dynamic range');
  });
});

// ── Scenario E: Moderate tube + insensitive speaker ───

describe('Scenario E: Leben CS300 (15W) + Falcon LS3/5a (83dB)', () => {
  const components = [
    makeComp('Leben CS300', 'amplifier', ['amplifier'], { power_watts: 15 }),
    makeComp('Falcon LS3/5a', 'speaker', ['speaker'], { sensitivity_db: 83 }),
  ];

  it('classifies as strained (95 dB SPL)', () => {
    const result = assessPowerMatch(components);
    // 83 + 10*log10(15) ≈ 83 + 11.76 = 94.76 → strained (≥90, <95)
    expect(result.compatibility).toBe('strained');
    expect(result.estimatedMaxCleanSPL).toBeLessThan(95);
    expect(result.estimatedMaxCleanSPL).toBeGreaterThanOrEqual(90);
  });
});

// ── Scenario F: Incomplete system ─────────────────────

describe('Scenario F: Amp only (no speaker)', () => {
  const components = [
    makeComp('Chord Qutest', 'dac', ['dac']),
    makeComp('Hegel H190', 'amplifier', ['amplifier'], { power_watts: 150 }),
  ];

  it('returns unknown — no crash', () => {
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
    expect(result.ampName).toBe('Hegel H190');
    expect(result.speakerName).toBeNull();
  });
});

// ── Scenario G: Uncataloged components ────────────────

describe('Scenario G: Free-text components without product data', () => {
  const components = [
    makeComp('Some Unknown DAC', 'dac', ['dac']),
    makeComp('Vintage Receiver', 'amplifier', ['amplifier']),
    makeComp('Bookshelf Speakers', 'speaker', ['speaker']),
  ];

  it('returns unknown — no product data → no crash, no false positives', () => {
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
    expect(result.ampPowerWatts).toBeNull();
    expect(result.speakerSensitivityDb).toBeNull();
    expect(result.relevantInteraction).toBeNull();
  });
});
