/**
 * A3 Artifact Case overlay (vI Phase 2) — validator + prompt-builder tests.
 *
 * The generator itself calls /api/memo-overlay and is exercised manually /
 * on Preview; these tests pin the deterministic halves: context extraction,
 * prompt grounding, and the validation gate that decides whether an A3
 * draft may replace the deterministic judgment column.
 */
import { describe, it, expect } from 'vitest';
import {
  toArtifactCaseContext,
  buildArtifactCasePrompt,
  validateArtifactCase,
  type ArtifactCaseContext,
} from '../a3-artifact-case';

const CTX: ArtifactCaseContext = {
  componentNames: ['Chord Qutest', 'Naim SuperNait 3', 'Harbeth Super HL5 Plus'],
  systemAxes: {
    warm_bright: 'neutral',
    smooth_detailed: 'detailed',
    elastic_controlled: 'controlled',
    airy_closed: 'neutral',
  },
  isCoherent: false,
  assessmentStrengths: ['Chord Qutest provides strong spatial definition'],
  assessmentLimitations: [],
};

// A structurally valid draft: 3 paragraphs, in-range length, names the
// system's own components, no banned constructions.
const GOOD = [
  'The Chord Qutest sets the pace here: fast leading edges and a clean noise floor arrive at the Naim SuperNait 3 intact, and the amplifier adds drive without softening what it received. The result is a front end that resolves first and relaxes second.',
  'The Harbeth Super HL5 Plus is the counterweight. Where the electronics push speed and separation, the speaker supplies tonal mass — so precision lands as presence rather than edge. The chain works because each stage hands the next one something it can use.',
  'The trade is grip over bloom. This chain damps rather than breathes, and the last word in elasticity goes unclaimed — the deliberate cost of choosing control at every stage.',
].join('\n\n');

describe('toArtifactCaseContext', () => {
  it('extracts a context from a raw assessment shape', () => {
    const raw = {
      findings: {
        componentNames: ['A One', 'B Two'],
        systemAxes: { warm_bright: 'warm' },
        isCoherent: true,
        coherentSharedTraits: ['warmth'],
        perComponentAxes: [{ name: 'A One', axes: { warm_bright: 'warm' }, source: 'catalog' }],
      },
      response: {
        assessmentStrengths: ['A One contributes musical flow'],
        preferenceNote: 'Fits the warmth you asked for',
      },
    };
    const ctx = toArtifactCaseContext(raw);
    expect(ctx).not.toBeNull();
    expect(ctx!.componentNames).toEqual(['A One', 'B Two']);
    expect(ctx!.isCoherent).toBe(true);
    expect(ctx!.coherentSharedTraits).toEqual(['warmth']);
    expect(ctx!.preferenceNote).toBe('Fits the warmth you asked for');
  });

  it('returns null when findings are missing or empty', () => {
    expect(toArtifactCaseContext(null)).toBeNull();
    expect(toArtifactCaseContext({})).toBeNull();
    expect(toArtifactCaseContext({ findings: { componentNames: [] } })).toBeNull();
  });
});

describe('buildArtifactCasePrompt', () => {
  it('grounds the payload in the supplied facts only', () => {
    const { systemPrompt, userPrompt } = buildArtifactCasePrompt(CTX);
    expect(systemPrompt).toContain('AUDIO XX REASONING DOCTRINE');
    expect(systemPrompt).toContain('JUDGMENT COLUMN');
    expect(userPrompt).toContain('Chord Qutest');
    expect(userPrompt).toContain('Harbeth Super HL5 Plus');
  });

  it('forbids recommendation and verdict-declaration in the instructions', () => {
    const { systemPrompt } = buildArtifactCasePrompt(CTX);
    expect(systemPrompt).toMatch(/NO recommendations/i);
    expect(systemPrompt).toMatch(/NEVER declare the verdict/i);
  });
});

describe('validateArtifactCase', () => {
  it('accepts a well-formed draft', () => {
    expect(validateArtifactCase(GOOD, CTX)).toEqual([]);
  });

  it('rejects a recommendation preview (R5)', () => {
    const bad = GOOD.replace(
      'The trade is grip over bloom.',
      "I'd upgrade the amplifier first if you want more bloom.",
    );
    expect(validateArtifactCase(bad, CTX)).toContain('previews-recommendation');
  });

  it('rejects a verdict refrain (R8)', () => {
    const bad = `${GOOD.split('\n\n').slice(0, 2).join('\n\n')}\n\nIt is balanced, and nothing here needs changing.`;
    expect(validateArtifactCase(bad, CTX)).toContain('declares-verdict');
  });

  it('rejects reviewer-register vocabulary', () => {
    const bad = GOOD.replace('tonal mass', 'a lush, velvety midrange');
    const fails = validateArtifactCase(bad, CTX);
    expect(fails).toContain('reviewer-register');
  });

  it('rejects machine register — vote counting and axis labels', () => {
    const counting = GOOD.replace(
      'The Harbeth Super HL5 Plus is the counterweight.',
      'On the ease vs. resolution axis, 2 of the 3 components lean the same way.',
    );
    expect(validateArtifactCase(counting, CTX)).toContain('machine-register');

    const axisLabel = GOOD.replace('tonal mass', 'a smooth_detailed lean');
    expect(validateArtifactCase(axisLabel, CTX)).toContain('machine-register');
  });

  it('rejects fabricated measurements not present in context', () => {
    const bad = GOOD.replace('tonal mass', '87 dB of tonal mass');
    const fails = validateArtifactCase(bad, CTX);
    expect(fails.some((f) => f.startsWith('fabricated-measurement'))).toBe(true);
  });

  it('allows a measurement that appears in the supplied constraint explanation', () => {
    const ctx: ArtifactCaseContext = {
      ...CTX,
      constraintExplanation: 'The amp cannot drive the 86 db speaker cleanly.',
    };
    const ok = GOOD.replace('tonal mass', 'presence even at 86 dB');
    const fails = validateArtifactCase(ok, ctx);
    expect(fails.some((f) => f.startsWith('fabricated-measurement'))).toBe(false);
  });

  it('rejects foreign products not in this system', () => {
    const bad = GOOD.replace('tonal mass', 'the kind of body a Magico never offers');
    expect(validateArtifactCase(bad, CTX)).toContain('names-foreign-product:magico');
  });

  it('rejects a draft that never names a system component', () => {
    const bad = 'The source is fast.\n\nThe speaker is warm.\n\nThe trade is speed over warmth, chosen at every stage of the chain, and it holds together because each part hands the next something it can use without correction or excuse across the whole signal path.';
    expect(validateArtifactCase(bad, CTX)).toContain('system-not-referenced');
  });

  it('rejects wrong paragraph counts', () => {
    const one = GOOD.replace(/\n\n/g, ' ');
    expect(validateArtifactCase(one, CTX).some((f) => f.startsWith('paragraph-count'))).toBe(true);
    const five = `${GOOD}\n\nExtra.\n\nMore extra.`;
    expect(validateArtifactCase(five, CTX).some((f) => f.startsWith('paragraph-count'))).toBe(true);
  });

  it('rejects out-of-range length', () => {
    const short = 'The Chord Qutest is fast.\n\nThe Harbeth Super HL5 Plus is warm.';
    expect(validateArtifactCase(short, CTX).some((f) => f.startsWith('length-out-of-range'))).toBe(true);
  });
});
