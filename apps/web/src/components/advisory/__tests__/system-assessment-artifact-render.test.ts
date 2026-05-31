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

  it('renders §3 First Impressions (Commit 10 presentational override)', () => {
    expect(html).toContain('First Impressions');
    // Commit 10 — when warm + tube + high-eff signals are absent in
    // the fixture, the presentational helper returns undefined and the
    // engine output flows through. FULL has signature "warm tube-led
    // source-first chain" but the chainFacts here don't strongly map
    // (the readings include "tube" but no explicit topology). Engine
    // output still surfaces; just confirm the heading + non-empty body.
    const slice = html.slice(html.indexOf('First Impressions'), html.indexOf('First Impressions') + 600);
    expect(slice).toMatch(/<p[^>]*>[^<]+<\/p>/);
  });

  it('renders §4 Character', () => {
    expect(html).toContain('Character');
    expect(html).toContain('canonical pairing');
  });

  it('renders §5 The Components in contribution register', () => {
    expect(html).toContain('The Components');
    // Commit 7 — §5 DAC lede rebalanced: source no longer "sets the
    // tonal character" the system inherits; it establishes signal
    // quality and character feeding the rest of the system.
    expect(html).toContain('Denafrips Pontus II establishes the character');
    // No product-review register survives — the engine's "warm-tube
    // reference R2R DAC" descriptor never reaches the body.
    expect(html).not.toContain('warm-tube reference');
  });

  it('renders §6 How They Work Together', () => {
    expect(html).toContain('How They Work Together');
    expect(html).toContain('reinforces rather than counterbalances');
  });

  it('renders §7 Strengths and Limits (Commit 7 rename)', () => {
    expect(html).toContain('Strengths and Limits');
    expect(html).toContain('Strengths');
    // Commit 7 — right-column eyebrow renamed from "Honest Limits"
    // to "Limits" for symmetry with the new section heading.
    expect(html).not.toContain('Strengths and Honest Limits');
    expect(html).toContain('Limited headroom');
  });

  it('renders §8 Why This System Works (Commit 7 paragraph mode)', () => {
    // Commit 7 — §8 converted from a card list to a 2-3 sentence
    // editorial paragraph. The section title was renamed; the
    // paragraph asserts coherence as the unit of value.
    expect(html).toContain('Why This System Works');
    expect(html).not.toContain('What’s Already Working');
    // Coherence claim surfaces.
    expect(html).toMatch(/coherence|reinforce a single voicing/);
    // The previous keep-recommendation reason text is NOT quoted.
    expect(html).not.toContain('voicing-by-ear');
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
  it('skips §3 First Impressions when introSummary AND presentational anchors are absent (Commit 10)', () => {
    // Commit 10 — §3 also fires presentationally from systemSignature
    // lean keywords + chainFacts anchors. To verify the OMIT path,
    // clear both engine prose AND the signals the presentational
    // helper consumes (signature lean keyword + chain).
    const html = render({
      ...FULL,
      introSummary: undefined,
      systemSignature: undefined,
      systemChain: undefined,
      componentReadings: undefined,
    });
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

  it('skips §6 How They Work Together when systemInteraction absent AND no fallback evidence', () => {
    // Commit 13 — §6 now renders a cautious fallback paragraph when
    // engine prose is absent BUT the chain shows ≥2 role families
    // plus anchored facts. Section omits only when both gates fail.
    const html = render({
      ...FULL,
      systemInteraction: undefined,
      componentReadings: ['One.', 'Two.', 'Three.'],
    });
    expect(html).not.toContain('How They Work Together');
  });

  it('skips §7 grid when both strengths and limits are absent', () => {
    const html = render({ ...FULL, assessmentStrengths: undefined, assessmentLimitations: undefined });
    expect(html).not.toContain('Strengths and Limits');
  });

  it('skips §8 when keepRecommendations is empty AND no coherence-fallback evidence exists', () => {
    // Commit 13 — §8 now renders a cautious coherence-fallback
    // paragraph when chain structure supports it (tonal anchor in
    // systemSignature OR ≥2 chain components with anchored facts).
    // Section omits ONLY when both anchored gates fail in addition
    // to the keepRecs gate.
    const html = render({
      ...FULL,
      keepRecommendations: undefined,
      systemSignature: 'a system',
      componentReadings: ['One.', 'Two.', 'Three.'],
    });
    expect(html).not.toContain('Why This System Works');
  });

  it('skips §10 when engine upgrade fields absent AND no hierarchy candidates present', () => {
    // Hardening Phase B B2 — the §10 hierarchy paragraph is now an
    // independent reason to render the section. Use a chain with no
    // destination speaker and no mature amplifier so the hierarchy
    // composer also returns undefined; only then does §10 omit.
    const html = render({
      ...FULL,
      upgradeDirection: undefined,
      upgradePaths: undefined,
      recommendedSequence: undefined,
      systemChain: {
        names: ['Some DAC', 'Some Solid-State Amp', 'Some Generic Bookshelf'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A delta-sigma DAC.',
        'A 75-watt Class-AB integrated amplifier.',
        'A 2-way bookshelf speaker.',
      ],
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
  it('uses exactly the 11 locked heading labels (Commit 9 added §9 listener-context)', () => {
    const html = render(FULL);
    const expectedHeadings = [
      'Your System',
      'Profile',
      'First Impressions',
      'Character',
      'The Components',
      'How They Work Together',
      'Strengths and Limits',
      'Why This System Works',
      'What This System Seems Built For',
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
      // Commit 8 — solo source falls to "establishes the character of
      // the signal it feeds into the system" (the prior "feeding the
      // rest of the system" was audited as DAC over-implication).
      expect(compsSection).toContain('Foo establishes the character');
      expect(compsSection).toContain('it feeds into the system');
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
    // section still says something. Commit 11 — the rewriter applies
    // before display, so "source-first chain" lands as "source-first
    // system" in the rendered output.
    expect(html).toContain('First Impressions');
    expect(html).toContain('warm tube-led source-first system');
    expect(html).not.toMatch(/source-first chain/i);
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

  it('source (DAC) body opens with "establishes the character" + names downstream (Commit 8)', () => {
    // Commit 8 further rebalance — source lede no longer doubles the
    // qualifier ("AND the rest of the system" was audited as DAC
    // over-implication). The body now simply names the downstream.
    const html = render(baseChain());
    expect(html).toContain('Denafrips Pontus II establishes the character');
    expect(html).toContain('feeding the Leben CS600X');
    // Old lede + Commit 7's doubled qualifier must NOT survive.
    expect(html).not.toContain('sets the tonal character');
    expect(html).not.toContain('and the rest of the system');
    expect(html).not.toContain('the quality and character');
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

  it('speaker body opens with the fused concrete-reviewer sentence (Commit 8 names upstream)', () => {
    // Commit 8 — the fused sentence now NAMES the upstream amplifier
    // by name and references its tech as a drive phrase. Phase K
    // reading parses high-efficiency + upstream Leben as tube →
    // "pairs naturally with the Leben CS600X's tube drive".
    const html = render(baseChain());
    expect(html).toContain('high-efficiency design pairs naturally with');
    expect(html).toContain('Leben CS600X');
    expect(html).toContain('tube drive');
    expect(html).toContain('emphasizing tonal weight, ease, and musical flow');
    expect(html).toContain('over razor-sharp precision');
    // Old AI/poetic phrasing must NOT appear.
    expect(html).not.toContain('is where this system becomes sound');
    expect(html).not.toContain('room-filling presentation');
    expect(html).not.toContain('rewards low-power upstream drive');
    // Commit 7's generic "lower-power tube amplifiers" framing is
    // replaced by the named pairing above.
    expect(html).not.toContain('lower-power tube amplifiers');
  });

  it('speaker body adds a wide-baffle second sentence when cabinet is detected (Commit 8 weight match)', () => {
    const html = render(baseChain());
    // Phase K reading has "high-efficiency wide-baffle" → second sentence
    // about scale/ease/imaging trade fires.
    expect(html).toContain('Its wide-baffle layout brings scale and ease into the room');
    expect(html).toContain('at the cost of pinpoint imaging');
  });

  it('speaker body names upstream solid-state drive when upstream tech is solid-state (Commit 8)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Solid-state pair',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Class A Solid State Integrated', 'Some HE Speaker'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A delta-sigma DAC.',
        'A class-A solid-state integrated amplifier.',
        'A high-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('Some Class A Solid State Integrated');
    expect(html).toContain('solid-state drive');
  });

  it('speaker body falls back to generic "amplification" when upstream tech is absent (Commit 8)', () => {
    // Upstream reading has no tube/solid-state anchor → drivePhrase ===
    // "the {upstream}'s amplification".
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Generic pair',
      systemSignature: 'sig',
      systemChain: { names: ['Some DAC', 'Some Amp', 'Some Speaker'], roles: ['DAC', 'Amp', 'Speakers'] },
      componentReadings: [
        'A DAC.',
        'An amplifier.',
        'A high-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('Some Amp');
    expect(html).toContain('amplification');
    expect(html).not.toContain('tube drive');
    expect(html).not.toContain('solid-state drive');
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

  it('source / amplifier / speaker cards open with distinct contribution shapes (Commit 8)', () => {
    const html = render(baseChain());
    const compsSection = html.slice(html.indexOf('The Components'));
    // Each role family produces a different sentence shape; assert
    // the distinct openers appear exactly once.
    expect((compsSection.match(/establishes the character/g) ?? []).length).toBe(1);
    expect((compsSection.match(/carries the signal between/g) ?? []).length).toBe(1);
    expect((compsSection.match(/high-efficiency design pairs naturally with/g) ?? []).length).toBe(1);
  });

  it('handles 2-component chain (head + tail, no middle) — Commit 8 register', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Pair',
      systemSignature: 'sig',
      systemChain: { names: ['Some DAC', 'Some Speakers'], roles: ['DAC', 'Speakers'] },
      componentReadings: ['Warm R2R DAC.', 'High-efficiency speaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    // Source role lede references downstream via "feeding".
    expect(html).toContain('Some DAC establishes the character');
    expect(html).toContain('feeding the Some Speakers');
    // Speaker has no upstream tech anchor here; falls back to the
    // generic "amplification" drive phrase but still names upstream.
    expect(html).toContain('high-efficiency design pairs naturally with');
    expect(html).toContain('amplification');
  });

  it('single-component chain falls back to solo-source lede (Commit 8)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Solo',
      systemSignature: 'sig',
      systemChain: { names: ['Solo DAC'], roles: ['DAC'] },
      componentReadings: ['Some DAC body content.'],
    } as AdvisoryResponse;
    const html = render(a);
    // Commit 8 — solo-source lede: "establishes the character of the
    // signal it feeds into the system".
    expect(html).toContain('Solo DAC establishes the character');
    expect(html).toContain('it feeds into the system');
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
    // Scope to the Limits subsection (renamed from "Honest Limits"
    // in Commit 7) — §2 Profile also pulls from assessmentLimitations[0]
    // for the "What it trades" row, which would otherwise double-count
    // the same phrase. Anchor on the right-column eyebrow "Limits".
    const limitsIdx = html.indexOf('>Limits<');
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

  it('source card opens with rebalanced lede (Commit 7), not the prior templates', () => {
    const html = render(GOLD());
    const componentsSlice = html.slice(html.indexOf('The Components'));
    const headBlock = componentsSlice.slice(componentsSlice.indexOf('Denafrips Pontus II'));
    expect(headBlock.slice(0, 1000)).toContain(
      'Denafrips Pontus II establishes the character',
    );
    // The Pass 21 and Commit 5 templates are both gone now.
    expect(headBlock.slice(0, 1000)).not.toContain('opens the signal path');
    expect(headBlock.slice(0, 1000)).not.toContain('sets the tonal character');
  });

  it('speaker card opens with named-upstream fused sentence (Commit 8)', () => {
    const html = render(GOLD());
    const componentsSlice = html.slice(html.indexOf('The Components'));
    const tailIdx = componentsSlice.indexOf('>DeVore O/96</div>');
    expect(tailIdx).toBeGreaterThan(0);
    const tailBlock = componentsSlice.slice(tailIdx, tailIdx + 1000);
    expect(tailBlock).toContain('high-efficiency design pairs naturally with');
    expect(tailBlock).toContain('Leben CS600X');
    expect(tailBlock).toContain('tube drive');
    // Old templates must NOT survive.
    expect(tailBlock).not.toContain('closes the path');
    expect(tailBlock).not.toContain('is where this system becomes sound');
    expect(tailBlock).not.toContain('room-filling presentation');
    expect(tailBlock).not.toContain('lower-power tube amplifiers');
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

  it('lede shapes differ across source/amp/speaker (Commit 8 register)', () => {
    const html = render(GOLD());
    // Each role-family lede shape appears exactly once per chain.
    const sourceMatches = (html.match(/establishes the character/g) ?? []).length;
    const ampMatches = (html.match(/carries the signal between/g) ?? []).length;
    const speakerMatches = (html.match(/high-efficiency design pairs naturally with/g) ?? []).length;
    expect(sourceMatches).toBe(1);
    expect(ampMatches).toBe(1);
    expect(speakerMatches).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 6 — §5 component images (scope-locked to §5)
// ════════════════════════════════════════════════════════════════════════
//
// Lock the editorial outcome: §5 component cards may render a small
// product image when the curated overlay or catalog supplies one.
// Resolution is brand-anchored and F4-gated; missing imagery
// degrades to a text-only card. NO images appear outside §5.

describe('SystemAssessmentArtifact — §5 component images', () => {
  // Phase K fixture — production chain that exercises three image
  // outcomes: catalog imageUrl (DeVore), overlay match (Pontus II),
  // and F4-gated reviewer-publication source (Leben) which must
  // degrade to text-only rather than fall through to a placeholder.
  const PHASE_K: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Phase K System',
    systemSignature: 'sig',
    systemChain: {
      names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'R2R DAC.',
      'Push-pull tube integrated.',
      'High-efficiency speaker.',
    ],
    keepRecommendations: [
      { name: 'DeVore O/96', reason: 'Anchors the system.' },
    ],
    recommendedSequence: [
      { step: 1, action: 'Audition a higher-power tube integrated.' },
    ],
    upgradeDirection: 'If the trade-off feels worth it.',
  };

  // ── Section-scoping helpers ──────────────────────────────
  // Bounded slices that capture exactly one section's HTML window
  // so that image-presence assertions don't bleed across sections.
  const SECTION_ORDER = [
    'Your System',
    'Profile',
    'First Impressions',
    'Character',
    'The Components',
    'How They Work Together',
    'Strengths and Honest Limits',
    'Already Working',
    'If You Were to Change',
    'Sources',
  ];

  function sliceForSection(html: string, name: string): string {
    const start = html.indexOf(name);
    if (start < 0) return '';
    const remainingTitles = SECTION_ORDER.filter((s) => s !== name);
    const ends = remainingTitles
      .map((s) => html.indexOf(s, start + name.length))
      .filter((i) => i > 0)
      .sort((a, b) => a - b);
    const end = ends.length > 0 ? ends[0] : html.length;
    return html.slice(start, end);
  }

  function imgTagsIn(s: string): string[] {
    return s.match(/<img[^>]+>/g) ?? [];
  }

  it('renders a product image for Denafrips Pontus II (curated overlay match)', () => {
    const html = render(PHASE_K);
    const componentsSlice = sliceForSection(html, 'The Components');
    const imgs = imgTagsIn(componentsSlice);
    const pontusImg = imgs.find((t) => t.includes('alt="Denafrips Pontus II"'));
    expect(pontusImg).toBeDefined();
    // The Denafrips overlay URL is hosted by the manufacturer site,
    // not a reviewer publication — F4 does NOT skip it.
    expect(pontusImg).toContain('static.wixstatic.com');
  });

  it('renders a product image for DeVore O/96 (catalog imageUrl)', () => {
    const html = render(PHASE_K);
    const componentsSlice = sliceForSection(html, 'The Components');
    const imgs = imgTagsIn(componentsSlice);
    const devoreImg = imgs.find((t) => t.includes('alt="DeVore O/96"'));
    expect(devoreImg).toBeDefined();
    expect(devoreImg).toContain('devorefidelity.com');
  });

  it('renders Leben CS600X as text-only (F4 reviewer-publication source skipped)', () => {
    const html = render(PHASE_K);
    const componentsSlice = sliceForSection(html, 'The Components');
    const imgs = imgTagsIn(componentsSlice);
    // F4 reviewer-data exclusion is the safety invariant — when the
    // only resolvable image is reviewer-hosted, the card must NOT
    // fall through to a placeholder and must NOT borrow another
    // component's image.
    const lebenImg = imgs.find((t) => t.includes('alt="Leben CS600X"'));
    expect(lebenImg).toBeUndefined();
  });

  it('does NOT render placeholders for missing component imagery', () => {
    const html = render(PHASE_K);
    // Strict resolution chain bypasses category placeholders. The
    // F4-gated Leben card should produce zero image markup, not a
    // generic SVG placeholder substitute.
    const componentsSlice = sliceForSection(html, 'The Components');
    expect(componentsSlice).not.toContain('/images/placeholders/');
  });

  it('does NOT cross-map images: Pontus II URL never appears under DeVore alt and vice versa', () => {
    const html = render(PHASE_K);
    const componentsSlice = sliceForSection(html, 'The Components');
    const imgs = imgTagsIn(componentsSlice);
    for (const tag of imgs) {
      const alt = tag.match(/alt="([^"]+)"/)?.[1];
      const src = tag.match(/src="([^"]+)"/)?.[1] ?? '';
      if (alt === 'Denafrips Pontus II') {
        // Pontus II image should NOT be from the DeVore manufacturer
        // host. (Brand-anchored substring match in getProductImage
        // makes this structurally impossible — assert anyway as a
        // future-proof guard.)
        expect(src).not.toContain('devorefidelity.com');
      }
      if (alt === 'DeVore O/96') {
        // DeVore image should NOT be from the Denafrips overlay host.
        expect(src).not.toContain('static.wixstatic.com');
      }
    }
  });

  it('does NOT render any images outside §5 The Components', () => {
    const html = render(PHASE_K);
    // §8 What's Already Working uses EditorialSubCard but must not
    // pass imageUrl.
    const keepSlice = sliceForSection(html, 'Already Working');
    expect(imgTagsIn(keepSlice).length).toBe(0);
    // §9 If You Were to Change Something uses EditorialSubCard for
    // step cards. Same constraint.
    const changeSlice = sliceForSection(html, 'If You Were to Change');
    expect(imgTagsIn(changeSlice).length).toBe(0);
    // §1 hero / §2 profile / §3 first impressions / §4 character /
    // §6 interaction / §7 strengths / §10 sources — none surface
    // <img> tags in their bodies.
    for (const name of ['Profile', 'First Impressions', 'How They Work Together', 'Strengths and Honest Limits']) {
      const slice = sliceForSection(html, name);
      expect(imgTagsIn(slice).length).toBe(0);
    }
  });

  it('renders zero images when no chain names supplied (graceful)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Empty',
      componentReadings: ['Anonymous reading.'],
    };
    const html = render(a);
    expect(imgTagsIn(html).length).toBe(0);
  });

  it('image markup uses loading="lazy" + alt with component name', () => {
    const html = render(PHASE_K);
    const imgs = imgTagsIn(html);
    for (const tag of imgs) {
      expect(tag).toContain('loading="lazy"');
      const alt = tag.match(/alt="([^"]+)"/)?.[1];
      expect(alt).toBeDefined();
      // Alt must be one of the chain names (no synthetic alts).
      const validAlts = PHASE_K.systemChain!.names!;
      expect(validAlts).toContain(alt!);
    }
  });

  it('§5 card prose is unchanged by the addition of imagery (Commit 8 register)', () => {
    const html = render(PHASE_K);
    // Commit 8 contribution composer outputs must still appear after
    // images land — image is additive, not a prose mutation.
    expect(html).toContain('Denafrips Pontus II establishes the character');
    expect(html).toContain('Leben CS600X carries the signal between');
    expect(html).toContain('high-efficiency design pairs naturally with');
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 7 — §7 family-bucket dedup + cap, §8 paragraph mode,
// §9 destination + mature protection
// ════════════════════════════════════════════════════════════════════════

describe('SystemAssessmentArtifact — §7 family-bucket dedup + cap (Commit 7)', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Family System',
      systemSignature: 'sig',
      systemChain: { names: ['DAC', 'Amp', 'Speakers'], roles: ['DAC', 'Amp', 'Speakers'] },
    } as AdvisoryResponse);

  // Helper: scope to the §7 grid (after the "Strengths and Limits"
  // heading) so §2 Profile and other sections don't bleed in.
  function section7(html: string): string {
    const start = html.indexOf('Strengths and Limits');
    if (start < 0) return '';
    return html.slice(start);
  }

  // Helper: count bullet `<li>` tags inside a slice.
  function bulletCount(slice: string): number {
    return (slice.match(/<li[^>]*>/g) ?? []).length;
  }

  it('collapses the transparency family on the limits side (Commit 7 brief case)', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentLimitations: [
        'Trades precision for warmth',
        'Limited fine detail',
        'Resolution gives way to body',
        'Transient sharpness is softened',
      ],
    };
    const html = render(a);
    const slice = section7(html);
    // All four are conceptual synonyms in LIMIT_FAMILIES.transparency
    // → collapse to exactly 1 surviving bullet.
    expect(bulletCount(slice)).toBe(1);
  });

  it('caps strengths at 3 even with 5 distinct families', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: [
        'Exceptional warmth and harmonic richness',  // tonal_density
        'Rhythmic engagement and musical flow',       // flow
        'Tonal coherence across the chain',           // coherence
        'Dynamic ease at listening levels',           // dynamics
        'Sharp imaging precision',                    // imaging
      ],
    };
    const html = render(a);
    const slice = section7(html);
    // Declaration order in STRENGTH_FAMILIES: tonal_density, flow,
    // coherence (first 3 wins).
    expect(bulletCount(slice)).toBe(3);
  });

  it('preserves out-of-vocabulary bullets (each its own bucket)', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: [
        'A wholly novel concept bullet',
        'Another novel concept',
      ],
    };
    const html = render(a);
    const slice = section7(html);
    // Each unkeyed bullet survives as its own bucket; still capped by 3.
    expect(bulletCount(slice)).toBe(2);
  });

  it('renames section heading to "Strengths and Limits" (Honest dropped)', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: ['Strong tonal density'],
      assessmentLimitations: ['Limited resolution'],
    };
    const html = render(a);
    expect(html).toContain('Strengths and Limits');
    expect(html).not.toContain('Strengths and Honest Limits');
    expect(html).not.toContain('Honest Limits');
  });

  it('right-column eyebrow renders as "Limits" (not "Honest Limits")', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentLimitations: ['Limited orchestral headroom'],
    };
    const html = render(a);
    // Match the eyebrow on its right-column position (an h3 with text "Limits").
    expect(html).toMatch(/<h3[^>]*>Limits<\/h3>/);
  });

  it('symmetric: 4 limits in one family → 1 bullet (cap applies AFTER family collapse)', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentLimitations: [
        'Limited orchestral headroom',
        'Power ceiling under demand',
        'Scale ceiling at high SPL',
        'Headroom for peaks is limited',
      ],
    };
    const html = render(a);
    const slice = section7(html);
    // All four → headroom family → 1 bullet.
    expect(bulletCount(slice)).toBe(1);
  });
});

describe('SystemAssessmentArtifact — §8 Why This System Works paragraph (Commit 7)', () => {
  const FULL_K: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Phase K',
    systemSignature: 'sig',
    systemChain: {
      names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'R2R DAC.',
      'Push-pull tube integrated.',
      'High-efficiency speaker.',
    ],
    keepRecommendations: [
      { name: 'DeVore O/96', reason: 'The cabinet anchors the system.' },
      { name: 'Leben CS600X', reason: 'Midrange weight defines the chain.' },
    ],
    primaryConstraint: {
      componentName: 'DeVore O/96',
      category: 'speaker_scale',
      explanation: '',
    } as AdvisoryResponse['primaryConstraint'],
  };

  it('renders the §8 paragraph with the new "Why This System Works" heading', () => {
    const html = render(FULL_K);
    expect(html).toContain('Why This System Works');
    // Section is a paragraph (single <p>), NOT a card list.
    const start = html.indexOf('Why This System Works');
    const slice = html.slice(start, start + 1500);
    expect(slice).toMatch(/<p\b[^>]*>/);
    // No EditorialSubCard chrome ("Step N", verdict italic, or
    // keep-recommendation 0.65rem gap div) inside this section.
    expect(slice).not.toContain('border:1px solid #E8E3D7');
  });

  it('paragraph asserts coherence as the unit of value', () => {
    const html = render(FULL_K);
    expect(html).toMatch(/coherence|reinforce a single voicing/);
  });

  it('does NOT quote the per-component keepRecommendations.reason text', () => {
    const html = render(FULL_K);
    expect(html).not.toContain('The cabinet anchors the system');
    expect(html).not.toContain('Midrange weight defines the chain');
  });

  it('uses the destination-loudspeaker caveat when the primaryConstraint is a speaker', () => {
    const html = render(FULL_K);
    expect(html).toContain('destination-level loudspeaker');
  });

  it('uses the amplifier caveat when the primaryConstraint is an amp', () => {
    const a: AdvisoryResponse = {
      ...FULL_K,
      primaryConstraint: {
        componentName: 'Leben CS600X',
        category: 'amplifier_control',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
    };
    const html = render(a);
    expect(html).toContain('amplifier that carries');
  });

  it('uses the upstream-source caveat when the primaryConstraint is a source', () => {
    const a: AdvisoryResponse = {
      ...FULL_K,
      primaryConstraint: {
        componentName: 'Denafrips Pontus II',
        category: 'dac_limitation',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
    };
    const html = render(a);
    expect(html).toContain('Major changes upstream');
  });

  it('omits §8 when keepRecommendations is empty AND coherence-fallback evidence is absent', () => {
    // Commit 13 — the §8 keep-recs branch now delegates to a
    // coherence-fallback path when keepRecs are absent. To verify the
    // omission path we strip the signature anchor and replace component
    // readings with facts-free strings so both fallback gates decline.
    const a: AdvisoryResponse = {
      ...FULL_K,
      keepRecommendations: undefined,
      systemSignature: 'a system',
      componentReadings: ['One.', 'Two.', 'Three.'],
    };
    const html = render(a);
    expect(html).not.toContain('Why This System Works');
  });

  it('omits §8 for a single-component chain (no coherence-among-pieces claim)', () => {
    const a: AdvisoryResponse = {
      ...FULL_K,
      systemChain: { names: ['Just One'], roles: ['DAC'] },
    };
    const html = render(a);
    expect(html).not.toContain('Why This System Works');
  });

  it('omits §8 when the chain spans only one role family (e.g. two amps)', () => {
    const a: AdvisoryResponse = {
      ...FULL_K,
      systemChain: {
        names: ['Amp One', 'Amp Two'],
        roles: ['Amplifier', 'Amplifier'],
      },
    };
    const html = render(a);
    expect(html).not.toContain('Why This System Works');
  });

  it('paragraph uses "three components" wording when chain has three entries', () => {
    const html = render(FULL_K);
    expect(html).toContain('its three components');
  });

  it('paragraph uses "two components" wording when chain has two entries', () => {
    const a: AdvisoryResponse = {
      ...FULL_K,
      systemChain: {
        names: ['Some DAC', 'Some Speakers'],
        roles: ['DAC', 'Speakers'],
      },
    };
    const html = render(a);
    expect(html).toContain('its two components');
  });
});

describe('SystemAssessmentArtifact — §9 protection caveats (Commit 7)', () => {
  // Phase K chain: Leben CS600X is a mature push-pull tube integrated
  // by a heritage brand; DeVore O/96 is a destination-level
  // high-efficiency wide-baffle speaker.
  const PHASE_K_BASE = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Phase K Change',
      systemSignature: 'sig',
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'R2R DAC.',
        'Push-pull tube integrated.',
        'High-efficiency wide-baffle speaker.',
      ],
      upgradeDirection: 'A direction.',
    } as AdvisoryResponse);

  it('fires the destination-speaker caveat when a step targets the DeVore O/96 by name', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Replace the DeVore O/96 with a narrower-baffle monitor.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('destination-level loudspeaker');
    expect(html).toContain('should be a late move');
  });

  it('fires the destination-speaker caveat via role token ("the speakers")', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Audition a different pair of speakers in your room.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('destination-level loudspeaker');
  });

  it('fires the mature-amplifier caveat when a step targets the Leben CS600X', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Swap the Leben CS600X for a class-A solid-state integrated.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('mature amplifier materially changes system identity');
  });

  it('does NOT fire a caveat for a low-leverage component (DAC swap)', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Replace the Denafrips Pontus II with a delta-sigma DAC.' },
      ],
    };
    const html = render(a);
    expect(html).not.toContain('destination-level loudspeaker');
    expect(html).not.toContain('mature amplifier materially');
  });

  it('does NOT fire a caveat for a preservation step ("Preserve the DAC")', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Preserve the DAC and the DeVore O/96 — both anchor the system.' },
      ],
    };
    const html = render(a);
    // Preservation steps short-circuit before the protection check.
    expect(html).not.toContain('destination-level loudspeaker');
    expect(html).not.toContain('mature amplifier materially');
  });

  it('does NOT fire a caveat for an oblique step that mentions no replacement verb', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Move toward a warmer presentation downstream.' },
      ],
    };
    const html = render(a);
    expect(html).not.toContain('destination-level loudspeaker');
    expect(html).not.toContain('mature amplifier materially');
  });

  it('fires caveats per-step when multiple protected components are targeted', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Audition a different DAC.' },
        { step: 2, action: 'Swap the Leben CS600X for a solid-state integrated.' },
        { step: 3, action: 'Replace the DeVore O/96 with a narrow-baffle monitor.' },
      ],
    };
    const html = render(a);
    // Step 2 → mature amplifier caveat. Step 3 → destination loudspeaker.
    expect(html).toContain('mature amplifier materially');
    expect(html).toContain('destination-level loudspeaker');
  });

  it('does not mutate the engine action text — body still contains the original verb', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K_BASE(),
      recommendedSequence: [
        { step: 1, action: 'Replace the DeVore O/96 with something narrower.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('Replace the DeVore O/96 with something narrower.');
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 8 — Editorial Balance Pass
// ════════════════════════════════════════════════════════════════════════
//
// Reader-experience refinements after the Commit 7 audit:
//   §5 — DAC over-implication softened; speaker names upstream + adds
//        cabinet sentence for editorial weight balance.
//   §7 — preferSystemTerminology applied to bullets so engine-emitted
//        "across the chain" lands as "across the system".
//   §8 — "pulling in its own direction" → "asserting itself
//        independently"; "speaker translation" → "speaker presentation".
//   §9 — softenStepAction rewrites the audited circular-Step-2 and
//        blunt-Step-3 engine patterns to advisor voice.

describe('SystemAssessmentArtifact — §7 terminology cleanup (Commit 8)', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Term Cleanup',
      systemSignature: 'sig',
      systemChain: { names: ['DAC', 'Amp', 'Speakers'], roles: ['DAC', 'Amp', 'Speakers'] },
    } as AdvisoryResponse);

  it('rewrites "across the chain" → "across the system" in strength bullets', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: ['Strong tonal coherence across the chain'],
    };
    const html = render(a);
    // Anchor the assertion to the §7 grid (the rewriter must reach
    // strength/limit bullets, not just §3/§4/§6 prose).
    const slice = html.slice(html.indexOf('Strengths and Limits'));
    expect(slice).toContain('across the system');
    expect(slice).not.toContain('across the chain');
  });

  it('rewrites "this chain" → "this system" in limit bullets', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentLimitations: ['Limited headroom in this chain'],
    };
    const html = render(a);
    const slice = html.slice(html.indexOf('Strengths and Limits'));
    expect(slice).toContain('this system');
    expect(slice).not.toMatch(/\bthis chain\b/i);
  });

  it('preserves "signal chain" topology vocabulary if it survives dedup', () => {
    const a: AdvisoryResponse = {
      ...base(),
      assessmentStrengths: ['Short signal chain keeps the system clean'],
    };
    const html = render(a);
    expect(html).toContain('signal chain');
  });
});

describe('SystemAssessmentArtifact — §8 phrase cleanup (Commit 8)', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Phrase Cleanup',
      systemSignature: 'sig',
      systemChain: {
        names: ['DAC', 'Amp', 'Speakers'],
        roles: ['DAC', 'Amp', 'Speakers'],
      },
      keepRecommendations: [{ name: 'Speakers', reason: 'anchor' }],
    } as AdvisoryResponse);

  it('replaces "pulling in its own direction" with "asserting itself independently"', () => {
    const html = render(base());
    const slice = html.slice(html.indexOf('Why This System Works'));
    expect(slice).toContain('asserting itself independently');
    expect(slice).not.toContain('pulling in its own direction');
    expect(slice).not.toContain('pulling in opposite directions');
  });

  it('replaces "speaker translation" with "speaker presentation"', () => {
    const html = render(base());
    const slice = html.slice(html.indexOf('Why This System Works'));
    // The 3-family case (source + amp + speaker) uses "speaker presentation".
    expect(slice).toContain('speaker presentation');
    expect(slice).not.toContain('speaker translation');
  });

  it('uses "asserting themselves independently" for the 2-component branch', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemChain: { names: ['DAC', 'Speakers'], roles: ['DAC', 'Speakers'] },
    };
    const html = render(a);
    const slice = html.slice(html.indexOf('Why This System Works'));
    expect(slice).toContain('asserting themselves independently');
    expect(slice).not.toContain('pulling in opposite directions');
  });
});

describe('SystemAssessmentArtifact — §9 advisor-voice softening (Commit 8)', () => {
  const PHASE_K = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Voice',
      systemSignature: 'sig',
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: ['R2R DAC.', 'Push-pull tube integrated.', 'High-efficiency wide-baffle speaker.'],
      upgradeDirection: 'A direction.',
    } as AdvisoryResponse);

  it('rewrites "Do not touch the DAC or the speakers." into named-component advisor framing', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K(),
      recommendedSequence: [
        { step: 1, action: 'Do not touch the DAC or the speakers.' },
      ],
    };
    const html = render(a);
    // Title still derives from the original action.
    expect(html).toContain('Preserve the DAC');
    // Body is the softened advisor sentence.
    expect(html).toContain('Denafrips Pontus II and DeVore O/96 are already doing what this system asks of them');
    expect(html).toContain('leave them in place');
    // Old blunt imperative must be gone from the body.
    expect(html).not.toContain('Do not touch the DAC or the speakers.');
  });

  it('rewrites "Do not touch the DAC." (single component) using "it"/"of it"', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K(),
      recommendedSequence: [
        { step: 1, action: 'Do not touch the DAC.' },
      ],
    };
    const html = render(a);
    expect(html).toContain('Denafrips Pontus II is already doing what this system asks of it');
    expect(html).toContain('leave it in place');
  });

  it('rewrites "If the trade-off feels worth it, plan the swap." into advisor framing', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K(),
      recommendedSequence: [
        { step: 1, action: 'If the trade-off feels worth it, plan the swap.' },
      ],
    };
    const html = render(a);
    // Title still resolves to "Plan the Swap".
    expect(html).toContain('Plan the Swap');
    // Body is the softened advisor sentence.
    expect(html).toContain('If the audition confirms the trade-off is worth it');
    expect(html).toContain('different system, not an upgrade-in-place');
    // Old circular phrasing must be gone.
    expect(html).not.toContain('If the trade-off feels worth it, plan the swap.');
  });

  it('passes through unmatched action text unchanged', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K(),
      recommendedSequence: [
        { step: 1, action: 'Audition a higher-power tube integrated against the CS600X.' },
      ],
    };
    const html = render(a);
    // Audition steps are not softened — engine action survives.
    expect(html).toContain('Audition a higher-power tube integrated against the CS600X.');
  });

  it('softening composes with §9 protection caveats on the same card', () => {
    const a: AdvisoryResponse = {
      ...PHASE_K(),
      recommendedSequence: [
        { step: 1, action: 'Do not touch the DAC or the speakers.' },
        { step: 2, action: 'If the trade-off feels worth it, plan the swap.' },
      ],
    };
    const html = render(a);
    // Step 1 is preservation — caveat short-circuits — but the body
    // is still softened.
    expect(html).toContain('are already doing what this system asks of them');
    // Step 2 is a replacement step — caveat would fire if the action
    // referenced a protected component. "Plan the swap" alone doesn't
    // reference a specific component; caveat is silent. Softened body
    // still renders.
    expect(html).toContain('If the audition confirms the trade-off is worth it');
  });
});

describe('SystemAssessmentArtifact — §5 editorial-weight balance (Commit 8)', () => {
  // Phase K case: all three cards should have similar editorial
  // weight. Pontus II (2 sentences), Leben CS600X (3 — incl.
  // bottleneck), DeVore O/96 (2 — fused + cabinet). No card is a
  // one-sentence under-write.
  const PHASE_K: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Balance',
    systemSignature: 'sig',
    systemChain: {
      names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'R2R DAC.',
      'Push-pull tube integrated.',
      'High-efficiency wide-baffle speaker.',
    ],
    primaryConstraint: {
      componentName: 'Leben CS600X',
      category: 'amplifier_control',
      explanation: '',
    } as AdvisoryResponse['primaryConstraint'],
  };

  function bodyTextForCard(html: string, name: string): string {
    const componentsSlice = html.slice(html.indexOf('The Components'));
    const headingIdx = componentsSlice.indexOf(`>${name}</div>`);
    const block = componentsSlice.slice(headingIdx);
    const open = block.indexOf('<p ');
    const close = block.indexOf('</p>', open);
    return block.slice(open, close).replace(/<[^>]+>/g, '');
  }

  it('Pontus II card body has 2 sentences (rebalanced lede + R2R facts phrase)', () => {
    const html = render(PHASE_K);
    const body = bodyTextForCard(html, 'Denafrips Pontus II');
    expect((body.match(/[.!?](?:\s|$)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((body.match(/[.!?](?:\s|$)/g) ?? []).length).toBeLessThanOrEqual(3);
  });

  it('DeVore O/96 card body has 2 sentences (fused pairing + cabinet behavior)', () => {
    const html = render(PHASE_K);
    const body = bodyTextForCard(html, 'DeVore O/96');
    expect((body.match(/[.!?](?:\s|$)/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((body.match(/[.!?](?:\s|$)/g) ?? []).length).toBeLessThanOrEqual(3);
  });

  it('Leben CS600X card body has 3 sentences (lede + facts + bottleneck)', () => {
    const html = render(PHASE_K);
    const body = bodyTextForCard(html, 'Leben CS600X');
    expect((body.match(/[.!?](?:\s|$)/g) ?? []).length).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 9 — §9 What This System Seems Built For (listener-context layer)
// ════════════════════════════════════════════════════════════════════════
//
// New section: pivots from "what is this system" to "who is this
// system for" via confidence-gated inference. Each sentence is
// independently gated; the section as a whole omits gracefully when
// no sentence fires.

describe('SystemAssessmentArtifact — §9 listener-context (Commit 9)', () => {
  // ── Fixture: warm tube + high-efficiency + bottleneck on amp.
  const WARM_TUBE: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Warm tube',
    systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
    systemChain: {
      names: ['Some DAC', 'Some Tube Amp', 'Some HE Speakers'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'Warm-leaning R2R DAC.',
      'Push-pull tube integrated.',
      'High-efficiency wide-baffle speaker.',
    ],
    primaryConstraint: {
      componentName: 'Some Tube Amp',
      category: 'amplifier_control',
      explanation: '',
    } as AdvisoryResponse['primaryConstraint'],
  };

  it('renders the new section heading "What This System Seems Built For"', () => {
    const html = render(WARM_TUBE);
    expect(html).toContain('What This System Seems Built For');
  });

  it('warm tube + high-efficiency emits three dimension-led sentences (Commit 10)', () => {
    const html = render(WARM_TUBE);
    const slice = html.slice(html.indexOf('What This System Seems Built For'));
    // Sentence 1 — preference dimensions, not psychoanalysis.
    expect(slice).toContain('favors listeners who value tonal richness, flow, and long-term listening comfort');
    expect(slice).toContain('over maximum resolution or analytical precision');
    // Sentence 2 — room + volume dimensions.
    expect(slice).toContain('small-to-medium rooms at moderate volume');
    // Sentence 3 — recording tolerance + bottleneck-aware mismatch.
    expect(slice).toContain('forgives imperfect recordings');
    expect(slice).toContain("drive ceiling before the speakers run out of voice");
    // Commit 9's genre claim must be gone.
    expect(slice).not.toContain('Jazz, vocals');
    expect(slice).not.toContain('compressed popular music');
    expect(slice).not.toContain('orchestral played at SPL');
  });

  it('listener-fit prose uses preference dimensions, not genre prescriptions (Commit 10 discipline)', () => {
    const html = render(WARM_TUBE);
    const slice = html.slice(html.indexOf('What This System Seems Built For'));
    // No genre nouns.
    expect(slice).not.toMatch(/\bjazz\b/i);
    expect(slice).not.toMatch(/\bvocals?\b/i);
    expect(slice).not.toMatch(/\bacoustic\b/i);
    expect(slice).not.toMatch(/\bclassical\b/i);
    expect(slice).not.toMatch(/\brock\b/i);
    expect(slice).not.toMatch(/\bpop\b/i);
  });

  // ── Analytical / lean system — should emit lean-style sentence 1 +
  // lean-style sentence 2, no bottleneck-aware sentence 3.
  const ANALYTICAL: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Analytical',
    systemSignature: 'A lean, analytical chain with neutral voicing.',
    systemChain: {
      names: ['Some DAC', 'Some SS Amp', 'Some Monitor'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'Delta-sigma DAC.',
      'Class-A solid-state integrated amplifier.',
      'Sealed near-field monitor.',
    ],
  };

  it('analytical system emits the lean preference + well-recorded-material framing (Commit 10)', () => {
    const html = render(ANALYTICAL);
    const slice = html.slice(html.indexOf('What This System Seems Built For'));
    // Sentence 1 — lean preference framing.
    expect(slice).toContain('detail and transient precision');
    expect(slice).toContain('over warmth or rhythmic ease');
    // Sentence 3 — recording tolerance for lean systems.
    expect(slice).toContain('Well-recorded material rewards this system');
    expect(slice).toContain('production weaknesses are exposed');
    // Warm-system claims must NOT fire.
    expect(slice).not.toContain('warmth as gentle');
    expect(slice).not.toContain('forgives imperfect');
  });

  // ── High-efficiency only (no amp tech) — medium-confidence
  // sentence 1 ("moderate-volume listening"), no sentence 2/3.
  const HIGH_EFF_ONLY: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'HE only',
    systemSignature: 'A coherent system.',
    systemChain: { names: ['Some DAC', 'Some Amp', 'Some HE Speakers'], roles: ['DAC', 'Amp', 'Speakers'] },
    componentReadings: ['A DAC.', 'An amplifier.', 'A high-efficiency speaker.'],
  };

  it('high-efficiency without amp-tech signal emits the medium-confidence framing (Commit 10)', () => {
    const html = render(HIGH_EFF_ONLY);
    const slice = html.slice(html.indexOf('What This System Seems Built For'));
    // Medium-confidence sentence 1 — ease/accessibility framing.
    expect(slice).toContain('favors listeners who value ease and accessibility');
    // Medium-confidence sentence 2 — moderate-volume + small-to-medium rooms.
    expect(slice).toContain('Moderate-volume listening in small-to-medium rooms');
    // Higher-confidence templates must NOT fire.
    expect(slice).not.toContain('tonal richness, flow, and long-term');
    expect(slice).not.toContain('Jazz, vocals');
  });

  // ── Small monitor / low-efficiency + solid-state — emits scale +
  // headroom framing.
  const SMALL_MONITOR: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Small monitor',
    systemSignature: 'A controlled system with good imaging.',
    systemChain: { names: ['Some DAC', 'Some Class-D Amp', 'Some Low-Eff Monitor'], roles: ['DAC', 'Amp', 'Speakers'] },
    componentReadings: [
      'A DAC.',
      'A high-power solid-state class-D integrated.',
      'A low-efficiency two-way monitor (~83dB).',
    ],
  };

  it('low-efficiency + solid-state emits the scale/headroom framing (Commit 10)', () => {
    const html = render(SMALL_MONITOR);
    const slice = html.slice(html.indexOf('What This System Seems Built For'));
    // Sentence 1 — preference dimensions for power/scale listeners.
    expect(slice).toContain('favors listeners who want dynamic ease, scale, and headroom');
    expect(slice).toContain('higher volume');
    expect(slice).toContain('prioritize control over delicacy');
    // Sentence 2 — room/volume profile.
    expect(slice).toContain('built for larger rooms');
    expect(slice).toContain('lower-efficiency speakers reward space and amplifier authority');
  });

  // ── Sparse data — chain present but no facts extractable + neutral
  // signature. Section MUST omit gracefully.
  const SPARSE: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Sparse',
    systemSignature: 'A small system.',
    systemChain: { names: ['Mystery 1', 'Mystery 2'], roles: ['Component', 'Component'] },
    componentReadings: ['No anchors.', 'No anchors here either.'],
  };

  it('omits §9 entirely when no inference template fires (graceful degradation)', () => {
    const html = render(SPARSE);
    expect(html).not.toContain('What This System Seems Built For');
  });

  it('omits §9 when chain is empty (defensive)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'No chain',
      systemSignature: 'A warm tube-led chain.',
    };
    const html = render(a);
    expect(html).not.toContain('What This System Seems Built For');
  });

  it('passes preferSystemTerminology so "chain" never leaks (rewriter applied)', () => {
    // Use a fixture whose primaryConstraint resolves to a speaker
    // family — none of the listener-context sentences mention "chain"
    // directly, but the rewriter still runs over the joined output
    // as a safety net.
    const html = render(WARM_TUBE);
    const slice = html.slice(
      html.indexOf('What This System Seems Built For'),
      html.indexOf('If You Were to Change'),
    );
    expect(slice).not.toMatch(/\bthe chain\b/i);
  });

  it('does NOT use personality-test or AI-therapy register (no "you are", no "your inner")', () => {
    const html = render(WARM_TUBE);
    const slice = html.slice(html.indexOf('What This System Seems Built For'));
    // The section frames the SYSTEM ("this system favours / rewards")
    // not the listener ("you are / you love / your inner").
    expect(slice).not.toMatch(/\byou are\b/i);
    expect(slice).not.toMatch(/\byou love\b/i);
    expect(slice).not.toMatch(/\byour inner\b/i);
    expect(slice).not.toMatch(/\byour personality\b/i);
  });

  it('does NOT psychoanalyze the listener (no certainty claims about preference)', () => {
    const html = render(WARM_TUBE);
    const slice = html.slice(html.indexOf('What This System Seems Built For'));
    // Each sentence describes what the SYSTEM rewards or favours.
    // Anti-claim guards: no certainty about the listener's identity.
    expect(slice).not.toMatch(/\bwill love\b/i);
    expect(slice).not.toMatch(/\bdefinitely prefers?\b/i);
    expect(slice).not.toMatch(/\byou will\b/i);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 10 — Editorial discipline pass
//   §3 presentational override
//   §10 upgrade hierarchy paragraph
//   §9 anti-genre listener-fit (locked above in the §9 suite)
// ════════════════════════════════════════════════════════════════════════

describe('SystemAssessmentArtifact — §3 presentational first impressions (Commit 10)', () => {
  // ── HIGH-confidence: warm + tube + high-eff → "prioritizes tone, flow,
  // and musical ease" template fires.
  const PHASE_K: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Phase K',
    systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
    introSummary: 'Generic engine intro that should be replaced.',
    systemChain: {
      names: ['Some DAC', 'Some Tube Amp', 'Some HE Speakers'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'Warm-leaning R2R DAC.',
      'Push-pull tube integrated.',
      'High-efficiency wide-baffle speaker.',
    ],
  };

  it('warm + tube + high-eff fires the "prioritizes tone, flow, and musical ease" template', () => {
    const html = render(PHASE_K);
    const slice = html.slice(html.indexOf('First Impressions'), html.indexOf('First Impressions') + 400);
    expect(slice).toContain('This system prioritizes tone, flow, and musical ease');
    expect(slice).toContain('over analytical precision or maximum resolution');
    // Engine intro is replaced when the presentational override fires.
    expect(slice).not.toContain('Generic engine intro');
  });

  // ── HIGH-confidence: lean + solid-state + low-eff → "resolution,
  // transient precision, and dynamic authority" template fires.
  const ANALYTICAL_FI: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Analytical',
    systemSignature: 'A lean, analytical system with neutral voicing.',
    systemChain: {
      names: ['Some DAC', 'Some SS Amp', 'Some Low-Eff Monitor'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'Delta-sigma DAC.',
      'Class-A solid-state integrated amplifier.',
      'A low-efficiency two-way monitor (~83dB).',
    ],
  };

  it('lean + solid-state + low-eff fires the "resolution, transient precision" template', () => {
    const html = render(ANALYTICAL_FI);
    const slice = html.slice(html.indexOf('First Impressions'), html.indexOf('First Impressions') + 400);
    expect(slice).toContain('This system prioritizes resolution, transient precision, and dynamic authority');
    expect(slice).toContain('over warmth or rhythmic ease');
  });

  // ── MEDIUM-confidence: warm signature only → "tonal density and flow"
  // template.
  it('warm-only signature fires the medium-confidence "tonal density and flow" template', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Warm Only',
      systemSignature: 'A warm sound.',
      systemChain: { names: ['Anon'], roles: ['DAC'] },
      componentReadings: ['No anchors.'],
    };
    const html = render(a);
    const slice = html.slice(html.indexOf('First Impressions'), html.indexOf('First Impressions') + 400);
    expect(slice).toContain('This system prioritizes tonal density and flow');
    expect(slice).toContain('over analytical detail');
  });

  // ── LOW-confidence: no lean keyword in signature, no chain anchors →
  // falls through to engine output.
  it('falls through to engine introSummary when neither lean nor chain anchors fire', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Low confidence',
      systemSignature: 'A coherent system.',
      introSummary: 'Engine-emitted introSummary text passes through.',
      systemChain: { names: ['Anon'], roles: ['DAC'] },
      componentReadings: ['No anchors.'],
    };
    const html = render(a);
    expect(html).toContain('First Impressions');
    // Engine output survives.
    expect(html).toContain('Engine-emitted introSummary text passes through');
    // Presentational templates must NOT fire.
    expect(html).not.toContain('This system prioritizes tone');
    expect(html).not.toContain('This system prioritizes resolution');
  });

  it('first-impressions prose is one paragraph (not multi-sentence)', () => {
    const html = render(PHASE_K);
    const start = html.indexOf('First Impressions');
    const slice = html.slice(start, start + 500);
    // Exactly one <p> in the section.
    const paragraphCount = (slice.match(/<p\b/g) ?? []).length;
    expect(paragraphCount).toBe(1);
  });
});

describe('SystemAssessmentArtifact — §10 upgrade hierarchy paragraph (Commit 10)', () => {
  // ── Phase K case: mature push-pull tube + high-efficiency wide-baffle
  // → both protections fire → 3-sentence hierarchy paragraph.
  const PHASE_K_CHANGE: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'Phase K Change',
    systemSignature: 'sig',
    systemChain: {
      names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
      roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
    },
    componentReadings: [
      'R2R DAC.',
      'Push-pull tube integrated.',
      'High-efficiency wide-baffle speaker.',
    ],
    upgradeDirection: 'Engine upgrade direction.',
    recommendedSequence: [
      { step: 1, action: 'Audition a higher-power tube integrated.' },
    ],
  };

  it('renders the hierarchy paragraph BEFORE the engine upgradeDirection', () => {
    const html = render(PHASE_K_CHANGE);
    const sectionStart = html.indexOf('If You Were to Change Something');
    const slice = html.slice(sectionStart, sectionStart + 1500);
    const hierarchyIdx = slice.indexOf('lowest-risk path forward');
    const engineIdx = slice.indexOf('Engine upgrade direction');
    expect(hierarchyIdx).toBeGreaterThan(0);
    expect(engineIdx).toBeGreaterThan(0);
    expect(hierarchyIdx).toBeLessThan(engineIdx);
  });

  it('hierarchy paragraph names front-end refinement as the lowest-risk move', () => {
    const html = render(PHASE_K_CHANGE);
    expect(html).toContain('lowest-risk path forward is front-end refinement');
    expect(html).toContain('source, DAC, and cabling');
    expect(html).toContain('without changing the system');
  });

  it('hierarchy paragraph names the mature amplifier as a philosophical change', () => {
    const html = render(PHASE_K_CHANGE);
    expect(html).toContain('Replacing the Leben CS600X is a philosophical change');
    expect(html).toContain('a different system, not the same one improved');
  });

  it('hierarchy paragraph names the destination loudspeaker as a fixed point', () => {
    const html = render(PHASE_K_CHANGE);
    expect(html).toContain('The DeVore O/96 is a destination-class loudspeaker');
    expect(html).toContain('fixed point rather than a swap candidate');
  });

  it('hierarchy paragraph is omitted when neither protection fires (low-leverage chain)', () => {
    // Chain has no destination-class speaker AND no mature amplifier.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Low-leverage',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Class D Integrated', 'Some Low-Eff Bookshelf'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A delta-sigma DAC.',
        'A class-D integrated.',
        'A low-efficiency sealed bookshelf.',
      ],
      upgradeDirection: 'Engine direction.',
      recommendedSequence: [{ step: 1, action: 'Try something.' }],
    };
    const html = render(a);
    expect(html).toContain('If You Were to Change Something');
    expect(html).not.toContain('lowest-risk path forward is front-end refinement');
    expect(html).not.toContain('philosophical change');
    expect(html).not.toContain('fixed point rather than a swap candidate');
  });

  it('hierarchy paragraph fires Level 1 + Level 2 only when amp matures but speaker is not destination', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Tube + non-destination speaker',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Tube Amp', 'Some Sealed Bookshelf'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A DAC.',
        'A push-pull tube integrated.',
        'A sealed bookshelf with no efficiency anchor.',
      ],
      upgradeDirection: 'Engine direction.',
      recommendedSequence: [{ step: 1, action: 'Try something.' }],
    };
    const html = render(a);
    expect(html).toContain('lowest-risk path forward');
    expect(html).toContain('philosophical change');
    expect(html).not.toContain('destination-class loudspeaker');
  });

  it('hierarchy paragraph fires Level 1 + Level 3 only when speaker is destination but amp is not mature', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Non-mature amp + destination speaker',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Class D Integrated', 'Some HE Wide-Baffle Speaker'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A DAC.',
        'A class-D integrated.',
        'A high-efficiency wide-baffle speaker.',
      ],
      upgradeDirection: 'Engine direction.',
      recommendedSequence: [{ step: 1, action: 'Try something.' }],
    };
    const html = render(a);
    expect(html).toContain('lowest-risk path forward');
    expect(html).toContain('destination-class loudspeaker');
    expect(html).not.toContain('philosophical change');
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 11 — pre-acceptance polish: §2 chain-leak fix + §4 synergy dedup
// ════════════════════════════════════════════════════════════════════════
//
// The Commit-10 production-readiness audit identified two
// non-blocking polish issues:
//   §2 — `systemSignature` passed through SystemProfileCard
//        unmodified, so engine-emitted "source-first chain with
//        coherent-source voicing" surfaced verbatim
//   §4 — `systemContext` and `systemSynergy` could carry overlapping
//        text, producing a duplicated insight in the rendered section
//
// Both are fixed presentationally with the smallest safe changes.

describe('SystemAssessmentArtifact — §2 Profile chain-leak fix (Commit 11)', () => {
  const base = (): AdvisoryResponse => ({
    kind: 'assessment',
    subject: 'Term Test',
  } as AdvisoryResponse);

  it('rewrites "chain" → "system" inside the systemSignature passthrough', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
    };
    const html = render(a);
    // Scope to §2 so other sections do not bleed into the assertion.
    const profileIdx = html.indexOf('Profile');
    const sliceEnd = html.indexOf('First Impressions', profileIdx);
    const slice = html.slice(profileIdx, sliceEnd > 0 ? sliceEnd : profileIdx + 800);
    expect(slice).toContain('source-first system');
    expect(slice).not.toMatch(/\bsource-first chain\b/i);
  });

  it('rewrites "this chain" / "chain\'s" inside tendencies passthrough', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemSignature: 'A coherent voicing.',
      tendencies: "Flowing midrange that highlights this chain's harmonic continuity.",
    };
    const html = render(a);
    const profileIdx = html.indexOf('Profile');
    const sliceEnd = html.indexOf('First Impressions', profileIdx);
    const slice = html.slice(profileIdx, sliceEnd > 0 ? sliceEnd : profileIdx + 800);
    // Both "this chain's" and the bare possessive must rewrite.
    expect(slice).toContain('this system');
    expect(slice).not.toMatch(/\bthis chain\b/i);
    expect(slice).not.toMatch(/chain['’]s/i);
  });

  it('preserves "signal chain" as a topology term in §2 (rewriter exception)', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemSignature: 'A short signal chain with coherent voicing.',
    };
    const html = render(a);
    const profileIdx = html.indexOf('Profile');
    const sliceEnd = html.indexOf('First Impressions', profileIdx);
    const slice = html.slice(profileIdx, sliceEnd > 0 ? sliceEnd : profileIdx + 800);
    expect(slice).toContain('signal chain');
  });

  it('also runs the rewriter over the "What it trades" row', () => {
    const a: AdvisoryResponse = {
      ...base(),
      systemSignature: 'A system.',
      assessmentLimitations: ['Reduced detail across the chain at low SPL'],
    };
    const html = render(a);
    const profileIdx = html.indexOf('Profile');
    const sliceEnd = html.indexOf('First Impressions', profileIdx);
    const slice = html.slice(profileIdx, sliceEnd > 0 ? sliceEnd : profileIdx + 800);
    expect(slice).toContain('across the system');
    expect(slice).not.toMatch(/across the chain/i);
  });
});

describe('SystemAssessmentArtifact — §4 Character synergy dedup (Commit 11)', () => {
  // Helper: count <p> children inside §4 Character.
  function characterParagraphCount(html: string): number {
    const start = html.indexOf('Character');
    if (start < 0) return 0;
    // §4 ends at the next section heading; bound by "The Components".
    const end = html.indexOf('The Components', start);
    const slice = html.slice(start, end > 0 ? end : start + 2000);
    return (slice.match(/<p\b/g) ?? []).length;
  }

  it('suppresses synergy when normalized synergy is a substring of normalized characterProse', () => {
    // The engine emits the synergy line embedded inside systemContext.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Dup',
      systemSignature: 'sig',
      systemContext:
        '**System read** The Leben CS600X and DeVore O/96 are a canonical pairing. The Pontus II warmth is reinforced by the Leben, then anchored by the O/96 cabinet weight.',
      systemSynergy:
        'The Pontus II warmth is reinforced by the Leben, then anchored by the O/96 cabinet weight.',
    };
    const html = render(a);
    expect(characterParagraphCount(html)).toBe(1);
    // Body still includes the synergy text once (via characterProse).
    expect(html).toContain('reinforced by the Leben');
  });

  it('suppresses characterProse when synergy is a superset of normalized characterProse', () => {
    // Inverse case: systemSynergy carries the full narrative; systemContext
    // emits a one-sentence fragment of it.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Dup-inv',
      systemSignature: 'sig',
      systemContext: '**System read** The Pontus II warmth is reinforced by the Leben.',
      systemSynergy:
        'The Pontus II warmth is reinforced by the Leben, then anchored by the O/96 cabinet weight.',
    };
    const html = render(a);
    expect(characterParagraphCount(html)).toBe(1);
    // The surviving paragraph carries the longer synergy text.
    expect(html).toContain('anchored by the O/96');
  });

  it('renders both paragraphs when they carry distinct content (graceful baseline)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Distinct',
      systemSignature: 'sig',
      systemContext:
        '**System read** The Leben CS600X and DeVore O/96 are a canonical pairing in the tube-warm coherent-source tradition.',
      systemSynergy:
        'The Pontus II warmth is reinforced by the Leben, then anchored by the O/96 cabinet weight.',
    };
    const html = render(a);
    expect(characterParagraphCount(html)).toBe(2);
    // Both insights survive.
    expect(html).toContain('canonical pairing');
    expect(html).toContain('reinforced by the Leben');
  });

  it('gracefully renders only systemContext when systemSynergy is absent', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Only context',
      systemSignature: 'sig',
      systemContext: '**System read** A canonical pairing.',
    };
    const html = render(a);
    expect(characterParagraphCount(html)).toBe(1);
    expect(html).toContain('canonical pairing');
  });

  it('gracefully renders only systemSynergy when systemContext is absent', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Only synergy',
      systemSignature: 'sig',
      systemSynergy: 'The Pontus II warmth is reinforced by the Leben.',
    };
    const html = render(a);
    expect(characterParagraphCount(html)).toBe(1);
    expect(html).toContain('reinforced by the Leben');
  });

  it('omits §4 entirely when BOTH systemContext and systemSynergy are absent', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'No context',
      systemSignature: 'sig',
    };
    const html = render(a);
    // Heading "Character" must NOT render with no body.
    expect(html).not.toMatch(/<h2[^>]*>Character<\/h2>/);
  });

  it('applies preferSystemTerminology to the synergy line (chain→system rewriter)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Synergy rewriter',
      systemSignature: 'sig',
      systemContext: '**System read** A canonical pairing.',
      systemSynergy: 'The chain reinforces a single voicing across all three components.',
    };
    const html = render(a);
    const start = html.indexOf('Character');
    const end = html.indexOf('The Components', start);
    const slice = html.slice(start, end > 0 ? end : start + 2000);
    expect(slice).toContain('The system reinforces');
    expect(slice).not.toMatch(/\bthe chain\b/i);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 12 — 15-chain acceptance polish
// ════════════════════════════════════════════════════════════════════════
//
// Five small presentational fixes surfaced by the 15-chain acceptance
// pass:
//   A. §10 step "Step N / Step N" title-subtitle dedup
//   C. §10 destination-speaker brand allowlist (Magnepan, Harbeth, …)
//   D. §9 single-sentence omission gate (require ≥2 sentences)
//   F. Marantz overlay key narrowed (within-brand wrong-image safety)
//   G. §5 headphone surface ("sound at the ear" vs "in the room")

describe('SystemAssessmentArtifact — Fix A: §10 step "Step N / Step N" dedup', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Step dup',
      systemSignature: 'sig',
      systemChain: { names: ['Some DAC', 'Some Amp', 'Some Speakers'], roles: ['DAC', 'Amp', 'Speakers'] },
      componentReadings: ['A DAC.', 'An amp.', 'A speaker.'],
      upgradeDirection: 'A direction.',
    } as AdvisoryResponse);

  it('suppresses the duplicate "Step N" subtitle when deriveStepTitle falls back to "Step N"', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        // Action that doesn't match any deriveStepTitle pattern →
        // title falls back to "Step 1". The subtitle should not also
        // render as "Step 1".
        { step: 1, action: 'Some action that matches no pattern.' },
      ],
    };
    const html = render(a);
    // The string "Step 1" should appear EXACTLY ONCE under §10 — as
    // the editorial title; not duplicated as a subtitle row.
    const sectionStart = html.indexOf('If You Were to Change Something');
    const slice = html.slice(sectionStart);
    const count = (slice.match(/>Step 1</g) ?? []).length;
    expect(count).toBe(1);
  });

  it('keeps the "Step N" subtitle when a meaningful title resolved', () => {
    const a: AdvisoryResponse = {
      ...base(),
      recommendedSequence: [
        { step: 1, action: 'Audition a higher-power tube integrated against the amp.' },
      ],
    };
    const html = render(a);
    const sectionStart = html.indexOf('If You Were to Change Something');
    const slice = html.slice(sectionStart);
    // deriveStepTitle returns "Audition the Amplifier"; the "Step 1"
    // subtitle row still renders for sequence ordering.
    expect(slice).toContain('Audition the Amplifier');
    expect(slice).toContain('>Step 1<');
  });
});

describe('SystemAssessmentArtifact — Fix C: §10 destination-speaker brand allowlist', () => {
  const base = (chainNames: string[], roles: string[]): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Dest brand',
      systemSignature: 'sig',
      systemChain: { names: chainNames, roles },
      componentReadings: chainNames.map(() => 'A component.'),
      upgradeDirection: 'A direction.',
      recommendedSequence: [{ step: 1, action: 'Try something.' }],
    } as AdvisoryResponse);

  it('fires Level 3 destination framing for Magnepan even without efficiency anchor', () => {
    const a = base(
      ['Holo May DAC', 'Pass Labs INT-25', 'Magnepan LRS+'],
      ['DAC', 'Integrated Amplifier', 'Speakers'],
    );
    const html = render(a);
    expect(html).toContain('The Magnepan LRS+ is a destination-class loudspeaker');
  });

  it('fires Level 3 destination framing for Harbeth even with bass-reflex cabinet', () => {
    const a = base(
      ['DAC', 'Amp', 'Harbeth SHL5plus XD'],
      ['DAC', 'Amplifier', 'Speakers'],
    );
    const html = render(a);
    expect(html).toContain('The Harbeth SHL5plus XD is a destination-class loudspeaker');
  });

  it('does NOT fire destination framing for non-allowlist brands without other anchors', () => {
    const a = base(
      ['Some DAC', 'Some Amp', 'Generic Bookshelf'],
      ['DAC', 'Amp', 'Speakers'],
    );
    const html = render(a);
    expect(html).not.toContain('destination-class loudspeaker');
  });
});

describe('SystemAssessmentArtifact — Fix D: §9 single-sentence omission gate', () => {
  it('omits §9 when only the bottleneck-mismatch sentence would fire', () => {
    // Chain has no efficiency anchor + no warm/lean signature → S1 and
    // S2 are silent. PrimaryConstraint on speaker → S3 fires. With the
    // gate, the section omits rather than rendering a one-sentence stub.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Single sentence',
      systemSignature: 'A coherent system.',
      systemChain: {
        names: ['Some DAC', 'Some Class-D Amp', 'Some Sealed Monitor'],
        roles: ['DAC', 'Amp', 'Speakers'],
      },
      componentReadings: [
        'A DAC.',
        'A class-D integrated.',
        'A sealed monitor.',
      ],
      primaryConstraint: {
        componentName: 'Some Sealed Monitor',
        category: 'speaker_scale',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
    };
    const html = render(a);
    expect(html).not.toContain('What This System Seems Built For');
  });

  it('still renders §9 when at least two sentences fire', () => {
    // Warm signature → S1 fires; warm + bottleneck → S3 fires → 2 sentences.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Two sentences',
      systemSignature: 'A warm system.',
      systemChain: { names: ['Some DAC', 'Some Amp', 'Some Speakers'], roles: ['DAC', 'Amp', 'Speakers'] },
      componentReadings: ['A DAC.', 'An amp.', 'A speaker.'],
      primaryConstraint: {
        componentName: 'Some Speakers',
        category: 'speaker_scale',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
    };
    const html = render(a);
    expect(html).toContain('What This System Seems Built For');
    expect(html).toContain('tonal richness and musical flow');
    // HTML escapes the apostrophe; assert via partial substring match.
    expect(html).toContain('practical ceiling');
  });
});

describe('SystemAssessmentArtifact — Fix G: §5 headphone surface', () => {
  const base = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Headphone',
      systemSignature: 'A warm tube-led headphone system.',
      systemChain: {
        names: ['Some DAC', 'Some Tube HP Amp', 'Some Headphones'],
        roles: ['DAC', 'Headphone Amplifier', 'Headphones'],
      },
      componentReadings: [
        'A DAC.',
        'A tube headphone amplifier.',
        'High-impedance dynamic headphones.',
      ],
    } as AdvisoryResponse);

  it('renders "sound at the ear" for the headphone-tail lede instead of "sound in the room"', () => {
    const html = render(base());
    // The headphone card uses the speaker-family template but with
    // the surface swapped to "at the ear".
    expect(html).toContain('Some Headphones translates what the Some Tube HP Amp delivers into sound at the ear');
    expect(html).not.toMatch(/Some Headphones translates what the Some Tube HP Amp delivers into sound in the room/);
  });

  it('still renders "in the room" for speakers (no regression)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Speakers',
      systemSignature: 'sig',
      systemChain: { names: ['Some DAC', 'Some Amp', 'Some Speakers'], roles: ['DAC', 'Amp', 'Speakers'] },
      componentReadings: ['A DAC.', 'An amp.', 'A speaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('Some Speakers translates what the Some Amp delivers into sound in the room');
    expect(html).not.toContain('sound at the ear');
  });
});

// ════════════════════════════════════════════════════════════════════════
// Commit 13 — §6 interaction fallback / §8 coherence fallback / §5 preamp parity
// ════════════════════════════════════════════════════════════════════════

describe('SystemAssessmentArtifact — Commit 13 §6 interaction fallback', () => {
  it('renders a cautious §6 paragraph when the engine emits no interaction prose but chain structure exists', () => {
    // No systemInteraction; chain has 3 components across 3 role
    // families; component readings carry topology / efficiency anchors
    // so chainFacts qualify. Fallback fires.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Fallback fires',
      systemSignature: 'A coherent warm system.',
      systemChain: {
        names: ['Some DAC', 'Some Tube Amp', 'Some High-Efficiency Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC favoring tonal density.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('How They Work Together');
    expect(html).toContain('With the available information');
    expect(html).toContain('source, amplification, and speaker stages');
    expect(html).toContain('A more precise interaction judgment');
  });

  it('omits §6 when no interaction prose AND chain is too sparse', () => {
    // Single-component chain → fallback declines.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Sparse',
      systemSignature: 'a system',
      systemChain: { names: ['Just One'], roles: ['DAC'] },
      componentReadings: ['An R2R DAC.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain('How They Work Together');
  });

  it('omits §6 when chain has 2 components but only one role family', () => {
    // Two amps → familySet.size === 1 → fallback declines.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Single family',
      systemSignature: 'a system',
      systemChain: { names: ['Amp One', 'Amp Two'], roles: ['Amplifier', 'Amplifier'] },
      componentReadings: ['A tube amp.', 'A solid-state amp.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain('How They Work Together');
  });

  it('omits §6 when no chain facts are anchored (no efficiency/topology/cabinet/tech/tonalLean)', () => {
    // 3-component, 3-family chain but readings produce no facts.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'No facts',
      systemSignature: 'a system',
      systemChain: {
        names: ['Some DAC', 'Some Amp', 'Some Speakers'],
        roles: ['DAC', 'Amp', 'Speakers'],
      },
      componentReadings: ['One.', 'Two.', 'Three.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain('How They Work Together');
  });

  it('engine systemInteraction still wins when present and non-empty', () => {
    // When the engine emits surviving interaction prose, the fallback
    // does NOT replace it.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Engine wins',
      systemSignature: 'A warm tube-led system.',
      systemChain: {
        names: ['Some DAC', 'Some Tube Amp', 'Some Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: ['An R2R DAC.', 'A tube amp.', 'A high-efficiency speaker.'],
      systemInteraction:
        'The Some DAC and the Some Tube Amp work together to deliver a coherent voice through the Some Speakers.',
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('How They Work Together');
    expect(html).toContain('work together to deliver a coherent voice');
    // Scope the fallback-marker assertion to §6 only — §8 may
    // independently emit "With the available information" via its
    // own Commit 13 coherence-fallback path when keepRecs is absent.
    const s6Start = html.indexOf('How They Work Together');
    const s6End = html.indexOf('</section>', s6Start);
    const s6Slice = html.slice(s6Start, s6End);
    expect(s6Slice).not.toContain('With the available information');
  });

  it('does not overclaim certainty — caveats are explicit', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'No overclaim',
      systemSignature: 'A warm system.',
      systemChain: {
        names: ['Some DAC', 'Some Tube Amp', 'Some High-Efficiency Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    // The fallback names placement/listening as the determinant of a
    // precise judgment — explicit acknowledgement of evidence limits.
    expect(html).toContain('would depend on placement and listening conditions');
  });
});

describe('SystemAssessmentArtifact — Commit 13 §8 coherence fallback', () => {
  const baseChain = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Coherence',
      systemSignature: 'A coherent warm tube-led system.',
      systemChain: {
        names: ['Some DAC', 'Some Tube Amp', 'Some High-Efficiency Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC favoring tonal density.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse);

  it('renders coherence-fallback paragraph when keepRecommendations is absent but tonal anchor exists', () => {
    const html = render({ ...baseChain(), keepRecommendations: undefined });
    expect(html).toContain('Why This System Works');
    expect(html).toContain('appear to be working toward a single voicing');
    expect(html).toContain('confirming this would require listening rather than assessment');
  });

  it('renders coherence-fallback paragraph when no tonal anchor but ≥2 chain components have anchored facts', () => {
    // No warm/lean/analytical/neutral in signature, but tube +
    // high-efficiency facts anchor two components.
    const a: AdvisoryResponse = {
      ...baseChain(),
      systemSignature: 'A system.',
      keepRecommendations: undefined,
    };
    const html = render(a);
    expect(html).toContain('Why This System Works');
    expect(html).toContain('appear to be working toward a single voicing');
  });

  it('omits §8 when keepRecs absent AND no tonal anchor AND <2 anchored-facts components', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      systemSignature: 'A system.',
      keepRecommendations: undefined,
      componentReadings: ['One.', 'Two.', 'Three.'],
    };
    const html = render(a);
    expect(html).not.toContain('Why This System Works');
  });

  it('omits §8 when keepRecs absent AND chain is single-component (no coherence story)', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      systemChain: { names: ['Just One'], roles: ['DAC'] },
      componentReadings: ['An R2R DAC.'],
      keepRecommendations: undefined,
    };
    const html = render(a);
    expect(html).not.toContain('Why This System Works');
  });

  it('engine keepRecommendations branch still wins when present', () => {
    const a: AdvisoryResponse = {
      ...baseChain(),
      keepRecommendations: [
        { componentName: 'Some Tube Amp', reason: 'It works.' } as never,
      ],
    };
    const html = render(a);
    expect(html).toContain('Why This System Works');
    // Original keep-recs branch uses "succeeds because" wording.
    expect(html).toContain('succeeds because');
    // Fallback marker should NOT appear in this path.
    expect(html).not.toContain('appear to be working toward');
  });

  it('does not duplicate §5 per-component summaries', () => {
    const html = render({ ...baseChain(), keepRecommendations: undefined });
    const s8Start = html.indexOf('Why This System Works');
    const s8End = html.indexOf('</section>', s8Start);
    const s8Slice = html.slice(s8Start, s8End);
    // §8 fallback should NOT name specific chain components.
    expect(s8Slice).not.toContain('Some DAC');
    expect(s8Slice).not.toContain('Some Tube Amp');
    expect(s8Slice).not.toContain('Some High-Efficiency Speakers');
  });
});

describe('SystemAssessmentArtifact — Commit 13 §5 preamp template parity', () => {
  const fourComponentChain = (): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'Preamp parity',
      systemSignature: 'A reference solid-state line-stage system.',
      systemChain: {
        names: ['Holo May DAC', 'Audio Research LS28', 'Audio Research Ref 75', 'Magnepan 3.7i'],
        roles: ['DAC', 'Preamplifier', 'Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A delta-sigma DAC.',
        'A line-stage preamplifier with tube gain.',
        'A push-pull tube power amplifier.',
        'A planar-magnetic destination speaker.',
      ],
    } as AdvisoryResponse);

  it('preamp card references the downstream power amplifier rather than the speakers', () => {
    const html = render(fourComponentChain());
    // The Audio Research LS28 (preamp) lede must mention the
    // downstream Audio Research Ref 75 (power amp).
    expect(html).toContain('Audio Research LS28 accepts the signal from the Holo May DAC');
    expect(html).toContain('hands it to the Audio Research Ref 75');
  });

  it('preamp card does NOT say "drives the speakers" or "drive for the speakers"', () => {
    const html = render(fourComponentChain());
    // Anchor the slice to the §5 The Components section so the
    // banner occurrence of "Audio Research LS28" doesn't shadow the
    // card body we actually want to inspect.
    const componentsStart = html.indexOf('The Components');
    const ls28Idx = html.indexOf('Audio Research LS28', componentsStart);
    const ls28End = html.indexOf('Audio Research Ref 75', ls28Idx + 'Audio Research LS28'.length);
    const ls28Slice = html.slice(ls28Idx, ls28End);
    expect(ls28Slice).not.toMatch(/drives the speakers/i);
    expect(ls28Slice).not.toMatch(/drive for the speakers/i);
    expect(ls28Slice).not.toMatch(/motion at the speakers/i);
    expect(ls28Slice).not.toMatch(/sound in the room/i);
    // Positive: preamp prose uses line-stage language.
    expect(ls28Slice).toContain('line-stage');
  });

  it('power-amp card after a preamp still uses speaker-drive prose', () => {
    const html = render(fourComponentChain());
    // The Ref 75 (power amp) sits between the preamp (LS28) and the
    // speakers (Magnepan 3.7i). It's allowed to talk about speaker drive.
    expect(html).toContain('Audio Research Ref 75');
    // The current amplifier-family lede with upstream+downstream is
    // "carries the signal between … translating source character into
    // drive for the speakers."
    expect(html).toMatch(
      /Audio Research Ref 75 carries the signal between the Audio Research LS28 and the Magnepan 3\.7i/,
    );
  });

  it('speaker card is unaffected by preamp branch', () => {
    const html = render(fourComponentChain());
    // Magnepan 3.7i speaker card should still describe planar /
    // destination behavior via the speaker branch.
    expect(html).toContain('Magnepan 3.7i');
    // Speaker family card uses "translates ... into sound in the room"
    // when no high/low efficiency is anchored from the reading. Either
    // way the speaker card must NOT pick up preamp language.
    const mgIdx = html.indexOf('Magnepan 3.7i', html.indexOf('The Components'));
    const mgSlice = html.slice(mgIdx, mgIdx + 1500);
    expect(mgSlice).not.toContain('line-stage');
    expect(mgSlice).not.toContain('gain shaping');
  });

  it('isolated preamp (no downstream / upstream) still avoids speaker-drive language', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Isolated preamp',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some Preamp'],
        roles: ['Preamplifier'],
      },
      componentReadings: ['A line-stage preamplifier.'],
    } as AdvisoryResponse;
    const html = render(a);
    const preIdx = html.indexOf('Some Preamp', html.indexOf('The Components'));
    const preSlice = html.slice(preIdx, preIdx + 1000);
    expect(preSlice).toMatch(/line-stage preamplifier|line-stage character/);
    expect(preSlice).not.toMatch(/drives the speakers/i);
    expect(preSlice).not.toMatch(/sound in the room/i);
  });
});

// ════════════════════════════════════════════════════════════════════════
// Hardening Phase A — trust + render-correctness fixes
// ════════════════════════════════════════════════════════════════════════
//
// Surgical fixes for four cross-fixture failure classes surfaced by the
// 36-fixture Final Product Validation Report:
//
//   B1  splitSentences silently dropped prefix when sentence contained
//       a decimal in a chain component model number (e.g. "Harbeth 30.2",
//       "Magnepan 3.7i") — §4 Character rendered as fragmentary text.
//   B3  §8 coherence prose (keep-recs branch + fallback) asserted
//       coherence on chains the engine had flagged as fighting / over-
//       warming / bottlenecked / mismatched.
//   B4  §9 listener-fit recommended systems to a listener-type profile
//       while §6 described them as fundamentally broken.
//   B5  §10 hierarchy paragraph protected a component the engine had
//       explicitly named as the primary constraint to be replaced.

describe('SystemAssessmentArtifact — Hardening A B1: §4 decimal-model truncation', () => {
  const baseChain = (systemContext: string): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'B1 test',
      systemSignature: 'sig',
      systemContext,
      systemChain: {
        names: ['Some DAC', 'Some Amp', 'Some Speakers'],
        roles: ['DAC', 'Amp', 'Speakers'],
      },
      componentReadings: ['A DAC.', 'An amp.', 'A speaker.'],
    } as AdvisoryResponse);

  it('preserves prefix before "Brand 30.2 XD" model decimals', () => {
    const html = render(
      baseChain(
        'The Pass Labs XA25 and Harbeth 30.2 XD pairing is a well-known modern Class-A-into-monitor signature.',
      ),
    );
    expect(html).toContain(
      'The Pass Labs XA25 and Harbeth 30.2 XD pairing is a well-known modern Class-A-into-monitor signature.',
    );
    // Negative — the pre-fix bug produced "2 XD pairing is a..."
    expect(html).not.toMatch(/>2 XD pairing/);
  });

  it('preserves prefix before "Magnepan 3.7i"-style decimal model', () => {
    const html = render(
      baseChain(
        'The Magnepan 3.7i is a low-efficiency planar magnetic; the Zen Triode produces ~2 watts. This is a mismatch.',
      ),
    );
    expect(html).toContain('The Magnepan 3.7i is a low-efficiency planar magnetic');
    expect(html).toContain('This is a mismatch');
    expect(html).not.toMatch(/>7i is a low-efficiency/);
  });

  it('handles multiple decimal models in one sentence', () => {
    const html = render(
      baseChain(
        'The Cary SLI-80HS is voiced warm; the Harbeth 30.2 XD is voiced warm; together they over-warm an otherwise neutral source.',
      ),
    );
    expect(html).toContain('The Cary SLI-80HS is voiced warm');
    expect(html).toContain('the Harbeth 30.2 XD is voiced warm');
    expect(html).not.toMatch(/>2 XD is voiced warm/);
  });

  it('still splits on real sentence boundaries (period + space)', () => {
    const html = render(
      baseChain('First sentence here. Second sentence here. Third sentence here.'),
    );
    expect(html).toContain('First sentence here');
    expect(html).toContain('Second sentence here');
    expect(html).toContain('Third sentence here');
  });

  it('preserves text with no terminating punctuation (tail fragment)', () => {
    const html = render(baseChain('Some prose without a final period'));
    expect(html).toContain('Some prose without a final period');
  });
});

describe('SystemAssessmentArtifact — Hardening A B3: §8 conflict-signal suppression', () => {
  const base = (overrides: Partial<AdvisoryResponse>): AdvisoryResponse =>
    ({
      kind: 'assessment',
      subject: 'B3 test',
      systemSignature: 'A warm coherent system.',
      systemChain: {
        names: ['Some DAC', 'Some Tube Amp', 'Some High-Efficiency Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC favoring tonal density.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle speaker.',
      ],
      ...overrides,
    } as AdvisoryResponse);

  it('suppresses §8 keep-recs branch when systemInteraction mentions fighting', () => {
    const html = render(
      base({
        systemInteraction:
          'The system is fighting itself — warm components compensating for a forward speaker.',
        keepRecommendations: [
          { componentName: 'Some Tube Amp', reason: 'works' } as never,
        ],
      }),
    );
    expect(html).not.toContain('Why This System Works');
  });

  it('suppresses §8 coherence fallback when assessmentLimitations contains a conflict token', () => {
    const html = render(
      base({
        assessmentLimitations: ['Voicing conflict.', 'Warmth fighting forward presentation.'],
      }),
    );
    expect(html).not.toContain('Why This System Works');
  });

  it('suppresses §8 when systemInteraction says "cannot translate"', () => {
    const html = render(
      base({
        systemInteraction:
          'The amplifier cannot translate the source quality through to the speakers.',
      }),
    );
    expect(html).not.toContain('Why This System Works');
  });

  it('suppresses §8 when assessmentLimitations names a bottleneck', () => {
    const html = render(
      base({
        assessmentLimitations: ['Amplifier limits everything downstream.'],
      }),
    );
    expect(html).not.toContain('Why This System Works');
  });

  it('continues to render §8 when no conflict signals are present', () => {
    const html = render(base({}));
    expect(html).toContain('Why This System Works');
    expect(html).toContain('appear to be working toward a single voicing');
  });

  it('continues to render §8 keep-recs branch when conflict-free', () => {
    const html = render(
      base({
        keepRecommendations: [
          { componentName: 'Some Tube Amp', reason: 'works' } as never,
        ],
      }),
    );
    expect(html).toContain('Why This System Works');
    expect(html).toContain('succeeds because');
  });
});

describe('SystemAssessmentArtifact — Hardening A B4: §9 conflict-signal suppression', () => {
  const baseConflict: AdvisoryResponse = {
    kind: 'assessment',
    subject: 'B4 test',
    systemSignature: 'A warm system.',
    systemInteraction:
      'The amplifier cannot drive the speakers to satisfactory levels. The speakers will not perform as designed.',
    systemChain: {
      names: ['Some DAC', 'Some Low-Power Amp', 'Some Low-Efficiency Planar'],
      roles: ['DAC', 'Power Amplifier', 'Speakers'],
    },
    componentReadings: [
      'An R2R DAC.',
      'A 2-watt single-ended triode tube amplifier.',
      'A low-efficiency planar magnetic floorstanding speaker.',
    ],
  } as AdvisoryResponse;

  it('suppresses §9 listener-fit when systemInteraction declares the speakers will not perform', () => {
    const html = render(baseConflict);
    expect(html).not.toContain('What This System Seems Built For');
  });

  it('suppresses §9 when assessmentLimitations contains "Voicing conflict"', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B4 limits',
      systemSignature: 'A warm system.',
      systemChain: {
        names: ['Some DAC', 'Some Warm Amp', 'Some High-Efficiency Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A warm DAC.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle speaker.',
      ],
      assessmentLimitations: ['Voicing conflict.', 'Warmth fighting forward presentation.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain('What This System Seems Built For');
  });

  it('continues to render §9 when no conflict signals are present (warm coherent system)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B4 healthy',
      systemSignature: 'A warm tube-led coherent system.',
      systemChain: {
        names: ['Some DAC', 'Some Tube Amp', 'Some High-Efficiency Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('What This System Seems Built For');
  });
});

describe('SystemAssessmentArtifact — Hardening A B5: §10 protection-vs-constraint suppression', () => {
  it('suppresses mature-amp protection when the engine names that amp as primary constraint', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B5 mature-amp constraint',
      systemSignature: 'A warm system.',
      systemChain: {
        names: ['Some DAC', 'Decware Zen Triode', 'Magnepan 3.7i'],
        roles: ['DAC', 'Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A 2-watt single-ended triode tube amplifier.',
        'A 4-panel low-efficiency planar magnetic floorstanding speaker.',
      ],
      primaryConstraint: {
        componentName: 'Decware Zen Triode',
        category: 'amplifier_drive',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
      upgradeDirection: 'Replace the amplifier.',
    } as AdvisoryResponse;
    const html = render(a);
    const sectionStart = html.indexOf('If You Were to Change Something');
    const slice = html.slice(sectionStart);
    // The Zen Triode is the constraint — protection must NOT name it.
    expect(slice).not.toContain(
      'Replacing the Decware Zen Triode is a philosophical change',
    );
  });

  it('suppresses destination-speaker protection when the engine names that speaker as primary constraint', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B5 destination-speaker constraint',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Amp', 'Wilson Sasha DAW'],
        roles: ['DAC', 'Amp', 'Speakers'],
      },
      componentReadings: ['A DAC.', 'An amp.', 'A speaker.'],
      primaryConstraint: {
        componentName: 'Wilson Sasha DAW',
        category: 'speaker_scale',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
      upgradeDirection: 'Replace the speaker.',
    } as AdvisoryResponse;
    const html = render(a);
    const sectionStart = html.indexOf('If You Were to Change Something');
    const slice = html.slice(sectionStart);
    expect(slice).not.toContain(
      'The Wilson Sasha DAW is a destination-class loudspeaker; treat it as a fixed point',
    );
  });

  it('continues to protect a destination speaker that is NOT the primary constraint', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B5 healthy destination',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Yamaha A-S301', 'Wilson Sasha DAW'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A 60-watt budget Class-AB integrated amplifier.',
        'A 3-way dynamic destination-class floorstander.',
      ],
      primaryConstraint: {
        componentName: 'Yamaha A-S301',
        category: 'amplifier_drive',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
      upgradeDirection: 'Replace the integrated amplifier.',
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Wilson Sasha DAW is a destination-class loudspeaker; treat it as a fixed point',
    );
  });

  it('continues to render §10 when ONLY the hierarchy paragraph fires (Phase B B2 ungate)', () => {
    // Hardening Phase B B2 — the hierarchy paragraph alone (no
    // engine upgrade output) should still produce a §10 render
    // because the destination-speaker protection is the artifact's
    // most-valuable advisory message.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B5 B2 cross-check',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Amp', 'Wilson Sasha DAW'],
        roles: ['DAC', 'Amp', 'Speakers'],
      },
      componentReadings: ['A DAC.', 'An amp.', 'A speaker.'],
      // No upgradeDirection / paths / sequence — pre-B2 this would
      // omit §10 entirely.
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('If You Were to Change Something');
    expect(html).toContain(
      'The Wilson Sasha DAW is a destination-class loudspeaker; treat it as a fixed point',
    );
  });

  it('omits §10 hierarchy entirely when the only protection candidate is also the constraint', () => {
    // 2-component chain: SET amp (mature) + planar speakers (not in
    // destination-brand allowlist; not high-eff in reading) — only
    // the SET amp would have triggered protection, but it is the
    // primary constraint. After B5 filtering both lists are empty.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B5 only-candidate-is-constraint',
      systemSignature: 'sig',
      systemChain: {
        names: ['Decware Zen Triode', 'Some Bookshelf'],
        roles: ['Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A 2-watt single-ended triode tube amplifier.',
        'A bookshelf speaker.',
      ],
      primaryConstraint: {
        componentName: 'Decware Zen Triode',
        category: 'amplifier_drive',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
      upgradeDirection: 'Replace the amplifier.',
    } as AdvisoryResponse;
    const html = render(a);
    const sectionStart = html.indexOf('If You Were to Change Something');
    const slice = html.slice(sectionStart);
    expect(slice).not.toContain('The lowest-risk path forward is front-end refinement');
    expect(slice).not.toContain('philosophical change');
  });
});

// ════════════════════════════════════════════════════════════════════════
// Hardening Phase B — system-architecture recognition + advisor judgment
// ════════════════════════════════════════════════════════════════════════
//
//   B2 §10 hierarchy ungated from engine output (with conflict-signal
//      guard when no engine direction backs the hierarchy framing).
//   B9 roleFamily reorder so amplifier match precedes source match;
//      compound all-in-one / streamer-amplifier roles classified as
//      amplifier and emitted with a role-correct §5 contribution lede.

describe('SystemAssessmentArtifact — Hardening B B2: §10 hierarchy independent gate', () => {
  it('renders §10 hierarchy paragraph when destination speaker present + no engine upgrade fields', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B2 destination ungate',
      systemSignature: 'A heritage Class-AB integrated into a Tannoy destination.',
      systemChain: {
        names: ['Holo May DAC', 'Luxman L-509X', 'Tannoy Cheviot'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A 120-watt Class-AB integrated amplifier.',
        'A 15-inch dual-concentric high-efficiency floorstander.',
      ],
      // no upgradeDirection, upgradePaths, or recommendedSequence
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('If You Were to Change Something');
    expect(html).toContain(
      'The Tannoy Cheviot is a destination-class loudspeaker; treat it as a fixed point',
    );
  });

  it('renders §10 hierarchy paragraph when mature amplifier present + no engine upgrade fields', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B2 mature ungate',
      systemSignature: 'A warm SET system.',
      systemChain: {
        names: ['Some DAC', 'Shindo Cortese', 'Some Bookshelf'],
        roles: ['DAC', 'Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A 9-watt single-ended triode tube amplifier.',
        'A 2-way bookshelf speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('If You Were to Change Something');
    expect(html).toContain(
      'Replacing the Shindo Cortese is a philosophical change rather than an obvious upgrade',
    );
  });

  it('omits §10 when no destination/mature component AND no engine upgrade fields', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B2 omit',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some SS Amp', 'Some Generic Bookshelf'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A delta-sigma DAC.',
        'A 75-watt Class-AB integrated amplifier.',
        'A 2-way bookshelf speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain('If You Were to Change Something');
  });

  it('suppresses solo hierarchy when chain has conflict signal AND no engine upgrade fields', () => {
    // Conflict-signaled chain with destination-allowlist speaker but
    // no curated engine direction. The hierarchy paragraph would
    // assert "front-end refinement first" / "treat as fixed point"
    // — neither is supported by an engine direction here, so suppress.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B2 conflict suppression',
      systemSignature: 'A warm-source warm-amp system met by a forward-voiced Harbeth.',
      systemInteraction:
        'The amp and speaker both lean warm; the system collapses toward a polite mid-centric voicing.',
      systemChain: {
        names: ['Berkeley Alpha', 'Cary SLI-80HS', 'Harbeth 30.2 XD'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A reference solid-state R2R DAC.',
        'A 40-watt push-pull tube integrated amplifier.',
        'A BBC-tradition thin-wall monitor with warm midband.',
      ],
      assessmentLimitations: ['Top-end air constrained.', 'Tonal warmth compounds.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain('If You Were to Change Something');
  });

  it('renders hierarchy alongside engine upgrade direction even on conflict-signaled chains', () => {
    // Conflict signal IS present but engine emitted a curated
    // direction. Hierarchy framing is consistent with the engine
    // recommendation, so render both.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B2 conflict with direction',
      systemSignature: 'A warm SET system mismatched with low-efficiency planars.',
      systemInteraction:
        'The amplifier cannot drive the speakers to satisfactory levels.',
      systemChain: {
        names: ['Some DAC', 'Decware Zen Triode', 'Magnepan 3.7i'],
        roles: ['DAC', 'Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A 2-watt single-ended triode tube amplifier.',
        'A 4-panel low-efficiency planar magnetic floorstander.',
      ],
      primaryConstraint: {
        componentName: 'Decware Zen Triode',
        category: 'amplifier_drive',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
      upgradeDirection: 'Replace the amplifier with one suited to a low-efficiency planar load.',
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('If You Were to Change Something');
    // Decware suppressed by Phase A B5
    expect(html).not.toContain(
      'Replacing the Decware Zen Triode is a philosophical change',
    );
    // Magnepan still correctly protected
    expect(html).toContain(
      'The Magnepan 3.7i is a destination-class loudspeaker; treat it as a fixed point',
    );
    // Engine direction renders
    expect(html).toContain('Replace the amplifier with one suited to a low-efficiency planar load');
  });

  it('Phase K hierarchy + engine direction render unchanged from Phase A', () => {
    // Locked Phase K reference must still render its hierarchy +
    // engine direction + sequence stack.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Phase K',
      systemSignature: 'A warm tube-led source-first chain with coherent-source voicing.',
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle loudspeaker.',
      ],
      primaryConstraint: {
        componentName: 'DeVore O/96',
        category: 'speaker_scale',
        explanation: '',
      } as AdvisoryResponse['primaryConstraint'],
      upgradeDirection: 'Refine the front-end before swapping the destination speakers.',
      recommendedSequence: [{ step: 1, action: 'Refine the source / streamer chain.' }],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('The lowest-risk path forward is front-end refinement');
    expect(html).toContain(
      'Replacing the Leben CS600X is a philosophical change rather than an obvious upgrade',
    );
    // DeVore is the primary constraint — protection suppressed by Phase A B5
    expect(html).not.toContain(
      'The DeVore O/96 is a destination-class loudspeaker; treat it as a fixed point',
    );
    expect(html).toContain('Refine the front-end before swapping the destination speakers');
  });
});

describe('SystemAssessmentArtifact — Hardening B B9: all-in-one / streamer-amplifier classification', () => {
  it('NAD M10 → DALI Oberon 5: all-in-one card uses combined source+amplification lede', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B9 NAD M10',
      systemSignature: 'A Class-D streaming all-in-one driving compact floorstanders.',
      systemChain: {
        names: ['NAD M10 V2', 'DALI Oberon 5'],
        roles: ['All-in-One Streamer Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A 100-watt Class-D streaming all-in-one with onboard Dirac Live correction.',
        'A 2.5-way compact floorstanding loudspeaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The NAD M10 V2 combines source access and amplification in a single chassis, driving the DALI Oberon 5.',
    );
    // Negative: pre-fix prose
    expect(html).not.toContain(
      'The NAD M10 V2 establishes the character of the signal feeding the DALI Oberon 5',
    );
  });

  it('Naim Uniti Atom → Q Acoustics 3030i: all-in-one classification', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B9 Naim Atom',
      systemSignature: 'sig',
      systemChain: {
        names: ['Naim Uniti Atom HE', 'Q Acoustics 3030i'],
        roles: ['All-in-One Streamer Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An all-in-one streamer / DAC / amplifier.',
        'A 2-way affordable bookshelf speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Naim Uniti Atom HE combines source access and amplification in a single chassis, driving the Q Acoustics 3030i.',
    );
    expect(html).not.toContain(
      'The Naim Uniti Atom HE establishes the character of the signal',
    );
  });

  it('Streaming Integrated Amplifier (Lyngdorf-style) classified as amplifier', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B9 streaming integrated',
      systemSignature: 'sig',
      systemChain: {
        names: ['Lyngdorf TDAI-1120', 'Some Passive Floorstander'],
        roles: ['Streaming Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A 60-watt Class-D streaming integrated amplifier with RoomPerfect DSP.',
        'A 2-way passive floorstanding speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Lyngdorf TDAI-1120 combines source access and amplification in a single chassis',
    );
  });

  it('Bluesound Node (bare streamer) still classified as source', () => {
    // Regression guard — B9 reorder must NOT misclassify pure
    // streamers as amplifiers. The Bluesound Node has no
    // amp/integrated/receiver token in its role string.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B9 streamer regression',
      systemSignature: 'sig',
      systemChain: {
        names: ['Bluesound Node', 'Hegel H120', 'Wharfedale Linton Heritage'],
        roles: ['Streamer', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A network streamer with DAC.',
        'A 75-watt Class-AB integrated amplifier.',
        'A 3-way heritage standmount.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Bluesound Node establishes the character of the signal feeding the Hegel H120.',
    );
    // The Hegel is a regular integrated, not an all-in-one
    expect(html).toContain(
      'The Hegel H120 carries the signal between the Bluesound Node and the Wharfedale Linton Heritage',
    );
  });

  it('Phase K Pontus II / Leben / DeVore — DAC and integrated unchanged', () => {
    // Regression guard — locked reference must render exactly as
    // before; "DAC" → source, "Integrated Amplifier" → amplifier, no
    // all-in-one classification.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'Phase K regression',
      systemSignature: 'A warm tube-led source-first chain.',
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle loudspeaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Denafrips Pontus II establishes the character of the signal feeding the Leben CS600X',
    );
    expect(html).toContain(
      'The Leben CS600X carries the signal between the Denafrips Pontus II and the DeVore O/96',
    );
    expect(html).not.toContain(
      'The Denafrips Pontus II combines source access and amplification',
    );
    expect(html).not.toContain(
      'The Leben CS600X combines source access and amplification',
    );
  });

  it('Plain "Integrated Amplifier" still uses regular amp prose (not all-in-one)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'B9 plain integrated',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Integrated', 'Some Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: ['A DAC.', 'An integrated.', 'A speaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Some Integrated carries the signal between the Some DAC and the Some Speakers',
    );
    expect(html).not.toContain('combines source access and amplification');
  });
});

// ════════════════════════════════════════════════════════════════════════
// Hardening Phase C — composer coverage + source depth
// ════════════════════════════════════════════════════════════════════════
//
//   - Source-card depth: role-based 2nd sentence when no DAC topology
//     fact is present (streamer, network, CD/SACD, turntable, phono).
//     New topology anchors: FPGA, Ring DAC.
//   - Active speaker / powered speaker / studio monitor: dedicated
//     §5 ledes that recognize integrated amplification + driver
//     control.
//   - Subwoofer: dedicated §5 lede framing low-frequency extension +
//     integration. Does NOT use passive-speaker prose. Does NOT
//     trigger destination protection in §10.
//   - Plural verb agreement on monoblock pairs and explicit
//     multiplier suffixes.

describe('SystemAssessmentArtifact — Hardening C: source-card depth', () => {
  it('streamer-only source (no DAC) gets the pure-streamer second sentence', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C streamer',
      systemSignature: 'sig',
      systemChain: {
        names: ['Aurender N20', 'Pass Labs XA25', 'Some Speakers'],
        roles: ['Streamer', 'Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A reference network streamer.',
        'A 25-watt Class-A stereo amplifier.',
        'A 2-way bookshelf speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'Its job is less to impose a voice than to provide stable, low-noise source delivery into the downstream electronics',
    );
  });

  it('Streamer/DAC role gets combined-stage second sentence', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C streamer/dac',
      systemSignature: 'sig',
      systemChain: {
        names: ['Lumin P1', 'Pass Labs INT-60', 'Some Speakers'],
        roles: ['Streamer/DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A reference network streamer/DAC.',
        'A 60-watt Class-AB integrated amplifier.',
        'A 2-way bookshelf speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'Its role is to deliver clean source signal and stable conversion into the rest of the system',
    );
  });

  it('Turntable + Phono Preamp chain gets analog-specific second sentences', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C vinyl',
      systemSignature: 'sig',
      systemChain: {
        names: ['Rega Planar 6', 'Rega Aria Mk3', 'Rega Brio', 'KEF LS50 Meta'],
        roles: ['Turntable', 'Phono Preamplifier', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A high-mass plinth turntable.',
        'A moving-magnet/moving-coil phono stage.',
        'A 50-watt integrated.',
        'A 2-way bookshelf.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain('Its analog front end sets the system');
    expect(html).toContain('rhythmic and tonal foundation before amplification takes over');
    expect(html).toContain(
      'Its phono-stage gain and equalization shape the analog signal before it enters the main signal path',
    );
  });

  it('CD transport role gets timing-stability second sentence', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C cd',
      systemSignature: 'sig',
      systemChain: {
        names: ['Cambridge CXC', 'Some Amp', 'Some Speakers'],
        roles: ['CD Transport', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: ['A CD transport.', 'An amp.', 'A speaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'Its mechanical and electronic stability set the timing precision the rest of the system inherits',
    );
  });

  it('Ring DAC topology gets dCS-specific second sentence', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C ring dac',
      systemSignature: 'sig',
      systemChain: {
        names: ['dCS Bartók', 'Some Amp', 'Some Speakers'],
        roles: ['DAC', 'Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A discrete DAC with Ring DAC topology.',
        'An amp.',
        'A speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'Its Ring DAC architecture prioritizes timing precision and quietness',
    );
  });

  it('FPGA topology gets FPGA-specific second sentence', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C fpga',
      systemSignature: 'sig',
      systemChain: {
        names: ['Chord Hugo TT2', 'Some Amp', 'Some Speakers'],
        roles: ['DAC', 'Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A reference DAC with FPGA-driven conversion.',
        'An amp.',
        'A speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'Its FPGA-based conversion prioritizes timing precision, transient clarity, and spatial focus',
    );
  });

  it('Pure streamer regression — Bluesound Node still classified as source (not all-in-one)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C streamer regression',
      systemSignature: 'sig',
      systemChain: {
        names: ['Bluesound Node', 'Hegel H120', 'Some Speakers'],
        roles: ['Streamer', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A network streamer with DAC.',
        'A 75-watt integrated amplifier.',
        'A speaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    // Source lede + pure-streamer second sentence
    expect(html).toContain(
      'The Bluesound Node establishes the character of the signal feeding the Hegel H120',
    );
    expect(html).toContain(
      'Its job is less to impose a voice than to provide stable, low-noise source delivery',
    );
    // Negative — must NOT classify as all-in-one
    expect(html).not.toContain(
      'The Bluesound Node combines source access and amplification',
    );
  });

  it('Unknown source role with no topology fact stays conservative (no invented facts)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C unknown source',
      systemSignature: 'sig',
      systemChain: {
        names: ['Unknown Source', 'Some Amp', 'Some Speakers'],
        roles: ['Source', 'Amp', 'Speakers'],
      },
      componentReadings: ['Some prose.', 'An amp.', 'A speaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    // No second sentence (no topology fact, no specific role match)
    expect(html).toContain(
      'The Unknown Source establishes the character of the signal feeding the Some Amp',
    );
    expect(html).not.toContain('FPGA-based conversion');
    expect(html).not.toContain('analog front end');
  });
});

describe('SystemAssessmentArtifact — Hardening C: active / powered / studio monitor branches', () => {
  it('Powered Speaker (KEF LS60 Wireless) emits active-speaker lede', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C active KEF',
      systemSignature: 'sig',
      systemChain: {
        names: ['RME ADI-2', 'KEF LS60 Wireless'],
        roles: ['DAC', 'Powered Speaker'],
      },
      componentReadings: ['A DAC.', 'A 3-way active loudspeaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The KEF LS60 Wireless integrates amplification, driver alignment, and room-facing output in the loudspeaker itself, so the RME ADI-2 is feeding a complete playback system rather than a passive load.',
    );
    expect(html).not.toContain(
      'The KEF LS60 Wireless translates what the RME ADI-2 delivers into sound in the room',
    );
  });

  it('Active Studio Monitor (Genelec) emits studio-monitor lede', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C studio monitor',
      systemSignature: 'sig',
      systemChain: {
        names: ['Auralic Aries G2.1', 'Genelec 8351B'],
        roles: ['Streamer', 'Active Studio Monitor'],
      },
      componentReadings: [
        'A streamer.',
        'A 3-way coaxial active studio monitor with built-in 250W amplification.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Genelec 8351B functions as an active studio monitor: amplification, driver control, and cabinet behavior are handled inside the speaker rather than delegated to an external amplifier.',
    );
  });

  it('Active 3-way role (no "speaker" word) still routes through active branch', () => {
    // Role "Active 3-way" matches roleFamily speaker via the new
    // n-way pattern and matches isActiveSpeaker via "active 3-way".
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C active 3-way',
      systemSignature: 'sig',
      systemChain: {
        names: ['miniDSP SHD', 'Hypex NCore', 'Custom 3-way Active'],
        roles: ['DSP/DAC/Streamer', 'Class-D Amplifier', 'Active 3-way'],
      },
      componentReadings: [
        'A DSP streamer.',
        'A Class-D amp module.',
        'A custom-built active 3-way loudspeaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Custom 3-way Active integrates amplification, driver alignment, and room-facing output in the loudspeaker itself',
    );
    expect(html).not.toContain('sits inside this system as the active 3-way');
  });

  it('Passive speaker (Phase K DeVore O/96) unchanged — does NOT use active-speaker prose', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C passive speaker regression',
      systemSignature: 'A warm tube-led chain.',
      systemChain: {
        names: ['Denafrips Pontus II', 'Leben CS600X', 'DeVore O/96'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: [
        'An R2R DAC.',
        'A push-pull tube integrated.',
        'A high-efficiency wide-baffle loudspeaker.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    // Existing high-eff passive prose still fires. HTML escapes the
    // possessive apostrophe; assert via partial substrings.
    expect(html).toContain('The DeVore O/96');
    expect(html).toContain('high-efficiency design pairs naturally with the Leben CS600X');
    expect(html).toContain('tube drive');
    expect(html).not.toContain('integrates amplification, driver alignment');
  });
});

describe('SystemAssessmentArtifact — Hardening C: subwoofer branch', () => {
  it('REL subwoofer emits low-frequency-extension lede + integration sentence', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C REL sub',
      systemSignature: 'sig',
      systemChain: {
        names: ['Hegel H120', 'Spendor A4', 'REL T/9x'],
        roles: ['Integrated Amplifier', 'Speakers', 'Subwoofer'],
      },
      componentReadings: [
        'A 75-watt integrated amplifier.',
        'A 2.5-way floorstander.',
        'A 10-inch sealed-cabinet subwoofer.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    // Note: HTML escapes apostrophes (`'` → `&#x27;`), so assert via
    // partial substrings that avoid the apostrophe.
    expect(html).toContain('The REL T/9x extends the system');
    expect(html).toContain('low-frequency foundation rather than carrying the full musical picture');
    expect(html).toContain(
      'Its value depends on integration with the main speakers and the room, not simply on output.',
    );
  });

  it('Subwoofer does NOT use passive-speaker "translates...into sound in the room" prose', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C sub no passive prose',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some Amp', 'Some Speakers', 'REL S/812 (×2)'],
        roles: ['Amp', 'Speakers', 'Subwoofers'],
      },
      componentReadings: ['An amp.', 'A speaker.', 'Twin subs.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain(
      'The REL S/812 (×2) translates what the Some Speakers',
    );
    expect(html).not.toContain('REL S/812 (×2) translates what');
  });

  it('Subwoofer does NOT trigger destination-speaker protection in §10', () => {
    // Subwoofer with no-engine §10 — destination protection must not
    // name the subwoofer. The chain's main speakers may still trigger
    // protection independently if they qualify.
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C sub no destination',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Some Amp', 'Some Bookshelf', 'REL T/9x'],
        roles: ['DAC', 'Amp', 'Speakers', 'Subwoofer'],
      },
      componentReadings: [
        'A DAC.',
        'An amp.',
        'A bookshelf.',
        'A 10-inch subwoofer.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).not.toContain(
      'The REL T/9x is a destination-class loudspeaker',
    );
  });
});

describe('SystemAssessmentArtifact — Hardening C: plural verb agreement', () => {
  it('Audio Research Ref 160M monoblocks — speaker relative clause uses "deliver" (plural)', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C plural Ref 160M',
      systemSignature: 'sig',
      systemChain: {
        names: ['dCS Vivaldi APEX DAC', 'Audio Research Ref 160M monoblocks', 'Wilson Sasha DAW'],
        roles: ['DAC', 'Monoblock Power Amplifier', 'Speakers'],
      },
      componentReadings: [
        'A reference DAC.',
        'A 140-watt KT150 tube monoblock amplifier with auto-bias.',
        'A 3-way reference floorstander.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    // Plural verb in the speaker's relative clause
    expect(html).toContain(
      'The Wilson Sasha DAW translates what the Audio Research Ref 160M monoblocks deliver into sound in the room',
    );
    // Negative — the pre-fix bug
    expect(html).not.toContain(
      'Audio Research Ref 160M monoblocks delivers into sound in the room',
    );
  });

  it('Bricasti M28 monoblocks (2x) — amp lede uses "carry" + speaker relative clause uses "deliver"', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C plural Bricasti',
      systemSignature: 'sig',
      systemChain: {
        names: ['Bricasti M5', 'Bricasti M3', 'Bricasti M28 monoblocks (2x)', 'Wilson Sabrina X'],
        roles: ['Network Renderer', 'DAC', 'Monoblock Power Amplifiers', 'Speakers'],
      },
      componentReadings: [
        'A renderer.',
        'A reference DAC.',
        'A solid-state Class-A monoblock amplifier.',
        'A floorstander.',
      ],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Bricasti M28 monoblocks (2x) carry the signal between the Bricasti M3 and the Wilson Sabrina X',
    );
    expect(html).toContain(
      'The Wilson Sabrina X translates what the Bricasti M28 monoblocks (2x) deliver into sound in the room',
    );
    // Negative — pre-fix bugs
    expect(html).not.toContain('monoblocks (2x) carries the signal');
    expect(html).not.toContain('monoblocks (2x) delivers into sound');
  });

  it('Singular amplifier unchanged — uses "carries" / "delivers"', () => {
    const a: AdvisoryResponse = {
      kind: 'assessment',
      subject: 'C singular regression',
      systemSignature: 'sig',
      systemChain: {
        names: ['Some DAC', 'Pass Labs INT-60', 'Some Speakers'],
        roles: ['DAC', 'Integrated Amplifier', 'Speakers'],
      },
      componentReadings: ['A DAC.', 'A 60-watt Class-AB integrated.', 'A speaker.'],
    } as AdvisoryResponse;
    const html = render(a);
    expect(html).toContain(
      'The Pass Labs INT-60 carries the signal between the Some DAC and the Some Speakers',
    );
    expect(html).toContain(
      'The Some Speakers translates what the Pass Labs INT-60 delivers into sound in the room',
    );
  });
});
