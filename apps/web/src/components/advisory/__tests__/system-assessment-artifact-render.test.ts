/**
 * Pass 19 — SystemAssessmentArtifact render tests.
 *
 * Locks the 10-section editorial document contract for the new
 * System Assessment artifact:
 *
 *   §1  Your System                       (hero with chart + chain)
 *   §2  Profile                           (Quick Identity card)
 *   §3  First Impressions
 *   §4  Character
 *   §5  The Components
 *   §6  How They Work Together
 *   §7  Strengths and Honest Limits
 *   §8  What's Already Working
 *   §9  If You Were to Change Something
 *  §10  Sources
 *
 * Each section data-gates on its underlying field. The artifact never
 * renders a section heading without content beneath it.
 *
 * F4 / cross-brand invariants verified at the bottom: no reviewer-quote
 * markup surfaces regardless of input.
 *
 * Uses `react-dom/server.renderToStaticMarkup` to match the established
 * vitest node-env pattern.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { AdvisoryResponse } from '@/lib/advisory-response';
import SystemAssessmentArtifact from '../SystemAssessmentArtifact';

function render(advisory: AdvisoryResponse): string {
  return renderToStaticMarkup(
    createElement(SystemAssessmentArtifact, { advisory }),
  );
}

// ── Fixture: a complete System Assessment with all 10 sections worth of data
const FULL: AdvisoryResponse = {
  kind: 'assessment',
  subject: 'Living Room System',
  systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
  tendencies: 'Flowing midrange, harmonically dense, rhythmically engaging.',
  introSummary: 'Your system is built around the philosophy that source quality dominates the final result.',
  systemContext: 'The Leben CS600X and DeVore Orangutan O/96 are a canonical pairing in the tube-warm coherent-source tradition.',
  systemSynergy: 'The Pontus II warmth is reinforced by the Leben, then anchored by the O/96 cabinet weight.',
  systemInteraction: 'Each component leans warm, and the chain reinforces rather than counterbalances.',
  systemChain: {
    names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
    roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
  },
  componentReadings: [
    'The Pontus II is the warm-tube reference R2R DAC in this price tier.',
    'The CS600X is the most musical sub-$10k tube integrated.',
    'The O/96 is the canonical low-power-tube speaker.',
  ],
  assessmentStrengths: [
    'Exceptional tonal coherence across the chain',
    'Rhythmic engagement and musical flow',
    'Dynamic ease at moderate listening levels',
  ],
  assessmentLimitations: [
    'Limited headroom for orchestral peaks',
    'Less pinpoint imaging than narrow-baffle competitors',
  ],
  primaryConstraint: {
    componentName: 'Amplification headroom for large-scale dynamics',
    role: 'amplifier',
    impact: 'Limits the system at peak orchestral demands.',
  },
  keepRecommendations: [
    { name: 'DeVore O/96', reason: 'The cabinet is doing exactly what voicing-by-ear was designed to deliver.' },
    { name: 'Leben CS600X', reason: 'The midrange weight is the chain\'s defining signal.' },
  ],
  upgradeDirection: 'If you ever wanted more headroom without giving up the warm voicing, the question is amplification.',
  upgradePaths: [
    {
      rank: 1,
      label: 'Amplifier Upgrade',
      rationale: 'Address the primary constraint while preserving voicing.',
      options: [],
    },
  ],
  recommendedSequence: [
    { step: 1, action: 'Audition a higher-power tube integrated against the CS600X in your room.' },
    { step: 2, action: 'If the trade-off feels worth it, plan the swap.' },
    { step: 3, action: 'Do not touch the DAC or the speakers.' },
  ],
  spiderChartData: [
    { trait: 'Warmth', value: 7, fullMark: 10 },
    { trait: 'Detail', value: 6, fullMark: 10 },
    { trait: 'Imaging', value: 5, fullMark: 10 },
    { trait: 'Dynamics', value: 6, fullMark: 10 },
  ],
  sourceReferences: [
    { source: 'Stereophile', note: 'Leben CS600X review', url: 'https://www.stereophile.com/' },
  ],
};

describe('SystemAssessmentArtifact — full data renders all 10 sections', () => {
  const html = render(FULL);

  it('renders §1 Your System (eyebrow heading)', () => {
    expect(html).toContain('Your System');
  });

  it('renders §1 spider chart SVG with all trait labels', () => {
    expect(html).toContain('<svg');
    expect(html).toContain('Warmth');
    expect(html).toContain('Detail');
    expect(html).toContain('Imaging');
    expect(html).toContain('Dynamics');
  });

  it('renders §1 signal chain banner with component names + roles', () => {
    expect(html).toContain('Denafrips Pontus II');
    expect(html).toContain('Leben CS600X');
    expect(html).toContain('DeVore O/96');
    expect(html).toContain('DAC');
    expect(html).toContain('Integrated Amplifier');
    expect(html).toContain('Speakers');
  });

  it('renders §2 Profile', () => {
    expect(html).toContain('Profile');
    expect(html).toContain('What it is:');
  });

  it('§2 Profile row 3 ("What it trades") renders a meaningful trade-off, not a bare component label', () => {
    // The derivation prefers assessmentLimitations[0] — a sentence-shaped
    // trade-off — over the raw primaryConstraint.componentName label.
    expect(html).toContain('What it trades:');
    expect(html).toContain('Limited headroom for orchestral peaks');
    // Negative: the row should NOT contain bare-label content sourced
    // from primaryConstraint.componentName in this fixture.
    expect(html).not.toMatch(/What it trades:\s*Amplification headroom for large-scale dynamics/);
  });

  it('renders §3 First Impressions', () => {
    expect(html).toContain('First Impressions');
    expect(html).toContain('source quality dominates');
  });

  it('renders §4 Character', () => {
    expect(html).toContain('Character');
    expect(html).toContain('canonical pairing');
  });

  it('renders §5 The Components', () => {
    expect(html).toContain('The Components');
    expect(html).toContain('Pontus II is the warm-tube reference');
  });

  it('renders §6 How They Work Together', () => {
    expect(html).toContain('How They Work Together');
    expect(html).toContain('reinforces rather than counterbalances');
  });

  it('renders §7 Strengths and Honest Limits', () => {
    expect(html).toContain('Strengths and Honest Limits');
    expect(html).toContain('Strengths');
    expect(html).toContain('Honest Limits');
    expect(html).toContain('tonal coherence');
    expect(html).toContain('Limited headroom');
  });

  it('renders §8 What\'s Already Working', () => {
    expect(html).toContain('Already Working');
    expect(html).toContain('DeVore O/96');
    expect(html).toContain('voicing-by-ear');
  });

  it('renders §9 If You Were to Change Something', () => {
    expect(html).toContain('If You Were to Change Something');
    expect(html).toContain('more headroom without giving up');
    expect(html).toContain('Step 1');
    expect(html).toContain('Audition a higher-power');
  });

  it('renders §9 ranked upgrade path label + rationale (via AdvisoryUpgradePaths)', () => {
    expect(html).toContain('Amplifier Upgrade');
    expect(html).toContain('Address the primary constraint while preserving voicing');
  });

  it('§9 bridge text is free of template-stitch defects', () => {
    // No doubled punctuation from trailing-period inputs.
    expect(html).not.toContain('..');
    // No mid-sentence proper-noun shape ("leans Warm ..." or
    // "leans A warm ...") from sentence-case inputs. This matches BOTH
    // the [A-Z][a-z] sentence-case shape AND the leading-article shape
    // (single capital followed by space) — the original Issue 2 missed
    // the second variant.
    expect(html).not.toMatch(/leans [A-Z][a-z]/);
    expect(html).not.toMatch(/leans [A-Z] /);
  });

  it('renders §10 Sources (heading present)', () => {
    expect(html).toContain('Sources');
    // Note: AdvisorySources applies a source whitelist (see
    // source-whitelist.ts) that may filter out individual entries.
    // The artifact's responsibility is to invoke AdvisorySources when
    // sourceReferences is non-empty; the whitelist filter's correctness
    // is exercised by its own tests (advisory-sources-fallback.test.ts).
    // Here we verify the §10 heading renders, confirming the
    // section-gating contract.
  });

  it('uses the System Assessment aria-label', () => {
    expect(html).toContain('aria-label="System Assessment"');
  });
});

describe('SystemAssessmentArtifact — warm-editorial chrome', () => {
  // Without the embedded AdvisorySpiderChart, the artifact chrome is
  // warm-only. This isolates the warm-palette contract from the
  // composed primitives (some of which still use the pre-warm palette
  // until the design-system Phase 1 propagation lands separately).
  const chromeOnly: AdvisoryResponse = { ...FULL, spiderChartData: undefined };
  const html = render(chromeOnly);

  it('uses warm accent (#B08D57) in eyebrow headings and accents', () => {
    expect(html).toContain('#B08D57');
  });

  it('uses cream cardBg (#FFFEFA) on every card surface', () => {
    expect(html).toContain('#FFFEFA');
  });

  it('artifact chrome does NOT use the cool-slate chat-surface accent (#1F3A5F navy)', () => {
    // Scoped to artifact chrome only. AdvisorySpiderChart still uses
    // the pre-warm palette internally; that is a separate concern
    // tracked in the design-system gap audit Phase 1. When rendered
    // without the chart, the artifact's own chrome surface must be
    // warm-only.
    expect(html).not.toContain('#1F3A5F');
  });

  it('artifact chrome does NOT use the cool-slate accentBg (#EEF2F8)', () => {
    expect(html).not.toContain('#EEF2F8');
  });
});

describe('SystemAssessmentArtifact — data gating (sparse responses)', () => {
  it('skips §3 First Impressions when introSummary is absent', () => {
    const html = render({ ...FULL, introSummary: undefined });
    expect(html).not.toContain('First Impressions');
  });

  it('skips §4 Character when both systemContext and systemSynergy are absent', () => {
    const html = render({ ...FULL, systemContext: undefined, systemSynergy: undefined });
    expect(html).not.toContain('>Character<');
  });

  it('skips §5 The Components when componentReadings is empty', () => {
    const html = render({ ...FULL, componentReadings: undefined });
    expect(html).not.toContain('The Components');
  });

  it('skips §6 How They Work Together when systemInteraction is absent', () => {
    const html = render({ ...FULL, systemInteraction: undefined });
    expect(html).not.toContain('How They Work Together');
  });

  it('skips §7 grid when both strengths and limits are absent', () => {
    const html = render({ ...FULL, assessmentStrengths: undefined, assessmentLimitations: undefined });
    expect(html).not.toContain('Strengths and Honest Limits');
  });

  it('skips §8 when keepRecommendations is empty', () => {
    const html = render({ ...FULL, keepRecommendations: undefined });
    expect(html).not.toContain('Already Working');
  });

  it('skips §9 when upgradeDirection, upgradePaths, and recommendedSequence are all absent', () => {
    const html = render({
      ...FULL,
      upgradeDirection: undefined,
      upgradePaths: undefined,
      recommendedSequence: undefined,
    });
    expect(html).not.toContain('If You Were to Change');
  });

  it('skips §10 Sources when sourceReferences is empty', () => {
    const html = render({ ...FULL, sourceReferences: undefined });
    expect(html).not.toMatch(/<h2[^>]*>Sources<\/h2>/);
  });

  it('skips §10 Sources when sourceReferences is non-empty but all entries are filtered out by the whitelist', () => {
    // Issue 3 fix: the §10 gate must check POST-filter visible sources,
    // not raw input count. Otherwise the heading orphans above empty
    // content. This input has 2 non-whitelisted sources — both must be
    // dropped by filterSourcesForDisplay, and the §10 heading must NOT
    // render.
    const html = render({
      ...FULL,
      sourceReferences: [
        { source: 'random-blog.example.com', note: 'Some review' },
        { source: 'unknown-source-label', note: 'Another' },
      ],
    });
    expect(html).not.toMatch(/<h2[^>]*>Sources<\/h2>/);
  });

  it('renders only §1 and §2 with hero + signature only (minimal viable)', () => {
    const minimal: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Minimal',
      systemSignature: 'A minimal system.',
    };
    const html = render(minimal);
    expect(html).toContain('Your System');
    expect(html).toContain('Profile');
    expect(html).not.toContain('First Impressions');
    expect(html).not.toContain('Character');
  });
});

describe('SystemAssessmentArtifact — F4 / cross-brand invariants', () => {
  it('does not render reviewer-quote markup regardless of input', () => {
    const html = render(FULL);
    expect(html).not.toContain('<blockquote');
    expect(html).not.toContain('<cite');
  });

  it('renders the queried system label in the aria-label (no cross-brand leak)', () => {
    const html = render(FULL);
    // aria-label is a fixed editorial label "System Assessment" (not the
    // subject) — the document chrome must not leak any other system's
    // identity into accessibility metadata.
    expect(html).toContain('aria-label="System Assessment"');
  });
});

describe('SystemAssessmentArtifact — section heading set is locked', () => {
  it('uses exactly the 10 locked heading labels', () => {
    const html = render(FULL);
    const expectedHeadings = [
      'Your System',
      'Profile',
      'First Impressions',
      'Character',
      'The Components',
      'How They Work Together',
      'Strengths and Honest Limits',
      'Already Working', // partial match — apostrophe-S renders as &rsquo;s
      'If You Were to Change Something',
      'Sources',
    ];
    for (const heading of expectedHeadings) {
      expect(html).toContain(heading);
    }
  });

  it('does NOT use any prior-candidate heading words that were rejected', () => {
    const html = render(FULL);
    // Locked heading set rejected these:
    expect(html).not.toContain('At a Glance');
    expect(html).not.toContain('Quick Identity');
    expect(html).not.toContain('Voicing');
    expect(html).not.toContain('Synergy');
    expect(html).not.toContain('Signal Chain');
    expect(html).not.toContain('Component Readings');
  });
});

describe('SystemAssessmentArtifact — Profile row 3 derivation fallback chain', () => {
  // Each case constructs an AdvisoryResponse with a subset of fields the
  // derivation considers, and asserts the rendered "What it trades:" row.
  // Builds the minimum viable response so other sections don't add noise.

  function base(): AdvisoryResponse {
    return { kind: 'assessment', subject: 'Test' };
  }

  it('uses assessmentLimitations[0] when present (top of derivation chain)', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentLimitations: ['Loses fine detail at low volumes', 'Bass extension is room-dependent'],
      primaryConstraint: { componentName: 'DAC', role: 'dac', impact: 'Limits resolution.' },
    };
    const html = render(a);
    expect(html).toContain('What it trades:');
    expect(html).toContain('Loses fine detail at low volumes');
    // Should NOT have used the lower-priority sources.
    expect(html).not.toContain('Limits resolution');
  });

  it('falls back to primaryConstraint.impact when assessmentLimitations is empty', () => {
    const a: AdvisoryResponse = {
      ...base(),
      primaryConstraint: { componentName: 'DAC', role: 'dac', impact: 'Limits resolution at moderate volumes.' },
    };
    const html = render(a);
    expect(html).toContain('What it trades:');
    expect(html).toContain('Limits resolution at moderate volumes');
  });

  it('falls back to a derived sentence when only componentName is present', () => {
    const a: AdvisoryResponse = {
      ...base(),
      primaryConstraint: { componentName: 'DAC', role: 'dac' },
    };
    const html = render(a);
    expect(html).toContain('What it trades:');
    // The rendered HTML escapes the apostrophe ('s → &#x27;s); match
    // the sentence shape via partial substrings.
    expect(html).toContain('DAC is the system');
    expect(html).toContain('primary constraint');
    // Even in the fallback case, the row reads as a sentence, not as
    // a bare component label — the original Issue 1 defect.
    expect(html).not.toMatch(/What it trades:\s*DAC\s*<\/li>/);
  });

  it('omits the "What it trades" row entirely when no derivation source exists', () => {
    const html = render(base());
    expect(html).not.toContain('What it trades:');
  });
});
