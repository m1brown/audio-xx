import { describe, it, expect } from 'vitest';
import { deriveEvidenceLedger } from '../evidence-ledger';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

/**
 * THE LEDGER IS DERIVED, NOT MAINTAINED.
 *
 * It used to be built from a hardcoded table of four products, so every
 * assessment outside that table reported no sources and described itself with
 * a fixed sentence. These are the invariants that make that class impossible:
 * a source appears because evidence from it survives in the assessment, and
 * its displayed role never exceeds what it licensed.
 */

const dcs: DossierView = {
  displayName: 'dCS Rossini Apex',
  primary: [
    { label: 'Independent review', value: 'Stereophile' },
    { label: 'FREQUENCY RESPONSE', value: 'Better than -113dB0', sourceClass: 'maker_published', sourceUrl: 'https://dcsaudio.com/spec' },
  ],
  secondary: [
    { label: 'Stereophile', value: 'deeper silences between notes', publication: 'Stereophile', sourceUrl: 'https://stereophile.com/x', sourceClass: 'listening_observation' },
  ],
  gaps: [], hasDetail: true,
};

const butler: DossierView = {
  displayName: 'Butler Monads',
  primary: [
    { label: 'POWER OUTPUT', value: '200 Watts @ 4 Ohms', sourceClass: 'maker_published', sourceUrl: 'https://butleraudio.com/spec' },
  ],
  secondary: [], gaps: [], hasDetail: false,
};

const listenerOnly: DossierView = {
  displayName: 'Acora QRC-2',
  // No sourceClass anywhere: the listener told us this exists and nothing else.
  primary: [{ label: 'IMPEDANCE', value: '4 ohm' }],
  secondary: [], gaps: [], hasDetail: false,
};

describe('a source appears only if its evidence survives in the assessment', () => {
  it('no dossiers yields no entries and no reassuring sentence', () => {
    const l = deriveEvidenceLedger([]);
    expect(l.entries).toEqual([]);
    expect(l.statement).not.toMatch(/manufacturer|Stereophile|observation/i);
  });

  it('listener-supplied information never becomes published evidence', () => {
    const l = deriveEvidenceLedger([listenerOnly]);
    expect(l.entries).toEqual([]);
    expect(l.statement).not.toMatch(/manufacturer specifications/i);
  });

  it('every entry traces to a line that carried a source class', () => {
    const l = deriveEvidenceLedger([dcs, butler, listenerOnly]);
    for (const e of l.entries) {
      const lines = [dcs, butler, listenerOnly]
        .flatMap((d) => [...d.primary, ...d.secondary]);
      expect(lines.some((ln) => !!ln.sourceClass), e.label).toBe(true);
    }
    // Acora contributed nothing, so nothing is attributed to it.
    expect(l.entries.flatMap((e) => e.licensedFor)).not.toContain('Acora QRC-2');
  });
});

describe("a source's displayed role never exceeds what it licensed", () => {
  it('Stereophile is scoped to the component it wrote about', () => {
    const l = deriveEvidenceLedger([dcs, butler]);
    const stereophile = l.entries.find((e) => e.label === 'Stereophile')!;
    expect(stereophile).toBeDefined();
    expect(stereophile.licensedFor).toEqual(['dCS Rossini Apex']);
    // It said nothing about the amplifier, and the ledger must not imply it did.
    expect(stereophile.licensedFor).not.toContain('Butler Monads');
  });

  it('review evidence for one component never becomes system-wide authority', () => {
    const l = deriveEvidenceLedger([dcs, butler]);
    const reviews = l.entries.filter((e) => e.evidenceClass === 'independent_review');
    const named = new Set(reviews.flatMap((e) => e.licensedFor));
    expect(named.size).toBe(1);
    expect([...named]).toEqual(['dCS Rossini Apex']);
  });

  it('published figures and listening observations stay separate kinds', () => {
    const l = deriveEvidenceLedger([dcs]);
    const classes = l.entries.map((e) => e.evidenceClass);
    expect(classes).toContain('maker_published');
    expect(classes).toContain('independent_review');
    // Two entries, not one merged authority.
    expect(new Set(classes).size).toBe(2);
  });
});

describe('the statement asserts only what is present', () => {
  it('names manufacturer specifications when they are held', () => {
    expect(deriveEvidenceLedger([butler]).statement)
      .toMatch(/published manufacturer specifications/i);
  });

  it('names the publication when exactly one supplied observations', () => {
    expect(deriveEvidenceLedger([dcs]).statement).toMatch(/Stereophile/);
  });

  it('never claims observations the assessment does not hold', () => {
    expect(deriveEvidenceLedger([butler]).statement).not.toMatch(/observation/i);
  });

  it('always credits Audio XX analysis last — the reading is ours', () => {
    for (const set of [[dcs], [butler], [dcs, butler]]) {
      expect(deriveEvidenceLedger(set).statement).toMatch(/Audio XX analysis\.$/);
    }
  });
});

describe('the ledger is a function of the assessment', () => {
  it('same dossiers, same ledger', () => {
    expect(deriveEvidenceLedger([dcs, butler]))
      .toEqual(deriveEvidenceLedger([dcs, butler]));
  });

  it('one maker publishing about two products is one entry, scoped to both', () => {
    const second: DossierView = { ...butler, displayName: 'Butler Something Else' };
    const l = deriveEvidenceLedger([butler, second]);
    const maker = l.entries.filter((e) => e.evidenceClass === 'maker_published');
    expect(maker).toHaveLength(1);
    expect(maker[0].licensedFor).toEqual(['Butler Monads', 'Butler Something Else']);
  });
});
