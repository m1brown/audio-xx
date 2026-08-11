import { describe, it, expect } from 'vitest';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { extractDesires } from '../intent';
import { reason } from '../reasoning';
import { AMPLIFIER_PRODUCTS } from '../products/amplifiers';
import type { ExtractedSignals } from '../signal-types';

/** Minimal heuristic signals (mirrors qa-full-pass helper). */
function buildSignalsFromText(text: string): ExtractedSignals {
  const traits: Record<string, 'up' | 'down'> = {};
  if (/warm|rich|tube|thick|body|lush/i.test(text)) traits['tonal_density'] = 'up';
  if (/dynamic|punch|slam|impact/i.test(text)) traits['dynamics'] = 'up';
  return {
    traits: traits as ExtractedSignals['traits'],
    symptoms: [],
    archetype_hints: [],
    uncertainty_level: 0,
    matched_phrases: [],
    matched_uncertainty_markers: [],
  };
}

/**
 * M5-F4 (Mission 5, 2026-08-11 overnight) — the contradictory buyer must
 * get the contradiction, not a fabricated fit.
 *
 * Live repro (production, persona D): "i want a tube amp with zero heat,
 * shoebox sized, that can drive my magnepan lrs+ with huge dynamics.
 * budget 1500 max" → PRIMARY RECOMMENDATION: Quad VA-One+ (15W push-pull
 * EL84) — a textbook power mismatch for the LRS+ (~86dB planar load) —
 * with no conflict flagged anywhere.
 *
 * Root cause: the pairing power-plausibility filter (launch gate
 * 2026-07-19) bails out silently when fewer than two plausible amps
 * survive (`powerPlausible.length >= 2`). Constraint conflicts collapse
 * the plausible set — which is exactly when honesty matters most. The
 * guard converted "your constraints conflict" into "here is an absurd
 * pick, presented confidently."
 *
 * Repair: the filter applies whenever ANY plausible candidate exists,
 * and when the plausible set is thin or empty the answer carries a
 * power-mismatch systemNote naming the conflict.
 *
 * Rule encoded: a physics constraint never yields to a ranking
 * convenience guard; when constraints conflict, say so.
 */

function run(text: string) {
  const signals = buildSignalsFromText(text);
  const desires = extractDesires(text);
  const ctx = detectShoppingIntent(text, signals, [], undefined);
  const reasoning = reason(text, desires, signals, null, ctx, undefined);
  return buildShoppingAnswer(ctx, signals, undefined, reasoning, []);
}

const CONTRADICTORY =
  'i want a tube amp with zero heat, shoebox sized, that can drive my magnepan lrs+ with huge dynamics. budget 1500 max';

function isImplausibleForPlanars(name: string): boolean {
  const p = AMPLIFIER_PRODUCTS.find(
    (x) => name.toLowerCase().includes(x.name.toLowerCase()) || x.name.toLowerCase().includes(name.toLowerCase()),
  ) as { topology?: string; power_watts?: number } | undefined;
  if (!p) return false;
  const topo = (p.topology ?? '').toLowerCase();
  if (topo.includes('set') || topo.includes('single-ended')) return true;
  return typeof p.power_watts === 'number' && p.power_watts < 40;
}

describe('planar load + conflicting constraints → honesty, not fabrication', () => {
  it('no low-watt tube leads the recommendations without a mismatch note', () => {
    const answer = run(CONTRADICTORY);
    const primary = answer.productExamples[0];
    const primaryImplausible = primary ? isImplausibleForPlanars(primary.name) : false;
    const note = `${answer.systemNote ?? ''} ${answer.watchFor.join(' ')}`;
    const flagsMismatch = /power|drive|sensitivit|watt|demand|current/i.test(note)
      && /magnepan|planar|lrs|load/i.test(note);
    // Either the picks respect the load, or the conflict is stated. Both
    // silent AND implausible is the failure.
    expect(primaryImplausible && !flagsMismatch).toBe(false);
  });

  it('control: an easy load keeps low-watt tubes eligible', () => {
    const answer = run('warm tube amp for my klipsch heresy, budget 1500');
    expect(answer.productExamples.length).toBeGreaterThan(0);
  });
});
