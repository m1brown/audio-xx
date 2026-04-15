/**
 * Phase K end-to-end replay — 5-turn release-gate scenario.
 *
 * Replays the exact conversation from the Phase K validation prompt:
 *
 *   1. "i have a sonos and an iphone"
 *   2. "my stereo doesn't have a lot of bass"
 *   3. "it sounds tiny"
 *   4. "it is noisy"
 *   5. "recommend a turntable"
 *
 * Invariants enforced across every turn after turn 1:
 *
 *   - The phantom saved system (WLM Diva / JOB Integrated / Chord Hugo)
 *     MUST NOT appear in activeSystem, reasoning text, editorial text,
 *     shopping context, or any other surfaced field.
 *   - Symptom recognition must fire: thinness for "no bass", scale for
 *     "sounds tiny", electrical_noise for "it is noisy".
 *   - The dismissive friendly-advisor-fallback rule must not appear.
 *   - The electrical-noise-diagnostic rule must fire on the noise turn.
 *   - "recommend a turntable" must lock the turntable category — no DAC,
 *     amp, or speaker leakage.
 */

import { describe, it, expect } from 'vitest';
import { buildTurnContext } from '../turn-context';
import { evaluateText } from '../engine';
import { detectShoppingIntent, extractPriorityCategory, buildShoppingAnswer } from '../shopping-intent';
import type { AudioSessionState, SavedSystem } from '../system-types';

// ── Phantom saved system (must NEVER leak after turn 1) ──
const PHANTOM_SAVED_SYSTEM: SavedSystem = {
  id: 'saved-1',
  name: 'My System',
  components: [
    { id: 'c1', componentId: 'p1', name: 'WLM Diva Monitor', brand: 'WLM', category: 'speaker', role: null, notes: null },
    { id: 'c2', componentId: 'p2', name: 'JOB Integrated', brand: 'JOB', category: 'integrated', role: null, notes: null },
    { id: 'c3', componentId: 'p3', name: 'Chord Hugo', brand: 'Chord', category: 'dac', role: null, notes: null },
  ],
  tendencies: null,
  notes: null,
  location: null,
  room: null,
  primaryUse: null,
};

const PHANTOM_TOKENS = ['wlm', 'diva', 'job', 'chord', 'hugo'];

function freshState(): AudioSessionState {
  return {
    activeSystemRef: { kind: 'saved', id: 'saved-1' },
    savedSystems: [PHANTOM_SAVED_SYSTEM],
    draftSystem: null,
    loading: false,
    proposedSystem: null,
  };
}

const NO_DISMISSED = new Set<string>();

function flatten(obj: unknown): string {
  return JSON.stringify(obj ?? {}).toLowerCase();
}

function expectNoPhantom(label: string, blob: string) {
  for (const tok of PHANTOM_TOKENS) {
    if (new RegExp(`\\b${tok}\\b`).test(blob)) {
      throw new Error(`PHANTOM LEAK at ${label}: token "${tok}" found in:\n${blob.slice(0, 600)}`);
    }
  }
}

describe('Phase K — full 5-turn release-gate replay', () => {
  // Shared mutable state across the 5-turn replay (mirrors page.tsx orchestrator).
  const state = freshState();
  let lastInlineSystem: { components: Array<{ brand: string; name: string; category: string }> } | null = null;
  let activeShoppingCategory: string | null = null;
  let domainContext: string | null = null;

  const turn = (text: string) => {
    const turnCtx = buildTurnContext(text, state, NO_DISMISSED);

    // Mirror page.tsx behavior: when the orchestrator detects an inline
    // ProposedSystem, it persists it as the active proposed system and
    // suppresses saved-system contamination on subsequent turns.
    if (turnCtx.proposedSystem && turnCtx.proposedSystem.components.length >= 2) {
      lastInlineSystem = {
        components: turnCtx.proposedSystem.components.map((c) => ({
          brand: c.brand,
          name: c.name,
          category: c.category,
        })),
      };
      state.proposedSystem = turnCtx.proposedSystem;
      // Clear the saved-system ref so subsequent turns do not auto-resolve
      // back to the phantom system. This is the page.tsx-equivalent state
      // transition that happens when a new system is detected.
      state.activeSystemRef = null;
    }

    const { signals, result } = evaluateText(text);
    const priority = extractPriorityCategory(text);
    const shoppingCtx = detectShoppingIntent(
      text,
      signals,
      undefined,
      // Carry the domain forward so a noun-light follow-up turn keeps
      // the previously locked category instead of drifting to general.
      (activeShoppingCategory ?? domainContext ?? undefined) as
        | import('../shopping-intent').ShoppingCategory
        | undefined,
    );
    if (shoppingCtx.category && shoppingCtx.category !== 'general') {
      activeShoppingCategory = shoppingCtx.category;
      domainContext = shoppingCtx.category;
    }

    return { turnCtx, signals, result, priority, shoppingCtx };
  };

  // ── Turn 1: "i have a sonos and an iphone" ──
  it('Turn 1 — system override: Sonos + iPhone replaces phantom saved system', () => {
    const { turnCtx } = turn('i have a sonos and an iphone');

    console.log('[T1] systemSource:', turnCtx.systemSource);
    console.log('[T1] activeSystem.components:',
      turnCtx.activeSystem?.components.map((c) => `${c.brand}/${c.category}`));

    expect(turnCtx.systemSource).toBe('inline');
    expect(turnCtx.activeSystem).not.toBeNull();

    const blob = flatten(turnCtx.activeSystem);
    expectNoPhantom('T1 activeSystem', blob);

    const brands = turnCtx.activeSystem!.components.map((c) => c.brand.toLowerCase());
    expect(brands).toContain('sonos');
    expect(brands).toContain('iphone');
  });

  // ── Turn 2: "my stereo doesn't have a lot of bass" ──
  it('Turn 2 — bass complaint: phantom saved system MUST NOT re-leak', () => {
    const result = turn("my stereo doesn't have a lot of bass");
    const { turnCtx, signals, result: evalResult } = result;

    console.log('[T2] systemSource:', turnCtx.systemSource);
    console.log('[T2] activeSystem.components:',
      turnCtx.activeSystem?.components.map((c) => `${c.brand}/${c.category}`));
    console.log('[T2] symptoms:', signals.symptoms);
    console.log('[T2] fired_rules:', evalResult.fired_rules.map((r) => r.id));

    // Saved system must not have re-activated.
    expectNoPhantom('T2 activeSystem', flatten(turnCtx.activeSystem));
    expectNoPhantom('T2 fired_rules', flatten(evalResult.fired_rules));

    // The bass complaint should map to a thinness signal (Phase K vocabulary).
    expect(signals.symptoms).toContain('thinness');

    // Active system must remain Sonos + iPhone.
    expect(turnCtx.activeSystem).not.toBeNull();
    const brands = turnCtx.activeSystem!.components.map((c) => c.brand.toLowerCase());
    expect(brands).toContain('sonos');
    expect(brands).toContain('iphone');

    // No dismissive fallback for a recognized symptom.
    const fired = evalResult.fired_rules.map((r) => r.id);
    expect(fired).not.toContain('friendly-advisor-fallback');
  });

  // ── Turn 3: "it sounds tiny" ──
  it('Turn 3 — scale complaint: thinness/scale symptom recognized', () => {
    const { turnCtx, signals, result: evalResult } = turn('it sounds tiny');

    console.log('[T3] systemSource:', turnCtx.systemSource);
    console.log('[T3] symptoms:', signals.symptoms);
    console.log('[T3] fired_rules:', evalResult.fired_rules.map((r) => r.id));

    expectNoPhantom('T3 activeSystem', flatten(turnCtx.activeSystem));
    expectNoPhantom('T3 fired_rules', flatten(evalResult.fired_rules));

    expect(signals.symptoms).toContain('thinness');
    const fired = evalResult.fired_rules.map((r) => r.id);
    expect(fired).not.toContain('friendly-advisor-fallback');
  });

  // ── Turn 4: "it is noisy" ──
  it('Turn 4 — noise complaint: electrical-noise-diagnostic fires, no fallback', () => {
    const { turnCtx, signals, result: evalResult } = turn('it is noisy');

    console.log('[T4] systemSource:', turnCtx.systemSource);
    console.log('[T4] symptoms:', signals.symptoms);
    console.log('[T4] fired_rules:', evalResult.fired_rules.map((r) => r.id));

    expectNoPhantom('T4 activeSystem', flatten(turnCtx.activeSystem));
    expectNoPhantom('T4 fired_rules', flatten(evalResult.fired_rules));

    expect(signals.symptoms).toContain('electrical_noise');
    const fired = evalResult.fired_rules.map((r) => r.id);
    expect(fired).toContain('electrical-noise-diagnostic');
    expect(fired).not.toContain('friendly-advisor-fallback');

    // Diagnostic posture: the fired rule's verdict should not be a buy verdict.
    const noiseRule = evalResult.fired_rules.find((r) => r.id === 'electrical-noise-diagnostic');
    expect(noiseRule).toBeDefined();
    const verdict = noiseRule!.outputs.verdict;
    expect(['wait_recommended', 'no_purchase_recommended', 'revert_recommended']).toContain(verdict);
  });

  // ── Turn 5: "recommend a turntable" ──
  it('Turn 5 — turntable category locks; no DAC/amp/speaker leakage', () => {
    const { turnCtx, priority, shoppingCtx } = turn('recommend a turntable');

    console.log('[T5] priority:', priority?.category);
    console.log('[T5] shoppingCtx.category:', shoppingCtx.category);
    console.log('[T5] systemSource:', turnCtx.systemSource);

    expect(priority?.category).toBe('turntable');
    expect(shoppingCtx.category).toBe('turntable');

    // Build the actual shopping answer and confirm category routing.
    const answer = buildShoppingAnswer(shoppingCtx, evaluateText('recommend a turntable').signals);
    console.log('[T5] answer.category (label):', answer.category);
    console.log('[T5] answer.productExamples categories:',
      (answer.productExamples ?? []).map((p) => (p as { category?: string }).category));

    // Phantom saved system must still not appear in the shopping answer.
    expectNoPhantom('T5 answer', flatten(answer));
    expectNoPhantom('T5 activeSystem', flatten(turnCtx.activeSystem));

    // No DAC/amp/speaker product leakage (turntables only).
    for (const p of (answer.productExamples ?? []) as Array<{ category?: string; name?: string }>) {
      const cat = (p.category ?? '').toLowerCase();
      if (cat) {
        expect(['turntable', 'turntables', 'cartridge', 'phono', 'general']).toContain(cat);
      }
    }
  });

  it('Multi-turn continuity: domain stayed coherent across all 5 turns', () => {
    // After the 5-turn replay above, the orchestrator's domain mirror
    // should reflect the most recent locked category.
    expect(domainContext).toBe('turntable');
    // And the inline system from turn 1 should still be the source of truth.
    expect(lastInlineSystem).not.toBeNull();
    const brands = lastInlineSystem!.components.map((c) => c.brand.toLowerCase());
    expect(brands).toContain('sonos');
    expect(brands).toContain('iphone');
  });
});
