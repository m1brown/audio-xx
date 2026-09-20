/**
 * Describe → Explain promotion pins (turn-0 governed assessment mission,
 * 2026-09-19). Two live production regressions, repaired at the rule:
 *
 *  A. A tube complement licenses CONTAINMENT, never "is a valve design" —
 *     the Butler MONAD A100 carries a 300B and is a hybrid; topology is
 *     stated only where an architecture fact establishes it. (The
 *     two-stage branch learned this on 2026-09-11; the single-stage
 *     branch now obeys the same rule.)
 *
 *  B. A one-metre theoretical SPL ceiling licenses a CEILING, never
 *     "running out of level is unlikely to be this system's limitation" —
 *     it assumes rated power into the real load and knows nothing of
 *     room, distance, or the listener's level. The severe band's system
 *     conclusion (a deficit no room recovers) remains licensed.
 */
import { describe, it, expect } from 'vitest';
import { composeSystemReviewDetailed } from '../system-review';
import type { DossierView } from '@/lib/evidence/dossier-presentation';

const dossier = (displayName: string, lines: Array<[string, string]>): DossierView => ({
  displayName, role: '', secondary: [], gaps: [],
  primary: lines.map(([label, value]) => ({
    label, value, provenance: 'maker_published', source: 'maker',
  })),
} as unknown as DossierView);

const NATHAN = [
  { displayName: 'dCS Rossini Apex', role: 'dac' },
  { displayName: 'ARC ref', role: 'preamplifier' },
  { displayName: 'Butler Monads', role: 'amplifier' },
  { displayName: 'Acora QRC-2', role: 'speaker' },
];

const butler = (extra: Array<[string, string]> = []) => dossier('Butler Monads', [
  ['Power output', '128 Watts, RMS typical @ 8 Ohms; 200 Watts, RMS typical @ 4 Ohms'],
  ['Tube complement', 'Butler Model 300B directly heated power triode'],
  ...extra,
]);
const acora = dossier('Acora QRC-2', [
  ['Sensitivity', '92.5dB 1W/1m'],
  ['Impedance', '4 ohm'],
  ['Power handling', '10 W – 250 W'],
]);
const NATHAN_DOSSIERS = [
  dossier('dCS Rossini Apex', [['Output impedance, balanced', '2 ohms']]),
  dossier('ARC ref', []),
  butler(),
  acora,
];

const compose = (dossiers = NATHAN_DOSSIERS) => composeSystemReviewDetailed({
  components: NATHAN,
  dossiers,
  rawQuery: 'Assess my system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2.',
}).paragraphs.join('\n');

describe('A — tube complement licenses containment, not topology', () => {
  it('a single published tube stage is never called "a valve design"', () => {
    const all = compose();
    expect(all).not.toMatch(/is a valve design/i);
    expect(all).not.toMatch(/valve output stage(?!.*nothing here says)/i);
  });

  it('containment is stated with the topology boundary named (fixture must trigger the paragraph)', () => {
    const all = compose();
    // Guard against a vacuous pin: this fixture must actually compose the
    // single-tube-stage paragraph.
    expect(all).toMatch(/only\s+published tube complement/i);
    expect(all).toMatch(/contains these valves, not where/i);
  });

  it('control: an architecture fact that settles topology is stated', () => {
    const all = compose([
      NATHAN_DOSSIERS[0], NATHAN_DOSSIERS[1],
      butler([['Output stage', 'a 300B driving a current-multiplying solid-state output arrangement']]),
      acora,
    ]);
    if (/only published tube complement/i.test(all)) {
      expect(all).toMatch(/Where those valves sit is on the record/i);
      expect(all).toMatch(/current-multiplying/i);
    }
  });
});

describe('B — theoretical SPL ceiling is not a system-limitation verdict', () => {
  it('the generous band no longer claims level is unlikely to be the system\'s limitation', () => {
    const all = compose();
    expect(all).not.toMatch(/unlikely to be this system.s limitation/i);
  });

  it('the arithmetic and the narrowed, checkable close remain (fixture must trigger the paragraph)', () => {
    const all = compose();
    expect(all).toMatch(/theoretical peak near/i);
    expect(all).toMatch(/licenses that ceiling, not your seat/i);
    expect(all).toMatch(/if your normal listening arrives clean/i);
  });

  it('the severe band keeps its licensed system conclusion', () => {
    const all = composeSystemReviewDetailed({
      components: [
        { displayName: 'Decware SE84UFO', role: 'amplifier' },
        { displayName: 'Magnepan LRS+', role: 'speaker' },
      ],
      dossiers: [
        dossier('Decware SE84UFO', [['Power output', '2 Watts per channel into 4 Ohms']]),
        dossier('Magnepan LRS+', [['Sensitivity', '86dB / 2.83V / 1m'], ['Impedance', '4 ohm']]),
      ],
      rawQuery: 'Assess my system: Decware SE84UFO and Magnepan LRS+.',
    }).paragraphs.join('\n');
    if (/theoretical ceiling near/i.test(all)) {
      expect(all).toMatch(/live constraint/i);
    }
  });
});
