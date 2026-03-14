/**
 * Chain reconstruction tests.
 *
 * Covers:
 *   1. Arrow-separated input (→, ->, -->, ==>)
 *   2. "Into" phrasing
 *   3. Comma-separated recoverable order
 *   4. Fallback behavior when order cannot be reconstructed
 *   5. Canonical ordering correctness
 *   6. Full chain preservation
 */

// @ts-nocheck — globals provided by test-runner.ts
import { _test } from '../consultation';

const { extractFullChain, tryCanonicalOrder, canonicalRole, roleSort } = _test;

// ──────────────────────────────────────────────────────
// 1. Arrow-separated chains
// ──────────────────────────────────────────────────────

describe('extractFullChain — arrow-separated', () => {
  it('parses → arrow chain', () => {
    const result = extractFullChain('Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toEqual([
      'Eversolo DMP-A6',
      'Chord Hugo',
      'JOB Integrated',
      'WLM Diva',
    ]);
  });

  it('parses -> arrow chain', () => {
    const result = extractFullChain('WiiM Pro -> Chord Hugo -> JOB Integrated -> WLM Diva');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(4);
  });

  it('parses --> arrow chain', () => {
    const result = extractFullChain('WiiM Pro --> Denafrips Pontus --> Leben CS300 --> Harbeth');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(4);
  });

  it('parses ==> arrow chain', () => {
    const result = extractFullChain('Streamer ==> DAC ==> Amp ==> Speakers');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(4);
  });

  it('parses >> arrow chain', () => {
    const result = extractFullChain('WiiM Pro >> Hugo >> JOB >> Diva');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(4);
  });

  it('preserves user order exactly (no reordering)', () => {
    // Even if "wrong" order, arrow chain trusts user
    const result = extractFullChain('WLM Diva → JOB Integrated → Chord Hugo → WiiM Pro');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments[0]).toBe('WLM Diva');
    expect(result!.segments[3]).toBe('WiiM Pro');
  });

  it('handles mixed whitespace around arrows', () => {
    const result = extractFullChain('WiiM Pro  →  Chord Hugo→JOB Integrated → WLM Diva');
    expect(result).not.toBeUndefined();
    expect(result!.segments).toHaveLength(4);
    expect(result!.segments[0]).toBe('WiiM Pro');
  });
});

// ──────────────────────────────────────────────────────
// 2. "Into" phrasing
// ──────────────────────────────────────────────────────

describe('extractFullChain — "into" phrasing', () => {
  it('parses chain with 3+ "into" connectors', () => {
    const result = extractFullChain(
      'Eversolo DMP-A6 into Chord Hugo into JOB Integrated into WLM Diva',
    );
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toEqual([
      'Eversolo DMP-A6',
      'Chord Hugo',
      'JOB Integrated',
      'WLM Diva',
    ]);
  });

  it('parses chain with exactly 2 "into" connectors', () => {
    const result = extractFullChain('Denafrips Pontus into Leben CS300 into Harbeth');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(3);
  });

  it('does NOT activate with only 1 "into" (likely prose)', () => {
    const result = extractFullChain('I plug the DAC into the amp');
    // Only 1 "into" — not treated as chain notation
    // May fall through to comma check or return undefined
    expect(result === undefined || result.confidence === 'medium').toBe(true);
  });

  it('handles case-insensitive "Into"', () => {
    const result = extractFullChain('WiiM Pro Into Chord Hugo Into JOB Into WLM Diva');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(4);
  });
});

// ──────────────────────────────────────────────────────
// 2b. Natural language connectors
// ──────────────────────────────────────────────────────

describe('extractFullChain — natural language connectors', () => {
  it('parses "feeding into...then to...connected to" chain', () => {
    const result = extractFullChain(
      'Eversolo DMP-A6 streamer feeding into the Chord Hugo DAC, then to the Job integrated amp, connected to the WLM Diva Monitors',
    );
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments.length).toBeGreaterThanOrEqual(3);
    // First segment should not start with a connector
    expect(result!.segments[0]).toMatch(/^[A-Z]/);
  });

  it('parses "evaluate my system:" prefix with mixed connectors', () => {
    const result = extractFullChain(
      'Evaluate my system: Eversolo DMP-A6 streamer feeding into the Chord Hugo (v1) DAC via the TotalDac D1 USB cable, then to the Job (Goldmund) integrated amp, connected to the WLM Diva Monitors with Tellurium Q Black II speaker cables',
    );
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments.length).toBeGreaterThanOrEqual(3);
  });
});

// ──────────────────────────────────────────────────────
// 3. Comma-separated chains
// ──────────────────────────────────────────────────────

describe('extractFullChain — comma-separated', () => {
  it('parses comma-separated component list', () => {
    const result = extractFullChain('WiiM Pro, Chord Hugo, JOB Integrated, WLM Diva');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('medium');
    expect(result!.segments).toHaveLength(4);
  });

  it('strips "my system is:" framing', () => {
    const result = extractFullChain('My system is: WiiM Pro, Chord Hugo, JOB Integrated, WLM Diva');
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('medium');
    expect(result!.segments).toHaveLength(4);
  });

  it('strips "I\'m using:" framing', () => {
    const result = extractFullChain("I'm using: Denafrips Pontus, Leben CS300, Harbeth P3ESR");
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('medium');
    expect(result!.segments).toHaveLength(3);
  });

  it('returns undefined for single-item (no comma)', () => {
    const result = extractFullChain('Chord Hugo');
    expect(result).toBeUndefined();
  });

  it('filters out long segments (>120 chars)', () => {
    const longSegment = 'A'.repeat(121);
    const result = extractFullChain(`WiiM Pro, ${longSegment}, Chord Hugo`);
    // The long segment gets filtered — may result in 2 valid segments
    if (result) {
      expect(result.segments.every((s) => s.length < 120)).toBe(true);
    }
  });
});

// ──────────────────────────────────────────────────────
// 4. tryCanonicalOrder
// ──────────────────────────────────────────────────────

describe('tryCanonicalOrder', () => {
  it('reorders streamer, DAC, amp, speaker correctly', () => {
    const result = tryCanonicalOrder(['WLM Diva speaker', 'JOB amp', 'Chord DAC', 'WiiM streamer']);
    expect(result).not.toBeUndefined();
    expect(result![0]).toMatch(/WiiM/i);
    expect(result![1]).toMatch(/Chord/i);
    expect(result![2]).toMatch(/JOB/i);
    expect(result![3]).toMatch(/WLM/i);
  });

  it('returns undefined for unclassifiable segments', () => {
    const result = tryCanonicalOrder(['Mystery Box', 'Unknown Thing', 'Random Gear']);
    expect(result).toBeUndefined();
  });

  it('places preamp before amp', () => {
    const result = tryCanonicalOrder(['integrated amp', 'preamp', 'DAC', 'speaker']);
    expect(result).not.toBeUndefined();
    expect(result!.indexOf('DAC')).toBeLessThan(result!.indexOf('preamp'));
    expect(result!.indexOf('preamp')).toBeLessThan(result!.indexOf('integrated amp'));
    expect(result!.indexOf('integrated amp')).toBeLessThan(result!.indexOf('speaker'));
  });

  it('places cables at end while preserving their relative order', () => {
    const result = tryCanonicalOrder([
      'USB cable',
      'DAC unit',
      'speaker cable',
      'amplifier',
      'speakers',
    ]);
    expect(result).not.toBeUndefined();
    // Main signal path should come first
    expect(result!.indexOf('DAC unit')).toBeLessThan(result!.indexOf('amplifier'));
    expect(result!.indexOf('amplifier')).toBeLessThan(result!.indexOf('speakers'));
    // Cables at the end
    expect(result!.indexOf('USB cable')).toBeGreaterThan(result!.indexOf('speakers'));
    expect(result!.indexOf('speaker cable')).toBeGreaterThan(result!.indexOf('speakers'));
  });

  it('handles mixed known and keyword-classifiable segments', () => {
    const result = tryCanonicalOrder(['Harbeth speaker', 'Denafrips DAC', 'streamer transport']);
    expect(result).not.toBeUndefined();
    expect(result![0]).toMatch(/stream/i);
    expect(result![1]).toMatch(/Denafrips/i);
    expect(result![2]).toMatch(/Harbeth/i);
  });
});

// ──────────────────────────────────────────────────────
// 5. Role sorting helpers
// ──────────────────────────────────────────────────────

describe('canonicalRole', () => {
  it('normalizes streamer variants', () => {
    expect(canonicalRole('streamer')).toBe('Streamer');
    expect(canonicalRole('source')).toBe('Streamer');
    expect(canonicalRole('transport')).toBe('Streamer');
  });

  it('normalizes DAC', () => {
    expect(canonicalRole('dac')).toBe('DAC');
  });

  it('normalizes amplifier variants', () => {
    expect(canonicalRole('amplifier')).toBe('Amplifier');
    expect(canonicalRole('integrated')).toBe('Amplifier');
    expect(canonicalRole('integrated-amplifier')).toBe('Amplifier');
  });

  it('normalizes speaker variants', () => {
    expect(canonicalRole('speaker')).toBe('Speakers');
    expect(canonicalRole('speakers')).toBe('Speakers');
  });
});

describe('roleSort', () => {
  it('orders streamer < dac < amp < speaker', () => {
    expect(roleSort('streamer')).toBeLessThan(roleSort('dac'));
    expect(roleSort('dac')).toBeLessThan(roleSort('amplifier'));
    expect(roleSort('amplifier')).toBeLessThan(roleSort('speaker'));
  });

  it('gives integrated same order as amplifier', () => {
    expect(roleSort('integrated')).toBe(roleSort('amplifier'));
  });

  it('gives unknown roles order 99', () => {
    expect(roleSort('mystery')).toBe(99);
  });
});

// ──────────────────────────────────────────────────────
// 6. Specific real-world chain patterns
// ──────────────────────────────────────────────────────

describe('Real-world chain parsing', () => {
  it('Eversolo → Chord → JOB → WLM chain', () => {
    const result = extractFullChain(
      'Eversolo DMP-A6 → Chord Hugo → JOB Integrated → WLM Diva',
    );
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments[0]).toBe('Eversolo DMP-A6');
    expect(result!.segments[1]).toBe('Chord Hugo');
    expect(result!.segments[2]).toBe('JOB Integrated');
    expect(result!.segments[3]).toBe('WLM Diva');
  });

  it('WiiM → Hugo → Crayon → XSA chain', () => {
    const result = extractFullChain(
      'WiiM Pro → Chord Hugo → Crayon CIA → XSA Vanguard',
    );
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(4);
  });

  it('Denafrips → Leben → Harbeth chain (3 components)', () => {
    const result = extractFullChain(
      'Denafrips Pontus into Leben CS300 into Harbeth P3ESR',
    );
    expect(result).not.toBeUndefined();
    expect(result!.confidence).toBe('high');
    expect(result!.segments).toHaveLength(3);
  });

  it('comma-separated preserves all segments', () => {
    const result = extractFullChain(
      'Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva',
    );
    expect(result).not.toBeUndefined();
    expect(result!.segments).toHaveLength(4);
    // All four component names preserved
    expect(result!.segments).toContain('Eversolo DMP-A6');
    expect(result!.segments).toContain('Chord Hugo');
    expect(result!.segments).toContain('JOB Integrated');
    expect(result!.segments).toContain('WLM Diva');
  });
});
