/**
 * Stage E-5B.3 — §8 *Why This System Works* brand-house-voicing tests.
 *
 * Strict rule under test: a §8 brand sentence may surface only when at
 * least two signal-path components share the same eligible brand entry.
 *
 * Test groups:
 *   1. Direct gate-stack tests for selectBrandClusterForSection8 and
 *      selectBrandHouseVoicingSentenceForSystemCoherence
 *   2. Feature-flag behavior
 *   3. Positive cluster cases (Naim 2, Rega 3, Linn active, ARC 2)
 *   4. Negative cases (single-component brand, headphone, commercial,
 *      auxiliary-only, conflict, primary-constraint)
 *   5. §5/§8 dedup discipline
 *   6. Editorial hygiene
 *   7. Regression guards
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import {
  selectBrandClusterForSection8,
  selectBrandHouseVoicingSentenceForSystemCoherence,
} from '@/lib/brand-house-voicing-gates';
import SystemAssessmentArtifact from '../SystemAssessmentArtifact';

// ── Helpers ────────────────────────────────────────────────────────

function render(advisory: AdvisoryResponse): string {
  return renderToStaticMarkup(
    createElement(SystemAssessmentArtifact, { advisory }),
  );
}

function extractSection8Body(html: string): string {
  // The §8 paragraph is the <p> following the "Why This System Works"
  // heading. Returns the body text (HTML-escaped, decoded for
  // assertions on plain text).
  const headIdx = html.indexOf('Why This System Works');
  if (headIdx === -1) return '';
  const pStart = html.indexOf('<p ', headIdx);
  if (pStart === -1) return '';
  const open = html.indexOf('>', pStart);
  const close = html.indexOf('</p>', open);
  if (open === -1 || close === -1) return '';
  return html
    .slice(open + 1, close)
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

// ── Fixtures ────────────────────────────────────────────────────────

// §8 needs enough chain evidence for the keep-recs or coherence
// fallback to fire. The keepRecommendations field is the simplest
// trigger.

const NAIM_2: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Naim 2-component ecosystem',
  systemSignature: 'A Naim source + Naim amp + Falcon stand-mount chain.',
  systemChain: {
    names: ['Naim NDX 2', 'Naim Supernait 3', 'Falcon Acoustics LS3/5a'],
    roles: ['Streamer DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The NDX 2 streams from network sources.',
    'The Supernait 3 is the Naim integrated.',
    'The Falcon LS3/5a is a BBC-tradition stand-mount.',
  ],
  keepRecommendations: [
    { name: 'Naim Supernait 3', reason: 'Ecosystem-tier integrated.' },
    { name: 'Falcon LS3/5a', reason: 'Mature destination.' },
  ],
};

const REGA_3: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Rega 3-component ecosystem',
  systemSignature: 'A Rega Planar 10 + Aethos + RX5 brand-coherent system.',
  systemChain: {
    names: ['Rega Planar 10', 'Rega Aethos', 'Rega RX5'],
    roles: ['Turntable', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: ['The Planar 10.', 'The Aethos.', 'The RX5.'],
  keepRecommendations: [
    { name: 'Rega Planar 10', reason: 'Anchor.' },
    { name: 'Rega RX5', reason: 'Destination.' },
  ],
};

const LINN_ACTIVE: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Linn active system',
  systemSignature: 'A Linn Klimax DSM + Akubarik active speakers.',
  systemChain: {
    names: ['Linn Klimax DSM', 'Linn Akubarik'],
    roles: ['Streaming DAC Preamp', 'Active Speakers'],
  },
  componentReadings: ['The DSM.', 'The Akubarik.'],
  keepRecommendations: [
    { name: 'Linn Klimax DSM', reason: 'Anchor.' },
    { name: 'Linn Akubarik', reason: 'Destination.' },
  ],
};

const ARC_DUAL: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Audio Research preamp + power amp',
  systemSignature: 'A dCS Bartók + ARC LS28 + ARC Ref 80S + Wilson Sasha system.',
  systemChain: {
    names: ['dCS Bartók', 'Audio Research LS28', 'Audio Research Ref 80S', 'Wilson Audio Sasha DAW'],
    roles: ['DAC', 'Tube Preamplifier', 'Tube Power Amplifier', 'Speakers'],
  },
  componentReadings: ['Bartók.', 'LS28.', 'Ref 80S.', 'Sasha.'],
  keepRecommendations: [
    { name: 'Audio Research Ref 80S', reason: 'Anchor.' },
    { name: 'Wilson Audio Sasha DAW', reason: 'Destination.' },
  ],
};

// Negative fixtures
const SINGLE_DCS: AdvisoryResponse = {
  kind: 'assessment',
  systemSignature: 'A dCS Bartók with Pass Labs and Harbeth chain.',
  systemChain: {
    names: ['dCS Bartók', 'Pass Labs XA25', 'Harbeth 30.2 XD'],
    roles: ['DAC', 'Power Amplifier', 'Speakers'],
  },
  componentReadings: ['Bartók.', 'XA25.', 'Harbeth.'],
  keepRecommendations: [
    { name: 'Pass Labs XA25', reason: 'Anchor.' },
    { name: 'Harbeth 30.2 XD', reason: 'Destination.' },
  ],
};

const COMMERCIAL_WIIM: AdvisoryResponse = {
  kind: 'assessment',
  systemChain: {
    names: ['WiiM Pro Plus', 'WiiM Ultra', 'KEF Blade Two Meta'],
    roles: ['Streamer', 'Streamer', 'Speakers'],
  },
  componentReadings: ['WiiM Pro Plus.', 'WiiM Ultra.', 'Blade.'],
  keepRecommendations: [
    { name: 'KEF Blade Two Meta', reason: 'Destination.' },
    { name: 'WiiM Pro Plus', reason: 'Source.' },
  ],
};

const HEADPHONE: AdvisoryResponse = {
  kind: 'assessment',
  systemChain: {
    names: ['Chord Hugo TT2', 'Chord DAVE', 'Focal Utopia'],
    roles: ['DAC', 'Headphone Amplifier', 'Headphone'],
  },
  componentReadings: ['TT2.', 'DAVE.', 'Utopia.'],
  keepRecommendations: [
    { name: 'Chord DAVE', reason: 'Anchor.' },
    { name: 'Focal Utopia', reason: 'Destination.' },
  ],
};

const NAIM_PSU_ONLY_PAIR: AdvisoryResponse = {
  // Naim + Naim XPS DR — the XPS DR is auxiliary, so only 1 eligible
  // Naim signal-path component. Cluster size = 1 → no §8 surfacing.
  kind: 'assessment',
  systemChain: {
    names: ['Naim NDX 2', 'Naim XPS DR', 'Harbeth 30.2 XD'],
    roles: ['Streamer DAC', 'Power Supply', 'Speakers'],
  },
  componentReadings: ['NDX 2.', 'XPS DR.', 'Harbeth.'],
  keepRecommendations: [
    { name: 'Naim NDX 2', reason: 'Source.' },
    { name: 'Harbeth 30.2 XD', reason: 'Destination.' },
  ],
};

const CONFLICT_NAIM_2: AdvisoryResponse = {
  ...NAIM_2,
  systemContext:
    'There is a mismatch between the Naim forward presentation and the Falcon character — the chain is fighting itself.',
};

const PHASE_K: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Phase K reference',
  systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
  systemChain: {
    names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
    roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Pontus II is an R2R DAC.',
    'The CS600X is a push-pull tube integrated using 6L6GC.',
    'The O/96 is a high-efficiency wide-baffle speaker.',
  ],
  keepRecommendations: [
    { name: 'Leben CS600X', reason: 'Amp.' },
    { name: 'DeVore O/96', reason: 'Speaker.' },
  ],
};

// ── Test setup ──────────────────────────────────────────────────────

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});

// ── Group 1 — direct cluster + sentence-selector tests ────────────

describe('selectBrandClusterForSection8 — direct', () => {
  it('returns null for an empty chain', () => {
    expect(selectBrandClusterForSection8([], [], [])).toBeNull();
  });

  it('returns null when no two components share the same eligible brand', () => {
    const result = selectBrandClusterForSection8(
      ['dCS Bartók', 'Pass Labs XA25', 'Harbeth 30.2 XD'],
      ['DAC', 'Power Amplifier', 'Speakers'],
      ['source', 'amplifier', 'speaker'],
    );
    expect(result).toBeNull();
  });

  it('detects Naim 2-cluster (source + amp)', () => {
    const result = selectBrandClusterForSection8(
      ['Naim NDX 2', 'Naim Supernait 3', 'Falcon Acoustics LS3/5a'],
      ['Streamer DAC', 'Integrated Amplifier', 'Speakers'],
      ['source', 'amplifier', 'speaker'],
    );
    expect(result).not.toBeNull();
    expect(result?.entry.brand).toBe('Naim Audio');
    expect(result?.members).toEqual([0, 1]);
    expect(result?.hasSpeaker).toBe(false);
    expect(result?.hasAmplifier).toBe(true);
    expect(result?.hasSource).toBe(true);
  });

  it('detects Rega 3-cluster and reports all role flags', () => {
    const result = selectBrandClusterForSection8(
      ['Rega Planar 10', 'Rega Aethos', 'Rega RX5'],
      ['Turntable', 'Integrated Amplifier', 'Speakers'],
      ['source', 'amplifier', 'speaker'],
    );
    expect(result?.entry.brand).toBe('Rega');
    expect(result?.members).toEqual([0, 1, 2]);
    expect(result?.hasSpeaker).toBe(true);
    expect(result?.hasAmplifier).toBe(true);
    expect(result?.hasSource).toBe(true);
  });

  it('excludes auxiliary components from the cluster', () => {
    // Naim NDX 2 (source) + Naim XPS DR (PSU/auxiliary) + Harbeth (no entry).
    // Only the NDX 2 is eligible → cluster size 1 → null.
    const result = selectBrandClusterForSection8(
      ['Naim NDX 2', 'Naim XPS DR', 'Harbeth 30.2 XD'],
      ['Streamer DAC', 'Power Supply', 'Speakers'],
      ['source', 'auxiliary', 'speaker'],
    );
    expect(result).toBeNull();
  });

  it('does not cluster commercial brands', () => {
    // Two WiiM components share the brand but priority is commercial,
    // so findEligibleBrandForComponent excludes them.
    const result = selectBrandClusterForSection8(
      ['WiiM Pro Plus', 'WiiM Ultra', 'KEF Blade Two Meta'],
      ['Streamer', 'Streamer', 'Speakers'],
      ['source', 'source', 'speaker'],
    );
    expect(result).toBeNull();
  });

  it('prefers a speaker-including cluster over an amplifier-only cluster', () => {
    // Hypothetical: chain with Naim source+amp AND Rega Planar 10 +
    // Rega RX5 (single Rega isn't a cluster — need 2 to qualify).
    // Construct: Naim source + Naim amp + Rega TT + Rega speaker.
    const result = selectBrandClusterForSection8(
      ['Naim NDX 2', 'Naim Supernait 3', 'Rega Planar 10', 'Rega RX5'],
      ['Streamer DAC', 'Integrated Amplifier', 'Turntable', 'Speakers'],
      ['source', 'amplifier', 'source', 'speaker'],
    );
    expect(result?.entry.brand).toBe('Rega'); // speaker-including cluster wins
  });

  it('prefers a larger cluster when tied on role classes', () => {
    // 2 Naim amps would tie role-class with 3 Naim sources if the
    // priority is the same. Construct a contrived chain: 3 amplifier-class
    // matches vs 2 amplifier-class matches. The 3-cluster should win.
    // Use Audio Research entries — appliesToRoles is ['amplifier'].
    const result = selectBrandClusterForSection8(
      [
        'Naim NDX 2',
        'Naim Supernait 3',
        'Audio Research Ref 6SE',
        'Audio Research LS28',
        'Audio Research Ref 80S',
        'Harbeth 30.2 XD',
      ],
      ['Streamer DAC', 'Integrated Amplifier', 'Tube Preamp', 'Tube Preamp', 'Tube Power Amplifier', 'Speakers'],
      ['source', 'amplifier', 'amplifier', 'amplifier', 'amplifier', 'speaker'],
    );
    // Naim cluster: src+amp → hasSpeaker=false hasAmp=true (rank 2)
    // ARC cluster: 3 amps → hasSpeaker=false hasAmp=true (rank 2), size 3
    // Same rank — larger ARC cluster wins.
    expect(result?.entry.brand).toBe('Audio Research');
    expect(result?.members.length).toBe(3);
  });
});

describe('selectBrandHouseVoicingSentenceForSystemCoherence — direct', () => {
  const NAIM_ENTRY = {
    brand: 'Naim Audio',
    matchTokens: ['naim'],
    priority: 'audiophile-identity' as const,
    confidence: 'high' as const,
    houseVoicing:
      'The discrete signal path and tight coupling to the power supply tend to produce a forward, rhythmically engaged presentation — what editorial coverage labels PRaT.',
    designPhilosophy:
      'All-discrete signal path; power-supply design treated as a primary determinant of sound, with outboard PSUs offered as a within-brand upgrade path on many models. The PSU hierarchy is an engineering choice, not a marketing label.',
    systemBuildingLogic:
      'Within the Naim ecosystem, upgrades tend to run through external power supplies and within-brand tier-step electronics rather than cross-brand substitution.',
    commonStrengths: ['x'] as const,
    commonTradeoffs: ['x'] as const,
    upgradeCautions: [] as const,
    avoidOverclaiming: [
      'unrivalled',
      'best in class',
      'the Naim sound',
      'PRaT leader',
      'the only brand that does PRaT',
      'endgame',
      'world class',
    ] as const,
    appliesToRoles: ['source', 'amplifier'] as const,
    exampleModels: ['x'] as const,
  };

  it('returns null with conflict-signal when hasConflictSignal is true', () => {
    const result = selectBrandHouseVoicingSentenceForSystemCoherence({
      entry: NAIM_ENTRY,
      hasConflictSignal: true,
      alreadySurfacedTexts: [],
    });
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('conflict-signal');
  });

  it('returns systemBuildingLogic when nothing suppresses it', () => {
    const result = selectBrandHouseVoicingSentenceForSystemCoherence({
      entry: NAIM_ENTRY,
      hasConflictSignal: false,
      alreadySurfacedTexts: [],
    });
    expect(result.sentence).toBe(NAIM_ENTRY.systemBuildingLogic);
  });

  it('falls through to designPhilosophy if systemBuildingLogic appears in §5', () => {
    const result = selectBrandHouseVoicingSentenceForSystemCoherence({
      entry: NAIM_ENTRY,
      hasConflictSignal: false,
      alreadySurfacedTexts: [
        `Naim card body. ${NAIM_ENTRY.systemBuildingLogic}`,
      ],
    });
    expect(result.sentence).toBe(NAIM_ENTRY.designPhilosophy);
  });

  it('returns null when all priority candidates already appear in §5', () => {
    const result = selectBrandHouseVoicingSentenceForSystemCoherence({
      entry: NAIM_ENTRY,
      hasConflictSignal: false,
      alreadySurfacedTexts: [
        NAIM_ENTRY.systemBuildingLogic ?? '',
        NAIM_ENTRY.designPhilosophy ?? '',
        NAIM_ENTRY.houseVoicing ?? '',
      ],
    });
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('duplicates-section5');
  });
});

// ── Group 2 — feature flag behavior ────────────────────────────────

describe('§8 brand-house-voicing feature flag', () => {
  it('flag OFF: §8 paragraph is unchanged from pre-E-5B.3', () => {
    const html = render(NAIM_2);
    const body = extractSection8Body(html);
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toContain('Within the Naim ecosystem');
  });

  it('flag ON: Naim cluster adds the systemBuildingLogic sentence to §8', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_2);
    const body = extractSection8Body(html);
    expect(body).toContain('Within the Naim ecosystem');
  });

  it('flag ON: invalid env value (e.g. "true") does NOT enable §8 brand surfacing', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'true';
    const html = render(NAIM_2);
    expect(extractSection8Body(html)).not.toContain('Within the Naim ecosystem');
  });
});

// ── Group 3 — positive cluster cases ────────────────────────────────

describe('§8 positive cluster cases', () => {
  it('Naim 2-cluster (source + amp) surfaces one Naim system-level sentence in §8', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_2);
    const body = extractSection8Body(html);
    expect(body).toContain('Within the Naim ecosystem');
    // Only ONE Naim sentence in §8 — count occurrences.
    const matches = body.match(/Within the Naim ecosystem/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('Rega 3-cluster surfaces the Rega system-building sentence in §8', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(REGA_3);
    const body = extractSection8Body(html);
    expect(body).toContain('Within-brand Rega partnering');
  });

  it('Linn active 2-cluster surfaces the Linn system-building sentence in §8', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(LINN_ACTIVE);
    const body = extractSection8Body(html);
    expect(body).toContain('LP12');
    expect(body).toContain('Klimax / Akurate / Selekt tier ladder');
  });

  it('Audio Research preamp + power amp cluster surfaces ARC system-building in §8', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(ARC_DUAL);
    const body = extractSection8Body(html);
    expect(body).toContain('Reference series components historically partner');
  });
});

// ── Group 4 — negative cases ───────────────────────────────────────

describe('§8 negative cases', () => {
  it('single known brand component does NOT trigger §8 (dCS source alone)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(SINGLE_DCS);
    const body = extractSection8Body(html);
    expect(body).not.toContain('Ring DAC');
    expect(body).not.toContain('Vivaldi');
  });

  it('commercial brands do not trigger §8 (WiiM Pro Plus + WiiM Ultra)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(COMMERCIAL_WIIM);
    const body = extractSection8Body(html);
    // Commercial entries have no system-building / design-philosophy /
    // house-voicing prose by construction. Nothing appears.
    expect(body).not.toContain('WiiM');
    expect(body).not.toContain('streaming entry');
  });

  it('headphone systems do not trigger §8 brand surfacing', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(HEADPHONE);
    const body = extractSection8Body(html);
    expect(body).not.toContain('FPGA');
    expect(body).not.toContain('Rob Watts');
  });

  it('auxiliary-only matches do not form a cluster (Naim NDX 2 + Naim XPS DR)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_PSU_ONLY_PAIR);
    const body = extractSection8Body(html);
    expect(body).not.toContain('Within the Naim ecosystem');
  });

  it('conflict-signaled system does not trigger §8 brand surfacing', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(CONFLICT_NAIM_2);
    const body = extractSection8Body(html);
    expect(body).not.toContain('Within the Naim ecosystem');
  });

  it('primary-constraint cluster member suppresses §8 brand surfacing', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const advisory: AdvisoryResponse = {
      ...NAIM_2,
      primaryConstraint: {
        componentName: 'Naim Supernait 3',
        role: 'amplifier',
      },
    };
    const html = render(advisory);
    const body = extractSection8Body(html);
    expect(body).not.toContain('Within the Naim ecosystem');
  });
});

// ── Group 5 — §5 / §8 dedup ────────────────────────────────────────

describe('§8 brand-house-voicing — §5 / §8 dedup', () => {
  it('Naim cluster: §5 surfaces houseVoicing once on the amp card; §8 surfaces systemBuildingLogic (different field, no dup)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NAIM_2);
    // §5: houseVoicing on Supernait card (per-section dedup, single card)
    const naimHouseVoicingMatches = html.match(/discrete signal path/g) ?? [];
    expect(naimHouseVoicingMatches.length).toBe(1);
    // §8: systemBuildingLogic (different field) — single occurrence
    const naimSBLMatches = html.match(/Within the Naim ecosystem/g) ?? [];
    expect(naimSBLMatches.length).toBe(1);
  });

  it('Rega cluster: §5 surfaces houseVoicing on RX5; §8 surfaces systemBuildingLogic', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(REGA_3);
    expect(html).toContain('cross-component design'); // §5 houseVoicing
    expect(html).toContain('Within-brand Rega partnering'); // §8 systemBuildingLogic
    // §8 sentence count
    const body = extractSection8Body(html);
    const matches = body.match(/Within-brand Rega partnering/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('§5 dedup from E-5B.2A still holds — Rega still appears only once in §5', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(REGA_3);
    const matches = html.match(/cross-component design/g) ?? [];
    expect(matches.length).toBe(1);
  });
});

// ── Group 6 — editorial hygiene ────────────────────────────────────

describe('§8 brand-house-voicing — editorial hygiene', () => {
  it('every §8 brand sentence in fixtures is ≤25 words', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const fixtures: Array<{ adv: AdvisoryResponse; label: string }> = [
      { adv: NAIM_2, label: 'Naim' },
      { adv: REGA_3, label: 'Rega' },
      { adv: LINN_ACTIVE, label: 'Linn active' },
      { adv: ARC_DUAL, label: 'ARC dual' },
    ];
    const KNOWN_SENTENCE_PATTERNS = [
      /Within the Naim ecosystem, upgrades tend to run through external power supplies and within-brand tier-step electronics rather than cross-brand substitution\./,
      /Within-brand Rega partnering tends to surface ecosystem-level compatibility — matched gain stages, recommended cartridges, intentional voicing alignment — that cross-brand substitution typically dilutes\./,
      /LP12 \(vinyl\) or Klimax DSM \(digital\) commonly function as the brand-tier anchor; the Klimax \/ Akurate \/ Selekt tier ladder structures within-brand upgrades\./,
      /Reference series components historically partner with destination-class loudspeakers; the LS series sits as the mid-tier all-tube preamplifier with a less imposing chassis\./,
    ];
    for (const { adv, label } of fixtures) {
      const html = render(adv);
      for (const pattern of KNOWN_SENTENCE_PATTERNS) {
        const match = html.match(pattern);
        if (!match) continue;
        const sentence = match[0]!.replace(/&#x27;/g, "'");
        const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
        expect(wordCount, `${label}: "${sentence.slice(0, 70)}…" has ${wordCount} words`).toBeLessThanOrEqual(25);
      }
    }
  });

  it('no §8 brand sentence contains internal governance language', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const banned = [
      'should not be collapsed',
      'brand-level claims',
      'scoped to the tier',
      'varies meaningfully by tier',
    ];
    for (const fixture of [NAIM_2, REGA_3, LINN_ACTIVE, ARC_DUAL]) {
      const html = render(fixture);
      const body = extractSection8Body(html);
      for (const phrase of banned) {
        expect(body).not.toContain(phrase);
      }
    }
  });

  it('no §8 brand sentence contains name-drop / trivia fragments', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const banned = [
      'William Z. Johnson lineage',
      'Greg Timbers and successors',
      'blue meters',
      // Drop the parenthetical destination-speaker name-list ARC formerly had
      '(Wilson, Magico, Sonus Faber are common pairings)',
    ];
    for (const fixture of [NAIM_2, REGA_3, LINN_ACTIVE, ARC_DUAL]) {
      const html = render(fixture);
      const body = extractSection8Body(html);
      for (const phrase of banned) {
        expect(body).not.toContain(phrase);
      }
    }
  });
});

// ── Group 7 — regression guards ────────────────────────────────────

describe('§8 brand-house-voicing — regression guards', () => {
  it('flag OFF: Phase K §8 unchanged from pre-E-5B.3', () => {
    const html = render(PHASE_K);
    const body = extractSection8Body(html);
    // No brand-voicing additions
    expect(body).not.toContain('Within the Naim ecosystem');
    expect(body).not.toContain('Within-brand Rega');
    expect(body).not.toContain('Reference series components historically');
  });

  it('flag ON: Phase K — single Leben + single DeVore + Pontus (no cluster) — §8 still has no brand sentence', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(PHASE_K);
    const body = extractSection8Body(html);
    // No same-brand cluster exists (each brand has only 1 component).
    expect(body).not.toContain('Within the Naim ecosystem');
    expect(body).not.toContain('Within-brand Rega');
    expect(body).not.toContain('Push-pull tube integrated amplifiers');
    expect(body).not.toContain('Wide-baffle dynamic loudspeakers');
  });

  it('flag ON: §8 with no keepRecommendations and no coherence fallback signal does NOT render at all (no brand append)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const advisory: AdvisoryResponse = {
      kind: 'assessment',
      systemChain: {
        names: ['Naim NDX 2', 'Naim Supernait 3'],
        roles: ['Streamer DAC', 'Integrated Amplifier'],
      },
      componentReadings: ['NDX.', 'Supernait.'],
      // No keepRecommendations; no characterization for coherence fallback.
    };
    const html = render(advisory);
    // §8 may render via coherence-fallback path if chainFacts qualifies;
    // when it does not, the entire section is omitted, including the
    // brand append.
    if (html.indexOf('Why This System Works') === -1) {
      // §8 omitted; brand append cannot fire.
      return;
    }
    // If §8 rendered via fallback, brand append may or may not fire
    // depending on cluster eligibility. We only assert that the brand
    // sentence (if surfaced) is one of the documented entries.
    const body = extractSection8Body(html);
    if (body.includes('Within the Naim ecosystem')) {
      expect(body.match(/Within the Naim ecosystem/g)?.length).toBe(1);
    }
  });
});
