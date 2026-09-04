import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSystemAssessment } from '../consultation';
import { extractSubjectMatches, detectIntent } from '../intent';
import { TURN_SEPARATOR } from '../labelled-components';
import { composeSystemReviewDetailed } from '../artifact/system-review';
import { synthesiseChain } from '../artifact/sonic-synthesis';

/**
 * COMPOSITION CONVERGENCE — entry path may not change editorial generation.
 *
 * The forensic pass found three artifacts from three entry shapes carrying
 * three different generations of the editorial UI: new synergy prose on one,
 * old prose on another, and a model preamble ("This combination suggests
 * that the dynamic performance is likely well-managed...") above the thesis
 * on the third. Two causes: a deployment flip mid-print-sequence, and a real
 * hole — the model-prose gate in StandardFormat was enumerated block by
 * block, and `systemInteraction` was the next block down a list of thirty.
 *
 * This suite pins STRUCTURE, not prose: every entry shape of the same system
 * must compose the same review skeleton, and the renderer must be incapable
 * of putting model prose above it.
 */

const NATHAN = 'Assess my system: - Dac/Streamer: dCS Rossini Apex. '
  + '- Pre-amp: ARC ref 5. - Amps: Butler Monads. - Speakers: Acora QRC-2.';
const FAIL = NATHAN.replace('Pre-amp:', 'Preamp:');
const INJ = 'My system: dCS Rossini Apex, ARC ref, Butler Monads, Acora QRC-2.';
const saved = [
  { brand: 'dCS', name: 'Rossini Apex', category: 'dac' },
  { brand: 'ARC', name: 'ref', category: 'preamplifier' },
  { brand: 'Butler', name: 'Monads', category: 'amplifier' },
  { brand: 'Acora', name: 'QRC-2', category: 'speaker' },
];

/** Run one entry shape end to end: engine -> canonical composer. */
function composePath(raw: string, withSaved: boolean) {
  const { desires } = detectIntent(raw) as never as { desires: unknown };
  const r = buildSystemAssessment(raw, extractSubjectMatches(raw),
    withSaved ? ({ name: 'Test system', components: saved } as never) : null as never,
    desires as never) as never as {
    kind?: string;
    components?: Array<{ displayName: string; role: string }>;
  };
  expect(r?.components, raw.slice(0, 40)).toHaveLength(4);
  const components = r!.components!.map((c) => ({
    displayName: c.displayName, role: c.role,
  }));
  const detail = composeSystemReviewDetailed({
    components,
    dossiers: [],
    synthesis: synthesiseChain(components),
  });
  return detail;
}

const PATHS: Array<[string, string, boolean]> = [
  ['ordinary signed-out', NATHAN, false],
  ['ordinary signed-in', NATHAN, true],
  ['former Fail string signed-in', FAIL, true],
  ['accumulated saved-turn', `${INJ}${TURN_SEPARATOR}${FAIL}`, true],
];

describe('every entry path composes the same review skeleton', () => {
  const composed = PATHS.map(([label, raw, s]) => [label, composePath(raw, s)] as const);

  it('the verdict leads, and the thesis follows it, on every path', () => {
    /*
     * Superseded pin (expert-system threshold, 2026-09-04): the review now
     * ANSWERS FIRST. The categorical judgment with its confidence is the
     * first sentence a reader meets; the ambition/coherence thesis that used
     * to open the document follows it. Same material, answer-first order.
     */
    for (const [label, d] of composed) {
      expect(d.paragraphs[0], label)
        .toMatch(/^(Excellent|Strong|Promising|Mixed|Uncertain|Poorly) /);
      expect(d.paragraphs.join('\n'), label).toMatch(/This is an exceptionally ambitious/);
    }
  });

  it('at most one epistemic qualification on every path', () => {
    for (const [label, d] of composed) {
      const all = d.paragraphs.join('\n');
      expect((all.match(/[Nn]o reviewer has heard/g) ?? []).length, label)
        .toBeLessThanOrEqual(1);
    }
  });

  it('no path carries the previous generation of synergy prose', () => {
    for (const [label, d] of composed) {
      const all = d.paragraphs.join('\n');
      expect(all, label).not.toMatch(/Same-direction characteristics add rather than cancel/);
      expect(all, label).not.toMatch(/If those descriptions combine/);
      expect(all, label).toMatch(/Reviewers reach for the same vocabulary/);
    }
  });

  it('identical section sequence on every path', () => {
    const sequences = composed.map(([, d]) => (d.sections ?? []).map((x) => x.label).join(' > '));
    for (const seq of sequences) expect(seq).toBe(sequences[0]);
  });
});

describe('sideways differs by evidence, not by generation', () => {
  const sideways = (() => {
    const components = [
      { displayName: 'dCS Rossini Apex', role: 'dac' },
      { displayName: 'leben cs600', role: 'integrated' },
      { displayName: 'devore o/96', role: 'speaker' },
    ];
    return composeSystemReviewDetailed({
      components, dossiers: [], synthesis: synthesiseChain(components),
    });
  })();

  it('uses the same generation of synergy prose', () => {
    const all = sideways.paragraphs.join('\n');
    expect(all).toMatch(/Reviewers reach for the same vocabulary/);
    expect(all).not.toMatch(/Same-direction characteristics add rather than cancel/);
  });

  it('its sections are drawn from the same canonical vocabulary', () => {
    const CANON = new Set([
      'The assessment', 'Why it works', 'Engineering check',
      'What I would do', 'What remains unknown',
    ]);
    for (const sec of sideways.sections ?? []) expect(CANON.has(sec.label), sec.label).toBe(true);
  });

  it('but its content differs where its evidence differs', () => {
    const nathan = composePath(NATHAN, false);
    expect(sideways.paragraphs[0]).not.toBe(nathan.paragraphs[0]);
  });
});

describe('the renderer cannot put model prose above a governed review', () => {
  const src = readFileSync(join(
    __dirname, '..', '..', 'components', 'advisory', 'AdvisoryMessage.tsx'), 'utf8');

  it('StandardFormat returns the governed shell before ANY model prose block', () => {
    const fn = src.slice(src.indexOf('function StandardFormat'));
    const shellAt = fn.indexOf('if (a.systemReview && a.systemReview.length > 0)');
    expect(shellAt).toBeGreaterThan(-1);
    // Every model-prose field must appear only AFTER the early return — the
    // enumerated-gate approach is what let systemInteraction through.
    for (const field of ['systemInteraction', 'componentReadings', 'systemTendencies',
      'sonicLandscape', 'bottomLine', 'upgradeDirection']) {
      const at = fn.indexOf(`a.${field}`);
      if (at !== -1) expect(at, field).toBeGreaterThan(shellAt);
    }
  });
});
