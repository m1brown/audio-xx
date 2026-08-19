import { describe, it, expect } from 'vitest';
import {
  parseQuantity, assessDriveCapability, quantitiesCombine, transferFor,
} from '../evidence/physical-quantities';

/**
 * Typed quantities — Phase 1 of the representation evolution.
 *
 * The sentence this exists to prevent, published by production:
 *
 *   "The amplifier's substantial power output pairs effectively with the Acora
 *    QRC-2's 4 ohm impedance, ensuring that the speakers are driven with
 *    authority."
 *
 * Every input was real, cited and manufacturer-published. The conclusion does
 * not follow: the power figure is specified INTO 8 OHMS and the loudspeaker is
 * a 4-OHM load. Both had flattened to `power_load` positions, so D-12 saw
 * commensurability and licensed reinforcement.
 */

const q = (subject: string, field: string, raw: string) => parseQuantity(subject, field, raw)!;

describe('a quantity keeps its unit and the condition it was measured under', () => {
  it('parses the Butler figure with its stated load', () => {
    const p = q('Butler Monads', 'power_output', 'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS');
    expect(p).toMatchObject({ quantity: 'power_output', value: 100, unit: 'W', specifiedIntoOhms: 8 });
    expect(p.qualifier).toContain('RMS');
  });

  it('parses the Acora load', () => {
    expect(q('Acora QRC-2', 'impedance', '4 ohm'))
      .toMatchObject({ quantity: 'nominal_impedance', value: 4, unit: 'Ω' });
  });

  it('parses sensitivity', () => {
    expect(q('Klipsch Cornwall IV', 'sensitivity', '102dB @ 2.83V / 1m'))
      .toMatchObject({ quantity: 'sensitivity', value: 102, unit: 'dB' });
  });

  it('records the ABSENCE of a stated load, which is not the same as a mismatch', () => {
    expect(q('Zorblax ZX1', 'power_output', '5 watt').specifiedIntoOhms).toBeUndefined();
  });

  it('returns null rather than inventing a figure from prose', () => {
    // The live defect: a measurement paragraph stuffed into a scalar slot.
    expect(parseQuantity('dCS Rossini Apex', 'impedance',
      'Measured performance was beyond reproach, with wide input sampling range')).toBeNull();
  });
});

describe('THE BUTLER / ACORA CASE — drive cannot be established', () => {
  const power = q('Butler Monads', 'power_output', 'Minimum 100 Watts RMS @ 8 Ohms');
  const load = q('Acora QRC-2', 'impedance', '4 ohm');
  const sens = q('Acora QRC-2', 'sensitivity', '86 dB');

  it('reports a load mismatch rather than a pass or a constraint', () => {
    const d = assessDriveCapability(power, load, sens);
    expect(d.status).toBe('load_mismatch');
    if (d.status !== 'load_mismatch') return;
    expect(d.specifiedIntoOhms).toBe(8);
    expect(d.loadOhms).toBe(4);
    expect(d.missing).toContain('4Ω');
  });

  it('NEVER infers output into a load it was not specified into', () => {
    const d = assessDriveCapability(power, load, sens);
    // No watts figure is asserted for 4Ω — not doubled, not held constant.
    expect(JSON.stringify(d)).not.toContain('200');
    expect(d.status).not.toBe('assessable');
  });
});

describe('the controls that must keep working', () => {
  it('5W SET into an 86dB Magnepan still diagnoses a constraint', () => {
    // A bare "5 watt" carries no stated load, so it reads as a nominal rating.
    // Refusing it would discard a fact the listener supplied and leave a real
    // mismatch undiagnosed.
    const d = assessDriveCapability(
      q('Zorblax ZX1 5 watt SET', 'power_output', '5 watt'),
      q('Magnepan LRS+', 'impedance', '4 ohm'),
      q('Magnepan LRS+', 'sensitivity', '86 dB'));
    expect(d.status).toBe('assessable');
    if (d.status !== 'assessable') return;
    expect(d.watts).toBe(5);
    expect(d.sensitivityDb).toBe(86);
  });

  it('Leben into a Cornwall IV remains assessable and coherent', () => {
    const d = assessDriveCapability(
      q('Leben CS600', 'power_output', '32 watts'),
      q('Klipsch Cornwall IV', 'impedance', '8 ohms'),
      q('Klipsch Cornwall IV', 'sensitivity', '102dB @ 2.83V / 1m'));
    expect(d.status).toBe('assessable');
  });

  it('a matched stated load is assessable', () => {
    const d = assessDriveCapability(
      q('Amp', 'power_output', '60 W into 4 ohms'),
      q('Speaker', 'impedance', '4 ohms'),
      q('Speaker', 'sensitivity', '88 dB'));
    expect(d.status).toBe('assessable');
  });

  it('missing sensitivity is incomplete, not fine', () => {
    const d = assessDriveCapability(
      q('Amp', 'power_output', '100 W'), q('Speaker', 'impedance', '4 ohms'), undefined);
    expect(d.status).toBe('incomplete');
  });
});

describe('being numeric is not a relation', () => {
  it('refuses to combine two quantities that do not produce a conclusion', () => {
    expect(quantitiesCombine('power_output', 'power_handling')).toBe(false);
    expect(quantitiesCombine('sensitivity', 'nominal_impedance')).toBe(false);
  });

  it('permits only the pairings a rule exists for', () => {
    expect(quantitiesCombine('power_output', 'sensitivity')).toBe(true);
    expect(quantitiesCombine('power_output', 'nominal_impedance')).toBe(true);
  });
});

describe('transfer is a property of the premise', () => {
  it('marks an observation made through other electronics as transfer-limited', () => {
    // The Acora case: the only published listening account was made through
    // Ideon and JMF electronics, not this listener's chain.
    expect(transferFor('associated_equipment')).toBe('transfer_limited');
  });

  it('treats conditions about the product itself as conditioned, not transfer-limited', () => {
    for (const k of ['break_in', 'setup', 'mode', 'level']) {
      expect(transferFor(k)).toBe('conditioned');
    }
  });

  it('treats an unconditioned observation as direct', () => {
    expect(transferFor(undefined)).toBe('direct');
  });
});
