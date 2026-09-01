/**
 * GATE C — Assessment Artifact structural contract (Stabilization Gate 1).
 *
 * The Assessment is a contractual product artifact. Every completed Assessment
 * must contain: resolved system · component imagery slots · hero verdict ·
 * tonal summary · THREE-AXIS Tonal Signature graph · Recognition ·
 * Recommendation · Engineering · provenance statement · Primary Sources (when
 * applicable) · no empty sections · no duplicated sections.
 *
 * Root cause pinned here (production regression): tonal axes travelled ONLY in
 * `raw.findings.systemAxes`; surfaces that render from the payload alone (chat
 * embed, saved snapshots) produced a CAM with `tonalSignature: undefined` and
 * the renderer's `sig &&` guard silently dropped the entire graph. The fix
 * carries `systemAxes` in the payload; these tests pin the graph on EVERY
 * entry mode so no call-site change can silently drop it again.
 */
import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';

// FollowUp (a child of the artifact) calls Next's useRouter; static render has
// no app-router context, so provide an inert one. Contract assertions never
// touch navigation.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, prefetch: () => {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/artifact',
}));
// The follow-up affordance is not part of the assessment contract (it is
// explicitly "not part of the assessment" in the product) — stub it out so the
// static render exercises only the artifact itself.
vi.mock('../FollowUp', () => ({ default: () => null }));
import { renderToStaticMarkup } from 'react-dom/server';
import AssessmentArtifact from '../AssessmentArtifact';
import { extractSubjectMatches, detectIntent } from '@/lib/intent';
import { buildSystemAssessment } from '@/lib/consultation';
import { synthesizeArtifact } from '@/lib/artifact/synthesizeArtifact';
import { toCanonicalAssessment, EVIDENCE_STATEMENT } from '@/lib/artifact/canonical';
import type { ArtifactPayload } from '@/lib/artifact/types';

const FRANCE = 'Assess my system: Eversolo DMP-A6, Chord Hugo, JOB Integrated, WLM Diva Monitor';

function franceRaw(): any {
  const subs = extractSubjectMatches(FRANCE);
  const { desires } = detectIntent(FRANCE);
  return buildSystemAssessment(FRANCE, subs, null, desires);
}

const raw = franceRaw();
const { payload } = synthesizeArtifact(raw) as { payload: ArtifactPayload };

/** The three production entry modes for the shared renderer. */
const ENTRY_MODES: Array<{ name: string; html: string }> = [
  {
    // /artifact (public): prebuilt canonical
    name: 'public (canonical)',
    html: renderToStaticMarkup(
      createElement(AssessmentArtifact, { canonical: toCanonicalAssessment(payload, raw) }),
    ),
  },
  {
    // chat embed: payload + raw (AdvisoryMessage now passes raw)
    name: 'chat embed (p + raw, embedded)',
    html: renderToStaticMarkup(
      createElement(AssessmentArtifact, { p: payload, raw, embedded: true }),
    ),
  },
  {
    // saved snapshot: payload ONLY — the mode that regressed in production.
    // The payload now carries systemAxes, so the graph must still render.
    name: 'saved snapshot (payload only)',
    html: renderToStaticMarkup(createElement(AssessmentArtifact, { p: payload })),
  },
];

const countMatches = (html: string, re: RegExp) => (html.match(re) ?? []).length;

describe('GATE C — three-axis Tonal Signature graph', () => {
  it('payload carries the tonal axes (regression: axes travelled only in raw)', () => {
    expect(payload.systemAxes).toBeDefined();
    expect(Object.keys(payload.systemAxes as object).length).toBeGreaterThan(0);
  });

  it('payload carries the numeric axis averages (tonal-signature unification)', () => {
    // The graph plots the same role-weighted numeric averages the signature
    // prose reads. They must survive payload-only surfaces exactly like the
    // categorical axes (same regression class as above).
    expect(payload.systemAxisNumeric).toBeDefined();
    for (const key of ['warm_bright', 'smooth_detailed', 'elastic_controlled']) {
      expect(typeof (payload.systemAxisNumeric as Record<string, number>)[key]).toBe('number');
    }
  });

  for (const mode of ENTRY_MODES) {
    it(`graph exists with exactly three axes — ${mode.name}`, () => {
      expect(mode.html).toContain('axa-sig');
      expect(mode.html).toContain('Tonal signature');
      expect(countMatches(mode.html, /class="axa-axis"/g)).toBe(3);
      expect(countMatches(mode.html, /class="axa-track"/g)).toBe(3);
    });

    it(`no fourth axis — airy/closed never plotted — ${mode.name}`, () => {
      expect(mode.html).not.toMatch(/>Airy</);
      expect(mode.html).not.toMatch(/>Closed</);
    });

    it(`graph values correspond to assessment data — ${mode.name}`, () => {
      // Tonal-signature unification: the graph plots the role-weighted
      // numeric averages (continuous position 50 + clamp(n, ±1.5) × 24),
      // the SAME values the signature prose reads. Legacy payloads without
      // numeric fall back to the original categorical 24/50/78 mapping.
      const numeric: Record<string, number> | undefined =
        raw?.findings?.systemAxisNumeric ?? payload.systemAxisNumeric;
      const axes: Record<string, string> = raw?.findings?.systemAxes ?? {};
      const AXIS_SPEC = [
        { key: 'warm_bright', leftPole: 'warm' },
        { key: 'smooth_detailed', leftPole: 'smooth' },
        { key: 'elastic_controlled', leftPole: 'elastic' },
      ];
      for (const spec of AXIS_SPEC) {
        let expected: number;
        if (numeric && typeof numeric[spec.key] === 'number') {
          const clamped = Math.max(-1.5, Math.min(1.5, numeric[spec.key]));
          expected = Math.round(50 + clamped * 24);
        } else {
          const v = axes[spec.key];
          expected =
            v === spec.leftPole ? 24
            : v === undefined || v === 'neutral' || v === 'mixed' ? 50
            : 78;
        }
        expect(mode.html).toContain(`left:${expected}%`);
      }
    });
  }
});

describe('GATE C — full artifact contract (every element structurally required)', () => {
  for (const mode of ENTRY_MODES) {
    it(`resolved system + verdict + tonal summary + sections + provenance — ${mode.name}`, () => {
      const html = mode.html;
      // resolved system: every credited component named
      for (const name of payload.componentCredit) expect(html).toContain(name);
      // component imagery slots: photo strip present (photos or placeholder)
      expect(html).toContain('axa-strip');
      // hero verdict + tonal summary (standfirst)
      expect(html).toContain('axa-verdict');
      expect(payload.verdict.length).toBeGreaterThan(0);
      expect(html).toContain('axa-standfirst');
      // named sections
      expect(html).toContain('Recognition');
      expect(html).toContain('Recommendation');
      expect(html).toContain('Engineering');
      // provenance statement
      expect(html).toContain(EVIDENCE_STATEMENT.slice(0, 40));
    });

    it(`no empty sections and no duplicated section labels — ${mode.name}`, () => {
      const html = mode.html;
      // Every rendered .axa-section must carry visible text content.
      const sections = html.split('class="axa-section"').slice(1);
      for (const s of sections) {
        const firstBlock = s.slice(0, 800).replace(/<[^>]+>/g, ' ').trim();
        expect(firstBlock.length).toBeGreaterThan(10);
      }
      // Section labels appear at most once each.
      for (const label of ['>Recognition<', '>Recommendation<', '>Engineering<']) {
        expect(countMatches(html, new RegExp(label, 'g'))).toBeLessThanOrEqual(1);
      }
      // The tonal signature block itself is never duplicated.
      expect(countMatches(html, /Tonal signature/g)).toBe(1);
    });
  }

  it('AXA_CSS never hides the graph at any breakpoint (visible desktop + mobile)', () => {
    // Structural guard for the responsive layer: no rule may set the signature
    // block or its tracks to display:none / visibility:hidden at any width.
    // (True pixel visibility is covered by the Playwright visual baseline.)
    const html = ENTRY_MODES[0].html;
    const cssStart = html.indexOf('<style');
    const css = html.slice(cssStart, html.indexOf('</style>'));
    const hidingRule = /\.axa-(sig|axis|track)[^{}]*\{[^}]*(display\s*:\s*none|visibility\s*:\s*hidden)/;
    expect(hidingRule.test(css)).toBe(false);
  });

  it('print mode keeps the graph (print artifact parity)', () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentArtifact, { p: payload, raw, print: true }),
    );
    expect(html).toContain('axa-sig');
    expect(countMatches(html, /class="axa-axis"/g)).toBe(3);
  });
});
