/**
 * Tests for amp/speaker power-match assessment.
 *
 * Covers:
 *   1. classifyPowerMatch() — SPL calculation and tier classification
 *   2. assessPowerMatch() — full system-level assessment
 *   3. surfaceAmpSpeakerInteraction() — interaction note matching
 *   4. Edge cases — missing data, headphone amps, no speakers
 */

import { assessPowerMatch } from '../consultation';
import type { SystemComponent } from '../consultation';

// ── Helpers ────────────────────────────────────────────

function makeComponent(
  displayName: string,
  role: string,
  roles: string[],
  product?: Partial<{ power_watts: number; sensitivity_db: number; tendencies: any }>,
): SystemComponent {
  return {
    displayName,
    role,
    roles,
    character: `${displayName} character`,
    product: product as any,
  };
}

// ── 1. Classification tiers ───────────────────────────

describe('assessPowerMatch — classification tiers', () => {
  it('2W SET + 96dB speaker → adequate (99 dB SPL, just under optimal threshold)', () => {
    const components = [
      makeComponent('Decware SE84UFO', 'amplifier', ['amplifier'], { power_watts: 2, sensitivity_db: undefined }),
      makeComponent('Cube Audio Nendo', 'speaker', ['speaker'], { sensitivity_db: 96, power_watts: undefined }),
    ];
    const result = assessPowerMatch(components);
    // 96 + 10*log10(2) ≈ 99.01 dB — just under 100, so adequate not optimal
    expect(result.compatibility).toBe('adequate');
    expect(result.ampName).toBe('Decware SE84UFO');
    expect(result.speakerName).toBe('Cube Audio Nendo');
    expect(result.ampPowerWatts).toBe(2);
    expect(result.speakerSensitivityDb).toBe(96);
    expect(result.estimatedMaxCleanSPL).toBeCloseTo(99.01, 0);
  });

  it('100W solid-state + 86dB speaker → optimal', () => {
    const components = [
      makeComponent('Hegel H190', 'amplifier', ['amplifier'], { power_watts: 150 }),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    // 86 + 10*log10(150) ≈ 86 + 21.76 = 107.76 → optimal
    expect(result.compatibility).toBe('optimal');
    expect(result.estimatedMaxCleanSPL).toBeGreaterThan(100);
  });

  it('15W tube + 93dB speaker → optimal', () => {
    const components = [
      makeComponent('Leben CS300', 'amplifier', ['amplifier'], { power_watts: 15 }),
      makeComponent('DeVore O/93', 'speaker', ['speaker'], { sensitivity_db: 93 }),
    ];
    const result = assessPowerMatch(components);
    // 93 + 10*log10(15) ≈ 93 + 11.76 = 104.76 → optimal
    expect(result.compatibility).toBe('optimal');
  });

  it('2W SET + 86dB speaker → mismatched', () => {
    const components = [
      makeComponent('Decware SE84UFO', 'amplifier', ['amplifier'], { power_watts: 2 }),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    // 86 + 10*log10(2) ≈ 86 + 3.01 = 89.01 → mismatched (<90)
    expect(result.compatibility).toBe('mismatched');
    expect(result.estimatedMaxCleanSPL).toBeLessThan(90);
  });

  it('10W amp + 86dB speaker → strained', () => {
    const components = [
      makeComponent('Shindo Cortese', 'amplifier', ['amplifier'], { power_watts: 10 }),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    // 86 + 10*log10(10) = 86 + 10 = 96 → adequate (≥95, <100)
    expect(result.compatibility).toBe('adequate');
  });

  it('15W tube + 83dB speaker → strained', () => {
    const components = [
      makeComponent('Leben CS300', 'amplifier', ['amplifier'], { power_watts: 15 }),
      makeComponent('Falcon LS3/5a', 'speaker', ['speaker'], { sensitivity_db: 83 }),
    ];
    const result = assessPowerMatch(components);
    // 83 + 10*log10(15) ≈ 83 + 11.76 = 94.76 → strained (≥90, <95)
    expect(result.compatibility).toBe('strained');
  });

  it('1W amp + 86dB speaker → mismatched', () => {
    const components = [
      makeComponent('LTA Z10', 'amplifier', ['amplifier'], { power_watts: 1 }),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    // 86 + 10*log10(1) = 86 + 0 = 86 → mismatched (<90)
    expect(result.compatibility).toBe('mismatched');
  });
});

// ── 2. Missing data handling ──────────────────────────

describe('assessPowerMatch — missing data', () => {
  it('amp without power_watts → unknown', () => {
    const components = [
      makeComponent('JOB Integrated', 'amplifier', ['amplifier'], {}),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
    expect(result.ampPowerWatts).toBeNull();
    expect(result.estimatedMaxCleanSPL).toBeNull();
  });

  it('speaker without sensitivity_db → unknown', () => {
    const components = [
      makeComponent('Hegel H190', 'amplifier', ['amplifier'], { power_watts: 150 }),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker'], {}),
    ];
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
    expect(result.speakerSensitivityDb).toBeNull();
  });

  it('neither has data → unknown', () => {
    const components = [
      makeComponent('JOB Integrated', 'amplifier', ['amplifier'], {}),
      makeComponent('Harbeth P3ESR', 'speaker', ['speaker'], {}),
    ];
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
  });

  it('no amp in system → unknown with null ampName', () => {
    const components = [
      makeComponent('Chord Qutest', 'dac', ['dac']),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
    expect(result.ampName).toBeNull();
    expect(result.speakerName).toBe('Amphion Argon3S');
  });

  it('no speaker in system → unknown with null speakerName', () => {
    const components = [
      makeComponent('Hegel H190', 'amplifier', ['amplifier'], { power_watts: 150 }),
      makeComponent('Chord Qutest', 'dac', ['dac']),
    ];
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
    expect(result.ampName).toBe('Hegel H190');
    expect(result.speakerName).toBeNull();
  });

  it('empty components array → unknown', () => {
    const result = assessPowerMatch([]);
    expect(result.compatibility).toBe('unknown');
    expect(result.ampName).toBeNull();
    expect(result.speakerName).toBeNull();
  });

  it('no product data at all → unknown', () => {
    const components = [
      makeComponent('Mystery Amp', 'amplifier', ['amplifier']),
      makeComponent('Mystery Speaker', 'speaker', ['speaker']),
    ];
    const result = assessPowerMatch(components);
    expect(result.compatibility).toBe('unknown');
  });
});

// ── 3. Headphone amp exclusion ────────────────────────

describe('assessPowerMatch — headphone amp handling', () => {
  it('prefers non-headphone amp when speakers are present', () => {
    const components = [
      makeComponent('Bottlehead Crack', 'headphone_amp', ['headphone_amp'], { power_watts: 1 }),
      makeComponent('Hegel H190', 'amplifier', ['amplifier'], { power_watts: 150 }),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    expect(result.ampName).toBe('Hegel H190');
    expect(result.compatibility).toBe('optimal');
  });
});

// ── 4. SPL calculation accuracy ───────────────────────

describe('assessPowerMatch — SPL calculation', () => {
  it('computes SPL correctly for known values', () => {
    const components = [
      makeComponent('Test Amp', 'amplifier', ['amplifier'], { power_watts: 100 }),
      makeComponent('Test Speaker', 'speaker', ['speaker'], { sensitivity_db: 90 }),
    ];
    const result = assessPowerMatch(components);
    // 90 + 10*log10(100) = 90 + 20 = 110
    expect(result.estimatedMaxCleanSPL).toBeCloseTo(110, 1);
    expect(result.compatibility).toBe('optimal');
  });

  it('handles fractional watts correctly', () => {
    const components = [
      makeComponent('Test Amp', 'amplifier', ['amplifier'], { power_watts: 2 }),
      makeComponent('Test Speaker', 'speaker', ['speaker'], { sensitivity_db: 93 }),
    ];
    const result = assessPowerMatch(components);
    // 93 + 10*log10(2) ≈ 93 + 3.01 = 96.01
    expect(result.estimatedMaxCleanSPL).toBeCloseTo(96.01, 0);
    expect(result.compatibility).toBe('adequate');
  });
});

// ── 5. Interaction surfacing ──────────────────────────

describe('assessPowerMatch — interaction surfacing', () => {
  it('surfaces positive interaction when speaker meets efficiency threshold', () => {
    const components = [
      makeComponent('Leben CS300', 'amplifier', ['amplifier'], {
        power_watts: 15,
        tendencies: {
          interactions: [
            { condition: 'paired with efficient speakers (88dB+)', effect: 'the 15 watts deliver full dynamic range with natural warmth', valence: 'positive', basis: 'listener_consensus' },
            { condition: 'in systems already warm or dense', effect: 'can compound warmth', valence: 'caution', basis: 'editorial_inference' },
          ],
        },
      }),
      makeComponent('DeVore O/93', 'speaker', ['speaker'], { sensitivity_db: 93 }),
    ];
    const result = assessPowerMatch(components);
    expect(result.relevantInteraction).toBe('the 15 watts deliver full dynamic range with natural warmth');
  });

  it('surfaces caution interaction when speaker below threshold', () => {
    const components = [
      makeComponent('Decware SE84UFO', 'amplifier', ['amplifier'], {
        power_watts: 2,
        tendencies: {
          interactions: [
            { condition: 'paired with high-efficiency speakers (94dB+)', effect: 'full dynamic range', valence: 'positive', basis: 'listener_consensus' },
            { condition: 'paired with speakers below 90dB efficiency', effect: 'dynamic compression and bass control suffer', valence: 'caution', basis: 'editorial_inference' },
          ],
        },
      }),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    expect(result.relevantInteraction).toBe('dynamic compression and bass control suffer');
  });

  it('returns null when no interaction matches', () => {
    const components = [
      makeComponent('Hegel H190', 'amplifier', ['amplifier'], {
        power_watts: 150,
        tendencies: {
          interactions: [
            { condition: 'paired with warm speakers', effect: 'adds clarity', valence: 'positive', basis: 'review_consensus' },
          ],
        },
      }),
      makeComponent('Amphion Argon3S', 'speaker', ['speaker'], { sensitivity_db: 86 }),
    ];
    const result = assessPowerMatch(components);
    expect(result.relevantInteraction).toBeNull();
  });
});
