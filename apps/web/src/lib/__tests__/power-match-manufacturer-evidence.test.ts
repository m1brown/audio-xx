import { describe, it, expect } from 'vitest';
import { assessPowerMatch, buildSystemAssessment } from '../consultation';
import type { SystemComponent } from '../consultation';
import { extractSubjectMatches } from '../intent';
import { toEvidenceItem } from '../evidence/manufacturer-facts';
import type { EvidenceItem } from '../evidence/evidence-types';

/**
 * Manufacturer facts reach the power/load compatibility path.
 *
 * The gap this closes: `assessPowerMatch` read `power_watts` and
 * `sensitivity_db` off the catalog row and nothing else, so an uncatalogued
 * loudspeaker had no sensitivity however plainly its maker published one, and
 * the pairing came back 'unknown'. ManufacturerFact is now live site-level
 * evidence infrastructure, and this is its first consumption in a
 * deterministic calculation.
 *
 * The precedence being pinned, strongest first:
 *
 *   catalog → manufacturer → explicit listener-supplied → unknown
 *
 * Model memory is absent by construction — a recalled sensitivity figure never
 * enters this arithmetic, because the reader will read the output as measured.
 *
 * The controls matter as much as the new capability. A coherent, adequately
 * powered system must keep its confident no-change, and a figure we do not
 * hold must stay 'unknown' rather than degrading into "probably fine".
 */

// ── Helpers ────────────────────────────────────────────

function makeComponent(
  displayName: string,
  role: string,
  product?: Partial<{ power_watts: number; sensitivity_db: number }>,
): SystemComponent {
  return {
    displayName,
    role,
    roles: [role],
    character: `${displayName} character`,
    product: product as never,
  };
}

/** A fact as the acquisition path would have stored it. */
function fact(
  productName: string,
  field: 'sensitivity' | 'impedance' | 'power_output',
  value: string,
  host: string,
): EvidenceItem {
  return toEvidenceItem(productName, {
    field,
    value,
    sourceUrl: `https://${host}/products/x`,
    quotedText: value,
  }, Date.now());
}

// ── 1. Manufacturer evidence makes a pairing assessable ─

describe('manufacturer power + manufacturer sensitivity make compatibility assessable', () => {
  // Neither side is catalogued. Before this wiring both figures were absent
  // and the pairing was unassessable.
  const components = [
    makeComponent('Butler Monads', 'amplifier'),
    makeComponent('Acora QRC-2', 'speaker'),
  ];
  const evidence = [
    fact('Butler Monads', 'power_output', '100 Watts RMS @ 8 Ohms', 'butleraudio.com'),
    fact('Acora QRC-2', 'sensitivity', '86 dB', 'acoraaudio.com'),
  ];

  it('was unassessable without the evidence', () => {
    expect(assessPowerMatch(components).compatibility).toBe('unknown');
  });

  it('becomes assessable with it', () => {
    const r = assessPowerMatch(components, evidence);
    expect(r.ampPowerWatts).toBe(100);
    expect(r.speakerSensitivityDb).toBe(86);
    expect(r.compatibility).not.toBe('unknown');
    // 86 + 10*log10(100) = 106 dB → optimal
    expect(r.estimatedMaxCleanSPL).toBeCloseTo(106, 5);
    expect(r.compatibility).toBe('optimal');
  });

  it('records manufacturer as the provenance of both figures', () => {
    const r = assessPowerMatch(components, evidence);
    expect(r.ampPowerProvenance).toBe('manufacturer');
    expect(r.speakerSensitivityProvenance).toBe('manufacturer');
  });

  it('does not lend one component’s specification to another', () => {
    // The sensitivity belongs to the Acora. An amplifier must not acquire it
    // just because both facts arrive in the same array.
    const r = assessPowerMatch(
      [makeComponent('Butler Monads', 'amplifier'), makeComponent('Some Other Speaker', 'speaker')],
      evidence,
    );
    expect(r.speakerSensitivityDb).toBeNull();
    expect(r.compatibility).toBe('unknown');
  });
});

// ── 2. Catalog outranks manufacturer ───────────────────

describe('catalog evidence wins when both exist', () => {
  const components = [
    makeComponent('Leben CS600X', 'amplifier', { power_watts: 32 }),
    makeComponent('Klipsch Cornwall IV', 'speaker', { sensitivity_db: 102 }),
  ];
  // The maker publishes different figures. Ours are curated and checked; we
  // keep them, and the manufacturer's do not silently overwrite them.
  const evidence = [
    fact('Leben CS600X', 'power_output', '15 W', 'lebenhifi.com'),
    fact('Klipsch Cornwall IV', 'sensitivity', '99 dB', 'klipsch.com'),
  ];

  it('keeps the catalog figures', () => {
    const r = assessPowerMatch(components, evidence);
    expect(r.ampPowerWatts).toBe(32);
    expect(r.speakerSensitivityDb).toBe(102);
  });

  it('reports catalog as the provenance', () => {
    const r = assessPowerMatch(components, evidence);
    expect(r.ampPowerProvenance).toBe('catalog');
    expect(r.speakerSensitivityProvenance).toBe('catalog');
  });
});

// ── 3. Listener-supplied survives, ranked below manufacturer ──

describe('explicit listener-supplied wattage remains usable', () => {
  it('is used when nothing stronger exists', () => {
    const r = assessPowerMatch([
      makeComponent('Zorblax ZX1 5 watt SET', 'amplifier'),
      makeComponent('Magnepan LRS+', 'speaker', { sensitivity_db: 86 }),
    ]);
    expect(r.ampPowerWatts).toBe(5);
    expect(r.ampPowerProvenance).toBe('listener');
    // 86 + 10*log10(5) ≈ 93 dB → strained
    expect(r.compatibility).toBe('strained');
  });

  it('yields to a manufacturer figure for the same amplifier', () => {
    const r = assessPowerMatch(
      [
        makeComponent('Zorblax ZX1 5 watt SET', 'amplifier'),
        makeComponent('Magnepan LRS+', 'speaker', { sensitivity_db: 86 }),
      ],
      [fact('Zorblax ZX1 5 watt SET', 'power_output', '50 W into 8 ohms', 'zorblax.com')],
    );
    expect(r.ampPowerWatts).toBe(50);
    expect(r.ampPowerProvenance).toBe('manufacturer');
  });
});

// ── 4. Absence stays absence ───────────────────────────

describe('missing required physical evidence remains unknown', () => {
  it('an amplifier figure alone does not make a pairing assessable', () => {
    const r = assessPowerMatch(
      [makeComponent('Butler Monads', 'amplifier'), makeComponent('Acora QRC-2', 'speaker')],
      [fact('Butler Monads', 'power_output', '100 Watts RMS @ 8 Ohms', 'butleraudio.com')],
    );
    expect(r.speakerSensitivityDb).toBeNull();
    expect(r.speakerSensitivityProvenance).toBe('unknown');
    expect(r.compatibility).toBe('unknown');
    expect(r.estimatedMaxCleanSPL).toBeNull();
  });

  it('a non-physical manufacturer fact does not stand in for a missing one', () => {
    // A cabinet material is a real published fact and answers nothing about
    // whether the amplifier can drive the speaker.
    const r = assessPowerMatch(
      [makeComponent('Butler Monads', 'amplifier'), makeComponent('Acora QRC-2', 'speaker')],
      [
        fact('Butler Monads', 'power_output', '100 Watts RMS @ 8 Ohms', 'butleraudio.com'),
        toEvidenceItem('Acora QRC-2', {
          field: 'cabinet_material', value: 'Granite',
          sourceUrl: 'https://acoraaudio.com/products/x', quotedText: 'Granite',
        }, Date.now()),
      ],
    );
    expect(r.compatibility).toBe('unknown');
  });

  it('an unparseable published figure is a figure we do not hold', () => {
    const r = assessPowerMatch(
      [makeComponent('Butler Monads', 'amplifier'), makeComponent('Acora QRC-2', 'speaker')],
      [
        fact('Butler Monads', 'power_output', '100 Watts RMS @ 8 Ohms', 'butleraudio.com'),
        fact('Acora QRC-2', 'sensitivity', 'see chart', 'acoraaudio.com'),
      ],
    );
    expect(r.compatibility).toBe('unknown');
  });
});

// ── 5 & 6. Effect on Evaluate ──────────────────────────

function context(text: string, evidence: EvidenceItem[] = []): string {
  const r = buildSystemAssessment(
    text, extractSubjectMatches(text), undefined, undefined, undefined, evidence,
  ) as { response?: { systemContext?: string } };
  return r?.response?.systemContext ?? '';
}

const NO_CHANGE =
  /no obvious bottleneck|nothing needs correcting|No single component demands change/i;

describe('the coherent high-sensitivity control stays confidently coherent', () => {
  // Leben CS600X into Klipsch Cornwall IV — ample headroom. Manufacturer
  // evidence in scope must not manufacture a constraint here.
  const evidence = [
    fact('Leben CS600X', 'power_output', '32 W', 'lebenhifi.com'),
    fact('Klipsch Cornwall IV', 'sensitivity', '102dB @ 2.83V / 1m', 'klipsch.com'),
  ];
  const text = 'Assess my system: Amp: Leben CS600X Speakers: Klipsch Cornwall IV '
    + 'Dac: Denafrips Pontus II';

  it('invents no headroom constraint', () => {
    expect(context(text, evidence)).not.toMatch(/limited headroom|underpowered/i);
  });

  it('reads the same with and without the evidence', () => {
    expect(context(text, evidence)).toBe(context(text));
  });
});

describe('a genuine low-power pairing cannot coexist with no_change', () => {
  /**
   * The whole point of the wiring, end to end.
   *
   * The Decware SE84UFO is catalogued at 2 W, so the system clears the
   * confidence gate and the deterministic path runs. The Acora QRC-2 is not
   * catalogued, so its sensitivity exists ONLY as a manufacturer-published
   * fact — and without it the pairing is unassessable and the advisor says so
   * rather than pretending otherwise.
   *
   * 84 + 10*log10(2) ≈ 87 dB ⇒ 'mismatched'.
   */
  const evidence = [fact('Acora QRC-2', 'sensitivity', '84 dB', 'acoraaudio.com')];
  const text = 'Assess my system: Amp: Decware SE84UFO Speakers: Acora QRC-2 '
    + 'Dac: Denafrips Pontus II';

  it('without the evidence, declines to judge the pairing', () => {
    const out = context(text);
    expect(out).not.toMatch(/underpowered/i);
    // Absence is stated, not smoothed over into "nothing needs correcting".
    expect(out).toMatch(/could not verify that the amplifier and loudspeakers suit each other/i);
  });

  it('with it, states the constraint and the headroom figure', () => {
    const out = context(text, evidence);
    expect(out).toMatch(/underpowered/i);
    expect(out).toMatch(/84 dB/);
    expect(out).toMatch(/~87 dB maximum clean output/);
  });

  it('names the amplifier as the primary leverage', () => {
    expect(context(text, evidence)).toMatch(/\*\*Primary leverage\*\*\s*\n\s*\n\s*The amp/i);
  });

  it('does not also report that nothing needs changing', () => {
    expect(context(text, evidence)).not.toMatch(NO_CHANGE);
  });

  it('frames it as a headroom limit rather than a matter of taste', () => {
    const out = context(text, evidence);
    const decision = out.match(/\*\*Decision\*\*[\s\S]*?(?=\n\*\*|$)/)?.[0] ?? '';
    expect(decision).toMatch(/headroom limit rather than a matter of taste/i);
  });
});
