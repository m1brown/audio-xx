import { describe, it, expect } from 'vitest';
import {
  parseQuantity, parseQuantities, powerForLoad,
  assessDriveCapability, driveSentence, quantitiesCombine, transferFor,
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

/** What Butler actually publishes, in one field, exactly as stored. */
const BUTLER_PUBLISHED =
  'Minimum 100 Watts RMS @ 8 Ohms; 128 Watts, RMS typical @ 8 Ohms; '
  + '200 Watts, RMS typical @ 4 Ohms';

describe('a published field states a TABLE, not a figure', () => {
  const powers = parseQuantities('Butler Monads', 'power_output', BUTLER_PUBLISHED);

  it('keeps every stated power/load pair', () => {
    expect(powers.map((p) => [p.value, p.specifiedIntoOhms]))
      .toEqual([[100, 8], [128, 8], [200, 4]]);
  });

  it('keeps minimum and typical apart, because one is a guarantee', () => {
    expect(powers[0].qualifier).toMatch(/100 W Minimum|Minimum/i);
    expect(powers[1].qualifier).toMatch(/typical/i);
  });

  it('selects the figure specified into the load actually presented', () => {
    // The whole point. Taking the first match reports 100 W into 8Ω and
    // discards the one figure that answers the question being asked.
    expect(powerForLoad(powers, 4)).toMatchObject({ value: 200, specifiedIntoOhms: 4 });
  });

  it('prefers the guaranteed minimum where several figures share a load', () => {
    expect(powerForLoad(powers, 8)).toMatchObject({ value: 100 });
  });

  it('offers nothing for a load no figure was specified into', () => {
    expect(powerForLoad(powers, 2)).toBeUndefined();
  });
});

describe('THE ACORA CASE — the evidence was in hand all along', () => {
  it('is assessable once the 4-ohm figure is not thrown away', () => {
    const d = assessDriveCapability(
      parseQuantities('Butler Monads', 'power_output', BUTLER_PUBLISHED),
      q('Acora QRC-2', 'impedance', '4 ohm'),
      q('Acora QRC-2', 'sensitivity', '86 dB'));
    expect(d.status).toBe('assessable');
    if (d.status !== 'assessable') return;
    expect(d.watts).toBe(200);
    expect(d.intoOhms).toBe(4);
  });

  it('still establishes output at the load when sensitivity is missing', () => {
    // "We know the output at your speaker's load but not its sensitivity" is a
    // far more useful thing to tell a listener than "not established".
    const d = assessDriveCapability(
      parseQuantities('Butler Monads', 'power_output', BUTLER_PUBLISHED),
      q('Acora QRC-2', 'impedance', '4 ohm'), undefined);
    expect(d.status).toBe('incomplete');
    if (d.status !== 'incomplete') return;
    expect(d.watts).toBe(200);
    expect(d.intoOhms).toBe(4);
    expect(d.missing).toContain('sensitivity');
  });

  it('does not mistake the loudspeaker power HANDLING for amplifier output', () => {
    const handling = parseQuantities('Acora QRC-2', 'power_handling', '10 W - 250 W');
    expect(handling[0]).toMatchObject({ quantity: 'power_handling', value: 10 });
    expect(assessDriveCapability(handling, q('Acora QRC-2', 'impedance', '4 ohm'),
      q('Acora QRC-2', 'sensitivity', '86 dB')).status).toBe('incomplete');
  });
});

describe('WHERE THE 4-OHM FIGURE IS NOT PUBLISHED — drive cannot be established', () => {
  // Butler as it would be if only the 8-ohm figure were published — the state
  // the assessment was actually reasoning from before the parser was fixed.
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

describe('Audio XX writes the drive conclusion itself', () => {
  // Three attempts at instructing the model to state this — permitted, then
  // required, then required in capitals — produced three assessments that said
  // nothing about power at all. Generic tonal prose is the cheaper output.
  const butler = parseQuantities('Butler Monads', 'power_output', BUTLER_PUBLISHED);
  const load = q('Acora QRC-2', 'impedance', '4 ohm');

  it('states the figure AT THE LOAD and names the remaining gap', () => {
    const s = driveSentence(
      assessDriveCapability(butler, load, undefined), 'Butler Monads', 'Acora QRC-2')!;
    expect(s).toContain('200 watts into 4 ohms');
    expect(s).toContain("Acora QRC-2's sensitivity is not published");
    // Not "drive is unknown" — that would be false, and is the failure the
    // typed-quantity repair exists to prevent in the other direction.
    expect(s).not.toMatch(/drive.{0,20}(?:unknown|not established)/i);
  });

  it('says drive cannot be established where no figure covers the load', () => {
    const s = driveSentence(
      assessDriveCapability(
        [q('Butler Monads', 'power_output', 'Minimum 100 Watts RMS @ 8 Ohms')],
        load, q('Acora QRC-2', 'sensitivity', '86 dB')),
      'Butler Monads', 'Acora QRC-2')!;
    expect(s).toContain('100 watts into 8 ohms');
    expect(s).toContain('presents 4 ohms');
    expect(s).toMatch(/cannot be established/);
    expect(s).not.toMatch(/synerg|effective|authorit|well matched/i);
  });

  it('sidesteps subject-verb agreement, which product names cannot supply', () => {
    // "Monads" is plural and "Rossini Apex" is not, so no template that agrees
    // with its subject can be written without knowing which.
    for (const name of ['Butler Monads', 'dCS Rossini Apex']) {
      const s = driveSentence(assessDriveCapability(butler, load,
        q('Acora QRC-2', 'sensitivity', '86 dB')), name, 'Acora QRC-2')!;
      expect(s).toContain(`Published figures put the ${name} at`);
    }
  });

  it('offers nothing when nothing was established', () => {
    expect(driveSentence({ status: 'incomplete', missing: 'amplifier power output' },
      'Butler Monads', 'Acora QRC-2')).toBeUndefined();
  });
});
