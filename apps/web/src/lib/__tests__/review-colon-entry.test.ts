/**
 * Colon-list entry routing (beta observation, 2026-08-03).
 *
 * Production escape: the founder typed
 *   "review: Job integrated · WLM Diva monitor · Eversolo DMP-A6 · Chord Hugo"
 * and got GEAR COMPARISON instead of a system assessment. Two gaps:
 * bare leading "review:" was not assessment language, and the
 * interpunct (·) — the exact separator the saved-system chip renders —
 * was not a chain separator. These tests pin the fix and the
 * neighbouring intents that must NOT move.
 */
import { describe, it, expect } from 'vitest';
import { detectIntent } from '../intent';

const FOUNDER_MESSAGE =
  'review: Job integrated · WLM Diva monitor · Eversolo DMP-A6 · Chord Hugo';

describe('colon-list entry — leading evaluation verb', () => {
  it('the founder message routes to system_assessment (anonymous)', () => {
    expect(detectIntent(FOUNDER_MESSAGE).intent).toBe('system_assessment');
  });

  it('the founder message routes to system_assessment (active saved system)', () => {
    expect(
      detectIntent(FOUNDER_MESSAGE, { hasActiveSavedSystem: true }).intent,
    ).toBe('system_assessment');
  });

  it('other leading verbs work: "rate: …" with two components', () => {
    expect(
      detectIntent('rate: Denafrips Pontus II · Leben CS600X').intent,
    ).toBe('system_assessment');
  });

  it('bullet separator (•) also reads as a chain', () => {
    expect(
      detectIntent('review: Denafrips Pontus II • Leben CS600X • DeVore O/96').intent,
    ).toBe('system_assessment');
  });
});

describe('colon-list entry — neighbouring intents unchanged', () => {
  it('explicit comparisons still compare', () => {
    const r = detectIntent("what's the real trade-off between Chord and Denafrips?");
    expect(r.intent).not.toBe('system_assessment');
  });

  it('"X vs Y" still compares', () => {
    const r = detectIntent('Chord Qutest vs Denafrips Pontus II');
    expect(r.intent).not.toBe('system_assessment');
  });

  it('mid-sentence "review:" does not trigger (anchored pattern)', () => {
    const r = detectIntent('I read a review: the Chord Qutest is fast sounding');
    expect(r.intent).not.toBe('system_assessment');
  });

  it('canonical "Assess my system: …" unchanged', () => {
    expect(
      detectIntent('Assess my system: Denafrips Pontus II, Leben CS600X, DeVore O/96').intent,
    ).toBe('system_assessment');
  });
});
