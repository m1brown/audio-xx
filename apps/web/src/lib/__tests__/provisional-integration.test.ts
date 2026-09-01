import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { inferProvisionalSystemAssessment } from '../llm-system-inference';

/**
 * The integration boundary between `inferProvisionalSystemAssessment` and
 * `parseSystemInferenceResponse`.
 *
 * This boundary was untested. 4,909 unit tests exercised the licensing
 * functions directly — validation, scope, question typing, provenance — and
 * every one of them passed while production published this:
 *
 *   philosophy: "{ \"verdict\": \"...\", \"attributes\": [...], ... }"
 *   actionVerdict: undefined
 *
 * A `ReferenceError` inside the parser (a variable read from the caller's
 * scope) was caught by the parser's own `catch`, logged as "Failed to parse
 * JSON", and degraded to the raw-text fallback. The listener got the entire
 * JSON object as prose with no verdict. It shipped and survived four replays.
 *
 * The failure class is not "one typo". It is: ANY runtime error inside the
 * parser is indistinguishable from malformed model output, and the fallback
 * hides it. That is the same shape as `lookup_unknown` collapsing into
 * `uncorroborated` — a broad catch labelled with one cause concealing another.
 *
 * Deliberately one file and one shape. This is not a QA framework; it is the
 * assertion that a well-formed response produces a STRUCTURED assessment, and
 * that the raw-text fallback is reached only when the content genuinely is not
 * JSON.
 */

const COMPONENTS = ['dCS Rossini Apex', 'ARC ref 5', 'Butler Monads', 'Acora QRC-2'];
const KNOWN = [{ name: 'dCS Rossini Apex',
  character: 'dCS components are described as transparent and spatially precise.',
  source: 'brand' as const }];
const ROLES = [
  { name: 'dCS Rossini Apex', role: 'dac' },
  { name: 'ARC ref 5', role: 'preamplifier' },
  { name: 'Butler Monads', role: 'amplifier' },
  { name: 'Acora QRC-2', role: 'speaker' },
];
const CORROBORATED = ['ARC ref 5', 'Butler Monads', 'Acora QRC-2'];

/** A well-formed response of the shape the contract asks for. */
const WELL_FORMED = {
  verdict: 'The system is coherent, favouring resolution over warmth.',
  systemThesis: 'A resolution-first chain.',
  attributes: [
    { component: 'dCS Rossini Apex', axis: 'warm_bright', value: 'cool' },
    { component: 'ARC ref 5', axis: 'warm_bright', value: 'warm' },
  ],
  relationStatus: 'established',
  relations: [
    { components: ['dCS Rossini Apex', 'ARC ref 5'], axis: 'warm_bright',
      kind: 'counterweight', premises: [0, 1] },
  ],
  interactionExplanation:
    'dCS designs are typically cool, which the ARC ref 5 counterbalances with a warmer character.',
  tradeoff: 'Clarity is gained; some harmonic weight is given up.',
  actionVerdict: 'no_change',
  action: 'Nothing here obviously needs changing.',
  nextQuestion: 'What, if anything, are you dissatisfied with in the system as it stands?',
  characterized: COMPONENTS,
  componentKnowledge: COMPONENTS.map((name) => ({ name, specific: true })),
};

function mockOverlay(payload: unknown, finishReason: string | null = 'stop') {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({
      content: typeof payload === 'string' ? payload : JSON.stringify(payload),
      finishReason,
      completionTokens: 700,
    }),
  }));
}

const infer = () => inferProvisionalSystemAssessment(
  'Assess my system', COMPONENTS, KNOWN, ROLES, CORROBORATED, []);

beforeEach(() => { vi.restoreAllMocks(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('a well-formed response produces a STRUCTURED assessment', () => {
  it('returns the structured fields, not the raw-text fallback', async () => {
    vi.stubGlobal('fetch', mockOverlay(WELL_FORMED));
    const r = await infer() as Record<string, unknown>;

    expect(r).not.toBeNull();
    // The verdict is the field that vanished. Its absence WAS the defect.
    expect(r.actionVerdict).toBe('no_change');
    expect(typeof r.systemSignature).toBe('string');
    expect(r.systemSignature).toBeTruthy();
  });

  it('never publishes the JSON object as prose', async () => {
    // The exact production symptom: philosophy carrying the whole payload.
    vi.stubGlobal('fetch', mockOverlay(WELL_FORMED));
    const r = await infer() as Record<string, string | undefined>;
    const prose = [r.systemSignature, r.philosophy, r.tendencies].filter(Boolean).join('\n');

    expect(prose).not.toContain('"attributes"');
    expect(prose).not.toContain('"relationStatus"');
    expect(prose).not.toContain('actionVerdict');
    expect(prose.trim().startsWith('{')).toBe(false);
  });

  it('carries the licensing output through the boundary', async () => {
    // Provenance and relations are computed on one side and consumed on the
    // other. If the boundary breaks, both arrive empty rather than wrong.
    vi.stubGlobal('fetch', mockOverlay(WELL_FORMED));
    const r = await infer() as Record<string, unknown>;

    expect(Array.isArray(r.componentProvenance)).toBe(true);
    expect((r.componentProvenance as unknown[]).length).toBe(COMPONENTS.length);
    expect(Array.isArray(r.systemRelations)).toBe(true);
    expect((r.systemRelations as unknown[]).length).toBe(1);
  });

  it('applies the licensing passes rather than passing prose through raw', async () => {
    // If the parser silently failed, none of the guards would have run.
    vi.stubGlobal('fetch', mockOverlay({
      ...WELL_FORMED,
      verdict: 'The system is deliberately voiced for resolution.',   // intent claim
    }));
    const r = await infer() as Record<string, string | undefined>;
    expect(r.systemSignature).not.toMatch(/deliberately voiced/i);
  });
});

describe('the fallback is reached only when the content is genuinely not JSON', () => {
  it('degrades to prose for actual non-JSON', async () => {
    vi.stubGlobal('fetch', mockOverlay('This is a plain prose answer with no JSON at all, '
      + 'long enough to exceed the fallback threshold and be treated as readable text.'));
    const r = await infer() as Record<string, string | undefined>;
    expect(r?.philosophy).toContain('plain prose answer');
  });

  it('declines an incomplete generation rather than salvaging it', async () => {
    // Truncation is not a parse problem: a partial object is a partial
    // ASSESSMENT, with premises cut off.
    vi.stubGlobal('fetch', mockOverlay(WELL_FORMED, 'length'));
    expect(await infer()).toBeNull();
  });
});
