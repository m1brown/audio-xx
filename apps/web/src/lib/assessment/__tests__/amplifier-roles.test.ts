import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeRole } from '../authoritative';
import { causalCoverage } from '@/lib/artifact/causal-coverage';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * A PREAMPLIFIER IS NOT AN AMPLIFIER.
 *
 * "pre-amplifier" contains "amplifier", and the amplifier test ran first — so
 * every preamplifier was typed as a power amplifier. That is not a labelling
 * nicety. In a chain like ARC Reference 5 → Butler Monads → Acora QRC-2 both
 * amplification boxes then carry the same role, the interface layer takes the
 * FIRST match as the amplification stage, and Audio XX reasons about the
 * PREAMPLIFIER driving the loudspeakers while ignoring the amplifier that
 * actually does — losing the strongest relationship it holds.
 */

const d = (displayName: string, role: string, primary: Array<{ label: string; value: string }> = []): DossierView => ({
  displayName, role,
  primary: primary.map((l) => ({ ...l, sourceClass: 'maker_published' as const })),
  secondary: [], gaps: [], hasDetail: true,
} as never);

describe('the amplifier family normalises to three distinct roles', () => {
  it('a preamplifier is never typed as an amplifier', () => {
    for (const label of ['Pre-amplifier', 'Preamplifier', 'pre-amp', 'preamp', 'Pre amp', 'PREAMP']) {
      expect(normalizeRole(label), label).toBe('preamplifier');
    }
  });

  it('a power amplifier is the amplification stage', () => {
    // `power_amp` is the STORED value. Missing the underscore dropped every
    // power amplifier out of the chain — no role, no interface, and the
    // amplifier-to-loudspeaker relationship absent from a system that has one.
    for (const label of ['Power amplifier', 'power_amp', 'power-amp', 'Power amp']) {
      expect(normalizeRole(label), label).toBe('amplifier');
    }
  });

  it('an unspecified amplifier still resolves, and an integrated stays integrated', () => {
    expect(normalizeRole('Amplifier')).toBe('amplifier');
    expect(normalizeRole('amp')).toBe('amplifier');
    expect(normalizeRole('Integrated amp')).toBe('integrated');
  });
});

describe("Nathan's chain resolves to the right amplification stage", () => {
  const rows = causalCoverage({
    components: [
      { displayName: 'dCS Rossini Apex', role: normalizeRole('dac')! },
      { displayName: 'ARC ref 5', role: normalizeRole('preamp')! },
      { displayName: 'Butler Monads', role: normalizeRole('power_amp')! },
      { displayName: 'Acora QRC-2', role: normalizeRole('speaker')! },
    ],
    dossiers: [
      d('dCS Rossini Apex', 'dac'),
      d('ARC ref 5', 'preamplifier'),
      d('Butler Monads', 'amplifier', [{
        label: 'power output',
        value: '128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms',
      }]),
      d('Acora QRC-2', 'speaker', [
        { label: 'impedance', value: '4 ohm' },
        { label: 'power handling', value: '10 W – 250 W' },
      ]),
    ],
  });

  it('examines the loudspeaker against the POWER amplifier', () => {
    const spk = rows.find((r) => r.to === 'Acora QRC-2')!;
    expect(spk.from).toBe('Butler Monads');
    expect(spk.state).toBe('partially_explained');
  });

  it('never treats the preamplifier as the thing driving the speakers', () => {
    expect(rows.some((r) => r.from === 'ARC ref 5' && r.to === 'Acora QRC-2')).toBe(false);
  });

  it('yields all three line-level and power interfaces, in chain order', () => {
    expect(rows.map((r) => `${r.from}→${r.to}`)).toEqual([
      'dCS Rossini Apex→ARC ref 5',
      'ARC ref 5→Butler Monads',
      'Butler Monads→Acora QRC-2',
    ]);
  });
});

describe('the editor can express what the reasoning layer distinguishes', () => {
  const src = readFileSync('apps/web/src/components/system/SystemEditor.tsx', 'utf8');

  it('offers pre-amplifier and power amplifier', () => {
    expect(src).toMatch(/label: 'Pre-amplifier'/);
    expect(src).toMatch(/label: 'Power amplifier'/);
  });

  it('sets the role, not only the category', () => {
    // Both map to category 'amplifier'; the role is what separates them, and
    // the dropdown never set it before.
    expect(src).toMatch(/role: 'preamp'/);
    expect(src).toMatch(/role: 'power_amp'/);
  });

  it('keeps a plain Amplifier option for rows that never specified', () => {
    expect(src).toMatch(/label: 'Amplifier', category: 'amplifier', role: null/);
  });
});
