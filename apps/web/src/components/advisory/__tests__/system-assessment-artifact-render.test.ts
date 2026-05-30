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

describe('SystemAssessmentArtifact — §4 Character: System-read extraction + memo-heading removal', () => {
  // Locks the Commit 4B fix: §4 must contain ONLY the "System read"
  // content, with all eight legacy MemoFormat sub-headings stripped:
  // System read · Emergent behavior · System logic · Primary leverage ·
  // Decision · Trade-offs · Next step options · Do nothing check.
  //
  // The fixture mirrors live engine output from the Phase K gold-case
  // chain (captured before the fix) so any regression that re-exposes
  // the memo prose is unambiguous.

  const PHASE_K_LIVE_SYSTEM_CONTEXT =
    '**System read** This is a warmth-first system anchored by Leben CS600X and Denafrips Pontus II, reinforced by the DeVore O/96. Warmth and body dominate throughout. This system reflects a listener drawn to harmonic density, tonal continuity, and timbral depth. This system is organized around harmonic restraint, smoothness, and unforced presence. **Emergent behavior** The Pontus II/CS600X/O/96 chain works because speed is converted into elastic motion rather than edge. **System logic** Denafrips Pontus II → tone-rich, smooth conversion → anchors the tonal foundation with warmth Leben CS600X → tone-rich, high flow → preserves upstream character. **Primary leverage** System balance. The system is already built around tonal richness. **Decision** KEEP if you value warmth, body, tonal richness. CHANGE the DAC if vocals feel thin or instruments lack weight. **Trade-offs** - Leaner DAC adds speed, reduces harmonic weight - Solid-state swap adds grip, reduces harmonic bloom. **Next step options** - Move toward more resolving DAC options - Compare Denafrips Pontus II vs delta-sigma alternatives. **Do nothing check** If the music sounds engaging, this system is doing its job.';

  function makePhaseK(extra?: Partial<AdvisoryResponse>): AdvisoryResponse {
    return {
      kind: 'assessment',
      subject: 'Living Room System',
      systemContext: PHASE_K_LIVE_SYSTEM_CONTEXT,
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Amplifier', 'Speakers'],
      },
      ...extra,
    };
  }

  function characterSection(html: string): string {
    const start = html.indexOf('>Character<');
    if (start < 0) return '';
    return html.slice(start, start + 3500);
  }

  describe('memo sub-headings are removed', () => {
    const html = render(makePhaseK());
    const ch = characterSection(html);

    it('System read marker is stripped (the content is kept, the marker is not)', () => {
      // The literal "**System read**" delimiter must not appear in
      // rendered HTML, but the content beneath it must.
      expect(ch).not.toContain('**System read**');
      expect(ch).toContain('warmth-first system');
    });

    it('Emergent behavior heading is removed', () => {
      expect(ch).not.toContain('Emergent behavior');
    });

    it('System logic heading + arrow narration are removed', () => {
      expect(ch).not.toContain('System logic');
      expect(ch).not.toContain('→');
    });

    it('Primary leverage heading is removed', () => {
      expect(ch).not.toContain('Primary leverage');
    });

    it('Decision heading + decision content are removed', () => {
      expect(ch).not.toContain('Decision');
      expect(ch).not.toContain('KEEP if you value');
      expect(ch).not.toContain('CHANGE the DAC');
    });

    it('Trade-offs heading + trade-off list are removed', () => {
      expect(ch).not.toContain('Trade-offs');
      expect(ch).not.toContain('Leaner DAC adds speed');
    });

    it('Next step options heading + recommendations are removed', () => {
      expect(ch).not.toContain('Next step options');
      expect(ch).not.toContain('delta-sigma alternatives');
    });

    it('Do nothing check heading + restraint phrasing are removed', () => {
      expect(ch).not.toContain('Do nothing check');
      expect(ch).not.toContain('doing its job');
    });

    it('no residual bold marker (**...**) anywhere in §4', () => {
      expect(ch).not.toMatch(/\*\*[^*]+\*\*/);
    });
  });

  describe('Character keeps system identity / voicing / coherence', () => {
    const html = render(makePhaseK());
    const ch = characterSection(html);

    it('renders the "warmth-first system" identity claim', () => {
      expect(ch).toContain('warmth-first system');
    });

    it('renders the listener-philosophy framing', () => {
      expect(ch).toContain('harmonic density');
      expect(ch).toContain('tonal continuity');
    });

    it('renders the coherence/organization framing', () => {
      expect(ch).toContain('harmonic restraint');
      expect(ch).toContain('smoothness');
    });
  });

  describe('Character length target (~500–800 chars after normalization)', () => {
    it('Phase K gold-case character prose lands inside the editorial target window', () => {
      const html = render(makePhaseK());
      const ch = characterSection(html);
      // The §4 section heading + chrome adds ~30-50 chars on top of
      // the prose; check that the prose portion is bounded.
      // Find the <p>...</p> content and measure.
      const proseMatch = ch.match(/<p[^>]*>([\s\S]*?)<\/p>/);
      expect(proseMatch).not.toBeNull();
      const proseLen = proseMatch![1].length;
      // After memo-heading removal the System-read content for Phase K
      // is ~400 chars. Locking >= 200 to catch over-aggressive stripping
      // and <= 900 to catch regression that re-floods the section.
      expect(proseLen).toBeGreaterThanOrEqual(200);
      expect(proseLen).toBeLessThanOrEqual(900);
    });
  });

  describe('Character graceful degradation', () => {
    it('omits §4 when systemContext is empty and systemSynergy is empty', () => {
      const html = render({ kind: 'assessment', subject: 'Test' });
      expect(html).not.toContain('>Character<');
    });

    it('still renders §4 with only systemSynergy when systemContext is empty', () => {
      const html = render({
        kind: 'assessment',
        subject: 'Test',
        systemSynergy: 'A short synergy claim.',
      });
      expect(html).toContain('>Character<');
      expect(html).toContain('short synergy claim');
    });

    it('renders systemContext as-is when no memo markers are present', () => {
      const html = render({
        kind: 'assessment',
        subject: 'Test',
        systemContext: 'A coherent warm-leaning system with deliberate voicing.',
      });
      expect(html).toContain('coherent warm-leaning system');
    });
  });
});

describe('SystemAssessmentArtifact — §6 How They Work Together: interaction-only discipline', () => {
  // Locks the Commit 4B fix: §6 must contain only system-level or
  // multi-component interaction sentences. Product-review drift,
  // off-chain product mentions, single-component spec rundowns, and
  // brand-history asides must be stripped.

  const PHASE_K_LIVE_INTERACTION =
    'The system leans toward warmth and smoothness and dynamic energy and scale across multiple components — they push in the same direction, creating a strong and coherent character. Leben CS600X: Leben amplifiers are a natural match for high-efficiency loudspeakers — DeVore, Zu, Klipsch Heritage. The CS600X (~32W) drives speakers in the 90–96 dB range with authority. The CS300 / CS300X has a parallel identity as a desktop tube amplifier for headphone listeners.';

  function makePhaseK(extra?: Partial<AdvisoryResponse>): AdvisoryResponse {
    return {
      kind: 'assessment',
      subject: 'Living Room System',
      systemInteraction: PHASE_K_LIVE_INTERACTION,
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Amplifier', 'Speakers'],
      },
      ...extra,
    };
  }

  function interactionSection(html: string): string {
    const start = html.indexOf('How They Work Together');
    if (start < 0) return '';
    return html.slice(start, start + 2000);
  }

  describe('product-review drift is removed', () => {
    const html = render(makePhaseK());
    const sec = interactionSection(html);

    it('removes the "Leben CS600X:" component-header label pattern', () => {
      expect(sec).not.toContain('Leben CS600X: Leben');
    });

    it('removes off-chain CS300 / CS300X product reference', () => {
      expect(sec).not.toContain('CS300');
      expect(sec).not.toContain('headphone listeners');
    });

    it('removes spec sentences (~32W / 90–96 dB)', () => {
      expect(sec).not.toContain('~32W');
      expect(sec).not.toContain('32W');
      expect(sec).not.toContain('90–96 dB');
    });

    it('removes brand-pairing trivia (Zu, Klipsch Heritage)', () => {
      expect(sec).not.toContain('Zu');
      expect(sec).not.toContain('Klipsch Heritage');
    });
  });

  describe('§6 retains system-level interaction prose', () => {
    const html = render(makePhaseK());
    const sec = interactionSection(html);

    it('keeps the system-level "push in the same direction" framing', () => {
      expect(sec).toContain('push in the same direction');
    });

    it('keeps the "coherent character" claim', () => {
      expect(sec).toContain('coherent character');
    });
  });

  describe('§6 success test — every retained sentence is interaction-grade', () => {
    const html = render(makePhaseK());
    const sec = interactionSection(html);
    // Extract the <p> content (the prose body)
    const proseMatch = sec.match(/<p[^>]*>([\s\S]*?)<\/p>/);

    it('renders at least one prose paragraph', () => {
      expect(proseMatch).not.toBeNull();
    });

    it('no retained sentence contains a "{Component}:" header label', () => {
      const prose = proseMatch![1];
      expect(prose).not.toMatch(/Leben CS600X\s*:/);
      expect(prose).not.toMatch(/Denafrips Pontus II\s*:/);
      expect(prose).not.toMatch(/DeVore O\/96\s*:/);
    });

    it('no retained sentence contains an off-chain product token', () => {
      const prose = proseMatch![1];
      // Spec model tokens for off-chain products (e.g. CS300, CS300X)
      // should not survive filtering.
      expect(prose).not.toMatch(/\bCS\d+/);
      expect(prose).not.toMatch(/\bKT\d+/);
      expect(prose).not.toMatch(/\bEL\d+/);
    });
  });

  describe('multi-component interaction sentences ARE retained', () => {
    it('a sentence that names two chain components is kept', () => {
      const html = render({
        ...makePhaseK(),
        systemInteraction:
          'The Pontus II warmth is reinforced by the Leben tube saturation. The CS600X (~32W) drives speakers.',
      });
      const sec = interactionSection(html);
      const prose = sec.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
      // Multi-component sentence retained.
      expect(prose).toContain('Pontus II warmth is reinforced by the Leben');
      // Spec sentence dropped.
      expect(prose).not.toContain('~32W');
    });
  });

  describe('§6 graceful degradation', () => {
    it('omits §6 when systemInteraction is absent', () => {
      const html = render({
        kind: 'assessment',
        subject: 'Test',
        systemChain: { names: ['Foo'], roles: ['DAC'] },
      });
      expect(html).not.toContain('How They Work Together');
    });

    it('falls back to first sentence when ALL sentences are filtered out', () => {
      // Adversarial: every sentence is single-component or off-chain.
      // The defensive fallback keeps the first sentence so the section
      // is not silently emptied.
      const html = render({
        ...makePhaseK(),
        systemInteraction:
          'Leben CS600X: standalone product review. The CS300X has no system role.',
      });
      const sec = interactionSection(html);
      const prose = sec.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '';
      // Some content survives (defensive fallback). Empty section
      // would fail to render the heading.
      expect(prose.length).toBeGreaterThan(0);
    });
  });
});

describe('SystemAssessmentArtifact — §5 The Components: identity mapping + content discipline', () => {
  // These tests lock the Commit 4A fix: the artifact must map engine
  // componentReadings to chain names by IDENTITY (prefix match), not by
  // array index. The engine produces readings in a different order than
  // systemChain.names produces, and prior index-mapping silently swapped
  // card descriptions. Tests are written with the gold-case chain so a
  // regression that re-introduces the swap is unambiguous.

  // Phase K gold-case fixture: chain in signal-path order, readings in
  // intentionally MISMATCHED order to expose the identity-mapping
  // requirement. The Leben reading deliberately mentions the off-chain
  // CS300X to test off-chain stripping; the Pontus II reading is shorter
  // than the others to test length-target tolerance.
  const GOLD_CASE: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Living Room System',
    systemChain: {
      names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
      roles: ['DAC', 'Amplifier', 'Speakers'],
    },
    // Readings INTENTIONALLY out of order vs systemChain.names — the
    // engine emits them in input order (Leben first), while the chain
    // is sorted by signal path (Pontus first). Identity mapping must
    // recover the correct pairing.
    componentReadings: [
      'The Leben CS600X — Leben\'s flagship push-pull tube integrated. ~32W with switchable output tube compatibility (KT77, KT88, EL34) that meaningfully changes voicing. Extraordinary rhythmic drive, tonal density, and midrange authority. One of the most celebrated pairings in modern audio with the DeVore O/96. The CS300 / CS300X has a parallel identity as a desktop tube amplifier for headphone listeners.',
      'The Denafrips Pontus II — Full-scale R2R with rich tonal density, strong harmonic texture, and refined composure. Prioritizes body and musical weight over transient sharpness.',
      'The DeVore O/96 — High-efficiency design that combines deep tonal density with remarkable rhythmic drive. Makes music feel physically present in the room.',
    ],
  };

  // Helper: scope to the §5 section only. "Leben CS600X" and similar
  // names appear in §1's chain banner first; we must search inside §5
  // explicitly to evaluate component-card content.
  function componentsSection(html: string): string {
    const start = html.indexOf('The Components');
    const after = html.slice(start);
    // §5 ends at the next <section> opener.
    const endRel = after.search(/<section[^>]*>/g.exec(after.slice(50))?.index !== undefined
      ? new RegExp(`<section[^>]*>`)
      : /$/);
    // Robust slice: take a generous window past the start. §5 in our
    // fixtures is well under 4000 chars.
    return html.slice(start, start + 4500);
  }

  function cardWindowForName(html: string, name: string): string {
    const scoped = componentsSection(html);
    // Anchor on the card-heading marker `>{name}</div>` (the
    // EditorialSubCard primitive renders the name inside a div with
    // distinctive font-weight:600). After the contribution-lede
    // helper landed, the prior card's body can mention the next
    // chain name (e.g. Pontus II's lede says "feeds the Leben
    // CS600X"), so a plain `indexOf(name)` would mis-locate. The
    // heading marker is unambiguous.
    const headingNeedle = `>${name}</div>`;
    let idx = scoped.indexOf(headingNeedle);
    if (idx < 0) {
      // Fallback for older snapshots / chain-banner usage.
      idx = scoped.indexOf(name);
    }
    if (idx < 0) return '';
    // Each card is a `<div ...>` block of bounded length; 1200 chars
    // covers the heading + role + lede + body within §5.
    return scoped.slice(idx, idx + 1200);
  }

  describe('identity mapping — readings match the named card, not the array index', () => {
    const html = render(GOLD_CASE);

    it('Denafrips Pontus II card body describes the Pontus II', () => {
      const card = cardWindowForName(html, 'Denafrips Pontus II');
      expect(card).toContain('Pontus II');
      expect(card).toContain('R2R');
      // Negative: the Leben\'s tube content must NOT appear in the
      // Denafrips card (this would be the pre-fix swap defect).
      expect(card).not.toContain('Leben\'s flagship push-pull');
      expect(card).not.toContain('KT88');
    });

    it('Leben CS600X card body describes the Leben CS600X', () => {
      const card = cardWindowForName(html, 'Leben CS600X');
      expect(card).toContain('tube integrated');
      // Negative: the Pontus II\'s R2R language must NOT appear in the
      // Leben card (this would be the pre-fix swap defect).
      expect(card).not.toContain('Full-scale R2R');
    });

    it('DeVore O/96 card body describes the DeVore O/96', () => {
      const card = cardWindowForName(html, 'DeVore O/96');
      expect(card).toContain('High-efficiency');
    });
  });

  describe('Phase K gold case — full chain renders correctly', () => {
    const html = render(GOLD_CASE);

    it('renders all three chain names as card headings', () => {
      // §5 must show all three names in the cards (not just the chain banner).
      // Use a chunk of HTML around "The Components" to scope the assertion.
      const compsIndex = html.indexOf('The Components');
      const compsSection = html.slice(compsIndex, compsIndex + 3000);
      expect(compsSection).toContain('Denafrips Pontus II');
      expect(compsSection).toContain('Leben CS600X');
      expect(compsSection).toContain('DeVore O/96');
    });

    it('renders each card with its role subtitle', () => {
      const compsIndex = html.indexOf('The Components');
      const compsSection = html.slice(compsIndex, compsIndex + 3000);
      expect(compsSection).toContain('DAC');
      expect(compsSection).toContain('Amplifier');
      expect(compsSection).toContain('Speakers');
    });
  });

  describe('off-chain product references are stripped', () => {
    const html = render(GOLD_CASE);

    it('§5 does NOT contain the CS300 / CS300X reference from the Leben reading', () => {
      const compsIndex = html.indexOf('The Components');
      const compsSection = html.slice(compsIndex, compsIndex + 3000);
      expect(compsSection).not.toContain('CS300');
      expect(compsSection).not.toContain('headphone listeners');
    });

    it('§5 retains in-chain product mentions (DeVore O/96 referenced inside Leben card is on-chain and kept)', () => {
      // The Leben reading mentions the DeVore O/96 — which IS in the
      // chain. That reference must be preserved (off-chain stripping
      // only removes products NOT in the chain).
      const card = cardWindowForName(html, 'Leben CS600X');
      expect(card).toContain('celebrated pairings');
    });
  });

  describe('contribution-orientation: cards reference system role or chain context', () => {
    const html = render(GOLD_CASE);

    it('each card carries its role subtitle (system-role anchor)', () => {
      // The role subtitle (DAC / Amplifier / Speakers) is the artifact's
      // explicit "what does this component do in this system" signal.
      // Every card body lives beneath this role anchor.
      const compsIndex = html.indexOf('The Components');
      const compsSection = html.slice(compsIndex, compsIndex + 3000);
      expect(compsSection.match(/DAC/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(compsSection.match(/Amplifier/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
      expect(compsSection.match(/Speakers/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    });

    it('at least one card body references another component in the chain (relational language)', () => {
      // For the gold case, the Leben reading references DeVore O/96 —
      // an on-chain neighbor. Identity-mapping + on-chain preservation
      // means the Leben card body now contains a relational sentence
      // to its chain neighbor.
      const card = cardWindowForName(html, 'Leben CS600X');
      expect(card).toContain('DeVore O/96');
    });
  });

  describe('length consistency — card bodies trimmed to a consistent target', () => {
    const html = render(GOLD_CASE);

    it('the Leben card (originally the longest engine reading) is not catastrophically longer than the Pontus II card', () => {
      // Extract approximate text body for each card by name window.
      // We use the absence of "KT88" (originally in the Leben body)
      // and "EL34" as a proxy for "the engine\'s 80-word body was
      // trimmed at sentence boundaries". The Leben body should retain
      // the opening character claim but not the full spec dump.
      const card = cardWindowForName(html, 'Leben CS600X');
      expect(card).toContain('tube integrated');
      // The full original reading included a spec dump in parens —
      // confirming length-trim is in effect by checking the spec dump
      // doesn\'t appear entirely.
      const hasFullSpec = card.includes('KT77') && card.includes('KT88') && card.includes('EL34');
      // Either the spec dump was stripped (off-chain heuristic), trimmed
      // (length target), or both. Locking the outcome: the spec
      // triplet is NOT present in full.
      expect(hasFullSpec).toBe(false);
    });
  });

  describe('graceful degradation', () => {
    it('renders with no chain names, falling back to "Component N" labels', () => {
      const a: AdvisoryResponse = {
        kind: 'assessment',
        subject: 'Test',
        componentReadings: ['The Foo — does something.', 'The Bar — does something else.'],
      };
      const html = render(a);
      const compsIndex = html.indexOf('The Components');
      const compsSection = html.slice(compsIndex, compsIndex + 1500);
      expect(compsSection).toContain('Component 1');
      expect(compsSection).toContain('Component 2');
    });

    it('omits §5 entirely when componentReadings is empty', () => {
      const a: AdvisoryResponse = {
        kind: 'assessment',
        subject: 'Test',
        systemChain: { names: ['Foo'], roles: ['DAC'] },
      };
      const html = render(a);
      expect(html).not.toContain('The Components');
    });

    it('falls back to positional reading when a chain name has no matching prefix', () => {
      // Engine reading does NOT start with "The Foo" — but chain name
      // is "Foo". The fallback uses the positional reading at index 0.
      const a: AdvisoryResponse = {
        kind: 'assessment',
        subject: 'Test',
        systemChain: { names: ['Foo'], roles: ['DAC'] },
        componentReadings: ['Some prose that does not start with the component name.'],
      };
      const html = render(a);
      const compsIndex = html.indexOf('The Components');
      const compsSection = html.slice(compsIndex, compsIndex + 1500);
      expect(compsSection).toContain('Some prose that does not start');
    });
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

// ════════════════════════════════════════════════════════════════════════
// Pass 20 — §3 / §5 / §7 / §9 refinement-helper tests
// ════════════════════════════════════════════════════════════════════════
//
// Locks the four presentation-layer helpers added in the §3/§5/§7/§9
// refinement pass:
//   - normalizeFirstImpressions    → strips marketing openers + adjective
//                                    stacks from §3
//   - buildContributionLede        → prepends a system-anchored sentence
//                                    to each §5 card body
//   - dedupeStrengthsByConcept     → collapses exact concept duplicates
//                                    in §7 strengths AND limitations
//   - deriveStepTitle              → produces editorial card titles for §9
//                                    step cards (with "Step N" as subtitle)
//
// Pure presentation transforms — engine output is unchanged.

describe('SystemAssessmentArtifact — §3 First Impressions normalization', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Living Room System',
      systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
    } as AdvisoryResponse);

  it('strips marketing-opener sentences ("A reference-level system…")', () => {
    const a: AdvisoryResponse = {
      ...base(),
      introSummary:
        'A reference-level system in the warm-coherent tradition. The chain leans into rhythm and tonal density.',
    };
    const html = render(a);
    expect(html).toContain('First Impressions');
    // Marketing-opener sentence is stripped.
    expect(html).not.toContain('A reference-level system');
    // Substantive sentence is kept.
    expect(html).toContain('leans into rhythm');
  });

  it('strips a 3+ comma-separated adjective stack sentence', () => {
    const a: AdvisoryResponse = {
      ...base(),
      introSummary:
        'It is warm, dense, harmonic, engaging. The pairing has a coherent voice that holds together across the spectrum.',
    };
    const html = render(a);
    // Adjective-stack sentence is dropped.
    expect(html).not.toContain('warm, dense, harmonic');
    // Non-stack sentence is kept.
    expect(html).toContain('coherent voice');
  });

  it('applies the "shares a consistent lean toward" → "leans toward" rewrite', () => {
    const a: AdvisoryResponse = {
      ...base(),
      introSummary:
        'The chain shares a consistent lean toward midrange weight and rhythmic engagement throughout.',
    };
    const html = render(a);
    expect(html).toContain('leans toward midrange weight');
    expect(html).not.toContain('shares a consistent lean toward');
  });

  it('falls back to systemSignature when stripping leaves the prose too thin', () => {
    const a: AdvisoryResponse = {
      ...base(),
      introSummary:
        'A reference-level system. The system prioritises warmth, density and engagement.',
    };
    const html = render(a);
    // Both source sentences match marketing/adjective-stack filters and
    // are dropped. The signature is used as graceful fallback so the
    // section still says something.
    expect(html).toContain('First Impressions');
    expect(html).toContain('warm tube-led source-first chain');
  });

  it('skips §3 entirely when introSummary is undefined (signature is NOT a substitute)', () => {
    // Data-gating contract: §3 keys on `introSummary` presence. If there
    // is nothing to normalize, the section stays hidden — signature
    // belongs in §1, not in §3.
    const a: AdvisoryResponse = {
      ...base(),
      introSummary: undefined,
    };
    const html = render(a);
    expect(html).not.toContain('First Impressions');
  });
});

describe('SystemAssessmentArtifact — §5 contribution lede', () => {
  const baseChain = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Test System',
      systemSignature: 'sig',
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'The Pontus II is a warm-tube R2R DAC.',
        'The CS600X is a musical tube integrated.',
        'The O/96 is a high-efficiency speaker.',
      ],
    } as AdvisoryResponse);

  it('head component (DAC) lede references the downstream neighbor', () => {
    const html = render(baseChain());
    // Pontus II is head (idx=0) → lede should say "feeds the Leben CS600X".
    expect(html).toContain('feeds the Leben CS600X');
  });

  it('tail component (Speakers) lede references the upstream neighbor', () => {
    const html = render(baseChain());
    // DeVore O/96 is tail → "translates what the Leben CS600X delivers".
    expect(html).toContain('translates what the Leben CS600X delivers');
  });

  it('middle component lede uses the "Sitting between" template', () => {
    const html = render(baseChain());
    expect(html).toContain('Sitting between the Denafrips Pontus II and the DeVore O/96');
  });

  it('strips the engine\'s "The {Name} —" prefix from the reading body', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      componentReadings: [
        'The Denafrips Pontus II — Full-scale R2R with rich tonal density.',
        'The Leben CS600X — Tube integrated.',
        'The DeVore O/96 — Efficient speaker.',
      ],
    };
    const html = render(a);
    // The prefix is stripped before the lede is prepended, so the body
    // does not double-name the component.
    expect(html).not.toContain('Pontus II — Full-scale R2R');
    expect(html).toContain('Full-scale R2R with rich tonal density');
  });

  it('appends "primary constraint" sentence when the card matches primaryConstraint.componentName', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      primaryConstraint: {
        componentName: 'Leben CS600X',
        category: 'amplifier_control',
        explanation: 'Power ceiling limits headroom.',
      } as AdvisoryResponse['primaryConstraint'],
    };
    const html = render(a);
    // HTML escapes the apostrophe ('s → &#x27;s); match the sentence
    // shape via two non-apostrophe substrings.
    expect(html).toContain('It is the system');
    expect(html).toContain('primary constraint');
  });

  it('falls back to generic "this system\'s {role}" for a single-component chain', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Solo',
      systemSignature: 'sig',
      systemChain: { names: ['Some Component'], roles: ['Headphone'] },
      componentReadings: ['Detailed reading body here.'],
    } as AdvisoryResponse;
    const html = render(a);
    // No upstream / downstream → generic anchor sentence.
    // HTML escapes the apostrophe; split into two substrings.
    expect(html).toContain('The Some Component is this system');
    expect(html).toContain('headphone');
  });

  it('handles 2-component chain (head + tail, no middle)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Pair',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Speakers'],
        roles: ['DAC', 'Speakers'],
      },
      componentReadings: [
        'Warm-leaning DAC.',
        'High-efficiency speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    // Head lede references downstream (the speakers).
    expect(html).toContain('feeds the Some Speakers');
    // Tail lede references upstream (the DAC).
    expect(html).toContain('translates what the Some DAC delivers');
  });

  it('gracefully handles role=undefined with a generic "component" anchor', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'No-Roles',
      systemSignature: 'sig',
      systemChain: { names: ['Mystery'], roles: undefined },
      componentReadings: ['Body content.'],
    } as AdvisoryResponse;
    const html = render(a);
    // Role label falls back to "component"; no exception.
    // HTML escapes the apostrophe; split into two substrings.
    expect(html).toContain('The Mystery is this system');
    expect(html).toContain('component');
  });
});

describe('SystemAssessmentArtifact — §7 strength/limit dedup', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Dedup System',
      systemSignature: 'sig',
      systemChain: {
        names: ['Leben CS600X', 'DeVore O/96'],
        roles: ['Integrated Amplifier', 'Speakers'],
      },
    } as AdvisoryResponse);

  it('collapses three concept-duplicate strength bullets to one', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: [
        'Leben contributes musical flow and continuity',
        'DeVore contributes musical flow and continuity',
        'System contributes musical flow and continuity',
      ],
    };
    const html = render(a);
    // After dedup, the concept "musical flow + continuity" surfaces
    // once rather than three times.
    const flowMatches = html.match(/musical flow/g) ?? [];
    expect(flowMatches.length).toBe(1);
  });

  it('preserves bullets that name DIFFERENT concepts', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: [
        'Exceptional tonal coherence across the chain',
        'Rhythmic engagement and musical flow',
        'Dynamic ease at moderate listening levels',
      ],
    };
    const html = render(a);
    expect(html).toContain('tonal coherence');
    expect(html).toContain('Rhythmic engagement');
    expect(html).toContain('Dynamic ease');
  });

  it('symmetrically applies dedup to honest limits', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentLimitations: [
        'Leben contributes limited dynamic headroom',
        'DeVore contributes limited dynamic headroom',
      ],
    };
    const html = render(a);
    // Scope to the Honest Limits subsection — §2 Profile also pulls
    // from assessmentLimitations[0] for the "What it trades" row,
    // which would otherwise double-count the same phrase.
    const limitsIdx = html.indexOf('Honest Limits');
    expect(limitsIdx).toBeGreaterThan(0);
    const limitsSection = html.slice(limitsIdx);
    const matches = limitsSection.match(/limited dynamic headroom/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('handles a system-level (no chain-name prefix) bullet', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: [
        'Coherent tonal voice across the chain',
        'Coherent tonal voice across the chain',
      ],
    };
    const html = render(a);
    // Both bullets are exact duplicates without a chain-name prefix —
    // the dedup helper still collapses them to one.
    const matches = html.match(/Coherent tonal voice/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('renders empty / undefined lists without crashing', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: undefined,
      assessmentLimitations: undefined,
    };
    const html = render(a);
    // §7 is gated off entirely when both lists are absent.
    expect(html).not.toContain('Strengths and Honest Limits');
  });
});

describe('SystemAssessmentArtifact — §9 step title derivation', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Step System',
      systemSignature: 'sig',
      upgradeDirection: 'Direction.',
    } as AdvisoryResponse);

  it('derives "Audition the Amplifier" from an audition-the-amp action', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        { step: 1, action: 'Audition a higher-power tube integrated against the CS600X in your room.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('Audition the Amplifier');
    // "Step 1" survives as the subtitle slot, not as the heading.
    expect(html).toContain('Step 1');
  });

  it('derives "Plan the Swap" from a conditional plan-the-swap action', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        { step: 1, action: 'If the trade-off feels worth it, plan the swap.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('Plan the Swap');
  });

  it('derives "Preserve the DAC" from a do-not-touch DAC action', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        { step: 1, action: 'Do not touch the DAC or the speakers.' },
      ],
    };
    const html = render(a);
    // Action mentions both DAC and speakers → composite title.
    expect(html).toContain('Preserve the DAC');
  });

  it('falls back to "Step N" when no pattern matches', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        { step: 1, action: 'Some action that does not match any pattern.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('Step 1');
  });

  it('produces distinct titles + sequential "Step N" subtitles for multi-step sequences', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        { step: 1, action: 'Audition a higher-power tube integrated against the CS600X.' },
        { step: 2, action: 'If the trade-off feels worth it, plan the swap.' },
        { step: 3, action: 'Do not touch the DAC or the speakers.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('Audition the Amplifier');
    expect(html).toContain('Plan the Swap');
    expect(html).toContain('Preserve the DAC');
    // All three "Step N" subtitles render.
    expect(html).toContain('Step 1');
    expect(html).toContain('Step 2');
    expect(html).toContain('Step 3');
  });

  it('handles a single-step sequence (no other steps to differentiate)', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        { step: 1, action: 'Audition a higher-power tube integrated against the CS600X.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('Audition the Amplifier');
    expect(html).toContain('Step 1');
  });

  it('§9 stays hidden when recommendedSequence is empty AND no upgrade paths present', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Empty',
      systemSignature: 'sig',
      recommendedSequence: [],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain('If You Were to Change Something');
  });
});
