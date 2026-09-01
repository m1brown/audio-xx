import { describe, it, expect } from 'vitest';
import { assessPowerMatch } from '../consultation';
import { toEvidenceItem } from '../evidence/manufacturer-facts';
import type { EvidenceItem } from '../evidence/evidence-types';

/**
 * Physical-fact precedence for the compatibility check.
 *
 * PRECEDENCE (founder, 2026-08-18):
 *   1. curated/catalog product facts
 *   2. manufacturer facts
 *   3. listener-supplied explicit specifications, where already licensed
 *   4. otherwise unknown
 *
 * Model memory has no branch. A remembered wattage is exactly the kind of
 * plausible figure that would make a verdict feel authoritative while resting
 * on nothing checkable, and the point of this path is that it rests on
 * something.
 *
 * This does not broaden reasoning. It lets the compatibility machinery that
 * already exists see evidence Audio XX already holds, instead of reporting
 * 'unknown' beside a published specification.
 */

const amp = (name: string, watts?: number) => ({
  displayName: name, role: 'amplifier',
  product: watts == null ? undefined : ({ power_watts: watts } as never),
}) as never;
const speaker = (name: string, sensitivity?: number) => ({
  displayName: name, role: 'speaker',
  product: sensitivity == null ? undefined : ({ sensitivity_db: sensitivity } as never),
}) as never;

const fact = (product: string, field: 'power_output' | 'sensitivity', value: string): EvidenceItem =>
  toEvidenceItem(product, {
    field, value,
    sourceUrl: `https://${product.split(' ')[0].toLowerCase()}.com/spec`,
    quotedText: `Specification — ${field}: ${value}`,
  }, Date.now());

describe('precedence — catalog first, manufacturer second, listener third', () => {
  it('CATALOG WINS where present, even with manufacturer facts available', () => {
    const r = assessPowerMatch(
      [amp('Leben CS600', 32), speaker('Klipsch Cornwall IV', 102)],
      [fact('Leben CS600', 'power_output', '99 W'),
        fact('Klipsch Cornwall IV', 'sensitivity', '55 dB')],
    );
    expect(r.ampPowerWatts).toBe(32);
    expect(r.speakerSensitivityDb).toBe(102);
    expect(r.powerSource).toBe('catalog');
    expect(r.sensitivitySource).toBe('catalog');
  });

  it('MANUFACTURER FACTS make an otherwise unassessable pairing assessable', () => {
    // The change this pass exists for. Neither component is catalogued; both
    // makers publish the figure.
    const r = assessPowerMatch(
      [amp('Butler Monads'), speaker('Acora QRC-2')],
      [fact('Butler Monads', 'power_output', '100 Watts RMS @ 8 Ohms'),
        fact('Acora QRC-2', 'sensitivity', '86 dB')],
    );
    expect(r.compatibility).not.toBe('unknown');
    expect(r.ampPowerWatts).toBe(100);
    expect(r.speakerSensitivityDb).toBe(86);
    expect(r.powerSource).toBe('manufacturer');
    expect(r.sensitivitySource).toBe('manufacturer');
  });

  it('LISTENER wattage is used when neither catalog nor manufacturer holds it', () => {
    const r = assessPowerMatch(
      [amp('Zorblax ZX1 5 watt SET'), speaker('Magnepan LRS+', 86)], [],
    );
    expect(r.ampPowerWatts).toBe(5);
    expect(r.powerSource).toBe('listener');
    expect(r.sensitivitySource).toBe('catalog');
  });

  it('manufacturer evidence outranks the listener’s own words', () => {
    const r = assessPowerMatch(
      [amp('Zorblax ZX1 5 watt SET'), speaker('Magnepan LRS+', 86)],
      [fact('Zorblax ZX1 5 watt SET', 'power_output', '40 W')],
    );
    expect(r.ampPowerWatts).toBe(40);
    expect(r.powerSource).toBe('manufacturer');
  });
});

describe('unknown stays unknown', () => {
  it('reports unknown when no source supplies sensitivity', () => {
    const r = assessPowerMatch(
      [amp('Butler Monads'), speaker('Acora QRC-2')],
      [fact('Butler Monads', 'power_output', '100 W')],
    );
    expect(r.compatibility).toBe('unknown');
    expect(r.sensitivitySource).toBe('none');
    expect(r.powerSource).toBe('manufacturer');
  });

  it('ignores manufacturer facts belonging to another product', () => {
    // Keyed by product identity; a Klipsch figure cannot answer for an Acora.
    const r = assessPowerMatch(
      [amp('Butler Monads'), speaker('Acora QRC-2')],
      [fact('Klipsch Cornwall IV', 'sensitivity', '102 dB')],
    );
    expect(r.speakerSensitivityDb).toBeNull();
    expect(r.compatibility).toBe('unknown');
  });

  it('admits no figure from any other evidence class', () => {
    // Model memory has no route in. Recast the same numbers as model-tier and
    // the pairing is unassessable again.
    const modelTier: EvidenceItem[] = [
      { ...fact('Butler Monads', 'power_output', '100 W'),
        evidenceClass: 'model', tier: 'model' },
      { ...fact('Acora QRC-2', 'sensitivity', '86 dB'),
        evidenceClass: 'model', tier: 'model' },
    ];
    const r = assessPowerMatch([amp('Butler Monads'), speaker('Acora QRC-2')], modelTier);
    expect(r.compatibility).toBe('unknown');
    expect(r.powerSource).toBe('none');
  });
});

describe('the two behavioural controls still discriminate', () => {
  it('COHERENT — high sensitivity and adequate power stays comfortable', () => {
    const r = assessPowerMatch(
      [amp('Butler Monads'), speaker('Klipsch Cornwall IV')],
      [fact('Butler Monads', 'power_output', '100 Watts RMS @ 8 Ohms'),
        fact('Klipsch Cornwall IV', 'sensitivity', '102 dB @ 2.83V / 1m')],
    );
    expect(r.compatibility).toBe('optimal');
  });

  it('CONSTRAINED — low power into a difficult load is named', () => {
    const r = assessPowerMatch(
      [amp('Zorblax ZX1 5 watt SET'), speaker('Acora QRC-2')],
      [fact('Acora QRC-2', 'sensitivity', '86 dB')],
    );
    // 5 W into 86 dB ⇒ ~93 dB max clean output.
    expect(['strained', 'mismatched']).toContain(r.compatibility);
    expect(r.estimatedMaxCleanSPL).toBeGreaterThan(90);
    expect(r.estimatedMaxCleanSPL).toBeLessThan(95);
  });
});
