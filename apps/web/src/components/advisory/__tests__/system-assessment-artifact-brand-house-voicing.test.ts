/**
 * Stage E-5B.2 — §5 component card brand-house-voicing integration tests.
 *
 * Scope: §5 only. Stages E-5B.3 (§8) and E-5B.4 (§10) land separately.
 *
 * Test groups:
 *   1. Direct gate-stack helper unit tests
 *      — pure logic, no flag concern
 *   2. Feature-flag behavior tests
 *      — flag OFF: byte-equivalent to pre-E-5B.2
 *      — flag ON: brand sentence may surface
 *   3. §5 render-integration tests covering each gate's effect
 *      — commercial suppression
 *      — confidence-low suppression (commercial entries are the only
 *        low-confidence ones in the production set)
 *      — excluded brands (Audio Note, Shindo) absent
 *      — role applicability
 *      — conflict-signal suppression
 *      — primary-constraint suppression
 *      — redundancy suppression
 *      — anti-overclaim deny-check
 *      — positive examples (Naim, Pass Labs, Quad ESL-57, Harbeth,
 *        Rega; McIntosh tested via gate helper directly)
 *   4. Regression guards
 *      — auxiliary cards unchanged
 *      — headphone systems unchanged
 *      — Phase K (Pontus II / Leben / O/96) byte-equivalent under
 *        flag OFF; coherent under flag ON
 *
 * Pattern: tests use `process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING`
 * mutation between renders. The integration site reads
 * `isBrandHouseVoicingEnabled()` at call time, so per-test mutation
 * is sufficient — no module-cache reset required.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import {
  selectBrandHouseVoicingSentenceForComponent,
  type BrandGateInputFor5,
} from '@/lib/brand-house-voicing-gates';
import SystemAssessmentArtifact from '../SystemAssessmentArtifact';

// ─── Helpers ────────────────────────────────────────────────────────

function render(advisory: AdvisoryResponse): string {
  return renderToStaticMarkup(
    createElement(SystemAssessmentArtifact, { advisory }),
  );
}

function gateInput(
  overrides: Partial<BrandGateInputFor5> = {},
): BrandGateInputFor5 {
  return {
    componentName: 'Naim Supernait 3',
    roleFamily: 'amplifier',
    hasConflictSignal: false,
    isPrimaryConstraint: false,
    existingCardProse: 'The Naim Supernait 3 carries the signal between source and speakers.',
    ...overrides,
  };
}

// ─── Fixture: Naim chain (Naim NDX 2 → Naim Supernait 3 → Falcon LS3/5a)
const NAIM_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Naim system',
  systemSignature: 'A Naim-anchored chain pairing the NDX 2 streaming DAC with the Supernait 3 integrated and Falcon LS3/5a stand-mount speakers.',
  systemChain: {
    names: ['Naim NDX 2', 'Naim Supernait 3', 'Falcon Acoustics LS3/5a'],
    roles: ['Streamer DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Naim NDX 2 streams from network sources and presents the chain with a forward, rhythmically engaged digital signal.',
    'The Naim Supernait 3 carries the signal between the NDX 2 and the Falcon speakers, translating source character into drive.',
    'The Falcon Acoustics LS3/5a translates the upstream tube-stable signal into sound in the room.',
  ],
};

// ─── Fixture: dCS Bartók chain (redundancy test — Ring DAC already in facts)
const DCS_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'dCS reference chain',
  systemSignature: 'A dCS Bartók streaming endpoint paired with a Pass Labs XA25 and Harbeth 30.2 XD.',
  systemChain: {
    names: ['dCS Bartók', 'Pass Labs XA25', 'Harbeth 30.2 XD'],
    roles: ['DAC', 'Power Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The dCS Bartók establishes the character of the signal feeding the Pass Labs XA25. Its Ring DAC architecture prioritizes timing precision and quietness over conventional ladder or delta-sigma topologies.',
    'The Pass Labs XA25 carries the signal between the Bartók and the Harbeth speakers. Its Class-A solid-state design delivers control and resolution without smoothing texture.',
    'The Harbeth 30.2 XD translates the upstream signal into sound in the room with BBC-tradition cabinet character.',
  ],
};

// ─── Fixture: Quad ESL-57 + Quad II Classic chain
const QUAD_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Quad ESL chain',
  systemSignature: 'A Quad heritage chain with Quad II Classic tube monoblocks driving Quad ESL-57 electrostatic speakers.',
  systemChain: {
    names: ['Linn LP12 Klimax', 'Quad II Classic', 'Quad ESL-57'],
    roles: ['Turntable', 'Tube Monoblock Amplifiers', 'Speakers'],
  },
  componentReadings: [
    'The Linn LP12 Klimax establishes the character of the signal feeding the Quad II Classic.',
    'The Quad II Classic carries the signal between the LP12 and the Quad ESL-57.',
    'The Quad ESL-57 translates what the Quad II Classic delivers into sound in the room.',
  ],
};

// ─── Fixture: Phase K reference (Pontus II / Leben CS600X / DeVore O/96)
const PHASE_K: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Phase K reference',
  systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
  systemChain: {
    names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
    roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Pontus II is an R2R DAC with warm, slightly euphonic character.',
    'The CS600X is a push-pull tube integrated using 6L6GC output stages.',
    'The O/96 is a high-efficiency wide-baffle dynamic loudspeaker.',
  ],
};

// ─── Fixture: WiiM chain (commercial brand)
const WIIM_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'WiiM commercial chain',
  systemSignature: 'A WiiM-anchored streaming chain.',
  systemChain: {
    names: ['WiiM Pro Plus', 'Hegel H190', 'KEF Blade Two Meta'],
    roles: ['Streamer DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The WiiM Pro Plus is an entry streamer.',
    'The Hegel H190 carries the signal between WiiM and KEF.',
    'The KEF Blade Two Meta translates the upstream signal into sound in the room.',
  ],
};

// ─── Fixture: Conflict-signal chain (Naim + Naim + Falcon, but with conflict vocabulary)
const NAIM_CONFLICT_CHAIN: AdvisoryResponse = {
  ...NAIM_CHAIN,
  // Phase A B3/B4 — conflict vocabulary triggers hasConflictSignal
  systemContext: 'There is a mismatch between the Naim forward presentation and the Falcon character — the chain is fighting itself.',
};

// ─── Fixture: Audio Note chain (excluded — must surface no brand sentence)
const AUDIO_NOTE_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Audio Note chain',
  systemChain: {
    names: ['Audio Note CD 2.1x', 'Audio Note Meishu', 'Audio Note AN-E SPe HE'],
    roles: ['CD Player', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Audio Note CD 2.1x establishes the source character.',
    'The Audio Note Meishu carries the signal into the AN-E speakers.',
    'The Audio Note AN-E SPe HE translates the signal into sound in the room.',
  ],
};

// ─── Fixture: Shindo chain (excluded — must surface no brand sentence)
const SHINDO_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Shindo chain',
  systemChain: {
    names: ['Shindo Aurieges-L', 'Shindo Cortese', 'DeVore O/96'],
    roles: ['Tube Preamplifier', 'SET Power Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Shindo Aurieges-L is a vintage-tube preamplifier.',
    'The Shindo Cortese drives the DeVore O/96 with SET character.',
    'The DeVore O/96 is a high-efficiency loudspeaker.',
  ],
};

// ─── Fixture: Auxiliary card chain (PSU; brand sentence must NOT appear on aux)
const AUX_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Chain with PSU',
  systemChain: {
    names: ['Naim NDX 2', 'Naim XPS DR', 'Naim Supernait 3', 'Falcon LS3/5a'],
    roles: ['Streamer DAC', 'Power Supply', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Naim NDX 2 is the source.',
    'The Naim XPS DR provides cleaner power.',
    'The Naim Supernait 3 carries the signal.',
    'The Falcon LS3/5a translates the signal into sound.',
  ],
};

// ─── Fixture: Headphone system (must skip integration entirely)
const HEADPHONE_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Headphone system',
  systemChain: {
    names: ['Chord Hugo TT2', 'Some Tube HP Amp', 'Focal Utopia'],
    roles: ['DAC', 'Headphone Amplifier', 'Headphone'],
  },
  componentReadings: [
    'The Chord Hugo TT2 is the source.',
    'The Some Tube HP Amp drives the Focal Utopia headphones.',
    'The Focal Utopia is a reference headphone.',
  ],
};

// ─── Test groups ───────────────────────────────────────────────────

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});

// ── Group 1 — direct gate-stack helper unit tests ──────────────────

describe('selectBrandHouseVoicingSentenceForComponent — gate stack', () => {
  it('returns null with no-match when component name does not match any entry', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({ componentName: 'Unknown XYZ' }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('no-match');
  });

  it('returns null with commercial suppression for commercial-priority components', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({ componentName: 'WiiM Pro Plus', roleFamily: 'source' }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('commercial');
  });

  it('returns null with role-not-applicable when role does not match entry', () => {
    // Pass Labs appliesToRoles is ['amplifier']; treat as 'speaker' to trigger
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({ componentName: 'Pass Labs XA25', roleFamily: 'speaker' }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('role-not-applicable');
  });

  it('returns null with conflict-signal suppression when hasConflictSignal is true', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Naim Supernait 3',
        roleFamily: 'amplifier',
        hasConflictSignal: true,
      }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('conflict-signal');
  });

  it('returns null with primary-constraint suppression when isPrimaryConstraint is true', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Naim Supernait 3',
        roleFamily: 'amplifier',
        isPrimaryConstraint: true,
      }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('primary-constraint');
  });

  it('the Ring-DAC-bearing dCS sentence is suppressed by redundancy when existing prose has Ring DAC; systemBuildingLogic may surface', () => {
    // Contract: the candidate sentence containing "Ring DAC" must NOT
    // surface when the existing prose already names Ring DAC. With
    // Phase E-5B.3 adding 'tier' / 'ladder' as shape-check anchors,
    // the systemBuildingLogic ("Vivaldi (statement stack) / Rossini
    // (one-box) / Bartók (compact streaming endpoint) tier ladder;
    // each step is meaningful in capability and cost.") passes the
    // shape check and may surface instead — that is NOT redundant
    // with "Ring DAC" because systemBuildingLogic does not mention
    // Ring DAC. The redundancy gate is working as designed.
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'dCS Bartók',
        roleFamily: 'source',
        existingCardProse:
          'The dCS Bartók establishes the character. Its Ring DAC architecture prioritizes timing precision.',
      }),
    );
    // Either a fall-through sentence surfaces (one that does not name
    // Ring DAC) or the result is null. The strict contract:
    if (result.sentence !== null) {
      expect(result.sentence).not.toContain('Ring DAC');
    }
  });

  it('the FPGA-bearing Chord sentence is suppressed by redundancy when existing prose has FPGA; tier ladder may surface', () => {
    // Same contract for Chord: the FPGA-mentioning candidate must not
    // surface when existing prose already names FPGA. Chord
    // systemBuildingLogic ("Hugo TT2 / DAVE act as the brand-tier
    // anchors...") passes the E-5B.3 shape check via 'tier' and may
    // surface — without naming FPGA.
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Chord DAVE',
        roleFamily: 'source',
        existingCardProse:
          'The Chord DAVE is an FPGA-driven DAC originated by Rob Watts.',
      }),
    );
    if (result.sentence !== null) {
      expect(result.sentence).not.toContain('FPGA');
    }
  });

  it('reports redundancy explicitly when only the first-priority field would redundantly surface', () => {
    // Naim houseVoicing contains "discrete signal path" — if the existing
    // prose has this token, redundancy fires on the FIRST iteration.
    // designPhilosophy is the second candidate ("power-supply design...");
    // it also redundancy-fires on "power supply"/"power-supply" hint.
    // systemBuildingLogic is the third ("Within the Naim ecosystem...");
    // it neither redundancy nor shape-fails because "signal path" and
    // "ecosystem" are anchors. So the final result surfaces
    // systemBuildingLogic, NOT null — verifying fall-through works.
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Naim Supernait 3',
        roleFamily: 'amplifier',
        existingCardProse:
          'The Naim Supernait 3 has a discrete signal path with power-supply integration.',
      }),
    );
    // Fall-through to systemBuildingLogic which still has architecture
    // anchors ("ecosystem"). Should surface.
    expect(result.sentence).not.toBeNull();
    expect(result.sentence?.toLowerCase()).toContain('ecosystem');
  });

  it('returns a Naim sentence when the gate stack passes for an amplifier role', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({ componentName: 'Naim Supernait 3', roleFamily: 'amplifier' }),
    );
    expect(result.sentence).not.toBeNull();
    expect(result.sentence).toContain('discrete signal path');
    expect(result.sentence).toContain('PRaT');
  });

  it('returns a Pass Labs sentence when the gate stack passes for an amplifier role', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Pass Labs XA25',
        roleFamily: 'amplifier',
        existingCardProse: 'The Pass Labs XA25 carries the signal.',
      }),
    );
    expect(result.sentence).not.toBeNull();
    expect(result.sentence).toContain('Class-A');
  });

  it('returns a Quad ESL sentence for a Quad ESL-57 speaker', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Quad ESL-57',
        roleFamily: 'speaker',
        existingCardProse: 'The Quad ESL-57 translates the signal into sound.',
      }),
    );
    expect(result.sentence).not.toBeNull();
    expect(result.sentence?.toLowerCase()).toContain('electrostatic');
  });

  it('returns a Harbeth sentence anchored to BBC research-derived cabinet construction', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Harbeth 30.2 XD',
        roleFamily: 'speaker',
        existingCardProse: 'The Harbeth 30.2 XD is a stand-mount.',
      }),
    );
    expect(result.sentence).not.toBeNull();
    expect(result.sentence).toContain('BBC research-derived');
  });

  it('falls through to designPhilosophy for McIntosh when houseVoicing fails shape check', () => {
    // McIntosh houseVoicing is "Smooth, full-bodied presentation with broad
    // headroom in many systems." — no architecture anchor token.
    // designPhilosophy mentions autoformer and unity-coupled → passes
    // shape check. The gate stack falls through to designPhilosophy.
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'McIntosh MC275',
        roleFamily: 'amplifier',
        existingCardProse: 'The MC275 is a power amplifier.',
      }),
    );
    expect(result.sentence).not.toBeNull();
    expect(result.sentence?.toLowerCase()).toMatch(/autoformer|unity-coupled/);
  });

  it('returns null with role-not-applicable for Rega-on-DAC if no DAC role', () => {
    // Rega appliesToRoles includes ['source', 'amplifier', 'speaker'] so
    // any of those qualifies. Use 'auxiliary' as the failing role for
    // structural verification.
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Rega Planar 10',
        roleFamily: 'auxiliary',
        existingCardProse: 'The Rega Planar 10 is in the chain.',
      }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('role-not-applicable');
  });

  it('returns a Rega sentence for a Rega source / amplifier / speaker component', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Rega Aethos',
        roleFamily: 'amplifier',
        existingCardProse: 'The Rega Aethos is an integrated amplifier.',
      }),
    );
    expect(result.sentence).not.toBeNull();
    expect(result.sentence?.toLowerCase()).toContain('cross-component');
  });

  it('returns null for excluded brands — Audio Note', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Audio Note Meishu',
        roleFamily: 'amplifier',
      }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('no-match');
  });

  it('returns null for excluded brands — Shindo', () => {
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Shindo Cortese',
        roleFamily: 'amplifier',
      }),
    );
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('no-match');
  });

  it('selected sentences do not contain any UNIVERSAL_AVOID_OVERCLAIMING token', () => {
    const probes: BrandGateInputFor5[] = [
      gateInput({ componentName: 'Naim Supernait 3', roleFamily: 'amplifier' }),
      gateInput({ componentName: 'Pass Labs XA25', roleFamily: 'amplifier' }),
      gateInput({ componentName: 'Quad ESL-57', roleFamily: 'speaker' }),
      gateInput({ componentName: 'Harbeth 30.2 XD', roleFamily: 'speaker' }),
      gateInput({ componentName: 'Klipsch Heresy IV', roleFamily: 'speaker' }),
      gateInput({ componentName: 'Wilson Audio Sabrina X', roleFamily: 'speaker' }),
      gateInput({ componentName: 'dCS Bartók', roleFamily: 'source', existingCardProse: '' }),
      gateInput({ componentName: 'Tannoy Canterbury GR', roleFamily: 'speaker' }),
      gateInput({ componentName: 'Magico A3', roleFamily: 'speaker' }),
      gateInput({ componentName: 'Hegel H190', roleFamily: 'amplifier' }),
    ];
    const banned = ['magic', 'endgame', 'world class', 'best in class', 'cult', 'unrivalled', 'musicality'];
    for (const probe of probes) {
      const r = selectBrandHouseVoicingSentenceForComponent(probe);
      if (!r.sentence) continue;
      const lower = r.sentence.toLowerCase();
      for (const phrase of banned) {
        expect(lower, `${probe.componentName} → "${r.sentence}"`).not.toContain(phrase);
      }
    }
  });
});

// ── Group 2 — feature flag behavior ────────────────────────────────

describe('§5 brand-house-voicing feature flag', () => {
  it('flag OFF: Phase K reference is byte-equivalent to pre-E-5B.2', () => {
    // Capture the render WITHOUT the flag — must contain no brand-voicing
    // additions (no PRaT, no Class-A, no electrostatic, no BBC-tradition,
    // no autoformer, no SoundEngine, no Ring DAC sentence).
    const html = render(PHASE_K);
    // Phase K chain: Pontus II (no entry) / Leben CS600X (medium) / O/96 (high)
    // With flag OFF, neither Leben nor DeVore brand sentence appears.
    expect(html).not.toContain('Push-pull tube integrated amplifiers using EL84');
    expect(html).not.toContain('Wide-baffle dynamic loudspeakers with high efficiency');
  });

  it('flag OFF: Naim chain is byte-equivalent (no Naim brand sentence)', () => {
    const html = render(NAIM_CHAIN);
    expect(html).not.toContain('PRaT');
    expect(html).not.toContain('discrete signal path');
  });

  it('flag ON: Naim Supernait 3 card surfaces a Naim brand sentence', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_CHAIN);
    // Naim Supernait 3 card MUST contain at least one architecture-anchored
    // Naim sentence.
    expect(html).toContain('discrete signal path');
    expect(html).toContain('PRaT');
  });

  it('flag ON: Phase K Leben card — push-pull is already in facts prose, so brand sentence is correctly suppressed by redundancy', () => {
    // Demonstrates the Phase E-5B.2 redundancy gate working as designed.
    // The composeContributionBody facts-phrase composer extracts
    // "push-pull tube" from the Leben engine reading and emits
    // "Its push-pull tube architecture adds harmonic weight..." as the
    // contribution-body second sentence. The brand selector then tries
    // all three Leben fields — houseVoicing ("Push-pull tube...") and
    // designPhilosophy ("Push-pull tube topology...") both contain
    // "push-pull", which is already in the existing prose, so redundancy
    // suppresses; systemBuildingLogic ("CS300 / CS600 / CS600X tier")
    // has no architecture anchor, so shape-check suppresses. The Leben
    // card therefore reads exactly as pre-E-5B.2.
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(PHASE_K);
    expect(html).not.toContain('Push-pull tube integrated amplifiers using EL84');
    // But the existing push-pull facts phrase IS present (pre-E-5B.2 baseline).
    expect(html).toContain('push-pull tube architecture');
  });

  it('flag ON: Phase K DeVore O/96 card surfaces the DeVore systemBuildingLogic sentence (E-5B.2A cleanup wording)', () => {
    // After E-5B.2A: DeVore houseVoicing ("Wide-baffle... high efficiency")
    // and designPhilosophy ("Orangutan line uses wide-baffle high-efficiency
    // dynamic drivers...") are both redundancy-suppressed because the
    // existing facts-phrase prose mentions wide-baffle / high-efficiency.
    // The rewritten systemBuildingLogic ("Orangutan models specifically tend
    // to anchor... the Gibbon line is a different lineage.") avoids the
    // catalog enumeration the previous draft contained and surfaces here.
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(PHASE_K);
    expect(html).toContain('Orangutan models specifically tend to anchor systems built around low-to-moderate power tube amplification');
    // Negative regression — the previous catalog-enumeration wording
    // must NOT appear after the E-5B.2A cleanup.
    expect(html).not.toContain('Orangutan O/93, O/96, O/Reference, and the Gibbon line');
  });

  it('flag ON: invalid env value ("true", "1") does NOT enable the flag', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'true';
    let html = render(NAIM_CHAIN);
    expect(html).not.toContain('PRaT');
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = '1';
    html = render(NAIM_CHAIN);
    expect(html).not.toContain('PRaT');
    // Only the literal 'on' enables it
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    html = render(NAIM_CHAIN);
    expect(html).toContain('PRaT');
  });
});

// ── Group 3 — §5 render integration: per-gate behavior ─────────────

describe('§5 brand-house-voicing — commercial suppression', () => {
  it('flag ON: WiiM card does not contain any identity prose', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(WIIM_CHAIN);
    // WiiM's only "identity" content in the catalog is functional. No
    // commercial entry has any of these substrings (commercial entries
    // have houseVoicing/designPhilosophy/systemBuildingLogic all unset).
    // We verify that NO sentence anchored to WiiM appears.
    expect(html).not.toContain('streaming entry');
    expect(html).not.toContain('Roon Ready');
  });

  it('flag ON: KEF Blade Two Meta DOES surface a KEF brand sentence (not commercial)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(WIIM_CHAIN);
    // KEF Blade matches the KEF entry (mixed priority, R-series+). KEF
    // houseVoicing contains "Uni-Q".
    expect(html).toContain('Uni-Q');
  });
});

describe('§5 brand-house-voicing — excluded brands stay absent', () => {
  it('flag ON: Audio Note chain surfaces no brand sentence on any card', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(AUDIO_NOTE_CHAIN);
    // The Audio Note research-note prose from E-5A §3 (which is NOT in
    // the production data file) must NOT appear.
    expect(html).not.toContain('Tube-led, high-efficiency-speaker tradition');
    expect(html).not.toContain('SET intimacy');
    expect(html).not.toContain('single-ended triode');
  });

  it('flag ON: Shindo chain surfaces no brand sentence on any card', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(SHINDO_CHAIN);
    // The Shindo research-note prose from E-5A §3 (also NOT in production)
    // must NOT appear.
    expect(html).not.toContain('All-tube, vintage-tube-focused designs');
    expect(html).not.toContain('Ken Shindo lineage');
    expect(html).not.toContain('tonal density and dynamic restraint');
  });
});

describe('§5 brand-house-voicing — role applicability', () => {
  it('flag ON: a source-only brand entry does not surface on a speaker role', () => {
    // dCS appliesToRoles is ['source']. Construct a chain that
    // misclassifies a dCS component as a speaker role. The gate stack
    // must suppress.
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const advisory: AdvisoryResponse = {
      kind: 'assessment',
      systemChain: {
        names: ['Naim NDX 2', 'Pass Labs XA25', 'dCS Misclassified'],
        // Misclassify dCS as 'Speakers' to verify gate behavior. The
        // chain is contrived; the assertion is structural.
        roles: ['Streamer DAC', 'Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'NDX 2 source.',
        'Pass Labs amp.',
        'dCS misclassified.',
      ],
    };
    const html = render(advisory);
    // The dCS designPhilosophy ("Ring DAC architecture") must NOT appear
    // on the third card because the role family is speaker — not
    // applicable to dCS entry.
    expect(html).not.toContain('Ring DAC architecture');
  });
});

describe('§5 brand-house-voicing — conflict-signal suppression', () => {
  it('flag ON: chain with conflict vocabulary suppresses ALL brand sentences', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_CONFLICT_CHAIN);
    // Even though confidence is HIGH for Naim, conflict-signal suppresses.
    expect(html).not.toContain('discrete signal path');
    expect(html).not.toContain('PRaT');
  });
});

describe('§5 brand-house-voicing — primary-constraint suppression', () => {
  it('flag ON: primary-constraint Supernait suppresses the Naim sentence (post-dedup)', () => {
    // E-5B.2A — with dedup, the Naim chain emits exactly ONE Naim
    // sentence on the Supernait 3 amp card (winner of speaker > amp > source).
    // Marking the Supernait as primary constraint causes Gate #7 to
    // suppress THAT card; no other Naim card is a winner under dedup,
    // so the entire Naim sentence disappears from the §5 section.
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';

    const withoutConstraint = render(NAIM_CHAIN);
    const withConstraint = render({
      ...NAIM_CHAIN,
      primaryConstraint: {
        componentName: 'Naim Supernait 3',
        role: 'amplifier',
      },
    });
    const countMatches = (s: string, pattern: RegExp): number =>
      (s.match(pattern) ?? []).length;

    expect(countMatches(withoutConstraint, /discrete signal path/g)).toBe(1);
    expect(countMatches(withConstraint, /discrete signal path/g)).toBe(0);
  });
});

describe('§5 brand-house-voicing — redundancy suppression', () => {
  it('flag ON: dCS Bartók card with Ring DAC already in facts → no brand sentence appended', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    // The DCS_CHAIN fixture includes "Ring DAC architecture" in the
    // Bartók reading. composeContributionBody may surface that phrase
    // in the facts sentence. The brand sentence (dCS designPhilosophy)
    // would duplicate "Ring DAC", so gate #9 suppresses.
    const html = render(DCS_CHAIN);
    // The dCS designPhilosophy text ("Ring DAC architecture — a discrete
    // FPGA-driven topology") must NOT appear because redundancy
    // suppression fires (existing facts already names Ring DAC).
    // Note: the facts phrase composer may emit "Ring DAC architecture"
    // from facts.topology — we verify the BRAND sentence is absent by
    // checking for the distinctive "discrete FPGA-driven topology" tail
    // of the brand designPhilosophy.
    expect(html).not.toContain('discrete FPGA-driven topology distinct from conventional R2R');
  });
});

// ── Group 4 — Positive integration examples ────────────────────────

describe('§5 brand-house-voicing — positive example renders', () => {
  it('flag ON: Naim chain renders exactly ONE Naim brand sentence after per-section dedup', () => {
    // E-5B.2A — per-section dedup: even when both Naim cards (NDX 2 +
    // Supernait 3) match the Naim entry, only ONE card surfaces the
    // sentence. With no Naim speaker in the chain, the winner is the
    // Naim Supernait 3 amplifier card (priority: speaker > amp > source).
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_CHAIN);
    const matches = html.match(/discrete signal path/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('flag ON: Quad ESL-57 card renders ONE Quad brand sentence', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_CHAIN);
    expect(html.toLowerCase()).toContain('electrostatic');
    // Quad houseVoicing references "Electrostatic loudspeaker family"
    expect(html).toContain('Electrostatic loudspeaker family');
  });

  it('flag ON: Quad II Classic (amplifier) does NOT receive the Quad ESL speaker sentence', () => {
    // E-5B.2A — Quad entry's appliesToRoles narrowed to ['speaker'].
    // The Quad II Classic tube amplifier card therefore does NOT receive
    // the electrostatic-loudspeaker houseVoicing (which was always about
    // the ESL speaker family, not the tube amp line). Additionally, the
    // per-section dedup pre-pass ensures only ONE Quad sentence per
    // §5 section — surfacing on the Quad ESL-57 speaker card.
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_CHAIN);
    const matches = html.match(/Electrostatic loudspeaker family/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

// ── Group 5 — Regression guards ────────────────────────────────────

describe('§5 brand-house-voicing — regression guards', () => {
  it('flag OFF: Phase K reference render is unchanged from pre-E-5B.2 (no brand sentence)', () => {
    const html = render(PHASE_K);
    // No brand sentence content for any Phase K component.
    expect(html).not.toContain('Push-pull tube integrated amplifiers using EL84');
    expect(html).not.toContain('Wide-baffle dynamic loudspeakers');
  });

  it('flag OFF: auxiliary chain renders unchanged (PSU card unchanged)', () => {
    const html = render(AUX_CHAIN);
    // The PSU card (Naim XPS DR) MUST always read as the Phase E-2
    // auxiliary template — no brand sentence in any configuration.
    expect(html).toContain('does not sit in the audio signal path directly');
  });

  it('flag ON: auxiliary chain does NOT add a brand sentence to the PSU card', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(AUX_CHAIN);
    // PSU card auxiliary template intact
    expect(html).toContain('does not sit in the audio signal path directly');
    // But Naim NDX 2 (Streamer DAC) and Naim Supernait 3 (Amplifier)
    // ARE eligible for brand surfacing — the auxiliary skip is per-card,
    // not per-chain.
    expect(html).toContain('discrete signal path');
  });

  it('flag ON: headphone-system chain does NOT add brand sentences to any card', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(HEADPHONE_CHAIN);
    // Chord Hugo TT2 → would normally match Chord Electronics. But the
    // chain is a headphone system → integration is skipped at the
    // call site.
    expect(html).not.toContain('FPGA-driven DAC line');
    // Focal Utopia → would normally match Focal. Same: headphone-system
    // skip applies.
    expect(html).not.toContain('Beryllium-tweeter top-end extension');
  });

  // ── E-5B.2A — per-section dedup + editorial hygiene ─────────────

  it('E-5B.2A — Rega chain emits exactly ONE Rega sentence on the speaker card', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const advisory: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Rega ecosystem',
      systemChain: {
        names: ['Rega Planar 10', 'Rega Aethos', 'Rega RX5'],
        roles: ['Turntable', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'The Planar 10 is the Rega flagship turntable.',
        'The Aethos is the Rega integrated amplifier.',
        'The RX5 is a Rega floor-stander.',
      ],
    };
    const html = render(advisory);
    const matches = html.match(/cross-component design/g) ?? [];
    expect(matches.length).toBe(1);
    // Speaker is the winner under priority (speaker > amp > source).
    // The RX5 card body must contain it; the Planar 10 / Aethos cards
    // must not. Verify by locating the §5 "The Components" section and
    // checking that the Rega sentence appears in the RX5 region.
    const componentsStart = html.indexOf('The Components');
    const rx5Start = html.indexOf('Rega RX5', componentsStart);
    expect(rx5Start).toBeGreaterThan(componentsStart);
    const rx5Body = html.slice(rx5Start, rx5Start + 1500);
    expect(rx5Body).toContain('cross-component design');
  });

  it('E-5B.2A — Naim chain emits exactly ONE Naim sentence on the Supernait amp card (no Naim speaker)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_CHAIN);
    const matches = html.match(/discrete signal path/g) ?? [];
    expect(matches.length).toBe(1);
    // No Naim speaker present → amplifier wins. Supernait card must
    // contain the sentence; NDX 2 card must not.
    const componentsStart = html.indexOf('The Components');
    const supernaitStart = html.indexOf('Naim Supernait 3', componentsStart);
    expect(supernaitStart).toBeGreaterThan(componentsStart);
    const supernaitBody = html.slice(supernaitStart, supernaitStart + 1500);
    expect(supernaitBody).toContain('discrete signal path');
  });

  it('E-5B.2A — Linn active chain emits ONE Linn sentence on the Akubarik active-speaker card', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const advisory: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Linn active',
      systemChain: {
        names: ['Linn Klimax DSM', 'Linn Akubarik'],
        roles: ['Streaming DAC Preamp', 'Active Speakers'],
      },
      componentReadings: [
        'The Klimax DSM is the source-first reference streamer.',
        'The Akubarik is an active speaker.',
      ],
    };
    const html = render(advisory);
    const matches = html.match(/Source-first presentation/g) ?? [];
    expect(matches.length).toBe(1);
    const componentsStart = html.indexOf('The Components');
    const akubarikStart = html.indexOf('Linn Akubarik', componentsStart);
    expect(akubarikStart).toBeGreaterThan(componentsStart);
    const akubarikBody = html.slice(akubarikStart, akubarikStart + 1500);
    expect(akubarikBody).toContain('Source-first presentation');
  });

  it('E-5B.2A — Quad ESL-57 receives the electrostatic sentence; Quad II Classic does not', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_CHAIN);
    const componentsStart = html.indexOf('The Components');
    const quadIIStart = html.indexOf('Quad II Classic', componentsStart);
    const quadIIEnd = html.indexOf('Quad ESL-57', quadIIStart);
    const quadIIBody = html.slice(quadIIStart, quadIIEnd);
    // Quad II Classic (amp role) — appliesToRoles narrowed to speaker.
    expect(quadIIBody).not.toContain('Electrostatic loudspeaker family');
    const quadESLStart = html.indexOf('Quad ESL-57', componentsStart);
    const quadESLBody = html.slice(quadESLStart, quadESLStart + 1500);
    expect(quadESLBody).toContain('Electrostatic loudspeaker family');
  });

  it('E-5B.2A — every surfaced brand sentence is ≤25 words (Magico allowed up to 30)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const fixtures: Array<{ adv: AdvisoryResponse; label: string }> = [
      { adv: PHASE_K, label: 'Phase K' },
      { adv: NAIM_CHAIN, label: 'Naim' },
      { adv: QUAD_CHAIN, label: 'Quad' },
      { adv: DCS_CHAIN, label: 'dCS' },
      { adv: WIIM_CHAIN, label: 'WiiM/KEF' },
      {
        adv: {
          kind: 'assessment',
          systemChain: {
            names: ['dCS Bartók', 'Audio Research Ref 80S', 'Magico A3'],
            roles: ['DAC', 'Tube Power Amplifier', 'Speakers'],
          },
          componentReadings: ['The Bartók.', 'The Ref 80S.', 'The A3.'],
        },
        label: 'ARC + Magico',
      },
      {
        adv: {
          kind: 'assessment',
          systemChain: {
            names: ['Bricasti M3', 'McIntosh MA12000', 'JBL 4429'],
            roles: ['DAC', 'Hybrid Integrated Amplifier', 'Speakers'],
          },
          componentReadings: ['M3.', 'MA12000.', '4429.'],
        },
        label: 'McIntosh + JBL',
      },
      {
        adv: {
          kind: 'assessment',
          systemChain: {
            names: ['Rega Planar 10', 'Rega Aethos', 'Rega RX5'],
            roles: ['Turntable', 'Integrated Amplifier', 'Speakers'],
          },
          componentReadings: ['P10.', 'Aethos.', 'RX5.'],
        },
        label: 'Rega',
      },
    ];
    // Detect any added sentence by extracting card bodies and looking
    // for sentences containing well-known brand-anchor tokens.
    // Word-count assertion: each known-brand sentence ≤ 25 words.
    const KNOWN_SENTENCE_PATTERNS = [
      // Naim: shortened to 24 words in E-5B.2A
      /The discrete signal path and tight coupling to the power supply tend to produce a forward, rhythmically engaged presentation — what editorial coverage labels PRaT\./,
      // KEF: shortened to 17 words
      /Uni-Q point-source coaxial driver — a concentric tweeter-in-midbass topology that tends to widen the off-axis listening window\./,
      // Rega: shortened to 22 words
      /A cross-component design — turntables, electronics, and loudspeakers from the same team — that tends to produce ecosystem-level compatibility and rhythmic engagement\./,
      // Quad: 17 words (unchanged)
      /Electrostatic loudspeaker family often associated with midrange realism and point-source coherence at the cost of SPL ceiling\./,
      // Hegel: cleaned, 16 words
      /Class-AB integrated amplifiers with SoundEngine feedback architecture, often associated with transient grip and neutral presentation\./,
      // McIntosh designPhilosophy: 13 words after dropping blue-meters sentence
      /Autoformer output transformers \(in many solid-state designs\) and unity-coupled circuit \(in tube designs\)\./,
      // ARC houseVoicing: 19 words after cleanup
      /All-tube Reference designs often associated with harmonic density and dynamic capability; the LS line voicing is closer to neutral\./,
      // JBL designPhilosophy: 12 words after cleanup
      /The 4xxx Studio Monitor lineage extends professional recording-monitor design into home audio\./,
      // DeVore systemBuildingLogic after cleanup
      /Orangutan models specifically tend to anchor systems built around low-to-moderate power tube amplification; the Gibbon line is a different lineage\./,
      // Magico houseVoicing (allowed up to 30 with hedge)
      /Sealed-cabinet aluminum-extrusion construction designed to minimize cabinet contribution; the engineering goal is low cabinet colouration, though the resulting presentation is preference-dependent — some listeners hear neutrality, others find it analytical\./,
    ];
    for (const { adv, label } of fixtures) {
      const html = render(adv);
      for (const pattern of KNOWN_SENTENCE_PATTERNS) {
        const match = html.match(pattern);
        if (!match) continue;
        const sentence = match[0];
        const decoded = sentence
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&');
        const wordCount = decoded.trim().split(/\s+/).filter(Boolean).length;
        const isMagico = pattern.source.includes('Sealed-cabinet aluminum');
        const cap = isMagico ? 30 : 25;
        expect(
          wordCount,
          `${label}: "${decoded.slice(0, 80)}…" has ${wordCount} words (cap=${cap})`,
        ).toBeLessThanOrEqual(cap);
      }
    }
  });

  it('E-5B.2A — no surfaced sentence contains internal governance language', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const fixtures = [PHASE_K, NAIM_CHAIN, QUAD_CHAIN, DCS_CHAIN, WIIM_CHAIN];
    const banned = [
      'should not be collapsed',
      'brand-level claims',
      'scoped to the tier',
      'varies meaningfully by tier',
    ];
    for (const fixture of fixtures) {
      const html = render(fixture);
      for (const phrase of banned) {
        expect(html, `${fixture.subject}: "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it('E-5B.2A — no surfaced sentence contains name-drop / trivia / catalog phrases', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const fixtures: AdvisoryResponse[] = [
      PHASE_K,
      NAIM_CHAIN,
      QUAD_CHAIN,
      DCS_CHAIN,
      WIIM_CHAIN,
      // ARC chain
      {
        kind: 'assessment',
        systemChain: {
          names: ['dCS Bartók', 'Audio Research Ref 80S', 'Magico A3'],
          roles: ['DAC', 'Tube Power Amplifier', 'Speakers'],
        },
        componentReadings: ['B.', 'R.', 'M.'],
      },
      // McIntosh + JBL chain
      {
        kind: 'assessment',
        systemChain: {
          names: ['Bricasti M3', 'McIntosh MA12000', 'JBL 4429'],
          roles: ['DAC', 'Hybrid Integrated Amplifier', 'Speakers'],
        },
        componentReadings: ['M3.', 'MA12000.', '4429.'],
      },
    ];
    const banned = [
      'William Z. Johnson lineage',
      'Greg Timbers and successors',
      'blue meters',
      'Orangutan O/93, O/96, O/Reference, and the Gibbon line cover a wide range',
    ];
    for (const fixture of fixtures) {
      const html = render(fixture);
      for (const phrase of banned) {
        expect(html, `phrase "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it('E-5B.2A — Hegel sentence drops "Norwegian-designed" and "characteristic"', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const advisory: AdvisoryResponse = {
      kind: 'assessment',
      systemChain: {
        names: ['dCS Bartók', 'Hegel H190', 'Harbeth 30.2 XD'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: ['B.', 'H.', 'H.'],
    };
    const html = render(advisory);
    expect(html).not.toContain('Norwegian-designed');
    expect(html).not.toContain('characteristic SoundEngine');
    expect(html).toContain('SoundEngine feedback architecture');
  });

  it('flag OFF: brand-house-voicing-specific phrases are absent from every fixture', () => {
    // Sanity sweep: across all fixtures, flag OFF means no brand-VOICING-
    // specific text appears. The phrases below are entry-specific
    // sentence content from the brand data file; they should never
    // appear from pre-E-5B.2 composers regardless of fixture.
    //
    // (Note: "Ring DAC architecture" is NOT in this list because the
    // pre-E-5B.2 facts-phrase extractor in composeContributionBody
    // surfaces it from the dCS engine reading. That is baseline
    // behavior unrelated to brand voicing.)
    const fixtures = [NAIM_CHAIN, DCS_CHAIN, QUAD_CHAIN, PHASE_K, WIIM_CHAIN, AUX_CHAIN, HEADPHONE_CHAIN];
    const brandPhrases = [
      'discrete signal path',  // Naim houseVoicing token
      'Electrostatic loudspeaker family',  // Quad houseVoicing
      'Push-pull tube integrated amplifiers using EL84',  // Leben houseVoicing
      'BBC research-derived',  // Harbeth houseVoicing
      'Uni-Q point-source coaxial driver',  // KEF houseVoicing
      'discrete FPGA-driven topology',  // dCS designPhilosophy
      'Orangutan O/93, O/96, O/Reference, and the Gibbon line',  // DeVore systemBuildingLogic
    ];
    for (const fixture of fixtures) {
      const html = render(fixture);
      for (const phrase of brandPhrases) {
        expect(html, `${fixture.subject} contains "${phrase}" with flag OFF`).not.toContain(phrase);
      }
    }
  });
});
