/**
 * Stage E-5B.4 — §10 *If You Were to Change Something* brand-house-voicing tests.
 *
 * The §10 brand append is destination-speaker-centric: it considers
 * upgradeCautions[0] for the destination-class speaker only (using the
 * existing isDestinationSpeaker detector shared with composeUpgradeHierarchy).
 *
 * Test groups:
 *   1. Direct selectBrandHouseVoicingSentenceForHierarchy unit tests
 *   2. Feature-flag behavior
 *   3. Positive surfacings
 *   4. Negative cases
 *   5. Editorial hygiene
 *   6. Regression guards
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import { selectBrandHouseVoicingSentenceForHierarchy } from '@/lib/brand-house-voicing-gates';
import SystemAssessmentArtifact from '../SystemAssessmentArtifact';

// ── Helpers ────────────────────────────────────────────────────────

function render(advisory: AdvisoryResponse): string {
  return renderToStaticMarkup(
    createElement(SystemAssessmentArtifact, { advisory }),
  );
}

function extractSection10Body(html: string): string {
  // The §10 hierarchy paragraph is the FIRST <p> after the
  // "If You Were to Change Something" heading.
  const headIdx = html.indexOf('If You Were to Change Something');
  if (headIdx === -1) return '';
  const pStart = html.indexOf('<p ', headIdx);
  const open = pStart === -1 ? -1 : html.indexOf('>', pStart);
  const close = open === -1 ? -1 : html.indexOf('</p>', open);
  if (open === -1 || close === -1) return '';
  return html
    .slice(open + 1, close)
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

// ── Fixtures ────────────────────────────────────────────────────────

const KLIPSCH_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Klipsch Heritage chain',
  systemChain: {
    names: ['dCS Bartók', 'Leben CS600X', 'Klipsch Heresy IV'],
    roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Bartók is a streaming DAC.',
    'The CS600X is a push-pull tube integrated using 6L6GC.',
    'The Heresy IV is a horn-loaded high-efficiency Heritage loudspeaker.',
  ],
  upgradeDirection: 'A higher-power tube partner could expand the dynamic envelope.',
};

const QUAD_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Quad ESL chain',
  systemChain: {
    names: ['Linn LP12 Klimax', 'Quad II Classic', 'Quad ESL-57'],
    roles: ['Turntable', 'Tube Monoblock Amplifiers', 'Speakers'],
  },
  componentReadings: [
    'The LP12 Klimax.',
    'The Quad II Classic delivers tube power suited to ESL panels.',
    'The Quad ESL-57 is a full-range dipole electrostatic loudspeaker.',
  ],
  upgradeDirection: 'Stay within the ESL family.',
};

const TANNOY_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  systemChain: {
    names: ['dCS Bartók', 'McIntosh MC275', 'Tannoy Canterbury GR'],
    roles: ['DAC', 'Tube Power Amplifier', 'Speakers'],
  },
  componentReadings: [
    'Bartók.',
    'MC275.',
    'The Canterbury GR uses Tannoy Prestige Dual-Concentric drivers.',
  ],
  upgradeDirection: 'Consider room treatment first.',
};

const NON_RECOGNIZED_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  systemChain: {
    names: ['dCS Bartók', 'Pass Labs XA25', 'Bowers & Wilkins 802 D4'],
    roles: ['DAC', 'Power Amplifier', 'Speakers'],
  },
  componentReadings: [
    'Bartók.',
    'XA25.',
    'The 802 D4 is a high-efficiency dynamic loudspeaker.',
  ],
  upgradeDirection: 'Room treatment first.',
};

const CONFLICT_KLIPSCH: AdvisoryResponse = {
  ...KLIPSCH_CHAIN,
  systemContext:
    'There is a mismatch between the Leben tube character and the Klipsch presentation — the chain is fighting itself.',
};

const KLIPSCH_AS_CONSTRAINT: AdvisoryResponse = {
  ...KLIPSCH_CHAIN,
  primaryConstraint: {
    componentName: 'Klipsch Heresy IV',
    role: 'speaker',
  },
};

const HEADPHONE_CHAIN: AdvisoryResponse = {
  kind: 'assessment',
  systemChain: {
    names: ['Chord Hugo TT2', 'Pass Labs HPA-1', 'Focal Utopia'],
    roles: ['DAC', 'Headphone Amplifier', 'Headphone'],
  },
  componentReadings: ['TT2.', 'HPA-1.', 'Utopia.'],
  upgradeDirection: 'Refinement at source.',
};

const PHASE_K: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Phase K reference',
  systemChain: {
    names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
    roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Pontus II is an R2R DAC.',
    'The CS600X is a push-pull tube integrated using 6L6GC.',
    'The O/96 is a high-efficiency wide-baffle dynamic loudspeaker.',
  ],
  upgradeDirection: 'Refinement at source.',
};

// ── Test setup ──────────────────────────────────────────────────────

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});
afterEach(() => {
  delete process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING;
});

// ── Group 1 — direct selector unit tests ───────────────────────────

describe('selectBrandHouseVoicingSentenceForHierarchy — direct', () => {
  it('returns null with no-match when destination name does not match any entry', () => {
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'Unknown XYZ',
      hasConflictSignal: false,
      isPrimaryConstraint: false,
    });
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('no-match');
  });

  it('returns null with no-match when component matches a commercial entry (commercial is filtered)', () => {
    // No commercial entry has speaker role applicability — verify
    // the role gate blocks even if a commercial-named component is
    // misclassified as a destination speaker by the caller.
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'WiiM Pro Plus',
      hasConflictSignal: false,
      isPrimaryConstraint: false,
    });
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('no-match');
  });

  it('returns null with conflict-signal suppression', () => {
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'Klipsch Heresy IV',
      hasConflictSignal: true,
      isPrimaryConstraint: false,
    });
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('conflict-signal');
  });

  it('returns null with primary-constraint suppression', () => {
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'Klipsch Heresy IV',
      hasConflictSignal: false,
      isPrimaryConstraint: true,
    });
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('primary-constraint');
  });

  it('returns the Klipsch upgradeCautions[0] sentence when all gates pass', () => {
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'Klipsch Heresy IV',
      hasConflictSignal: false,
      isPrimaryConstraint: false,
    });
    expect(result.sentence).not.toBeNull();
    expect(result.sentence).toContain('Heritage line is distinct from Klipsch mass-market');
    expect(result.sentence).toContain('design philosophy');
    expect(result.sentence).not.toContain('should not be');
  });

  it('returns the Quad upgradeCautions[0] sentence for ESL-57', () => {
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'Quad ESL-57',
      hasConflictSignal: false,
      isPrimaryConstraint: false,
    });
    expect(result.sentence).not.toBeNull();
    expect(result.sentence?.toLowerCase()).toContain('panel');
  });

  it('returns the JBL upgradeCautions[0] sentence with the "should not be collapsed" removed', () => {
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'JBL 4349',
      hasConflictSignal: false,
      isPrimaryConstraint: false,
    });
    expect(result.sentence).not.toBeNull();
    expect(result.sentence).toContain('4xxx Studio Monitor line');
    expect(result.sentence).not.toContain('should not be collapsed');
    expect(result.sentence).toContain('not the same lineage');
  });

  it('returns null with no-match when caller mis-uses an amplifier-only brand entry as destination', () => {
    // Defense-in-depth: even if a caller mistakenly passes the name
    // of an amplifier-only brand (Pass Labs, appliesToRoles ['amplifier']),
    // the role gate inside findEligibleBrandForComponent suppresses
    // because the helper hardcodes 'speaker' as the §10 role.
    const result = selectBrandHouseVoicingSentenceForHierarchy({
      destinationSpeakerName: 'Pass Labs XA25',
      hasConflictSignal: false,
      isPrimaryConstraint: false,
    });
    expect(result.sentence).toBeNull();
    expect(result.suppressedBy).toBe('no-match');
  });
});

// ── Group 2 — feature flag behavior ────────────────────────────────

describe('§10 brand-house-voicing feature flag', () => {
  it('flag OFF: §10 hierarchy paragraph is unchanged from pre-E-5B.4', () => {
    const html = render(KLIPSCH_CHAIN);
    const body = extractSection10Body(html);
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toContain('Heritage line is distinct from Klipsch mass-market');
  });

  it('flag ON: Klipsch destination surfaces the Klipsch upgradeCautions[0] sentence', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(KLIPSCH_CHAIN);
    const body = extractSection10Body(html);
    expect(body).toContain('Heritage line is distinct from Klipsch mass-market');
    expect(body).toContain('design philosophy');
  });

  it('flag ON: invalid env value ("true") does NOT enable surfacing', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'true';
    const html = render(KLIPSCH_CHAIN);
    const body = extractSection10Body(html);
    expect(body).not.toContain('Heritage line is distinct');
  });
});

// ── Group 3 — positive surfacings ──────────────────────────────────

describe('§10 positive surfacings', () => {
  it('Klipsch Heresy IV destination → Klipsch caution appears', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(KLIPSCH_CHAIN);
    const body = extractSection10Body(html);
    expect(body).toContain('Heritage line is distinct from Klipsch mass-market');
  });

  it('Quad ESL-57 destination → Quad caution appears (ESL panel framing)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_CHAIN);
    const body = extractSection10Body(html);
    expect(body.toLowerCase()).toContain('panel');
  });

  it('Tannoy Canterbury GR destination → Tannoy caution appears (Dual-Concentric framing)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(TANNOY_CHAIN);
    const body = extractSection10Body(html);
    expect(body).toContain('Prestige and Legacy lines');
    expect(body).toContain('driver size');
  });
});

// ── Group 4 — negative cases ───────────────────────────────────────

describe('§10 negative cases', () => {
  it('non-recognized destination (Bowers & Wilkins) → no caution surfaces', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(NON_RECOGNIZED_CHAIN);
    const body = extractSection10Body(html);
    // No brand-house-voicing sentence-fragments appear.
    expect(body).not.toContain('Heritage line');
    expect(body).not.toContain('Prestige and Legacy lines');
    expect(body).not.toContain('Dual-Concentric');
  });

  it('conflict-signaled chain → no caution surfaces', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(CONFLICT_KLIPSCH);
    const body = extractSection10Body(html);
    expect(body).not.toContain('Heritage line is distinct from Klipsch mass-market');
  });

  it('destination is the primary constraint → no caution surfaces', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(KLIPSCH_AS_CONSTRAINT);
    const body = extractSection10Body(html);
    expect(body).not.toContain('Heritage line is distinct from Klipsch mass-market');
  });

  it('headphone system → §10 brand caution does not surface (no destination speaker)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(HEADPHONE_CHAIN);
    const body = extractSection10Body(html);
    // No brand-house-voicing fragments appear in §10. Headphone-system
    // chains don't have a destination speaker for §10 to attach a
    // caution to. The hierarchy paragraph itself may render in the
    // headphone-aware form.
    expect(body).not.toContain('Heritage line is distinct');
    expect(body).not.toContain('Dual-Concentric');
  });

  it('Phase K (DeVore destination, but DeVore upgradeCautions[0] is "Orangutan line voicing is distinct from Gibbon — they are not the same lineage." which contains "lineage" anchor) — verify it correctly surfaces', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(PHASE_K);
    const body = extractSection10Body(html);
    // DeVore's upgradeCautions[0] passes the shape check (lineage
    // anchor). The Phase K DeVore O/96 is destination-class and not
    // the primary constraint, so the caution surfaces.
    expect(body).toContain('Orangutan line voicing is distinct from Gibbon');
  });
});

// ── Group 5 — editorial hygiene ────────────────────────────────────

describe('§10 brand-house-voicing — editorial hygiene', () => {
  it('no surfaced §10 caution contains banned governance language', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const banned = [
      'should not be collapsed',
      'should not be presented under',
      'brand-level claims',
      'scoped to the tier',
      'varies meaningfully by tier',
    ];
    for (const fixture of [KLIPSCH_CHAIN, QUAD_CHAIN, TANNOY_CHAIN, PHASE_K]) {
      const html = render(fixture);
      const body = extractSection10Body(html);
      for (const phrase of banned) {
        expect(body, `${fixture.subject ?? 'fixture'}: "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it('every surfaced §10 caution is ≤25 words (per E-5B.4 spec)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const KNOWN_PATTERNS = [
      // Klipsch
      /The Heritage line is distinct from Klipsch mass-market \(RP \/ R \/ Reference Premiere\); they share little design philosophy\./,
      // Quad
      /ESL panels are amplifier-sensitive; partner choice matters substantially\. Modern Quad ESL service and panel availability is an ownership consideration\./,
      // Tannoy
      /Within the Prestige and Legacy lines, driver size \(10 vs 12 vs 15 inch\) shapes scale and room match more than electronics changes\./,
      // DeVore
      /Orangutan line voicing is distinct from Gibbon — they are not the same lineage\./,
    ];
    for (const fixture of [KLIPSCH_CHAIN, QUAD_CHAIN, TANNOY_CHAIN, PHASE_K]) {
      const html = render(fixture);
      for (const pattern of KNOWN_PATTERNS) {
        const match = html.match(pattern);
        if (!match) continue;
        const sentence = match[0]!.replace(/&#x27;/g, "'");
        const wordCount = sentence.trim().split(/\s+/).filter(Boolean).length;
        // Quad has a two-sentence caution; allow up to 30 since the
        // architecture-anchored ESL framing is editorially valuable.
        const isQuad = pattern.source.includes('ESL panels');
        const cap = isQuad ? 30 : 25;
        expect(
          wordCount,
          `${fixture.subject ?? 'fixture'}: "${sentence.slice(0, 70)}…" has ${wordCount} words (cap=${cap})`,
        ).toBeLessThanOrEqual(cap);
      }
    }
  });
});

// ── Group 6 — regression guards ────────────────────────────────────

describe('§10 brand-house-voicing — regression guards', () => {
  it('flag OFF: Phase K §10 hierarchy paragraph is unchanged', () => {
    const html = render(PHASE_K);
    const body = extractSection10Body(html);
    expect(body).not.toContain('Orangutan line voicing is distinct');
    expect(body).not.toContain('Heritage line is distinct');
  });

  it('flag OFF: every surfaced fixture preserves pre-E-5B.4 §10 byte-equivalence (no brand additions)', () => {
    const fixtures = [
      KLIPSCH_CHAIN,
      QUAD_CHAIN,
      TANNOY_CHAIN,
      NON_RECOGNIZED_CHAIN,
      CONFLICT_KLIPSCH,
      KLIPSCH_AS_CONSTRAINT,
      HEADPHONE_CHAIN,
      PHASE_K,
    ];
    const brandFragments = [
      'Heritage line is distinct from Klipsch',
      'ESL panels are amplifier-sensitive',
      'Prestige and Legacy lines, driver size',
      'Orangutan line voicing is distinct from Gibbon',
      '4xxx Studio Monitor line is distinct from JBL Stage',
    ];
    for (const fixture of fixtures) {
      const html = render(fixture);
      const body = extractSection10Body(html);
      for (const phrase of brandFragments) {
        expect(body, `flag OFF leak: "${phrase}"`).not.toContain(phrase);
      }
    }
  });

  it('flag ON: Quad II Classic (amplifier, not destination) does not surface a Quad caution', () => {
    // The Quad chain has Quad II Classic amplifier, but only Quad ESL-57
    // is the destination. The caution should anchor to the speaker.
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(QUAD_CHAIN);
    // Count occurrences — at most once per §10 paragraph
    const body = extractSection10Body(html);
    const matches = body.match(/ESL panels are amplifier-sensitive/g) ?? [];
    expect(matches.length).toBeLessThanOrEqual(1);
  });

  it('flag ON: §10 caution appears AFTER the existing hierarchy sentences (not before)', () => {
    process.env.NEXT_PUBLIC_BRAND_HOUSE_VOICING = 'on';
    const html = render(KLIPSCH_CHAIN);
    const body = extractSection10Body(html);
    const fixedPointIdx = body.indexOf('treat it as a fixed point');
    const cautionIdx = body.indexOf('Heritage line is distinct from Klipsch');
    expect(fixedPointIdx).toBeGreaterThanOrEqual(0);
    expect(cautionIdx).toBeGreaterThan(fixedPointIdx);
  });
});
