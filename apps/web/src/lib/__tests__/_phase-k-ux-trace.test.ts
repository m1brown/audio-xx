/**
 * Phase K — UX reality trace.
 *
 * Calls the actual advisory builders used by page.tsx for each of the 5
 * Phase K turns and PRINTS the user-visible text so we can eyeball tone,
 * diagnostic posture, and phantom leak at the copy level (not just at
 * state level).
 *
 * This is a trace — its assertions only enforce invariants; the real
 * signal is the console output.
 */

import { describe, it, expect } from 'vitest';
import { buildTurnContext } from '../turn-context';
import { evaluateText } from '../engine';
import { extractSubjectMatches } from '../intent';
import { detectShoppingIntent, buildShoppingAnswer, extractPriorityCategory } from '../shopping-intent';
import { buildSystemAssessment, buildSystemDiagnosis } from '../consultation';
import type { AudioSessionState, SavedSystem } from '../system-types';

const PHANTOM_SAVED_SYSTEM: SavedSystem = {
  id: 'saved-1',
  name: 'My System',
  components: [
    { id: 'c1', componentId: 'p1', name: 'WLM Diva Monitor', brand: 'WLM', category: 'speaker', role: null, notes: null },
    { id: 'c2', componentId: 'p2', name: 'JOB Integrated', brand: 'JOB', category: 'integrated', role: null, notes: null },
    { id: 'c3', componentId: 'p3', name: 'Chord Hugo', brand: 'Chord', category: 'dac', role: null, notes: null },
  ],
  tendencies: null, notes: null, location: null, room: null, primaryUse: null,
};

const PHANTOM_RE = /\b(wlm|diva|job|chord|hugo)\b/i;
const DISMISSIVE_RE = /does\s+not\s+strongly\s+activate|doesn't\s+strongly\s+activate/i;

function freshState(): AudioSessionState {
  return {
    activeSystemRef: { kind: 'saved', id: 'saved-1' },
    savedSystems: [PHANTOM_SAVED_SYSTEM],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };
}

function visible(obj: unknown): string {
  return JSON.stringify(obj ?? {}, null, 2);
}

describe('Phase K UX trace — visible copy per turn', () => {
  const state = freshState();

  function turn(text: string, label: string) {
    console.log(`\n──────── ${label} ────────`);
    console.log(`USER: "${text}"`);

    const ctx = buildTurnContext(text, state, new Set());

    // Mirror page.tsx: persist inline proposedSystem, clear saved ref.
    if (ctx.proposedSystem && ctx.proposedSystem.components.length >= 2) {
      state.proposedSystem = ctx.proposedSystem;
      state.activeSystemRef = null;
    }

    console.log(`  systemSource: ${ctx.systemSource}`);
    console.log(`  activeSystem.components:`,
      ctx.activeSystem?.components.map((c) => `${c.brand}/${c.category}`) ?? '(none)');

    const { signals, result } = evaluateText(text);
    console.log(`  symptoms:`, signals.symptoms);
    console.log(`  fired_rules:`, result.fired_rules.map((r) => r.id));

    // Print actual rule copy the user would see
    for (const r of result.fired_rules) {
      const exp = r.outputs.explanation?.trim();
      const sug = r.outputs.suggestions;
      const next = r.outputs.next_step?.trim();
      const verdict = r.outputs.verdict;
      if (exp) console.log(`  [rule ${r.id}] explanation: ${exp}`);
      if (sug) console.log(`  [rule ${r.id}] suggestions:`, sug);
      if (next) console.log(`  [rule ${r.id}] next_step: ${next}`);
      if (verdict) console.log(`  [rule ${r.id}] verdict: ${verdict}`);
    }
    return ctx;
  }

  it('T1 — "i have a sonos and an iphone" → system assessment copy', () => {
    const text = 'i have a sonos and an iphone';
    const ctx = turn(text, 'Turn 1');
    const subjects = extractSubjectMatches(text);
    const assessment = buildSystemAssessment(text, subjects, ctx.activeSystem, ctx.desires);
    console.log('  assessment.introSummary:', assessment.introSummary);
    console.log('  assessment.systemInteraction:', assessment.systemInteraction);
    console.log('  assessment.upgradeDirection:', assessment.upgradeDirection);

    const blob = visible(assessment);
    expect(PHANTOM_RE.test(blob)).toBe(false);
    expect(DISMISSIVE_RE.test(blob)).toBe(false);
  });

  it('T2 — "my stereo doesn\'t have a lot of bass" → diagnosis copy', () => {
    const text = "my stereo doesn't have a lot of bass";
    const ctx = turn(text, 'Turn 2');
    const subjects = extractSubjectMatches(text);
    const diag = buildSystemDiagnosis(text, subjects);
    console.log('  diagnosis:', diag
      ? {
        subject: diag.subject,
        philosophy: diag.philosophy,
        tendencies: diag.tendencies,
        systemContext: diag.systemContext,
      }
      : '(null)');

    const blob = visible({ ctx: ctx.activeSystem, diag });
    expect(PHANTOM_RE.test(blob)).toBe(false);
    expect(DISMISSIVE_RE.test(blob)).toBe(false);
  });

  it('T3 — "it sounds tiny" → scale / thinness copy', () => {
    const text = 'it sounds tiny';
    const ctx = turn(text, 'Turn 3');
    const subjects = extractSubjectMatches(text);
    const diag = buildSystemDiagnosis(text, subjects);
    console.log('  diagnosis:', diag ? {
      subject: diag.subject,
      philosophy: diag.philosophy,
      tendencies: diag.tendencies,
    } : '(null)');

    const blob = visible({ ctx: ctx.activeSystem, diag });
    expect(PHANTOM_RE.test(blob)).toBe(false);
    expect(DISMISSIVE_RE.test(blob)).toBe(false);
  });

  it('T4 — "it is noisy" → electrical noise diagnostic copy', () => {
    const text = 'it is noisy';
    const ctx = turn(text, 'Turn 4');
    const { signals, result } = evaluateText(text);
    expect(signals.symptoms).toContain('electrical_noise');
    const noiseRule = result.fired_rules.find((r) => r.id === 'electrical-noise-diagnostic');
    expect(noiseRule).toBeDefined();
    // Verdict must be diagnostic, not buy
    expect(['wait_recommended', 'no_purchase_recommended', 'revert_recommended'])
      .toContain(noiseRule!.outputs.verdict);

    const blob = visible({ ctx: ctx.activeSystem, rules: result.fired_rules });
    expect(PHANTOM_RE.test(blob)).toBe(false);
    expect(DISMISSIVE_RE.test(blob)).toBe(false);
  });

  it('T5 — "recommend a turntable" → shopping copy locked to turntable', () => {
    const text = 'recommend a turntable';
    const ctx = turn(text, 'Turn 5');
    const { signals } = evaluateText(text);
    const priority = extractPriorityCategory(text);
    const shoppingCtx = detectShoppingIntent(text, signals, undefined, 'turntable');
    const answer = buildShoppingAnswer(shoppingCtx, signals);
    console.log('  priority.category:', priority?.category);
    console.log('  answer.category:', answer.category);
    console.log('  answer.intro:', answer.intro);
    console.log('  answer.productExamples:', (answer.productExamples ?? []).map(
      (p) => `${(p as { brand?: string }).brand ?? ''} ${(p as { name?: string }).name ?? ''}`.trim(),
    ));

    expect(priority?.category).toBe('turntable');
    expect(shoppingCtx.category).toBe('turntable');

    const blob = visible({ ctx: ctx.activeSystem, answer });
    expect(PHANTOM_RE.test(blob)).toBe(false);
    expect(DISMISSIVE_RE.test(blob)).toBe(false);
  });
});
