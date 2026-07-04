/**
 * Launch QA — regression tests for Launch Mode product-bug fixes.
 *
 * Each test pins a specific benchmark failure from
 * audit-2026-07-02/launch-qa (see ROOT-CAUSE.md) so the wrong behaviour
 * cannot silently return. Tests exercise the deterministic engine
 * exactly as the benchmark harness does: guest state, single turn.
 */
import { describe, it, expect } from 'vitest';
import { buildTurnContext } from '../turn-context';
import { buildSystemAssessment, buildConsultationResponse } from '../consultation';
import { detectIntent } from '../intent';
import { detectShoppingIntent, buildShoppingAnswer } from '../shopping-intent';
import { reason } from '../reasoning';
import type { AudioSessionState } from '../system-types';
import type { ExtractedSignals } from '../signal-types';

const EMPTY_SIGNALS: ExtractedSignals = {
  traits: {},
  symptoms: [],
  archetype_hints: [],
  uncertainty_level: 0.5,
  matched_phrases: [],
  matched_uncertainty_markers: [],
};

const GUEST_AUDIO_STATE: AudioSessionState = {
  activeSystemRef: { kind: 'none' } as AudioSessionState['activeSystemRef'],
  savedSystems: [],
  draftSystem: null,
  loading: false,
  proposedSystem: null,
};

function assess(prompt: string): string {
  const turnCtx = buildTurnContext(prompt, GUEST_AUDIO_STATE, new Set(), undefined);
  const result: any = buildSystemAssessment(
    prompt,
    turnCtx.subjectMatches,
    turnCtx.activeSystem,
    turnCtx.desires,
  );
  return JSON.stringify(result ?? {});
}

describe('SA-06 regression: constraint labels are direction-aware', () => {
  // The AHB2 leans detailed + controlled. Before the fix, constrainedAxes
  // rendered its own character poles as deficits: "limits inner detail
  // and texture and rhythmic flow and grip" — its strengths phrased as
  // what it takes away.
  it('never claims a detailed/controlled component limits inner detail or grip', () => {
    const text = assess('Assess my system: Magnepan 1.7i, Benchmark AHB2');
    expect(text).not.toMatch(/limits inner detail and texture and rhythmic flow and grip/i);
    expect(text).not.toMatch(/reduces inner detail and texture and rhythmic flow and grip/i);
    expect(text).not.toMatch(/(AHB2|ahb2)[^.]{0,40}limits inner detail/);
  });

  it('SA-05: a warm/elastic SET is never said to limit tonal weight or flow', () => {
    const text = assess('Assess my system: Klipsch Cornwall IV, Decware SE84UFO');
    expect(text).not.toMatch(/(SE84UFO|se84ufo|Se84ufo)[^.]{0,40}limits tonal weight/);
    expect(text).not.toMatch(/limits tonal weight and body and rhythmic flow and grip/i);
  });
});

describe('diagnosis-default regression: general questions reach the knowledge lane', () => {
  // Launch QA "diagnosis black hole" — 12 of 39 🔴. Any message matching
  // no pattern fell through to intent 'diagnosis' and beginner/philosophy
  // questions were answered with symptom triage ("does it sound thin,
  // digital, fatiguing?").
  const BLACK_HOLE_PROMPTS = [
    'Do cables actually matter?',
    'Is room treatment more important than electronics?',
    'What does speaker sensitivity mean?',
    'Are expensive speakers actually better?',
    'is class D finally good',
    'honestly just tell me if the LS50 meta is overhyped',
  ];
  for (const p of BLACK_HOLE_PROMPTS) {
    it(`"${p}" routes to the knowledge lane, not diagnosis`, () => {
      expect(detectIntent(p).intent).toBe('audio_knowledge');
    });
  }

  it('symptom language still routes to diagnosis', () => {
    expect(detectIntent('My system sounds bad and I do not know why').intent).toBe('diagnosis');
    expect(detectIntent('there is a hum coming from my speakers').intent).toBe('diagnosis');
  });

  it('active-system tuning fall-through is preserved', () => {
    expect(detectIntent('I want more warmth', { hasActiveSavedSystem: true }).intent).toBe('diagnosis');
  });
});

describe('NT-09 regression: colloquial budget language caps the shopping pool', () => {
  // "whats a good tube amp that wont blow up my budget" anchored on the
  // $20,000 Shindo Cortese — no numeric budget parsed, so no filtering
  // and no esoteric penalty fired. budgetConscious now caps the pool at
  // the affordability ceiling without fabricating a "$X" budget in copy.
  it('detects budget-consciousness from "wont blow up my budget"', () => {
    const ctx = detectShoppingIntent('whats a good tube amp that wont blow up my budget', EMPTY_SIGNALS);
    expect(ctx.budgetConscious).toBe(true);
    expect(ctx.budgetAmount).toBeNull();
  });

  it('never recommends a product over the affordability ceiling', () => {
    const q = 'whats a good tube amp that wont blow up my budget';
    const ctx = detectShoppingIntent(q, EMPTY_SIGNALS);
    const reasoning = reason(q, [], EMPTY_SIGNALS, null, ctx, null);
    const answer: any = buildShoppingAnswer(ctx, EMPTY_SIGNALS, undefined, reasoning);
    const prices = (answer.productExamples ?? [])
      .map((p: any) => p.price)
      .filter((p: any) => typeof p === 'number');
    expect(prices.length).toBeGreaterThan(0);
    for (const price of prices) expect(price).toBeLessThanOrEqual(3000);
  });

  it('numeric budgets still take precedence over the colloquial flag', () => {
    const ctx = detectShoppingIntent('best dac under $1000', EMPTY_SIGNALS);
    expect(ctx.budgetAmount).toBe(1000);
    expect(ctx.budgetConscious).toBe(false);
  });
});

describe('PH-05/NT-01 regression: generic words never resolve to a catalog product', () => {
  // The WiiM product's catalog name is literally "Amp"; bare substring
  // matching in findProductsByBrand resolved any sentence containing
  // "amp" to the WiiM AMP product sheet — a product the user never
  // mentioned. Generic-vocabulary and bare-numeral names now require the
  // brand in the text.
  function consult(prompt: string) {
    const turnCtx = buildTurnContext(prompt, GUEST_AUDIO_STATE, new Set(), undefined);
    return buildConsultationResponse(prompt, turnCtx.subjectMatches);
  }

  it('"not sure if it\'s the amp" does not return a WiiM product sheet', () => {
    const c: any = consult("ok so I have about $1500 and my system sounds kind of lifeless, not sure if it's the amp or what");
    expect(JSON.stringify(c ?? {})).not.toMatch(/wiim/i);
  });

  it('"why do tube amps sound different" does not return a product sheet', () => {
    const c: any = consult('Why do tube amps sound different from solid state?');
    expect(JSON.stringify(c ?? {})).not.toMatch(/wiim/i);
  });

  it('explicit product mentions still resolve', () => {
    const wiim: any = consult('thoughts on the WiiM Amp');
    expect(JSON.stringify(wiim ?? {})).toMatch(/wiim/i);
    const node: any = consult('what do you think of the Bluesound Node');
    expect(JSON.stringify(node ?? {})).toMatch(/bluesound/i);
  });
});
