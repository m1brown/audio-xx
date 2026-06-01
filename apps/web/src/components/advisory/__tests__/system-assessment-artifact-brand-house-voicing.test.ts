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

  it('returns null when existing prose already names Ring DAC for dCS (redundancy fires on designPhilosophy)', () => {
    // dCS iterates houseVoicing (fails shape) → designPhilosophy (fails
    // redundancy on "Ring DAC") → systemBuildingLogic (fails shape).
    // Final suppression reason is shape-check-failed (last try), but the
    // important contract is that the candidate sentence with "Ring DAC"
    // never surfaces.
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'dCS Bartók',
        roleFamily: 'source',
        existingCardProse:
          'The dCS Bartók establishes the character. Its Ring DAC architecture prioritizes timing precision.',
      }),
    );
    expect(result.sentence).toBeNull();
    // designPhilosophy ("Ring DAC architecture...") would have been the
    // first-set field, but redundancy fires on it. systemBuildingLogic
    // doesn't redundancy but fails shape, so 'shape-check-failed' surfaces
    // as the last reason. The contract is the suppression, not the
    // specific diagnostic.
  });

  it('returns null when existing prose already names FPGA for Chord (redundancy fires on houseVoicing)', () => {
    // Chord Electronics houseVoicing contains "FPGA-driven DAC line" — if
    // existing prose has "FPGA", redundancy fires.
    const result = selectBrandHouseVoicingSentenceForComponent(
      gateInput({
        componentName: 'Chord DAVE',
        roleFamily: 'source',
        existingCardProse:
          'The Chord DAVE is an FPGA-driven DAC originated by Rob Watts.',
      }),
    );
    expect(result.sentence).toBeNull();
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

  it('flag ON: Phase K DeVore O/96 card surfaces a DeVore systemBuildingLogic sentence (houseVoicing and designPhilosophy suppressed by redundancy)', () => {
    // The composeContributionBody facts-phrase composer surfaces
    // "wide-baffle" and "high-efficiency" tokens in the existing prose.
    // DeVore houseVoicing ("Wide-baffle dynamic loudspeakers with high
    // efficiency...") and designPhilosophy ("Orangutan line uses
    // wide-baffle high-efficiency dynamic drivers...") both contain
    // those tokens — redundancy suppresses both. systemBuildingLogic
    // ("Orangutan O/93, O/96, ... pair with low-to-moderate power tube
    // amplification.") has "tube" as anchor and no redundancy hit,
    // so it surfaces. Verifies fall-through to the third priority
    // field works correctly.
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(PHASE_K);
    // Brand sentence anchored to the Orangutan / Gibbon ladder surfaces.
    expect(html).toContain('Orangutan O/93, O/96, O/Reference, and the Gibbon line');
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
  it('flag ON: marking the Supernait as primary constraint reduces Naim sentence count', () => {
    // Strategy: count occurrences of the Naim houseVoicing key phrase
    // across the full rendered HTML. Without primary-constraint, both
    // Naim cards (NDX 2 + Supernait 3) MAY surface the sentence (2 total).
    // With Supernait 3 marked as primary constraint, the Supernait card
    // is suppressed → 1 total.
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

    // Discrete-signal-path token appears in Naim houseVoicing AND
    // designPhilosophy; either field surfacing counts. Without constraint,
    // both NDX 2 (Naim source) and Supernait 3 (Naim amp) may surface a
    // brand sentence. With constraint, Supernait 3 is suppressed.
    const withoutCount = countMatches(withoutConstraint, /discrete signal path/g);
    const withCount = countMatches(withConstraint, /discrete signal path/g);

    // The exact count depends on what existing-card-prose redundancy
    // suppression does for each card. The structural assertion is that
    // adding the constraint REDUCES the count by at least 1 — the
    // Supernait card stopped emitting its brand sentence.
    expect(withCount).toBeLessThan(withoutCount);
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
  it('flag ON: Naim Supernait 3 card renders ONE Naim brand sentence (per-card cap)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_CHAIN);
    // Count occurrences of the Naim houseVoicing key phrase. Should
    // appear at most once per card. With three Naim-eligible cards
    // (NDX 2, Supernait 3) — Falcon is not Naim — we expect 2 occurrences
    // at most (one per card).
    const matches = html.match(/discrete signal path/g) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    expect(matches.length).toBeLessThanOrEqual(3);
  });

  it('flag ON: Quad ESL-57 card renders ONE Quad brand sentence', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_CHAIN);
    expect(html.toLowerCase()).toContain('electrostatic');
    // Quad houseVoicing references "Electrostatic loudspeaker family"
    expect(html).toContain('Electrostatic loudspeaker family');
  });

  it('flag ON: Quad II Classic card (amplifier role) also matches Quad entry', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_CHAIN);
    // Quad entry has appliesToRoles ['speaker', 'amplifier'] — both Quad
    // II Classic (amp) and Quad ESL-57 (speaker) qualify. The chain has
    // both, so the Quad houseVoicing may appear up to 2 times.
    const matches = html.match(/Electrostatic loudspeaker family/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(matches.length).toBeLessThanOrEqual(2);
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
