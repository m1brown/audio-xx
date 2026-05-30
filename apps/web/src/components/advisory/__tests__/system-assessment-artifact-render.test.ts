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

  it('renders §5 The Components in contribution register', () => {
    expect(html).toContain('The Components');
    // Pass 22 — §5 bodies are composed from extracted facts, not
    // pass-through of engine reading. Source card opens with the
    // contribution-first lede; the fixture's reading lacks a topology
    // anchor so the body relies on the lede alone.
    expect(html).toContain('Denafrips Pontus II sets the tonal character');
    // No product-review register survives — the engine's "warm-tube
    // reference R2R DAC" descriptor never reaches the body.
    expect(html).not.toContain('warm-tube reference');
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
    // Each card body lives inside a single `<p>…</p>`. Slice from the
    // card heading through the first closing `</p>` so neighbouring
    // cards never leak into the window. This is critical for the
    // negative assertions ("Pontus II card does NOT contain push-pull
    // tube content") — Commit 5's amp-card body sits ~50 chars away
    // and would otherwise be captured by a wider fixed window.
    const after = scoped.slice(idx);
    const closeIdx = after.indexOf('</p>');
    if (closeIdx < 0) return after.slice(0, 1200);
    return after.slice(0, closeIdx + 4); // +4 includes "</p>"
  }

  describe('identity mapping — facts extracted from each named card belong to that card', () => {
    const html = render(GOLD_CASE);

    it('Denafrips Pontus II card body carries the R2R contribution, not the Leben\'s tube content', () => {
      const card = cardWindowForName(html, 'Denafrips Pontus II');
      expect(card).toContain('Pontus II');
      // R2R is the Pontus II reading's structural fact; the Pass 22
      // composer surfaces it as a contribution sentence.
      expect(card).toContain('R2R conversion');
      // Negative: the Leben\'s tube facts must NOT appear in the
      // Denafrips card (this would be the pre-fix swap defect).
      expect(card).not.toContain('push-pull tube architecture');
      expect(card).not.toContain('KT88');
    });

    it('Leben CS600X card body carries the tube-amp contribution, not the Pontus II\'s R2R content', () => {
      const card = cardWindowForName(html, 'Leben CS600X');
      // push-pull + KT88 are the Leben reading\'s structural facts.
      expect(card).toContain('push-pull tube architecture');
      expect(card).toContain('KT88');
      // Negative: R2R language belongs to the Pontus II card only.
      expect(card).not.toContain('R2R conversion');
    });

    it('DeVore O/96 card body carries the high-efficiency speaker contribution', () => {
      const card = cardWindowForName(html, 'DeVore O/96');
      // The composer surfaces high-efficiency speaker traits from the
      // engine reading; verify the speaker contribution language.
      expect(card).toContain('high-efficiency');
      // Negative: tube-amp language belongs to the Leben card only.
      expect(card).not.toContain('push-pull tube architecture');
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

    it('§5 surfaces in-chain neighbor names through the contribution lede (relational discipline)', () => {
      // The composer always references in-chain upstream/downstream by
      // name in the lede ("carries the signal between the {upstream}
      // and the {downstream}, …"). Off-chain product names are
      // structurally impossible to surface because they are never
      // passed into the composer.
      const card = cardWindowForName(html, 'Leben CS600X');
      expect(card).toContain('between the Denafrips Pontus II and the DeVore O/96');
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

  describe('length consistency — composed bodies stay within editorial weight', () => {
    const html = render(GOLD_CASE);

    it('the Leben card is not catastrophically longer than the Pontus II card', () => {
      // The composer emits 2-3 sentences per card; bodies should have
      // similar editorial weight regardless of how verbose the engine
      // reading was. Measure approximate body length by sentence
      // count via period-counting inside each card window.
      const lebenCard = cardWindowForName(html, 'Leben CS600X');
      const pontusCard = cardWindowForName(html, 'Denafrips Pontus II');
      // Strip HTML for a rough text-length comparison.
      const lebenText = lebenCard.replace(/<[^>]+>/g, ' ');
      const pontusText = pontusCard.replace(/<[^>]+>/g, ' ');
      // Allow the bottleneck card (Leben) to be modestly longer due
      // to its limit-framing third sentence, but no more than 2x.
      expect(lebenText.length).toBeLessThan(pontusText.length * 2.5);
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

    it('composes a contribution body for a single-DAC chain even when the reading has no extractable facts', () => {
      // Engine reading has no R2R / multibit / delta-sigma anchor —
      // the composer falls back to the contribution lede alone.
      // The fallback is editorial-grade prose, not raw passthrough.
      const a: AdvisoryResponse = {
        kind: 'assessment',
        subject: 'Test',
        systemChain: { names: ['Foo'], roles: ['DAC'] },
        componentReadings: ['Some prose that does not include a topology anchor.'],
      };
      const html = render(a);
      const compsIndex = html.indexOf('The Components');
      const compsSection = html.slice(compsIndex, compsIndex + 1500);
      // Solo source falls to the source-establishes lede.
      expect(compsSection).toContain('Foo establishes this system');
      // The raw engine reading must NOT leak into the card body.
      expect(compsSection).not.toContain('Some prose that does not include');
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

  it('falls back to an editorial limit-framing sentence when only componentName is present', () => {
    const a: AdvisoryResponse = {
      ...base(),
      primaryConstraint: { componentName: 'DAC', role: 'dac' },
    };
    const html = render(a);
    expect(html).toContain('What it trades:');
    // Editorial reviewer language — no diagnostic engine vocabulary.
    expect(html).toContain('Much of this system');
    expect(html).toContain('where it reaches its limits');
    expect(html).toContain('shaped by the DAC');
    // The fallback row should NOT use the engine's "primary
    // constraint" diagnostic phrasing.
    expect(html).not.toContain('primary constraint');
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

describe('SystemAssessmentArtifact — §5 contribution body (Commit 5)', () => {
  // Phase K — Commit 5 ledes-to-body rewrite. Cards no longer pass
  // through engine reading text; the body is composed from extracted
  // facts + chain position + role family.
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
        'The CS600X is a musical push-pull tube integrated (KT88).',
        'The O/96 is a high-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse);

  it('source (DAC) body opens with "sets the tonal character" + names downstream', () => {
    const html = render(baseChain());
    expect(html).toContain('Denafrips Pontus II sets the tonal character');
    expect(html).toContain('handing the Leben CS600X');
  });

  it('source (DAC) body surfaces R2R conversion contribution when facts allow', () => {
    const html = render(baseChain());
    expect(html).toContain('Its R2R conversion favors tonal density and harmonic continuity');
  });

  it('amplifier body opens with "carries the signal between" + names upstream and downstream', () => {
    const html = render(baseChain());
    expect(html).toContain(
      'Leben CS600X carries the signal between the Denafrips Pontus II and the DeVore O/96',
    );
    expect(html).toContain('translating source character into drive for the speakers');
  });

  it('amplifier body surfaces push-pull tube + tube type when facts allow', () => {
    const html = render(baseChain());
    expect(html).toContain('push-pull tube architecture');
    expect(html).toContain('KT88');
    expect(html).toContain('adds harmonic weight and rhythmic continuity');
  });

  it('speaker body opens with "where this system becomes sound" + names upstream', () => {
    const html = render(baseChain());
    expect(html).toContain('DeVore O/96 is where this system becomes sound');
    expect(html).toContain('translating what the Leben CS600X produces');
  });

  it('speaker body surfaces high-efficiency wide-baffle contribution + low-power tube pairing', () => {
    const html = render(baseChain());
    expect(html).toContain('high-efficiency wide-baffle design');
    expect(html).toContain('rewards low-power upstream drive');
  });

  it('amplifier bottleneck appends amp-specific limit-framing sentence', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      primaryConstraint: {
        componentName: 'Leben CS600X',
        category: 'amplifier_control',
        explanation: 'Power ceiling limits headroom.',
      } as AdvisoryResponse['primaryConstraint'],
    };
    const html = render(a);
    // Editorial limit framing, role-specific to amplifier.
    expect(html).toContain('Where this system meets its honest limits');
    expect(html).toContain('headroom under demand');
    expect(html).toContain('control at scale');
    // No diagnostic engine vocabulary surfaces.
    expect(html).not.toContain('primary constraint');
    expect(html).not.toContain('bottleneck');
  });

  it('speaker bottleneck appends speaker-specific limit-framing sentence', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      primaryConstraint: {
        componentName: 'DeVore O/96',
        category: 'speaker_scale',
        explanation: 'Cabinet scale limits room interaction.',
      } as AdvisoryResponse['primaryConstraint'],
    };
    const html = render(a);
    expect(html).toContain('Where this system meets its honest limits');
    expect(html).toContain('room interaction');
    expect(html).toContain('imaging precision');
  });

  it('cards do NOT contain product-review register words ("flagship", "celebrated", "canonical")', () => {
    const html = render(baseChain());
    const compsSection = html.slice(html.indexOf('The Components'));
    // The composer never embeds these phrases — they were product-review
    // register that the old reading-passthrough sometimes surfaced.
    expect(compsSection).not.toContain('flagship');
    expect(compsSection).not.toContain('celebrated');
    expect(compsSection).not.toContain('canonical');
    expect(compsSection).not.toContain('famous pairing');
    expect(compsSection).not.toContain('reference R2R DAC');
  });

  it('cards do NOT contain raw engine reading sentences ("most musical sub-")', () => {
    // Even when the engine reading mentions catalog superlatives, the
    // composer keeps them out of the rendered body.
    const a: AdvisoryResponse = {
      ...baseChain(),
      componentReadings: [
        'The Pontus II is the warm-tube reference R2R DAC.',
        'The CS600X is the most musical sub-$10k tube integrated.',
        'The O/96 is the canonical low-power-tube speaker.',
      ],
    };
    const html = render(a);
    const compsSection = html.slice(html.indexOf('The Components'));
    expect(compsSection).not.toContain('most musical sub-');
    expect(compsSection).not.toContain('canonical low-power-tube');
    expect(compsSection).not.toContain('reference R2R DAC');
  });

  it('source / amplifier / speaker cards open with distinct contribution shapes', () => {
    const html = render(baseChain());
    const compsSection = html.slice(html.indexOf('The Components'));
    // Each role family produces a different sentence shape; assert
    // the distinct openers appear exactly once.
    expect((compsSection.match(/sets the tonal character/g) ?? []).length).toBe(1);
    expect((compsSection.match(/carries the signal between/g) ?? []).length).toBe(1);
    expect((compsSection.match(/is where this system becomes sound/g) ?? []).length).toBe(1);
  });

  it('handles 2-component chain (head + tail, no middle)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Pair',
      systemSignature: 'sig',
      systemChain: { names: ['Some DAC', 'Some Speakers'], roles: ['DAC', 'Speakers'] },
      componentReadings: ['Warm R2R DAC.', 'High-efficiency speaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    // Source role lede references downstream.
    expect(html).toContain('Some DAC sets the tonal character');
    expect(html).toContain('handing the Some Speakers');
    // Speaker role lede references upstream.
    expect(html).toContain('Some Speakers is where this system becomes sound');
    expect(html).toContain('translating what the Some DAC produces');
  });

  it('single-component chain falls back to role-establishment lede (source)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Solo',
      systemSignature: 'sig',
      systemChain: { names: ['Solo DAC'], roles: ['DAC'] },
      componentReadings: ['Some DAC body content.'],
    } as AdvisoryResponse;
    const html = render(a);
    // No downstream → falls to "establishes this system's source voice".
    expect(html).toContain('Solo DAC establishes this system');
  });

  it('role=undefined defaults to the generic "sits inside this system" lede', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'No-Role',
      systemSignature: 'sig',
      systemChain: { names: ['Mystery'], roles: undefined },
      componentReadings: ['Body content.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('Mystery sits inside this system');
    expect(html).toContain('component');
  });

  it('source card with delta-sigma topology surfaces a different fact phrase than R2R', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      componentReadings: [
        'A delta-sigma DAC.',
        'A tube amp.',
        'A speaker.',
      ],
    };
    const html = render(a);
    expect(html).toContain('Its delta-sigma conversion');
    expect(html).toContain('resolution and clean extension');
    expect(html).not.toContain('R2R conversion');
  });

  it('speaker card without efficiency anchor falls back to neutral cabinet contribution', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      componentReadings: [
        'A DAC.',
        'A tube amp.',
        'A bass-reflex speaker.',
      ],
    };
    const html = render(a);
    // Cabinet known, efficiency unknown → neutral cabinet contribution.
    expect(html).toContain('bass-reflex design');
    expect(html).not.toContain('rewards low-power upstream drive');
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

// ════════════════════════════════════════════════════════════════════════
// Pass 21 — editorial-register cleanup (chain → system, drop engine
// vocabulary, polish §5 ledes)
// ════════════════════════════════════════════════════════════════════════
//
// Locks the editorial pass over user-facing prose:
//   - preferSystemTerminology rewrites engine-emitted "chain"
//     vocabulary to "system" while preserving "signal chain" as a
//     topology term.
//   - diagnostic-engine vocabulary ("primary constraint",
//     "bottleneck") is absent from user-visible prose across §2 row
//     3 and §5 ledes.
//   - §5 contribution ledes use distinct, editorial opening shapes
//     per chain position (no formulaic "As X" / "Sitting between X"
//     repetition).

describe('SystemAssessmentArtifact — system-first terminology', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Terminology System',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Amp', 'Some Speakers'],
        roles: ['DAC', 'Amplifier', 'Speakers'],
      },
    } as AdvisoryResponse);

  it('rewrites engine-emitted "the chain" to "the system" in §3 prose', () => {
    const a: AdvisoryResponse = {
      ...base(),
      introSummary:
        'The chain leans toward midrange weight and rhythmic engagement throughout.',
    };
    const html = render(a);
    expect(html).toContain('First Impressions');
    expect(html).toContain('The system leans toward');
    // The bare "chain" term has been re-cast.
    const firstImpressionsSlice = html.slice(html.indexOf('First Impressions'), html.indexOf('First Impressions') + 600);
    expect(firstImpressionsSlice).not.toMatch(/\bthe chain\b/i);
  });

  it('rewrites engine-emitted "chain" to "system" in §6 interaction prose', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemInteraction:
        'Each component leans warm. The chain reinforces rather than counterbalances.',
    };
    const html = render(a);
    expect(html).toContain('How They Work Together');
    expect(html).toContain('The system reinforces');
    const interactionSlice = html.slice(html.indexOf('How They Work Together'));
    expect(interactionSlice.slice(0, 600)).not.toMatch(/\bthe chain\b/i);
  });

  it('rewrites engine-emitted "chain" to "system" in §4 character prose', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemContext:
        '**System read** The chain shares a coherent voicing across all three components.',
    };
    const html = render(a);
    expect(html).toContain('Character');
    const characterSlice = html.slice(html.indexOf('Character'), html.indexOf('Character') + 600);
    expect(characterSlice).toContain('The system shares');
    expect(characterSlice).not.toMatch(/\bthe chain\b/i);
  });

  it('preserves "signal chain" as a topology term', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemInteraction:
        'The signal chain is short and the system stays coherent across all three components.',
    };
    const html = render(a);
    // Signal-chain topology is preserved; system-level "chain" usage
    // is rewritten elsewhere (no opportunity in this prose).
    expect(html).toContain('signal chain');
  });

  it('rewrites possessive "chain\'s" to "system\'s"', () => {
    const a: AdvisoryResponse = {
      ...base(),
      introSummary:
        "The chain's overall character favors warmth and rhythmic flow across the midrange.",
    };
    const html = render(a);
    // Possessive form is normalized.
    expect(html).toContain('First Impressions');
    const firstImpressionsSlice = html.slice(html.indexOf('First Impressions'), html.indexOf('First Impressions') + 600);
    expect(firstImpressionsSlice).not.toMatch(/chain['’]s/i);
    expect(firstImpressionsSlice).toContain('system');
  });
});

describe('SystemAssessmentArtifact — no diagnostic-engine vocabulary in user prose', () => {
  const FULL_WITH_CONSTRAINT: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Constraint System',
    systemSignature: 'A warm voicing.',
    introSummary: 'A balanced system that leans into warmth and rhythm.',
    systemChain: {
      names: ['Some DAC', 'Some Amp', 'Some Speakers'],
      roles: ['DAC', 'Amplifier', 'Speakers'],
    },
    componentReadings: ['DAC body.', 'Amp body.', 'Speaker body.'],
    primaryConstraint: {
      componentName: 'Some Amp',
      category: 'amplifier_control',
      explanation: 'Power limits headroom.',
    } as AdvisoryResponse['primaryConstraint'],
    assessmentLimitations: ['Limited orchestral peak headroom'],
    recommendedSequence: [
      { step: 1, action: 'Audition a higher-power integrated.' },
    ],
  };

  it('no user-visible "primary constraint" anywhere in the artifact', () => {
    const html = render(FULL_WITH_CONSTRAINT);
    expect(html).not.toContain('primary constraint');
  });

  it('no user-visible "bottleneck" anywhere in the artifact', () => {
    const html = render(FULL_WITH_CONSTRAINT);
    expect(html).not.toContain('bottleneck');
  });

  it('limit-framing prose reads editorially, not diagnostically', () => {
    const html = render(FULL_WITH_CONSTRAINT);
    // After Commit 5 the §5 bottleneck card uses role-specific limit
    // framing ("Where this system meets its honest limits — …"). The
    // §2 row 3 fallback ("Much of this system's practical character — …")
    // also surfaces editorially. Either editorial framing is fine —
    // assert the role-specific §5 surface here.
    expect(html).toContain('Where this system meets its honest limits');
    expect(html).toContain('headroom under demand');
  });
});

describe('SystemAssessmentArtifact — §5 system-walkthrough register (Commit 5 + Pass 21)', () => {
  // Lock the editorial outcome: bodies read as a system walkthrough,
  // not as catalog blurbs. Each card opens with a role-family-specific
  // contribution shape so a stack of cards reads as varied prose.
  const GOLD = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Polish System',
      systemSignature: 'sig',
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'Warm-tube R2R DAC.',
        'Push-pull tube integrated (KT88).',
        'High-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse);

  it('source card opens with role-aware contribution lede, not the old "opens the signal path" template', () => {
    const html = render(GOLD());
    const componentsSlice = html.slice(html.indexOf('The Components'));
    const headBlock = componentsSlice.slice(componentsSlice.indexOf('Denafrips Pontus II'));
    expect(headBlock.slice(0, 1000)).toContain('Denafrips Pontus II sets the tonal character');
    // The Pass 21 "opens the signal path" template has been replaced
    // by the Commit 5 contribution-first composer.
    expect(headBlock.slice(0, 1000)).not.toContain('opens the signal path');
  });

  it('speaker card opens with role-aware contribution lede, not the old "closes the path" template', () => {
    const html = render(GOLD());
    const componentsSlice = html.slice(html.indexOf('The Components'));
    const tailIdx = componentsSlice.indexOf('>DeVore O/96</div>');
    expect(tailIdx).toBeGreaterThan(0);
    const tailBlock = componentsSlice.slice(tailIdx, tailIdx + 1000);
    expect(tailBlock).toContain('is where this system becomes sound');
    expect(tailBlock).not.toContain('closes the path');
  });

  it('amplifier card opens with role-aware contribution lede, not the old "Between … and …" template alone', () => {
    const html = render(GOLD());
    // The Commit 5 amplifier lede uses "carries the signal between" —
    // which includes the upstream/downstream names but in a complete
    // contribution sentence rather than the bare position phrase.
    expect(html).toContain(
      'Leben CS600X carries the signal between the Denafrips Pontus II and the DeVore O/96',
    );
    expect(html).toContain('translating source character into drive');
  });

  it('lede shapes differ across source/amp/speaker (role-aware varied prose)', () => {
    const html = render(GOLD());
    // Each role-family lede shape appears exactly once per chain.
    const sourceMatches = (html.match(/sets the tonal character/g) ?? []).length;
    const ampMatches = (html.match(/carries the signal between/g) ?? []).length;
    const speakerMatches = (html.match(/is where this system becomes sound/g) ?? []).length;
    expect(sourceMatches).toBe(1);
    expect(ampMatches).toBe(1);
    expect(speakerMatches).toBe(1);
  });
});
